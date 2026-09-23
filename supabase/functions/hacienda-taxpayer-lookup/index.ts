import {
  corsHeaders,
  json,
  requireBusinessMember,
} from '../shared/fiscal.ts';

const HACIENDA_AE = 'https://api.hacienda.go.cr/fe/ae';
const CACHE_HOURS = 24;

function cleanIdentification(value: unknown) {
  return String(value || '').replace(/\D+/g, '');
}

function normalizeActivities(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => ({
    code: String(item?.codigo ?? item?.code ?? item?.codigoActividad ?? '').trim(),
    description: String(item?.descripcion ?? item?.description ?? item?.nombre ?? '').trim(),
  })).filter((item) => item.code || item.description);
}

function normalizeHacienda(data: any, identification: string) {
  return {
    identification,
    name: String(data?.nombre || '').trim(),
    idType: String(data?.tipoIdentificacion || '').trim(),
    regime: data?.regimen || null,
    situation: data?.situacion || null,
    activities: normalizeActivities(data?.actividades),
  };
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
try {
    const body = await req.json();
    const businessId = String(body?.business_id || '').trim();
    const identification = cleanIdentification(body?.identificacion);

    if (!businessId) return json({ error: 'business_id requerido.' }, 400);
    if (!/^\d{9,12}$/.test(identification)) {
      return json({ error: 'La identificación debe contener entre 9 y 12 dígitos.' }, 400);
    }

    const { service } = await requireBusinessMember(req, businessId);

    // Cache compartida: Hacienda recomienda evitar consultas repetitivas.
    try {
      const { data: cached } = await service
        .from('taxpayer_lookup_cache')
        .select('payload, fetched_at')
        .eq('identification', identification)
        .maybeSingle();

      if (cached?.payload && cached?.fetched_at) {
        const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
        if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < CACHE_HOURS * 60 * 60 * 1000) {
          return json({ ...cached.payload, source: 'cache', fetched_at: cached.fetched_at });
        }
      }
    } catch (cacheReadError) {
      console.warn('Cache fiscal no disponible todavía:', cacheReadError);
    }

    const url = `${HACIENDA_AE}?identificacion=${encodeURIComponent(identification)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (response.status === 404) return json({ error: 'Identificación no encontrada en Hacienda.' }, 404);
    if (response.status === 429) return json({ error: 'Hacienda limitó temporalmente las consultas. Intenta de nuevo más tarde.' }, 429);

    const text = await response.text();
    let raw: any = null;
    try { raw = JSON.parse(text); } catch { raw = null; }

    if (!response.ok || !raw) {
      return json({ error: `Hacienda respondió ${response.status}.` }, response.status || 502);
    }

    const normalized = normalizeHacienda(raw, identification);
    if (!normalized.name) return json({ error: 'Hacienda no devolvió datos identificativos.' }, 404);

    const fetchedAt = new Date().toISOString();
    try {
      await service.from('taxpayer_lookup_cache').upsert({
        identification,
        payload: normalized,
        fetched_at: fetchedAt,
        updated_at: fetchedAt,
      }, { onConflict: 'identification' });
    } catch (cacheWriteError) {
      console.warn('No se pudo actualizar cache fiscal:', cacheWriteError);
    }

    return json({ ...normalized, source: 'hacienda', fetched_at: fetchedAt });
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método no permitido." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json().catch(() => ({}));
    const codigo = String(body?.codigo || "").replace(/\D/g, "").slice(0, 13);
    const q = String(body?.q || "").trim();
    const top = Math.min(30, Math.max(1, Number(body?.top || 30)));
    if (!codigo && q.length < 3) return new Response(JSON.stringify({ error: "Indica un CAByS o una búsqueda de al menos 3 caracteres." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const url = codigo
      ? `https://api.hacienda.go.cr/fe/cabys?codigo=${encodeURIComponent(codigo)}`
      : `https://api.hacienda.go.cr/fe/cabys?q=${encodeURIComponent(q)}&top=${top}`;
    const upstream = await fetch(url, { headers: { "Accept": "application/json", "User-Agent": "PUNTO-YA-CR/1.0" } });
    if (upstream.status === 429) return new Response(JSON.stringify({ error: "Hacienda limitó temporalmente las consultas. Espera un momento e intenta de nuevo." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const text = await upstream.text();
    if (!upstream.ok) return new Response(JSON.stringify({ error: `Hacienda respondió ${upstream.status}.` }), { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": upstream.headers.get("content-type") || "application/json", "Cache-Control": "public, max-age=3600" } });
} catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error consultando CAByS." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
});
