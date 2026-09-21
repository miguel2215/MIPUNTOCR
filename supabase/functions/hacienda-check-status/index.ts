import { corsHeaders, decryptSecrets, haciendaToken, json, requireOwner } from '../_shared/fiscal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { business_id, clave } = body;
    const environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (environment === 'production') return json({ error: 'Producción está bloqueada durante PRE-BETA.' }, 409);
    if (!business_id || !clave) return json({ error: 'business_id y clave son requeridos.' }, 400);
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
    if (!response.ok) return json({ error: `Hacienda ${response.status}`, detail: result }, response.status);
    return json({ ok: true, result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
