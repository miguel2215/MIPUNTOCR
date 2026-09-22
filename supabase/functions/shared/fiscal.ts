import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export function env(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Falta la variable segura ${name}`);
  }

  return value;
}


/* =========================================================
   SUPABASE CLIENT DEL USUARIO
   ========================================================= */

export function userClient(req: Request) {
  return createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_ANON_KEY'),
    {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        },
      },
      auth: {
        persistSession: false,
      },
    },
  );
}


/* =========================================================
   SUPABASE SERVICE ROLE
   SOLO SE UTILIZA DENTRO DE EDGE FUNCTIONS
   ========================================================= */

export function serviceClient() {
  return createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
      },
    },
  );
}


/* =========================================================
   VALIDAR DUEÑO DEL NEGOCIO

   La conexión fiscal de Hacienda solamente puede ser
   administrada por el DUEÑO.

   Un empleado o administrador NO puede:
   - guardar credenciales
   - cambiar credenciales
   - manipular la llave fiscal
   - modificar configuración Hacienda
   ========================================================= */

export async function requireOwner(
  req: Request,
  businessId: string,
) {
  if (!businessId) {
    throw new Error('Negocio no especificado.');
  }

  const client = userClient(req);

  const {
    data: authData,
    error: authError,
  } = await client.auth.getUser();

  if (authError || !authData.user) {
    throw new Error('Sesión no válida.');
  }

  const uid = authData.user.id;

  const service = serviceClient();

  const {
    data: business,
    error: businessError,
  } = await service
    .from('businesses')
    .select('id, owner_user_id')
    .eq('id', businessId)
    .maybeSingle();

  if (businessError) {
    throw new Error('No fue posible consultar el negocio.');
  }

  if (!business) {
    throw new Error('Negocio no encontrado.');
  }

  /*
   * Dueño principal registrado directamente
   * en businesses.owner_user_id
   */
  if (business.owner_user_id === uid) {
    return {
      user: authData.user,
      service,
    };
  }

  /*
   * Compatibilidad por si el dueño también se encuentra
   * registrado en business_members.
   */
  const {
    data: member,
    error: memberError,
  } = await service
    .from('business_members')
    .select('role, active')
    .eq('business_id', businessId)
    .eq('user_id', uid)
    .eq('active', true)
    .maybeSingle();

  if (memberError) {
    throw new Error(
      'No fue posible comprobar los permisos del negocio.',
    );
  }

  /*
   * IMPORTANTE:
   * Solo OWNER.
   * ADMIN no puede administrar Hacienda.
   */
  if (
    !member ||
    String(member.role || '').toLowerCase() !== 'owner'
  ) {
    throw new Error(
      'Solo el Dueño puede administrar la conexión fiscal.',
    );
  }

  return {
    user: authData.user,
    service,
  };
}


/* =========================================================
   VALIDAR MIEMBRO ACTIVO DEL NEGOCIO

   Usado por consultas operativas no sensibles, por ejemplo
   buscar los datos públicos de un receptor para facturación.
   Dueño, administrador o empleado activo pueden consultar.
   ========================================================= */

export async function requireBusinessMember(
  req: Request,
  businessId: string,
) {
  if (!businessId) throw new Error('Negocio no especificado.');

  const client = userClient(req);
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sesión no válida.');

  const uid = authData.user.id;
  const service = serviceClient();
  const { data: business, error: businessError } = await service
    .from('businesses')
    .select('id, owner_user_id')
    .eq('id', businessId)
    .maybeSingle();

  if (businessError) throw new Error('No fue posible consultar el negocio.');
  if (!business) throw new Error('Negocio no encontrado.');
  if (business.owner_user_id === uid) return { user: authData.user, service, role: 'owner' };

  const { data: member, error: memberError } = await service
    .from('business_members')
    .select('role, active')
    .eq('business_id', businessId)
    .eq('user_id', uid)
    .eq('active', true)
    .maybeSingle();

  if (memberError) throw new Error('No fue posible comprobar los permisos del negocio.');
  if (!member) throw new Error('No tienes acceso a este negocio.');

  return {
    user: authData.user,
    service,
    role: String(member.role || 'employee').toLowerCase(),
  };
}


/* =========================================================
   BASE64
   ========================================================= */

function bytesToB64(bytes: Uint8Array) {
  let result = '';

  for (
    let i = 0;
    i < bytes.length;
    i += 0x8000
  ) {
    result += String.fromCharCode(
      ...bytes.subarray(i, i + 0x8000),
    );
  }

  return btoa(result);
}


function b64ToBytes(value: string) {
  const raw = atob(value);

  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}


/* =========================================================
   LLAVE MAESTRA DE CIFRADO

   IMPORTANTE:
   FISCAL_MASTER_KEY debe existir únicamente como
   secreto de Supabase.

   Nunca:
   - GitHub
   - HTML
   - JavaScript público
   - localStorage
   ========================================================= */

async function encryptionKey() {
  const raw = new TextEncoder().encode(
    env('FISCAL_MASTER_KEY'),
  );

  const digest = await crypto.subtle.digest(
    'SHA-256',
    raw,
  );

  return crypto.subtle.importKey(
    'raw',
    digest,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}


/* =========================================================
   CIFRAR CREDENCIALES FISCALES
   ========================================================= */

export async function encryptSecrets(
  payload: unknown,
) {
  const iv = crypto.getRandomValues(
    new Uint8Array(12),
  );

  const key = await encryptionKey();

  const plain = new TextEncoder().encode(
    JSON.stringify(payload),
  );

  const encrypted =
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      plain,
    );

  return {
    payload_ciphertext: bytesToB64(
      new Uint8Array(encrypted),
    ),
    iv: bytesToB64(iv),
    key_version: 'v1',
  };
}


/* =========================================================
   DESCIFRAR CREDENCIALES FISCALES
   ========================================================= */

export async function decryptSecrets(
  row: {
    payload_ciphertext: string;
    iv: string;
  },
) {
  const key = await encryptionKey();

  const plain =
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: b64ToBytes(row.iv),
      },
      key,
      b64ToBytes(row.payload_ciphertext),
    );

  return JSON.parse(
    new TextDecoder().decode(plain),
  );
}


/* =========================================================
   CONFIGURACIÓN HACIENDA
   ========================================================= */

export function haciendaConfig(
  environment: 'sandbox' | 'production',
) {
  /*
   * PRODUCCIÓN
   */
  if (environment === 'production') {
    return {
      environment: 'production',

      tokenUrl:
        'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token',

      clientId:
        'api-prod',

      apiBase:
        'https://api.comprobanteselectronicos.go.cr/recepcion/v1',
    };
  }

  /*
   * AMBIENTE DE PRUEBAS
   */
  return {
    environment: 'sandbox',

    tokenUrl:
      'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token',

    clientId:
      'api-stag',

    apiBase:
      'https://api.comprobanteselectronicos.go.cr/recepcion-sandbox/v1',
  };
}


/* =========================================================
   OAUTH HACIENDA

   Obtiene el access_token utilizado posteriormente
   para enviar o consultar comprobantes electrónicos.
   ========================================================= */

export async function haciendaToken(
  environment: 'sandbox' | 'production',
  username: string,
  password: string,
) {
  if (!username) {
    throw new Error(
      'Falta el usuario de Hacienda.',
    );
  }

  if (!password) {
    throw new Error(
      'Falta la contraseña de Hacienda.',
    );
  }

  const config =
    haciendaConfig(environment);

  const form = new URLSearchParams();

  form.set(
    'client_id',
    config.clientId,
  );

  form.set(
    'grant_type',
    'password',
  );

  form.set(
    'username',
    username,
  );

  form.set(
    'password',
    password,
  );

  /*
   * No enviar scope vacío.
   */

  const response = await fetch(
    config.tokenUrl,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },

      body: form.toString(),
    },
  );

  const responseText =
    await response.text();

  let body: any = {};

  try {
    body = JSON.parse(responseText);
  } catch {
    body = {
      raw: responseText,
    };
  }

  if (
    !response.ok ||
    !body.access_token
  ) {
    throw new Error(
      `Hacienda OAuth ${response.status}: ${
        body.error_description ||
        body.error ||
        'credenciales no válidas'
      }`,
    );
  }

  return {
    accessToken:
      body.access_token as string,

    expiresIn:
      Number(body.expires_in || 0),

    tokenType:
      body.token_type || 'bearer',

    config,
  };
}