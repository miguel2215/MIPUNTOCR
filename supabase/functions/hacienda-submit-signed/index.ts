import { corsHeaders, decryptSecrets, haciendaToken, json, requireOwner } from '../shared/fiscal.ts';

function decodeBase64Utf8(value: string) {
  try {
    const raw = atob(value);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

async function storeSentDocument(
  service: any,
  userId: string,
  body: Record<string, any>,
  environment: 'sandbox' | 'production',
  location: string | null,
) {
  const businessId = String(body.business_id || '');
  const clave = String(body.clave || '');
  const explicitType = String(body.document_type || '').padStart(2, '0');
  const consecutivo = String(body.consecutivo || '');
  const inferredType = /^\d{20}$/.test(consecutivo) ? consecutivo.slice(8, 10) : '';
  const documentType = explicitType && /^\d{2}$/.test(explicitType) ? explicitType : inferredType;

  // La transmisión sigue funcionando aunque el caller todavía no envíe
  // metadata suficiente para crear el registro técnico local.
  if (!documentType) return { stored: false, warning: 'Falta document_type/consecutivo para registrar el documento fiscal.' };

  const now = new Date().toISOString();
  const signedXml = decodeBase64Utf8(String(body.comprobanteXml || ''));
  const { data: existing, error: findError } = await service
    .from('fiscal_documents')
    .select('id')
    .eq('business_id', businessId)
    .eq('clave', clave)
    .maybeSingle();
  if (findError) throw findError;

  const values = {
    business_id: businessId,
    sale_id: body.sale_id ? String(body.sale_id) : null,
    environment,
    document_type: documentType,
    clave,
    consecutivo: consecutivo || null,
    status: 'sent',
    signed_xml: signedXml || null,
    error_message: null,
    hacienda_location: location,
    sent_at: now,
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await service.from('fiscal_documents').update(values).eq('id', existing.id);
    if (error) throw error;
    return { stored: true, id: existing.id };
  }

  const { data, error } = await service
    .from('fiscal_documents')
    .insert({ ...values, created_by: userId })
    .select('id')
    .single();
  if (error) throw error;
  return { stored: true, id: data?.id || null };
}

async function storeSubmissionError(service: any, businessId: string, clave: string, message: string) {
  if (!businessId || !clave) return;
  try {
    await service
      .from('fiscal_documents')
      .update({ status: 'error', error_message: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('clave', clave);
  } catch {
    // El error de bitácora nunca debe ocultar la respuesta real de Hacienda.
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { business_id, clave, fecha, emisor, receptor, comprobanteXml } = body;
    const environment = body.environment === 'production' ? 'production' : 'sandbox';
    if (environment === 'production') return json({ error: 'Producción está bloqueada durante PRE-BETA.' }, 409);
    if (!business_id || !clave || !fecha || !emisor || !comprobanteXml) return json({ error: 'Faltan datos del comprobante firmado.' }, 400);
    if (!/^\d{50}$/.test(String(clave))) return json({ error: 'La clave del comprobante debe contener 50 dígitos.' }, 400);

    // Endpoint técnico de bajo nivel: solo el dueño puede enviar XML ya firmado.
    // La emisión operativa para cajeros deberá pasar por el futuro endpoint que
    // construye/firma el XML en backend, sin exponer el .p12 al navegador.
    const { user, service } = await requireOwner(req, business_id);
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
    const detail = text || response.headers.get('X-Error-Cause') || '';

    if (![200, 201, 202].includes(response.status)) {
      await storeSubmissionError(service, business_id, clave, `Hacienda ${response.status}: ${detail}`);
      return json({ error: `Hacienda ${response.status}`, detail }, response.status);
    }

    const location = response.headers.get('Location') || null;
    let storage: Record<string, unknown> = { stored: false };
    try {
      storage = await storeSentDocument(service, user.id, body, environment, location);
    } catch (storageError) {
      storage = {
        stored: false,
        warning: storageError instanceof Error ? storageError.message : String(storageError),
      };
    }

    return json({ ok: true, status: response.status, location, ...storage });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
