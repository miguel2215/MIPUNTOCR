import { Buffer } from 'node:buffer';
import { signAndEncode } from 'npm:@dojocoding/hacienda-sdk@0.2.0';
import {
  corsHeaders,
  decryptSecrets,
  haciendaToken,
  json,
  requireOwner,
} from '../shared/fiscal.ts';

function b64ToBuffer(value: string) {
  const clean = String(value || '').replace(/^data:.*?;base64,/, '').replace(/\s+/g, '');
  if (!clean) throw new Error('La llave criptográfica .p12 no está disponible.');
  return Buffer.from(clean, 'base64');
}

function decodeBase64Utf8(value: string) {
  const bytes = Buffer.from(String(value || ''), 'base64');
  return new TextDecoder().decode(bytes);
}

async function persistSent(
  service: any,
  userId: string,
  body: Record<string, any>,
  environment: 'sandbox' | 'production',
  signedBase64: string,
  location: string | null,
) {
  const now = new Date().toISOString();
  const signedXml = decodeBase64Utf8(signedBase64);
  const values = {
    business_id: String(body.business_id),
    sale_id: body.sale_id ? String(body.sale_id) : null,
    environment,
    document_type: '01',
    clave: String(body.clave),
    consecutivo: String(body.consecutivo || ''),
    status: 'sent',
    signed_xml: signedXml,
    error_message: null,
    hacienda_location: location,
    sent_at: now,
    updated_at: now,
  };

  const { data: existing, error: findError } = await service
    .from('fiscal_documents')
    .select('id')
    .eq('business_id', values.business_id)
    .eq('clave', values.clave)
    .maybeSingle();
  if (findError) throw findError;

  if (existing?.id) {
    const { error } = await service.from('fiscal_documents').update(values).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await service
    .from('fiscal_documents')
    .insert({ ...values, created_by: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data?.id || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const businessId = String(body.business_id || '');
    const environment: 'sandbox' | 'production' = body.environment === 'production' ? 'production' : 'sandbox';

    // PUNTO YA CR ya es público; lo que permanece bloqueado es únicamente
    // la emisión fiscal en producción hasta completar la aceptación en sandbox.
    if (environment === 'production') {
      return json({ error: 'La emisión en producción permanece bloqueada hasta completar las pruebas con Hacienda.' }, 409);
    }

    const clave = String(body.clave || '');
    const consecutivo = String(body.consecutivo || '');
    const fecha = String(body.fecha || '');
    const unsignedXml = String(body.xml || body.unsigned_xml || '');
    const emisor = body.emisor || {};
    const receptor = body.receptor || null;

    if (!businessId || !/^\d{50}$/.test(clave) || !/^\d{20}$/.test(consecutivo) || !fecha || !unsignedXml) {
      return json({ error: 'Faltan datos para firmar y enviar el comprobante.' }, 400);
    }
    if (consecutivo.slice(8, 10) !== '01') {
      return json({ error: 'Este endpoint emite únicamente Factura Electrónica tipo 01.' }, 400);
    }
    if (!unsignedXml.includes('<FacturaElectronica') || unsignedXml.includes('<ds:Signature')) {
      return json({ error: 'Se esperaba un XML 4.4 de Factura Electrónica sin firma.' }, 400);
    }
    if (!emisor?.tipoIdentificacion || !emisor?.numeroIdentificacion) {
      return json({ error: 'Faltan los datos de identificación del emisor para Hacienda.' }, 400);
    }

    const { user, service } = await requireOwner(req, businessId);
    const { data: row, error } = await service
      .from('fiscal_secret_envelopes')
      .select('payload_ciphertext, iv')
      .eq('business_id', businessId)
      .eq('environment', environment)
      .maybeSingle();
    if (error) throw error;
    if (!row) return json({ error: 'Negocio no conectado con Hacienda.' }, 404);

    const secrets = await decryptSecrets(row);
    if (!secrets?.p12_base64 || !secrets?.pin) {
      return json({ error: 'Falta la llave criptográfica o su PIN en la configuración fiscal segura.' }, 409);
    }

    // La llave y el PIN solo existen descifrados durante esta ejecución backend.
    // signAndEncode genera XAdES-EPES y devuelve el XML firmado en Base64.
    const signedBase64 = await signAndEncode(unsignedXml, b64ToBuffer(secrets.p12_base64), String(secrets.pin));
    if (!signedBase64) throw new Error('No fue posible generar la firma XAdES-EPES.');

    const token = await haciendaToken(environment, String(secrets.username || ''), String(secrets.password || ''));
    const payload: Record<string, unknown> = {
      clave,
      fecha,
      emisor: {
        tipoIdentificacion: String(emisor.tipoIdentificacion),
        numeroIdentificacion: String(emisor.numeroIdentificacion),
      },
      comprobanteXml: signedBase64,
    };
    if (receptor?.numeroIdentificacion) {
      payload.receptor = {
        tipoIdentificacion: String(receptor.tipoIdentificacion || ''),
        numeroIdentificacion: String(receptor.numeroIdentificacion),
      };
    }

    const response = await fetch(`${token.config.apiBase}/recepcion`, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    const detail = responseText || response.headers.get('X-Error-Cause') || '';

    if (![200, 201, 202].includes(response.status)) {
      return json({ error: `Hacienda ${response.status}`, detail }, response.status);
    }

    const location = response.headers.get('Location') || null;
    let documentId: string | null = null;
    let storageWarning: string | null = null;
    try {
      documentId = await persistSent(service, user.id, body, environment, signedBase64, location);
    } catch (e) {
      storageWarning = e instanceof Error ? e.message : String(e);
    }

    // Nunca devolver XML firmado, P12, PIN, usuario o contraseña al navegador.
    return json({
      ok: true,
      signed: true,
      submitted: true,
      status: response.status,
      clave,
      location,
      fiscal_document_id: documentId,
      storage_warning: storageWarning,
      next: 'Consultar hacienda-check-status con esta clave hasta obtener aceptado, rechazado o error.',
    });
  } catch (e) {
    console.error('hacienda-sign-submit:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
