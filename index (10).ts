import {
  corsHeaders,
  encryptSecrets,
  json,
  requireOwner,
} from '../shared/fiscal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const {
      business_id,
      username,
      password,
      pin,
      p12_base64,
    } = body;

    const environment =
      body.environment === 'production'
        ? 'production'
        : 'sandbox';

    /*
     * PRE-BETA:
     * Producción permanece bloqueada.
     */
    if (environment === 'production') {
      return json(
        {
          error:
            'Producción está bloqueada durante PRE-BETA.',
        },
        409,
      );
    }

    /*
     * Validación de datos requeridos.
     */
    if (
      !business_id ||
      !username ||
      !password ||
      !pin ||
      !p12_base64
    ) {
      return json(
        {
          error:
            'Faltan datos fiscales seguros.',
        },
        400,
      );
    }

    /*
     * Evitar cargas excesivas.
     */
    if (
      String(p12_base64).length >
      2_500_000
    ) {
      return json(
        {
          error:
            'Archivo .p12 demasiado grande.',
        },
        413,
      );
    }

    /*
     * Solo el Dueño puede guardar
     * o modificar las credenciales fiscales.
     */
    const {
      user,
      service,
    } = await requireOwner(
      req,
      business_id,
    );

    /*
     * Cifrar:
     * - usuario Hacienda
     * - contraseña Hacienda
     * - PIN .p12
     * - certificado .p12
     *
     * Nunca se guardan en texto plano.
     */
    const encrypted =
      await encryptSecrets({
        username,
        password,
        pin,
        p12_base64,
      });

    /*
     * Guardar el sobre cifrado.
     *
     * Debe existir:
     * public.fiscal_secret_envelopes
     */
    const {
      error,
    } = await service
      .from(
        'fiscal_secret_envelopes',
      )
      .upsert(
        {
          business_id,
          environment,

          ...encrypted,

          created_by:
            user.id,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'business_id,environment',
        },
      );

    if (error) {
      throw error;
    }

    /*
     * No devolvemos ningún secreto
     * al navegador.
     */
    return json({
      ok: true,

      message:
        'Credenciales cifradas y guardadas. Ningún secreto fue devuelto al navegador.',
    });
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error
            ? e.message
            : String(e),
      },
      400,
    );
  }
});