import { corsHeaders, decryptSecrets, haciendaToken, json, requireOwner } from '../_shared/fiscal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { business_id } = body;
    const environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (environment === 'production') return json({ error: 'Producción está bloqueada durante PRE-BETA.' }, 409);
    if (!business_id) return json({ error: 'business_id requerido' }, 400);
    const { service } = await requireOwner(req, business_id);
    const { data: row, error } = await service
      .from('fiscal_secret_envelopes')
      .select('payload_ciphertext, iv')
      .eq('business_id', business_id)
      .eq('environment', environment)
      .maybeSingle();
    if (error) throw error;
    if (!row) return json({ error: 'Todavía no hay credenciales protegidas para este negocio.' }, 404);
    const secrets = await decryptSecrets(row);
    const token = await haciendaToken(environment, secrets.username, secrets.password);
    return json({ ok: true, environment, expires_in: token.expiresIn });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
