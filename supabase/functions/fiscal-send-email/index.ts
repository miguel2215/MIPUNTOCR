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

function userClient(req: Request) {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    auth: { persistSession: false },
  });
}

function serviceClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

async function requireBusinessMember(req: Request, businessId: string) {
  if (!businessId) throw new Error('Negocio no especificado.');

  const client = userClient(req);
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) throw new Error('Sesión no válida.');

  const uid = authData.user.id;
  const service = serviceClient();

  const { data: business, error: businessError } = await client
    .from('businesses')
    .select('id, owner_user_id')
    .eq('id', businessId)
    .maybeSingle();

  if (businessError) {
    console.error('businesses member lookup:', businessError);
    throw new Error('No fue posible consultar el negocio.');
  }
  if (!business) throw new Error('Negocio no encontrado.');
  if (business.owner_user_id === uid) return { user: authData.user, service, role: 'owner' };

  const { data: member, error: memberError } = await client
    .from('business_members')
    .select('role, active')
    .eq('business_id', businessId)
    .eq('user_id', uid)
    .eq('active', true)
    .maybeSingle();

  if (memberError) throw new Error('No fue posible comprobar los permisos del negocio.');
  if (!member) throw new Error('No tienes acceso a este negocio.');

  return {
    user: authData.user,
    service,
    role: String(member.role || 'employee').toLowerCase(),
  };
}

const SALE_META_PREFIX='__PYCR_SALE__';
const clean=(v:unknown,max=200)=>String(v??'').trim().slice(0,max);
function unpack(raw:unknown){const t=String(raw||'');if(!t.startsWith(SALE_META_PREFIX))return {} as Record<string,unknown>;const n=t.indexOf('\n');const e=n>=0?t.slice(SALE_META_PREFIX.length,n):t.slice(SALE_META_PREFIX.length);try{return JSON.parse(e||'{}')||{};}catch{return {};}}
function esc(v:unknown){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));}
function xmlB64(v:unknown){const bytes=new TextEncoder().encode(String(v||''));let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin);}
function validEmail(v:string){return /^\S+@\S+\.\S+$/.test(v)&&v.length<=180;}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  try{
    const body=await req.json().catch(()=>({}));
    const businessId=clean(body.business_id,80), saleId=clean(body.sale_id,80), recipient=clean(body.recipient,180).toLowerCase();
    if(!businessId||!saleId||!validEmail(recipient)) return json({error:'Faltan datos válidos para enviar el comprobante.'},400);
    const pdfBase64=clean(body.pdf_base64,10_000_000);
    if(!pdfBase64||pdfBase64.length>9_500_000) return json({error:'El PDF no es válido o supera el tamaño permitido.'},400);
    const {service}=await requireBusinessMember(req,businessId);
    const [{data:sale,error:saleError},{data:business,error:businessError},{data:fiscal,error:fiscalError}]=await Promise.all([
      service.from('sales').select('id,business_id,receipt_number,local_number,total,created_at,notes').eq('id',saleId).eq('business_id',businessId).maybeSingle(),
      service.from('businesses').select('name,settings').eq('id',businessId).maybeSingle(),
      service.from('fiscal_documents').select('*').eq('business_id',businessId).eq('sale_id',saleId).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    ]);
    if(saleError)throw saleError;if(businessError)throw businessError;if(fiscalError)throw fiscalError;if(!sale)return json({error:'Venta no encontrada.'},404);
    const meta=unpack(sale.notes); if(!meta.electronicDocumentRequested)return json({error:'Esta venta no corresponde a un comprobante electrónico.'},400);
    const apiKey=Deno.env.get('RESEND_API_KEY')||''; const from=Deno.env.get('FISCAL_EMAIL_FROM')||'';
    if(!apiKey||!from) return json({error:'Falta configurar el proveedor de correo transaccional: RESEND_API_KEY y FISCAL_EMAIL_FROM.'},503);
    const settings=(business?.settings||{}) as Record<string,unknown>; const docType=clean(fiscal?.document_type||meta.fiscalDocumentType||(meta.documentType==='electronic_ticket'?'04':'01'),2); const label=docType==='04'?'Tiquete Electrónico':'Factura Electrónica';
    const number=clean(fiscal?.consecutivo||sale.receipt_number||sale.local_number||'',30); const fiscalStatus=clean(fiscal?.status||meta.electronicInvoiceStatus||'prepared',40).toLowerCase(); const accepted=['accepted','aceptado'].includes(fiscalStatus);
    const attachments:any[]=[{filename:`${docType==='04'?'tiquete':'factura'}-${number||sale.id}.pdf`,content:pdfBase64,content_type:'application/pdf'}];
    if(accepted&&fiscal?.signed_xml)attachments.push({filename:`comprobante-${number||sale.id}.xml`,content:xmlB64(fiscal.signed_xml),content_type:'application/xml'});
    if(accepted&&fiscal?.response_xml)attachments.push({filename:`respuesta-hacienda-${number||sale.id}.xml`,content:xmlB64(fiscal.response_xml),content_type:'application/xml'});
    const publicUrl=clean(body.public_url,1200); const emitter=clean(settings.fiscalLegalName||business?.name||'PUNTO YA CR',180);
    const html=`<div style="font-family:Arial,sans-serif;color:#162B38;line-height:1.55"><h2>${esc(label)}</h2><p>Adjuntamos el comprobante electrónico emitido por <strong>${esc(emitter)}</strong>.</p><p><strong>Total:</strong> ₡${Number(sale.total||0).toLocaleString('es-CR',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>${accepted?'<p>También se adjuntan los XML disponibles del comprobante y de la respuesta de Hacienda.</p>':'<p>El comprobante aún no cuenta con XML aceptados por Hacienda. El PDF refleja el estado actual del documento.</p>'}${publicUrl?`<p><a href="${esc(publicUrl)}">Consulta tu factura/comprobante electrónico aquí</a></p>`:''}<p style="color:#536B79;font-size:12px">Enviado mediante PUNTO YA CR.</p></div>`;
    const idem=`pycr-fiscal-${sale.id}-${recipient}-${clean(fiscal?.updated_at||meta.fiscalResponseAt||meta.fiscalPreparedAt||sale.created_at,60)}`.replace(/[^a-zA-Z0-9_.@-]/g,'_').slice(0,240);
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idem},body:JSON.stringify({from,to:[recipient],subject:`${label}${number?` ${number}`:''} · ${emitter}`,html,attachments})});
    const out=await response.json().catch(()=>({})); if(!response.ok){console.error('Resend:',response.status,out);return json({error:'El proveedor de correo no pudo enviar el comprobante.',detail:clean(out?.message||out?.error||'',300)},502);}
    return json({ok:true,email_id:clean(out?.id,120),sent_at:new Date().toISOString(),xml_attached:attachments.length>1});
  }catch(e){console.error('fiscal-send-email',e);return json({error:e instanceof Error?e.message:'No fue posible enviar el comprobante por correo.'},500);}
});
