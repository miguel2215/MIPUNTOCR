const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({
        ok: false,
        error: "Método no permitido.",
      });
    }

    const body = await req.json().catch(() => ({}));

    const codigo = String(body?.codigo || "")
      .replace(/\D/g, "")
      .slice(0, 13);

    const q = String(body?.q || "").trim();

    const top = Math.min(
      30,
      Math.max(1, Number(body?.top || 30))
    );

    if (!codigo && q.length < 3) {
      return jsonResponse({
        ok: false,
        error:
          "Indica un CAByS o una búsqueda de al menos 3 caracteres.",
      });
    }

    const url = codigo
      ? `https://api.hacienda.go.cr/fe/cabys?codigo=${encodeURIComponent(codigo)}`
      : `https://api.hacienda.go.cr/fe/cabys?q=${encodeURIComponent(q)}&top=${top}`;

    console.log("Consultando CAByS:", {
      tipo: codigo ? "codigo" : "texto",
      valor: codigo || q,
      url,
    });

    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const text = await upstream.text();

    console.log("Respuesta Hacienda:", {
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      bodyPreview: text.slice(0, 500),
    });

    if (!upstream.ok) {
      return jsonResponse({
        ok: false,
        error: `Hacienda respondió ${upstream.status}.`,
        hacienda_status: upstream.status,
        detail: text.slice(0, 500),
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return jsonResponse({
        ok: false,
        error: "Hacienda devolvió una respuesta que no es JSON.",
        detail: text.slice(0, 500),
      });
    }

    return jsonResponse(data);

  } catch (error) {
    console.error("Error hacienda-cabys-lookup:", error);

    return jsonResponse({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Error consultando CAByS.",
    });
  }
});
