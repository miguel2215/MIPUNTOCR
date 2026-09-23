const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error consultando CAByS." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
