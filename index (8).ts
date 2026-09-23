import { corsHeaders, decryptSecrets, haciendaToken, json, requireOwner } from '../shared/fiscal.ts';

const FISCAL_STATES = new Set(['recibido', 'procesando', 'aceptado', 'rechazado', 'error']);

function decodeBase64Utf8(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const raw = atob(value);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

async function persistHaciendaStatus(service: any, businessId: string, clave: string, result: any) {
  const rawState = String(result?.['ind-estado'] || '').toLowerCase();
  if (!FISCAL_STATES.has(rawState)) return { stored: false, warning: 'Hacienda no devolvió un estado fiscal reconocido.' };

  const terminal = ['aceptado', 'rechazado', 'error'].includes(rawState);
  const responseXml = decodeBase64Utf8(result?.['respuesta-xml']);
  const values: Record<string, unknown> = {
    status: rawState,
    response_xml: responseXml,
    error_message: rawState === 'rechazado' || rawState === 'error' ? `Estado Hacienda: ${rawState}` : null,
    updated_at: new Date().toISOString(),
  };
  if (terminal) values.answered_at = new Date().toISOString();

  const { data, error } = await service
    .from('fiscal_documents')
    .update(values)
    .eq('business_id', businessId)
    .eq('clave', clave)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return { stored: !!data?.id, id: data?.id || null, fiscal_status: rawState };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { business_id, clave } = body;
    const environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (environment === 'production') return json({ error: 'La emisión en producción permanece bloqueada hasta completar las pruebas con Hacienda.' }, 409);
    if (!business_id || !clave) return json({ error: 'business_id y clave son requeridos.' }, 400);
    if (!/^\d{50}$/.test(String(clave))) return json({ error: 'La clave del comprobante debe contener 50 dígitos.' }, 400);

    const { service } = await requireOwner(req, business_id);
    const { data: row, error } = await service.from('fiscal_secret_envelopes')
      .select('payload_ciphertext, iv').eq('business_id', business_id).eq('environment', environment).maybeSingle();
    if (error) throw error;
    if (!row) return json({ error: 'Negocio no conectado con Hacienda.' }, 404);

    const secrets = await decryptSecrets(row);
    const token = await haciendaToken(environment, secrets.username, secrets.password);
    const response = await fetch(`${token.config.apiBase}/recepcion/${encodeURIComponent(clave)}`, {
      headers: { 'Authorization': `bearer ${token.accessToken}` },
    });
    const text = await response.text();
    let result: unknown = text;
    try { result = JSON.parse(text); } catch {}
    const errorCause = response.headers.get('X-Error-Cause') || '';
    if (!response.ok) {
      const temporary = [502, 503, 504].includes(response.status);
      console.error('Hacienda consulta de estado falló', {
        environment,
        hacienda_status: response.status,
        temporary,
        error_cause: errorCause,
        response_text: text,
        clave: String(clave),
      });
      // 502/503/504 son fallos temporales de infraestructura. El comprobante ya
      // enviado conserva su misma clave/consecutivo y permanece pendiente; el POS
      // puede volver a consultar sin emitir otro documento.
      if (temporary) {
        return json({
          ok: true,
          pending: true,
          temporary: true,
          fiscal_status: 'pendiente',
          hacienda_status: response.status,
          message: 'Hacienda no respondió temporalmente. El comprobante conserva su clave y puede consultarse nuevamente.',
        });
      }
      return json({ error: `Hacienda ${response.status}`, hacienda_status: response.status, detail: result }, response.status);
    }

    const fiscalState = String((result as any)?.['ind-estado'] || '').toLowerCase();
    const responseXml = decodeBase64Utf8((result as any)?.['respuesta-xml']);
    if (fiscalState === 'rechazado' || fiscalState === 'error') {
      // Diagnóstico SANDBOX: registra la respuesta fiscal de Hacienda, pero nunca
      // credenciales, access_token, P12 ni PIN. El XML de respuesta es el mensaje
      // oficial de Hacienda y permite identificar la validación exacta que falló.
      console.error('Hacienda estado fiscal terminal', {
        environment,
        hacienda_status: response.status,
        fiscal_status: fiscalState,
        error_cause: errorCause,
        respuesta_xml: responseXml || '',
        clave: String(clave),
      });
    } else {
      console.log('Hacienda estado fiscal', {
        environment,
        hacienda_status: response.status,
        fiscal_status: fiscalState || 'sin_estado',
        clave: String(clave),
      });
    }

    let storage: Record<string, unknown> = { stored: false };
    try {
      storage = await persistHaciendaStatus(service, business_id, clave, result);
    } catch (storageError) {
      storage = {
        stored: false,
        warning: storageError instanceof Error ? storageError.message : String(storageError),
      };
    }

    return json({ ok: true, result, ...storage });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
