import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta la variable segura ${name}`);
  return value;
}

function serviceClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

const SALE_META_PREFIX = '__PYCR_SALE__';
function clean(v: unknown, max = 160) { return String(v ?? '').trim().slice(0, max); }
function unpack(raw: unknown) {
  const text=String(raw||'');
  if(!text.startsWith(SALE_META_PREFIX)) return {} as Record<string,unknown>;
  const nl=text.indexOf('\n');
  const encoded=nl>=0?text.slice(SALE_META_PREFIX.length,nl):text.slice(SALE_META_PREFIX.length);
  try { return JSON.parse(encoded||'{}') || {}; } catch { return {}; }
}
function b64Utf8(xml: unknown) {
  const bytes=new TextEncoder().encode(String(xml||'')); let binary='';
  for(const b of bytes) binary+=String.fromCharCode(b);
  return btoa(binary);
}

Deno.serve(async (req) => {
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const body=req.method==='POST'?await req.json().catch(()=>({})):{};
    const saleId=clean(body.id||url.searchParams.get('id'),80);
    const token=clean(body.token||url.searchParams.get('token'),96);
    if(!/^[0-9a-f-]{36}$/i.test(saleId) || !/^[0-9a-f]{48}$/i.test(token)) return json({error:'Enlace de consulta inválido.'},400);

    const service=serviceClient();
    const {data:sale,error:saleError}=await service.from('sales').select('id,business_id,receipt_number,local_number,subtotal,tax,total,payment_method,created_at,notes,status').eq('id',saleId).maybeSingle();
    if(saleError) throw saleError;
    if(!sale) return json({error:'Comprobante no encontrado.'},404);
    const meta=unpack(sale.notes);
    if(clean(meta.fiscalPublicToken,96)!==token || !meta.electronicDocumentRequested) return json({error:'Enlace de consulta inválido.'},403);

    const [{data:items,error:itemsError},{data:business,error:businessError},{data:fiscal,error:fiscalError}] = await Promise.all([
      service.from('sale_items').select('product_name,variant,quantity,unit_price,subtotal,cabys,fiscal_tax_rate,fiscal_tax_amount,fiscal_line_total').eq('sale_id',saleId).order('created_at',{ascending:true}),
      service.from('businesses').select('name,settings').eq('id',sale.business_id).maybeSingle(),
      service.from('fiscal_documents').select('*').eq('business_id',sale.business_id).eq('sale_id',saleId).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(itemsError) throw itemsError; if(businessError) throw businessError; if(fiscalError) throw fiscalError;
    const settings=(business?.settings||{}) as Record<string,unknown>;
    const receiver=(meta.invoiceCustomer||null) as Record<string,unknown>|null;
    const fiscalStatus=clean(fiscal?.status||meta.electronicInvoiceStatus||'prepared',40).toLowerCase();
    const accepted=['accepted','aceptado'].includes(fiscalStatus);
    const signedXml=accepted?clean(fiscal?.signed_xml,2_000_000):'';
    const responseXml=accepted?clean(fiscal?.response_xml,2_000_000):'';
    return json({
      ok:true,
      receipt:{
        id:sale.id,
        number:sale.receipt_number||sale.local_number||null,
        document_type:clean(fiscal?.document_type||meta.fiscalDocumentType||(meta.documentType==='electronic_ticket'?'04':'01'),2),
        document_label:(clean(fiscal?.document_type||meta.fiscalDocumentType,2)==='04'||meta.documentType==='electronic_ticket')?'Tiquete Electrónico':'Factura Electrónica',
        created_at:sale.created_at,
        status:fiscalStatus,
        status_label:accepted?'Aceptado por Hacienda':(['rejected','rechazado'].includes(fiscalStatus)?'Rechazado por Hacienda':(fiscalStatus==='prepared'?'Preparado · transmisión pausada':'En proceso fiscal')),
        clave:clean(fiscal?.clave||meta.fiscalClave,50),
        consecutivo:clean(fiscal?.consecutivo||meta.fiscalConsecutivo,20),
        emitter:{name:clean(settings.fiscalLegalName||business?.name||'PUNTO YA CR',180),id:clean(settings.fiscalId,20),email:clean(settings.fiscalEmail,180)},
        receiver:receiver?{name:clean(receiver.name,180),id_type:clean(receiver.idType,4),id:clean(receiver.id,30),email:clean(receiver.email,180)}:null,
        items:(items||[]).map((i:any)=>({name:clean(i.product_name,240),variant:clean(i.variant,160),qty:Number(i.quantity||0),unit_price:Number(i.unit_price||0),cabys:clean(i.cabys,13),tax_rate:Number(i.fiscal_tax_rate||0),tax:Number(i.fiscal_tax_amount||0),total:Number(i.fiscal_line_total??i.subtotal??(Number(i.quantity||0)*Number(i.unit_price||0)))})),
        subtotal:Number(sale.subtotal||0),tax:Number(sale.tax||0),total:Number(sale.total||0),payment_method:clean(sale.payment_method,40),
        files:{signed_xml_base64:signedXml?b64Utf8(signedXml):'',response_xml_base64:responseXml?b64Utf8(responseXml):''}
      }
    });
  } catch(e) { console.error('fiscal-public-receipt',e); return json({error:'No fue posible consultar el comprobante.'},500); }
});
