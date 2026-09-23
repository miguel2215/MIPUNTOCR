import { corsHeaders, json, requireOwner } from '../shared/fiscal.ts';

const DOCUMENT_TYPES = new Set(['01','02','03','04','05','06','07','08','09','10']);
const SITUATIONS = new Set(['1','2','3']);

function onlyDigits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeEmitterId(type: string, raw: unknown) {
  const id = onlyDigits(raw);
  if (type === '01' && /^\d{9}$/.test(id)) return id.padStart(12, '0');
  if (type === '02' && /^\d{10}$/.test(id)) return id.padStart(12, '0');
  if (type === '03' && /^\d{11,12}$/.test(id)) return id.padStart(12, '0');
  if (type === '04' && /^\d{10}$/.test(id)) return id.padStart(12, '0');
  throw new Error('La identificación del emisor no tiene el formato requerido para generar la clave.');
}

function costaRicaDateParts(input?: unknown) {
  const date = input ? new Date(String(input)) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Fecha de emisión no válida.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: '2-digit', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return { day: get('day'), month: get('month'), year: get('year') };
}

function securityCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 100_000_000).padStart(8, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  try {
    const body = await req.json();
    const businessId = String(body.business_id || '');
    const branchCode = String(body.branch_code || '001');
    const terminalCode = String(body.terminal_code || '00001');
    const documentType = String(body.document_type || '01');
    const situation = String(body.situation || '1');
    const emitterIdType = String(body.emitter_id_type || '');

    if (!/^\d{3}$/.test(branchCode)) return json({ error: 'El código de sucursal debe tener 3 dígitos.' }, 400);
    if (!/^\d{5}$/.test(terminalCode)) return json({ error: 'El código de terminal debe tener 5 dígitos.' }, 400);
    if (!DOCUMENT_TYPES.has(documentType)) return json({ error: 'Tipo de comprobante no válido.' }, 400);
    if (!SITUATIONS.has(situation)) return json({ error: 'Situación del comprobante no válida.' }, 400);

    const { service } = await requireOwner(req, businessId);
    const emitterId12 = normalizeEmitterId(emitterIdType, body.emitter_id_number);

    const { data: reserved, error: reserveError } = await service.rpc('pycr_reserve_fiscal_number', {
      p_business_id: businessId,
      p_branch_code: branchCode,
      p_terminal_code: terminalCode,
      p_document_type: documentType,
    });
    if (reserveError) {
      console.error('reserve fiscal number:', reserveError);
      throw new Error('No fue posible reservar el consecutivo fiscal.');
    }

    const number = Number(reserved);
    if (!Number.isSafeInteger(number) || number < 1 || number > 9_999_999_999) {
      throw new Error('Hacienda devolvió un consecutivo fuera de rango.');
    }

    const sequential10 = String(number).padStart(10, '0');
    const consecutivo = `${branchCode}${terminalCode}${documentType}${sequential10}`;
    const { day, month, year } = costaRicaDateParts(body.issue_date);
    const security = securityCode();
    const clave = `506${day}${month}${year}${emitterId12}${consecutivo}${situation}${security}`;

    if (!/^\d{20}$/.test(consecutivo) || !/^\d{50}$/.test(clave)) {
      throw new Error('No fue posible construir una clave fiscal válida.');
    }

    return json({
      clave,
      consecutivo,
      branch_code: branchCode,
      terminal_code: terminalCode,
      document_type: documentType,
      sequence_number: number,
      situation,
      security_code: security,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 400);
  }
});
