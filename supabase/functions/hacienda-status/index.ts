import { corsHeaders, json, requireOwner } from '../_shared/fiscal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { business_id } = await req.json();
    if (!business_id) return json({ error: 'business_id requerido' }, 400);
    const { service } = await requireOwner(req, business_id);
    const { data, error } = await service
      .from('fiscal_secret_envelopes')
      .select('environment, updated_at')
      .eq('business_id', business_id)
      .eq('environment', 'sandbox')
      .maybeSingle();
    if (error) throw error;
    return json({ connected: !!data, environment: data?.environment || 'sandbox', updated_at: data?.updated_at || null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 401);
  }
});
