import { corsHeaders, json, requireOwner } from '../shared/fiscal.ts';

const NS = 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica';
const ID_TYPES = new Set(['01', '02', '03', '04']);
const SALE_CONDITIONS = new Set(['01','02','03','04','05','06','07','08','10','12','13','14','15','99']);
const PAYMENT_TYPES = new Set(['01','02','03','04','05','06','07','99']);

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function n(value: unknown) {
  const v = Number(value);
  if (!Number.isFinite(v)) throw new Error('Se recibió un monto numérico no válido.');
  return v;
}
function dec(value: unknown, digits = 5) { return n(value).toFixed(digits); }
function money(value: unknown) { return dec(value, 5); }
function text(value: unknown, max: number) { return String(value ?? '').trim().slice(0, max); }
function digits(value: unknown) { return String(value ?? '').replace(/\D+/g, ''); }
function cleanActivity(value: unknown) { return String(value ?? '').replace(/[^0-9A-Za-z]/g, '').slice(0, 6); }
function cleanCabys(value: unknown) { return digits(value).slice(0, 13); }
function taxRateCode(rate: number) {
  if (rate === 0) return '01';
  if (rate === 0.5) return '09';
  if (rate === 1) return '02';
  if (rate === 2) return '03';
  if (rate === 4) return '04';
  if (rate === 13) return '08';
  throw new Error(`Tarifa IVA no soportada todavía: ${rate}%`);
}
function crDateTime(value?: unknown) {
  const d = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error('Fecha de emisión no válida.');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  }).formatToParts(d).reduce((a:any,p:any)=>(a[p.type]=p.value,a),{});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-06:00`;
}
function identificationXml(person: any) {
  const type = String(person?.id_type || '');
  const number = String(person?.id_number || '').trim();
  if (!ID_TYPES.has(type)) throw new Error('Tipo de identificación no válido para Factura Electrónica.');
  if (!number) throw new Error('Falta el número de identificación.');
  return `<Identificacion><Tipo>${esc(type)}</Tipo><Numero>${esc(number)}</Numero></Identificacion>`;
}
function locationXml(location: any) {
  const province = digits(location?.province);
  const canton = digits(location?.canton).padStart(2,'0');
  const district = digits(location?.district).padStart(2,'0');
  const other = text(location?.other_signs, 250);
  if (!/^[1-7]$/.test(province) || !/^\d{2}$/.test(canton) || !/^\d{2}$/.test(district) || !other) {
    throw new Error('La ubicación fiscal del emisor está incompleta.');
  }
  return `<Ubicacion><Provincia>${province}</Provincia><Canton>${canton}</Canton><Distrito>${district}</Distrito><OtrasSenas>${esc(other)}</OtrasSenas></Ubicacion>`;
}
function personXml(tag: 'Emisor'|'Receptor', person: any, requireLocation = false) {
  const name = text(person?.name, 100);
  if (!name) throw new Error(`Falta el nombre del ${tag.toLowerCase()}.`);
  let xml = `<${tag}><Nombre>${esc(name)}</Nombre>${identificationXml(person)}`;
  if (person?.commercial_name) xml += `<NombreComercial>${esc(text(person.commercial_name,80))}</NombreComercial>`;
  if (requireLocation || person?.location) xml += locationXml(person.location);
  if (person?.email) xml += `<CorreoElectronico>${esc(text(person.email,160))}</CorreoElectronico>`;
  xml += `</${tag}>`;
  return xml;
}

type BuiltLine = { xml:string; base:number; tax:number; total:number; discount:number; kind:'service'|'goods'; taxed:boolean };
function buildLine(raw:any, index:number): BuiltLine {
  const qty = n(raw?.quantity ?? 0);
  const unitPrice = n(raw?.unit_price ?? 0);
  if (!(qty > 0)) throw new Error(`Línea ${index}: cantidad inválida.`);
  if (unitPrice < 0) throw new Error(`Línea ${index}: precio inválido.`);
  const cabys = cleanCabys(raw?.cabys);
  if (!/^\d{13}$/.test(cabys)) throw new Error(`Línea ${index}: CAByS debe tener 13 dígitos.`);
  const detail = text(raw?.detail, 200);
  if (!detail) throw new Error(`Línea ${index}: falta el detalle.`);
  const kind:'service'|'goods' = raw?.kind === 'service' ? 'service' : 'goods';
  const unit = text(raw?.unit || (kind === 'service' ? 'Sp' : 'Unid'), 20);
  const gross = qty * unitPrice;
  const discount = Math.max(0, n(raw?.discount_amount ?? 0));
  if (discount > gross) throw new Error(`Línea ${index}: el descuento supera el monto total.`);
  const subtotal = gross - discount;
  const rate = n(raw?.tax_rate ?? 0);
  const taxed = rate > 0;
  const tax = taxed ? subtotal * rate / 100 : 0;
  const total = subtotal + tax;
  let xml = `<LineaDetalle><NumeroLinea>${index}</NumeroLinea><CodigoCABYS>${cabys}</CodigoCABYS>`;
  xml += `<Cantidad>${dec(qty,3)}</Cantidad><UnidadMedida>${esc(unit)}</UnidadMedida><Detalle>${esc(detail)}</Detalle>`;
  xml += `<PrecioUnitario>${money(unitPrice)}</PrecioUnitario><MontoTotal>${money(gross)}</MontoTotal>`;
  if (discount > 0) {
    const code = String(raw?.discount_code || '07');
    xml += `<Descuento><MontoDescuento>${money(discount)}</MontoDescuento><CodigoDescuento>${esc(code)}</CodigoDescuento>`;
    if (code === '99') xml += `<CodigoDescuentoOTRO>${esc(text(raw?.discount_other || 'Otro descuento',80))}</CodigoDescuentoOTRO>`;
    xml += `<NaturalezaDescuento>${esc(text(raw?.discount_reason || 'Descuento aplicado',80))}</NaturalezaDescuento></Descuento>`;
  }
  xml += `<SubTotal>${money(subtotal)}</SubTotal><BaseImponible>${money(subtotal)}</BaseImponible>`;
  xml += `<Impuesto><Codigo>01</Codigo><CodigoTarifaIVA>${taxRateCode(rate)}</CodigoTarifaIVA><Tarifa>${dec(rate,2)}</Tarifa><Monto>${money(tax)}</Monto></Impuesto>`;
  xml += `<ImpuestoAsumidoEmisorFabrica>0.00000</ImpuestoAsumidoEmisorFabrica><ImpuestoNeto>${money(tax)}</ImpuestoNeto><MontoTotalLinea>${money(total)}</MontoTotalLinea></LineaDetalle>`;
  return { xml, base:subtotal, tax, total, discount, kind, taxed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const businessId = String(body.business_id || '');
    await requireOwner(req, businessId);

    const clave = String(body.clave || '');
    const consecutivo = String(body.consecutivo || '');
    if (!/^[0-9A-Za-z]{50}$/.test(clave)) return json({ error:'La clave debe tener exactamente 50 caracteres válidos.' },400);
    if (!/^\d{20}$/.test(consecutivo)) return json({ error:'El consecutivo debe tener exactamente 20 dígitos.' },400);
    if (consecutivo.slice(8,10) !== '01') return json({ error:'Esta función construye únicamente Factura Electrónica tipo 01.' },400);

    const issuer = body.issuer || {};
    const receiver = body.receiver || {};
    const providerSystems = String(body.provider_systems || issuer.id_number || '').trim();
    // Hacienda 4.4 indica que, para desarrollo propio/a la medida, se usa la identificación del obligado tributario.
    if (!providerSystems) return json({ error:'Falta ProveedorSistemas.' },400);
    const issuerActivity = cleanActivity(body.issuer_activity);
    const receiverActivity = cleanActivity(body.receiver_activity);
    if (!issuerActivity) return json({ error:'Falta la actividad económica del emisor.' },400);

    const condition = String(body.sale_condition || '01');
    if (!SALE_CONDITIONS.has(condition)) return json({ error:'Condición de venta no válida para FE 4.4.' },400);
    const creditDays = digits(body.credit_days).slice(0,5);
    if ((condition === '02' || condition === '10') && (!creditDays || Number(creditDays) <= 0)) {
      return json({ error:'La condición de crédito requiere plazo en días.' },400);
    }
    const conditionOther = text(body.sale_condition_other,100);
    if (condition === '99' && conditionOther.length < 5) return json({ error:'La condición Otros requiere una descripción.' },400);

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (!rawLines.length) return json({ error:'La factura necesita al menos una línea.' },400);
    if (rawLines.length > 1000) return json({ error:'La factura supera 1000 líneas.' },400);
    const lines = rawLines.map((line:any,i:number)=>buildLine(line,i+1));

    const sum = (fn:(x:BuiltLine)=>number) => lines.reduce((a,x)=>a+fn(x),0);
    const servTaxed = sum(x=>x.kind==='service'&&x.taxed?x.base:0);
    const servExempt = sum(x=>x.kind==='service'&&!x.taxed?x.base:0);
    const goodsTaxed = sum(x=>x.kind==='goods'&&x.taxed?x.base:0);
    const goodsExempt = sum(x=>x.kind==='goods'&&!x.taxed?x.base:0);
    const totalTaxed = servTaxed + goodsTaxed;
    const totalExempt = servExempt + goodsExempt;
    const totalSale = totalTaxed + totalExempt + sum(x=>x.discount);
    const totalDiscount = sum(x=>x.discount);
    const totalNet = sum(x=>x.base);
    const totalTax = sum(x=>x.tax);
    const totalDocument = sum(x=>x.total);

    const payment = String(body.payment_method || '01');
    if (!PAYMENT_TYPES.has(payment)) return json({ error:'Medio de pago no válido para FE 4.4.' },400);
    const paymentOther = text(body.payment_other,100);
    if (payment === '99' && paymentOther.length < 5) return json({ error:'El medio de pago Otros requiere una descripción.' },400);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `<FacturaElectronica xmlns="${NS}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">`;
    xml += `<Clave>${esc(clave)}</Clave><ProveedorSistemas>${esc(providerSystems)}</ProveedorSistemas>`;
    xml += `<CodigoActividadEmisor>${esc(issuerActivity)}</CodigoActividadEmisor>`;
    if (receiverActivity) xml += `<CodigoActividadReceptor>${esc(receiverActivity)}</CodigoActividadReceptor>`;
    xml += `<NumeroConsecutivo>${consecutivo}</NumeroConsecutivo><FechaEmision>${crDateTime(body.issue_date)}</FechaEmision>`;
    xml += personXml('Emisor', issuer, true) + personXml('Receptor', receiver, false);
    xml += `<CondicionVenta>${condition}</CondicionVenta>`;
    if (condition === '99') xml += `<CondicionVentaOtros>${esc(conditionOther)}</CondicionVentaOtros>`;
    if (condition === '02' || condition === '10') xml += `<PlazoCredito>${creditDays}</PlazoCredito>`;
    xml += `<DetalleServicio>${lines.map(x=>x.xml).join('')}</DetalleServicio>`;
    xml += `<ResumenFactura><CodigoTipoMoneda><CodigoMoneda>CRC</CodigoMoneda><TipoCambio>1.00000</TipoCambio></CodigoTipoMoneda>`;
    if (servTaxed) xml += `<TotalServGravados>${money(servTaxed)}</TotalServGravados>`;
    if (servExempt) xml += `<TotalServExentos>${money(servExempt)}</TotalServExentos>`;
    if (goodsTaxed) xml += `<TotalMercanciasGravadas>${money(goodsTaxed)}</TotalMercanciasGravadas>`;
    if (goodsExempt) xml += `<TotalMercanciasExentas>${money(goodsExempt)}</TotalMercanciasExentas>`;
    if (totalTaxed) xml += `<TotalGravado>${money(totalTaxed)}</TotalGravado>`;
    if (totalExempt) xml += `<TotalExento>${money(totalExempt)}</TotalExento>`;
    xml += `<TotalVenta>${money(totalSale)}</TotalVenta><TotalDescuentos>${money(totalDiscount)}</TotalDescuentos><TotalVentaNeta>${money(totalNet)}</TotalVentaNeta><TotalImpuesto>${money(totalTax)}</TotalImpuesto>`;
    xml += `<TotalImpAsumEmisorFabrica>0.00000</TotalImpAsumEmisorFabrica><TotalIVADevuelto>0.00000</TotalIVADevuelto><TotalOtrosCargos>0.00000</TotalOtrosCargos>`;
    xml += `<MedioPago><TipoMedioPago>${payment}</TipoMedioPago>${payment==='99'?`<MedioPagoOtros>${esc(paymentOther)}</MedioPagoOtros>`:''}<TotalMedioPago>${money(totalDocument)}</TotalMedioPago></MedioPago>`;
    xml += `<TotalComprobante>${money(totalDocument)}</TotalComprobante></ResumenFactura></FacturaElectronica>`;

    return json({
      ok:true, version:'4.4', document_type:'01', unsigned:true,
      clave, consecutivo, fecha: crDateTime(body.issue_date), xml,
      totals:{ total_sale:totalSale, discounts:totalDiscount, net:totalNet, tax:totalTax, total:totalDocument }
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) },400);
  }
});
