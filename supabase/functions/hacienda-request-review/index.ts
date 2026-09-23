import { corsHeaders, json, requireOwner } from '../shared/fiscal.ts';
function clean(v: unknown, max = 800) { return String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max); }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const businessId = clean(body.business_id, 80), clave = clean(body.clave, 50), saleId = clean(body.sale_id, 120);
    const documentType = clean(body.document_type || '01', 2).padStart(2, '0');
    if (!businessId || !saleId) return json({ error: 'business_id y sale_id son requeridos.' }, 400);
    if (clave && !/^\d{50}$/.test(clave)) return json({ error: 'Clave fiscal inválida.' }, 400);
    if (!['01','04'].includes(documentType)) return json({ error: 'Tipo de comprobante inválido para revisión.' }, 400);
    const { service, user } = await requireOwner(req, businessId);
    const now = new Date().toISOString();
    const reason = clean(body.reason || 'El comprobante requiere revisión fiscal.');
    const state = clean(body.fiscal_status || 'error', 40).toLowerCase();
    const technical = clean(body.technical_detail || '', 1200);
    const source = clean(body.source || 'pos', 30);
    const appVersion = clean(body.app_version || '', 30);
    const marker = `REVISION_SOLICITADA|${now}|tipo=${documentType}|estado=${state}|origen=${source}|app=${appVersion}|motivo=${reason}|detalle=${technical}`.slice(0, 2000);
    let row: any = null;
    if (clave) {
      const found = await service.from('fiscal_documents').select('id,status').eq('business_id', businessId).eq('clave', clave).maybeSingle();
      if (found.error) throw found.error; row = found.data;
    }
    if (row?.id) {
      const upd = await service.from('fiscal_documents').update({ error_message: marker, updated_at: now }).eq('id', row.id); if (upd.error) throw upd.error;
    } else {
      const ins = await service.from('fiscal_documents').insert({ business_id: businessId, sale_id: saleId, environment: 'sandbox', document_type: documentType, clave: clave || null, consecutivo: clean(body.consecutivo, 20) || null, status: ['rechazado','error'].includes(state) ? state : 'error', error_message: marker, created_by: user.id, updated_at: now }); if (ins.error) throw ins.error;
    }
    console.log('Solicitud de revisión fiscal', { business_id: businessId, sale_id: saleId, document_type: documentType, clave: clave || null, fiscal_status: state, source, app_version: appVersion, requested_at: now });
    return json({ ok: true, review_requested: true, requested_at: now });
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 400); }
});
