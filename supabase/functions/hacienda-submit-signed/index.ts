import { corsHeaders, decryptSecrets, haciendaToken, json, requireOwner } from '../shared/fiscal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { business_id, clave, fecha, emisor, receptor, comprobanteXml } = body;
    const environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (environment === 'production') return json({ error: 'Producción está bloqueada durante PRE-BETA.' }, 409);
    if (!business_id || !clave || !fecha || !emisor || !comprobanteXml) return json({ error: 'Faltan datos del comprobante firmado.' }, 400);
    const { service } = await requireOwner(req, business_id);
    const { data: row, error } = await service.from('fiscal_secret_envelopes')
      .select('payload_ciphertext, iv').eq('business_id', business_id).eq('environment', environment).maybeSingle();
    if (error) throw error;
    if (!row) return json({ error: 'Negocio no conectado con Hacienda.' }, 404);
    const secrets = await decryptSecrets(row);
    const token = await haciendaToken(environment, secrets.username, secrets.password);
    const payload: Record<string, unknown> = { clave, fecha, emisor, comprobanteXml };
    if (receptor?.numeroIdentificacion) payload.receptor = receptor;
    const response = await fetch(`${token.config.apiBase}/recepcion`, {
      method: 'POST',
      headers: { 'Authorization': `bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (![200, 201, 202].includes(response.status)) return json({ error: `Hacienda ${response.status}`, detail: text || response.headers.get('X-Error-Cause') }, response.status);
    return json({ ok: true, status: response.status, location: response.headers.get('Location') || null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
