/* =========================
   COMPROBANTE / PDF
========================= */
function receiptTypeLabel(sale) {
  if (sale.businessType === "food") return "COMPROBANTE DE COMIDA";
  if (sale.businessType === "services") return "COMPROBANTE DE SERVICIO";
  return "COMPROBANTE DE VENTA";
}
function showReceipt(sale) {
  const c = sale.clientId ? state.clients.find(x => x.id === sale.clientId) : null;
  const context = sale.businessType === "food" ? `<div class="ticket-line"><span>Pedido</span><strong>${esc(sale.orderType || "Mostrador")}${sale.table ? ` · Mesa ${esc(sale.table)}` : ""}</strong></div>` : "";
  const tableClean = !sale.voided && sale.businessType === "food" && sale.orderType === "Mesa" && sale.tableAccountId ? `<button class="btn primary" onclick="askCleanTable('${sale.tableAccountId}')">Limpiar mesa ${esc(sale.table)}</button>` : "";
  const voidBanner = sale.voided ? `<div class="panel" style="box-shadow:none;margin:10px 0;background:#fde9e7;color:#9f2f26;text-align:center"><strong>COMPROBANTE ANULADO</strong><div class="muted" style="margin-top:4px">${sale.voidedAt ? dateTime(sale.voidedAt) : ""}</div></div>` : "";
  const adminActions = hasPermission("void_sales") ? (sale.voided
    ? `<button class="btn danger" onclick="askHideSale('${sale.id}')">Eliminar de Mis ventas</button>`
    : `<button class="btn danger" onclick="askVoidSale('${sale.id}')">Anular comprobante</button>`) : "";
  modal(`<div class="ticket"><div class="ticket-business"><h3>${esc(state.settings.businessName)}</h3><div class="muted">${receiptTypeLabel(sale)}</div><div class="muted">Comprobante #${sale.number} · ${dateTime(sale.createdAt)}</div></div>${voidBanner}<div class="divider"></div>${context}${c ? `<div class="ticket-line"><span>Cliente</span><strong>${esc(c.name)}</strong></div>` : ""}${sale.items.map(i => `<div class="ticket-line"><span>${i.qty} × ${esc(i.name)}${i.variant ? ` · ${esc(i.variant)}` : ""}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}${sale.note ? `<div class="panel" style="box-shadow:none;margin-top:10px"><span class="muted">Nota</span><div>${esc(sale.note)}</div></div>` : ""}<div class="divider"></div>${sale.tax > 0 ? `<div class="ticket-line"><span>Impuesto</span><span>${money(sale.tax)}</span></div>` : ""}<div class="ticket-line ticket-total"><span>Total</span><span>${money(sale.total)}</span></div><div class="ticket-line"><span>Pago</span><span>${esc(sale.method)}</span></div>${sale.change > 0 ? `<div class="ticket-line"><span>Vuelto</span><span>${money(sale.change)}</span></div>` : ""}${sale.method === "Crédito" && !sale.voided ? `<div class="panel" style="box-shadow:none;margin-top:10px;background:#fff5dc"><strong>Saldo pendiente: ${money(sale.total)}</strong></div>` : ""}<div class="mpcr-powered"><span>Mi Punto CR</span><img class="brand-powered-logo" src="${BRAND.horizontal}" alt="Mi Punto CR"></div><div class="divider"></div><div class="toolbar"><button class="btn primary" onclick="sharePdf('${sale.id}')">Compartir PDF</button><button class="btn ghost" onclick="printReceipt('${sale.id}')">Imprimir comprobante</button>${tableClean}${adminActions}<button class="btn ghost" onclick="closeModal();go('sale')">Nueva venta</button><button class="btn" onclick="closeModal();go('home')">Inicio</button></div></div>`);
}
function loadExternalScript(src, id) {
  return new Promise((resolve, reject) => {
    const old = document.getElementById(id);
    if (old) {
      if (old.dataset.loaded === "true") return resolve();
      old.addEventListener("load", resolve, { once: true }); old.addEventListener("error", reject, { once: true }); return;
    }
    const script = document.createElement("script"); script.id = id; script.src = src; script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); }; script.onerror = reject; document.head.appendChild(script);
  });
}
async function ensurePdfLibraries() {
  if (!window.html2canvas) await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "mipunto-html2canvas");
  if (!window.jspdf?.jsPDF) await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "mipunto-jspdf");
}
function receiptItemsHtml(sale) {
  if (sale.businessType === "services") {
    return sale.items.map(i => `<div style="padding:12px 0;border-bottom:1px solid #e6e8e7"><div style="font-weight:800;font-size:15px">${esc(i.name)}</div>${i.variant ? `<div style="color:#536B79;font-size:12px;margin-top:3px">${esc(i.variant)}</div>` : ""}<div style="display:flex;justify-content:space-between;margin-top:6px"><span style="color:#536B79">${i.qty > 1 ? `${i.qty} servicios` : "Servicio"}</span><strong>${money(i.price * i.qty)}</strong></div></div>`).join("");
  }
  if (sale.businessType === "products") {
    return sale.items.map(i => `<div style="padding:11px 0;border-bottom:1px solid #e6e8e7"><div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font-weight:800;font-size:15px">${esc(i.name)}</div>${i.variant ? `<div style="color:#536B79;font-size:12px;margin-top:3px">${esc(i.variant)}</div>` : ""}<div style="color:#536B79;font-size:12px;margin-top:3px">${i.qty} × ${money(i.price)}</div></div><strong style="white-space:nowrap">${money(i.price * i.qty)}</strong></div></div>`).join("");
  }
  return sale.items.map(i => `<div style="display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid #e6e8e7"><div style="font-weight:800;font-size:15px">${i.qty} × ${esc(i.name)}${i.variant ? `<div style="color:#536B79;font-size:12px;font-weight:500;margin-top:3px">${esc(i.variant)}</div>` : ""}</div><strong style="white-space:nowrap">${money(i.price * i.qty)}</strong></div>`).join("");
}
function buildReceiptElement(sale) {
  const client = sale.clientId ? state.clients.find(x => x.id === sale.clientId) : null;
  const receipt = document.createElement("div");
  receipt.style.cssText = `position:fixed;left:-10000px;top:0;width:360px;background:#fff;color:#162B38;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;box-sizing:border-box;z-index:-1`;
  const foodInfo = sale.businessType === "food" ? `<div style="margin-top:13px;padding:11px 12px;background:#f5f8f7;border-radius:12px;font-size:12px"><strong>${esc(sale.orderType || "Mostrador")}${sale.table ? ` · Mesa ${esc(sale.table)}` : ""}</strong>${sale.note ? `<div style="margin-top:4px;color:#697281">${esc(sale.note)}</div>` : ""}</div>` : "";
  const serviceInfo = sale.businessType === "services" && client ? `<div style="margin-top:13px;padding:11px 12px;background:#f5f8f7;border-radius:12px;font-size:12px"><span style="color:#536B79">Cliente</span><div style="font-weight:800;margin-top:2px">${esc(client.name)}</div></div>` : "";
  const voidBanner = sale.voided ? `<div style="margin-top:14px;padding:10px 12px;background:#fde9e7;color:#9f2f26;border-radius:12px;text-align:center;font-weight:900;font-size:13px">ANULADO${sale.voidReason ? `<div style="font-size:10px;font-weight:600;margin-top:3px">${esc(sale.voidReason)}</div>` : ""}</div>` : "";
  receipt.innerHTML = `<div style="text-align:center"><div style="font-size:23px;font-weight:900">${esc(state.settings.businessName || "Mi Punto CR")}</div>${state.settings.phone ? `<div style="color:#536B79;font-size:12px;margin-top:4px">${esc(state.settings.phone)}</div>` : ""}<div style="display:inline-block;margin-top:16px;padding:7px 12px;background:#E8F7F3;color:#065F5E;border-radius:999px;font-size:11px;font-weight:900">${receiptTypeLabel(sale)}</div><div style="color:#536B79;font-size:11px;margin-top:8px">#${sale.number} · ${dateTime(sale.createdAt)}</div></div>${voidBanner}${foodInfo}${serviceInfo}${sale.businessType === "products" && client ? `<div style="margin-top:13px;padding:10px 0;font-size:12px"><span style="color:#536B79">Cliente: </span><strong>${esc(client.name)}</strong></div>` : ""}<div style="margin-top:17px;border-top:2px solid #202938">${receiptItemsHtml(sale)}</div><div style="margin-top:15px">${sale.tax > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#536B79;padding:4px 0"><span>Impuesto${(sale.taxMode || state.settings.taxMode) === "included" ? " incluido" : ""}</span><span>${money(sale.tax)}</span></div>` : ""}<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:13px 0;border-top:2px solid #202938;border-bottom:2px solid #202938"><span style="font-size:17px;font-weight:900">TOTAL</span><span style="font-size:22px;font-weight:900;color:#065F5E">${money(sale.total)}</span></div></div><div style="margin-top:15px;font-size:12px;line-height:1.55"><div style="display:flex;justify-content:space-between"><span style="color:#536B79">Forma de pago</span><strong>${esc(sale.method)}</strong></div>${sale.reference ? `<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="color:#536B79">Referencia</span><strong>${esc(sale.reference)}</strong></div>` : ""}${sale.change > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="color:#536B79">Vuelto</span><strong>${money(sale.change)}</strong></div>` : ""}${client && sale.businessType !== "services" && sale.businessType !== "products" ? `<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="color:#536B79">Cliente</span><strong>${esc(client.name)}</strong></div>` : ""}${sale.method === "Crédito" ? `<div style="margin-top:12px;padding:11px;background:#fff4d6;border-radius:12px;color:#8a5a00"><div style="font-size:10px;font-weight:800">SALDO A CRÉDITO</div><div style="font-size:19px;font-weight:900;margin-top:2px">${money(sale.total)}</div></div>` : ""}</div><div style="text-align:center;margin-top:24px;padding-top:15px;border-top:1px dashed #cdd3d0;color:#536B79;font-size:11px;line-height:1.5">Gracias por su compra.${state.settings.whatsapp ? `<br>WhatsApp: ${esc(state.settings.whatsapp)}` : ""}<br>Comprobante de venta<div class="mpcr-powered"><span>Generado con</span><img src="${BRAND.horizontal}" alt="Mi Punto CR"></div></div>`;
  document.body.appendChild(receipt);
  return receipt;
}
async function createReceiptPdf(sale) {
  await ensurePdfLibraries();
  const receipt = buildReceiptElement(sale);
  try {
    await waitForElementImages(receipt);
    const canvas = await window.html2canvas(receipt, { scale: 3, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const image = canvas.toDataURL("image/png");
    const pdfWidth = 80;
    const pdfHeight = Math.max(90, pdfWidth * canvas.height / canvas.width);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pdfWidth, pdfHeight] });
    pdf.addImage(image, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
    return pdf.output("blob");
  } finally { receipt.remove(); }
}
window.sharePdf = async id => {
  const sale = state.sales.find(x => x.id === id); if (!sale) return;
  try {
    toast("Generando comprobante...");
    const blob = await createReceiptPdf(sale);
    const file = new File([blob], `comprobante-${sale.number}.pdf`, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) return navigator.share({ title: `Comprobante #${sale.number}`, text: `${state.settings.businessName} · Comprobante #${sale.number}`, files: [file] });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); toast("PDF generado.");
  } catch (e) { console.error(e); toast("No se pudo generar el PDF. Necesitas conexión la primera vez."); }
};

/* =========================
   MIS VENTAS
========================= */
function salesGroupLabel(key) {
  const today = localDayKey(new Date());
  const y = new Date(); y.setDate(y.getDate()-1);
  if (key === today) return `Hoy · ${new Date(key+"T12:00:00").toLocaleDateString("es-CR")}`;
  if (key === localDayKey(y)) return `Ayer · ${new Date(key+"T12:00:00").toLocaleDateString("es-CR")}`;
  return new Date(key+"T12:00:00").toLocaleDateString("es-CR", { weekday:"long", day:"2-digit", month:"2-digit", year:"numeric" });
}
function groupedSalesHtml(items) {
  if (!items.length) return `<div class="empty">No hay ventas en este período.</div>`;
  const groups = {};
  for (const sale of items) (groups[localDayKey(sale.createdAt)] ||= []).push(sale);
  return Object.keys(groups).sort().reverse().map(key => {
    const daySales = groups[key].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const activeTotal = daySales.filter(s=>!s.voided).reduce((a,b)=>a+Number(b.total||0),0);
    const voidedTotal = daySales.filter(s=>s.voided).reduce((a,b)=>a+Number(b.total||0),0);
    const voidedCount = daySales.filter(s=>s.voided).length;
    return `<section class="sales-day"><div class="sales-day-head"><div><h3>${esc(salesGroupLabel(key))}</h3><span>${daySales.length} ${daySales.length===1?"venta":"ventas"}${voidedCount ? ` · ${voidedCount} anulada${voidedCount===1?"":"s"}` : ""}</span></div><div style="text-align:right"><strong>${money(activeTotal)}</strong>${voidedTotal ? `<div class="muted" style="font-size:12px;margin-top:3px">Anulado ${money(voidedTotal)}</div>` : ""}</div></div><div class="sales-day-list">${daySales.map(s => `<button class="row-card" style="width:100%;text-align:left;${s.voided?"opacity:.72;border-style:dashed":""}" onclick="openSale('${s.id}')"><div class="row-head"><div><strong>Comprobante #${s.number}${s.voided?" · ANULADO":""}</strong><div class="muted">${new Date(s.createdAt).toLocaleTimeString("es-CR",{hour:"2-digit",minute:"2-digit"})}</div></div><strong>${money(s.total)}</strong></div><div class="muted" style="margin-top:7px">${esc(s.method)}${s.clientId ? ` · ${esc(clientName(s.clientId))}` : ""}${s.table ? ` · Mesa ${esc(s.table)}` : ""}</div></button>`).join("")}</div></section>`;
  }).join("");
}
let salesDateMode = "all";
let salesStatusMode = "active";
function filteredSalesForView() {
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), yesterday = new Date(today), week = new Date(today);
  yesterday.setDate(yesterday.getDate()-1); const d=week.getDay()||7; week.setDate(week.getDate()-d+1);
  let list=[...visibleCurrentSales()];
  if(salesDateMode==="today") list=list.filter(s=>new Date(s.createdAt)>=today);
  if(salesDateMode==="yesterday") list=list.filter(s=>{const x=new Date(s.createdAt);return x>=yesterday&&x<today;});
  if(salesDateMode==="week") list=list.filter(s=>new Date(s.createdAt)>=week);
  if(salesStatusMode==="active") list=list.filter(s=>!s.voided);
  if(salesStatusMode==="voided") list=list.filter(s=>s.voided);
  list.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return list;
}
function refreshSalesList() {
  const el=$("#salesList");
  if(el) el.innerHTML=groupedSalesHtml(filteredSalesForView());
}
function renderSales() {
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Mis ventas</h2><p>Agrupadas por día. Toca una venta para abrir su comprobante.</p></section><div class="toolbar"><button class="btn ghost" onclick="filterSales('today')">Hoy</button><button class="btn ghost" onclick="filterSales('yesterday')">Ayer</button><button class="btn ghost" onclick="filterSales('week')">Esta semana</button><button class="btn ghost" onclick="filterSales('all')">Todas las fechas</button></div><div class="toolbar"><button class="btn ${salesStatusMode==='active'?'primary':'ghost'}" onclick="filterSalesStatus('active')">Activas</button><button class="btn ${salesStatusMode==='voided'?'primary':'ghost'}" onclick="filterSalesStatus('voided')">Anuladas</button><button class="btn ${salesStatusMode==='all'?'primary':'ghost'}" onclick="filterSalesStatus('all')">Todas</button></div><div id="salesList" class="sales-scroll">${groupedSalesHtml(filteredSalesForView())}</div>`, isFood() ? "more" : "sales");
}
window.filterSales = mode => { salesDateMode=mode; refreshSalesList(); };
window.filterSalesStatus = mode => { salesStatusMode=mode; renderSales(); };
window.openSale = id => { const sale=state.sales.find(x=>x.id===id); if(sale) showReceipt(sale); };

function buildShiftSnapshot(shift) {
  const r=shiftReportData(shift);
  return {
    count:r.count,gross:r.gross,tax:r.tax,cash:r.cash,sinpe:r.sinpe,card:r.card,credit:r.credit,
    creditCash:r.creditCash,creditPayments:r.creditPayments,ins:r.ins,outs:r.outs,expected:r.expected,
    products:r.products,orderCounts:r.orderCounts,saleIds:r.sales.map(s=>s.id),
    voidedSaleIds:state.sales.filter(s=>s.shiftId===shift.id&&s.voided).map(s=>s.id)
  };
}
async function refreshShiftAfterVoid(sale) {
  if(!sale.shiftId) return;
  const shift=state.cashSessions.find(x=>x.id===sale.shiftId);
  if(!shift) return;
  const snap=buildShiftSnapshot(shift);
  shift.report=snap;
  if(shift.status==="closed") {
    shift.expected=snap.expected;
    shift.difference=Number(shift.counted||0)-Number(shift.expected||0);
  }
  await put("cashSessions",shift);
}
async function restoreSaleStock(sale) {
  if(sale.stockRestoredAt || sale.businessType === "services") return;
  for(const item of sale.items||[]) {
    const p=state.products.find(x=>x.id===item.id && x.businessType===sale.businessType);
    if(!p) continue;
    const beforeStock=Number(p.stock||0);
    const afterStock=beforeStock+Number(item.qty||0);
    p.stock=afterStock;
    cloudQueueInventoryEvent(sale,{productLocalId:p.id,movementType:"void",quantity:Number(item.qty||0),previousStock:beforeStock,newStock:afterStock,linkedSale:true,notes:`Anulación comprobante #${sale.number}`,createdAt:new Date().toISOString()});
    try { await cloudSaveProductFromApp(p); } catch (error) { console.error(error); p.cloudPending = true; }
    await put("products",p);
  }
  sale.stockRestoredAt=new Date().toISOString();
}
window.askVoidSale = id => {
  if (!requirePermission("void_sales", "No tienes permiso para anular ventas.")) return;
  const sale=state.sales.find(x=>x.id===id);
  if(!sale || sale.voided) return;
  modal(`<h3>Anular comprobante #${sale.number}</h3><p>La venta dejará de contar en los totales activos, Caja, reportes y Crédito.</p><p class="muted">El comprobante quedará guardado como ANULADO para mantener el historial.</p><div class="field"><label>Motivo opcional</label><input id="voidReason" placeholder="Ej. venta ingresada por error"></div><div class="toolbar"><button class="btn danger" onclick="voidSale('${id}')">Anular comprobante</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
};
window.voidSale = async id => {
  if (!requirePermission("void_sales", "No tienes permiso para anular ventas.")) return;
  const sale=state.sales.find(x=>x.id===id);
  if(!sale || sale.voided) return;
  const reason=$("#voidReason")?.value?.trim()||"";
  const beforeVoid={status:"active",hiddenFromSales:!!sale.hiddenFromSales,total:Number(sale.total||0)};
  sale.voided=true;
  sale.voidedAt=new Date().toISOString();
  sale.voidReason=reason;
  cloudQueueAuditEvent(sale,"void","sale",beforeVoid,{status:"voided",reason,total:Number(sale.total||0)});
  await restoreSaleStock(sale);
  await put("sales",sale);
  if(sale.businessType==="food" && sale.tableAccountId) {
    const acc=state.tableAccounts.find(a=>a.id===sale.tableAccountId);
    if(acc && acc.status==="paid" && acc.paidSaleId===sale.id) {
      acc.status="open";
      acc.paidSaleId="";
      acc.paidAt="";
      acc.updatedAt=new Date().toISOString();
      await put("tableAccounts",acc);
      try { await cloudSaveTableAccountFromApp(acc); } catch (error) { console.error(error); acc.cloudPending = true; await put("tableAccounts",acc); }
    }
  }
  await refreshShiftAfterVoid(sale);
  try { await cloudSaveSaleFromApp(sale); } catch (error) { console.error(error); sale.cloudPending = true; await put("sales",sale); }
  if (sale.shiftId) { const sh=state.cashSessions.find(x=>x.id===sale.shiftId); if(sh){ try{await cloudSaveCashSessionFromApp(sh);}catch(error){console.error(error);sh.cloudPending=true;await put("cashSessions",sh);} } }
  closeModal();
  salesStatusMode="voided";
  screen="sales";
  renderSales();
  toast(`Comprobante #${sale.number} anulado.`);
};
window.askHideSale = id => {
  if (!requirePermission("void_sales", "No tienes permiso para eliminar comprobantes anulados de la vista.")) return;
  const sale=state.sales.find(x=>x.id===id);
  if(!sale || !sale.voided) return;
  modal(`<h3>Eliminar de Mis ventas</h3><p>¿Quieres quitar el comprobante #${sale.number} de la pantalla Mis ventas?</p><p class="muted">El registro interno de la anulación se conservará. No cambia Caja, Crédito ni reportes.</p><div class="toolbar"><button class="btn danger" onclick="hideSaleFromHistory('${id}')">Eliminar de Mis ventas</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
};
window.hideSaleFromHistory = async id => {
  if (!requirePermission("void_sales", "No tienes permiso para eliminar comprobantes anulados de la vista.")) return;
  const sale=state.sales.find(x=>x.id===id);
  if(!sale || !sale.voided) return;
  sale.hiddenFromSales=true;
  sale.hiddenFromSalesAt=new Date().toISOString();
  cloudQueueAuditEvent(sale,"hide_from_sales","sale",{hiddenFromSales:false},{hiddenFromSales:true});
  await put("sales",sale);
  try { await cloudSaveSaleFromApp(sale); } catch (error) { console.error(error); sale.cloudPending = true; await put("sales",sale); }
  closeModal();
  screen="sales";
  renderSales();
  toast("Comprobante eliminado de Mis ventas.");
};

