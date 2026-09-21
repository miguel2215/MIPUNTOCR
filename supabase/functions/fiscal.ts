import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta la variable segura ${name}`);
  return value;
}

export function userClient(req: Request) {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    auth: { persistSession: false },
  });
}

export function serviceClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

export async function requireOwner(req: Request, businessId: string) {
  const client = userClient(req);
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sesión no válida.');
  const uid = authData.user.id;
  const service = serviceClient();
  const { data: business, error: bErr } = await service
    .from('businesses')
    .select('id, owner_user_id')
    .eq('id', businessId)
    .maybeSingle();
  if (bErr || !business) throw new Error('Negocio no encontrado.');
  if (business.owner_user_id === uid) return { user: authData.user, service };
  const { data: member } = await service
    .from('business_members')
    .select('role, active')
    .eq('business_id', businessId)
    .eq('user_id', uid)
    .eq('active', true)
    .maybeSingle();
  if (!member || !['owner', 'admin'].includes(String(member.role || '').toLowerCase())) {
    throw new Error('Solo el Dueño puede administrar la conexión fiscal.');
  }
  return { user: authData.user, service };
}

function bytesToB64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function b64ToBytes(value: string) {
  const raw = atob(value);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function encryptionKey() {
  const raw = new TextEncoder().encode(env('FISCAL_MASTER_KEY'));
  const digest = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecrets(payload: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return { payload_ciphertext: bytesToB64(new Uint8Array(encrypted)), iv: bytesToB64(iv), key_version: 'v1' };
}

export async function decryptSecrets(row: { payload_ciphertext: string; iv: string }) {
  const key = await encryptionKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(row.iv) },
    key,
    b64ToBytes(row.payload_ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

export function haciendaConfig(environment: 'sandbox' | 'production') {
  if (environment === 'production') {
    return {
      tokenUrl: 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token',
      clientId: 'api-prod',
      apiBase: 'https://api.comprobanteselectronicos.go.cr/recepcion/v1',
    };
  }
  return {
    tokenUrl: 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token',
    clientId: 'api-stag',
    apiBase: 'https://api.comprobanteselectronicos.go.cr/recepcion-sandbox/v1',
  };
}

export async function haciendaToken(environment: 'sandbox' | 'production', username: string, password: string) {
  const cfg = haciendaConfig(environment);
  const form = new URLSearchParams();
  form.set('client_id', cfg.clientId);
  form.set('grant_type', 'password');
  form.set('username', username);
  form.set('password', password);
  // Scope se omite: Hacienda endureció la validación y no acepta scope vacío.
  const response = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const text = await response.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok || !body.access_token) {
    throw new Error(`Hacienda OAuth ${response.status}: ${body.error_description || body.error || 'credenciales no válidas'}`);
  }
  return { accessToken: body.access_token as string, expiresIn: Number(body.expires_in || 0), config: cfg };
}
