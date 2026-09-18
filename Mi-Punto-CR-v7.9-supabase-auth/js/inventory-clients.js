/* =========================
   PRODUCTOS / SERVICIOS
========================= */
function productCategories() { return [...new Set(currentProducts().map(p => p.category?.trim() || "Otros"))].sort((a,b)=>a.localeCompare(b,"es")); }
function renderProducts() {
  const label = isServices() ? "Servicios" : "Productos", singular = isServices() ? "servicio" : "producto";
  const cats = productCategories();
  const html = cats.length ? cats.map(c => {
    const items=currentProducts().filter(p=>(p.category?.trim()||"Otros")===c);
    return `<button class="product-category-card" onclick="openProductCategory(decodeURIComponent('${enc(c)}'))"><span><strong>${esc(c)}</strong><small>${items.length} ${isServices() ? (items.length===1?"servicio":"servicios") : (items.length===1?"producto":"productos")}</small></span><b>›</b></button>`;
  }).join("") : `<div class="empty">No hay ${label.toLowerCase()}.</div>`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${label}</h2><p>Primero categorías; después ${label.toLowerCase()} dentro de cada categoría. Este módulo tiene inventario independiente.</p></section><div class="toolbar"><button class="btn primary" onclick="productForm('')">Nuevo ${singular}</button></div><div class="product-category-grid">${html}</div>`, "more");
}
window.openProductCategory = category => {
  const items=currentProducts().filter(p=>(p.category?.trim()||"Otros")===category);
  const singular=isServices()?"servicio":"producto";
  const html=items.length?items.map(p=>`<div class="row-card"><div class="row-head"><div><strong style="font-size:19px">${esc(p.name)}</strong>${!isServices()?`<div class="muted">Stock: ${Number(p.stock||0)}</div>`:""}${!isFood()&&p.variants?.length?`<div class="muted">${p.variants.map(esc).join(" · ")}</div>`:""}</div><strong>${money(p.price)}</strong></div><div class="product-row-actions"><button class="btn ghost" onclick="productForm('${p.id}')">Editar</button><button class="btn danger" onclick="askDeleteProduct('${p.id}')">Eliminar</button></div></div>`).join(""):`<div class="empty">Esta categoría está vacía.</div>`;
  $("#app").innerHTML=shell(`<button class="back-link" onclick="go('products')">‹ Categorías</button><section class="screen-title"><h2>${esc(category)}</h2><p>${items.length} ${items.length===1?singular:`${singular}s`}.</p></section><div class="toolbar"><button class="btn primary" onclick="productForm('',decodeURIComponent('${enc(category)}'))">Nuevo ${singular}</button></div><div class="category-products-page">${html}</div>`,"more");
};
window.productForm = (id, presetCategory="") => {
  const p=id?currentProducts().find(x=>x.id===id):null;
  const variantField = isProducts() ? `<div class="field"><label>Variantes opcionales</label><input id="pVariants" value="${esc(p?.variants?.join(", ")||"")}" placeholder="Ej. 50ml, 100ml o S, M, L"></div>` : `<input id="pVariants" type="hidden" value="">`;
  const stockField = !isServices() ? `<div class="field"><label>Stock</label><input id="pStock" type="number" value="${Number(p?.stock||0)}"></div>` : `<input id="pStock" type="hidden" value="0">`;
  modal(`<h3>${p?"Editar":"Nuevo"} ${isServices()?"servicio":"producto"}</h3><div class="form-grid"><div class="field"><label>Nombre</label><input id="pName" value="${esc(p?.name||"")}"></div><div class="field"><label>Precio</label><input id="pPrice" type="number" value="${Number(p?.price||0)}"></div><div class="field"><label>Categoría</label><input id="pCategory" value="${esc(p?.category||presetCategory||"")}" placeholder="Ej. Bebidas"></div>${stockField}${variantField}</div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveProduct('${p?.id||""}')">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
};
window.saveProduct = async id => {
  const name=$("#pName").value.trim(), price=Number($("#pPrice").value||0); if(!name||price<=0)return toast("Nombre y precio son obligatorios.");
  let p=id?currentProducts().find(x=>x.id===id):null; if(!p){p={id:uid("p"),businessType:type()};state.products.push(p);} p.businessType=type();p.name=name;p.price=price;p.category=$("#pCategory").value.trim()||"Otros";p.stock=Number($("#pStock").value||0);p.variants=isProducts()?$("#pVariants").value.split(",").map(x=>x.trim()).filter(Boolean):[];
  await put("products",p); const cat=p.category; closeModal(); openProductCategory(cat); toast("Guardado.");
};
window.askDeleteProduct = id => { const p=currentProducts().find(x=>x.id===id); if(!p)return; modal(`<h3>Eliminar</h3><p>¿Quieres eliminar <strong>${esc(p.name)}</strong>?</p><p class="muted">Las ventas anteriores no se borrarán.</p><div class="toolbar"><button class="btn danger" onclick="deleteProduct('${id}')">Sí, eliminar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`); };
window.deleteProduct = async id => { const p=currentProducts().find(x=>x.id===id); const cat=p?.category||"Otros"; await del("products",id); state.products=state.products.filter(x=>x.id!==id);cart=cart.filter(x=>x.id!==id);closeModal(); if(currentProducts().some(x=>(x.category?.trim()||"Otros")===cat))openProductCategory(cat);else renderProducts();toast("Eliminado."); };

/* =========================
   CLIENTES / CRÉDITO
========================= */
function renderClients() {
  const html = state.clients.length ? state.clients.map(c => { const balance = clientModuleBalance(c.id); return `<div class="row-card clickable" onclick="openClient('${c.id}')"><div class="row-head"><div><strong style="font-size:20px">${esc(c.name)}</strong><div class="muted">${esc(c.phone || "Sin teléfono")}</div></div><strong style="font-size:23px">${money(balance)}</strong></div><div class="toolbar" style="margin-top:10px;margin-bottom:0"><button class="btn ghost" onclick="event.stopPropagation();openClient('${c.id}')">Ver movimientos</button>${balance > 0 ? `<button class="btn primary" onclick="event.stopPropagation();abono('${c.id}')">Registrar abono</button>` : ""}</div></div>`; }).join("") : `<div class="empty">No hay clientes.</div>`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${isServices() ? "Clientes" : "Clientes / Crédito"}</h2><p>Compras, saldos y abonos de cada cliente.</p></section><div class="toolbar"><button class="btn primary" onclick="newClient()">Nuevo cliente</button></div><div class="list">${html}</div>`, "more");
}
window.newClient = () => modal(`<h3>Nuevo cliente</h3><div class="form-grid"><div class="field"><label>Nombre</label><input id="cName"></div><div class="field"><label>Teléfono / WhatsApp</label><input id="cPhone"></div></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveClient(false)">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveClient = async selectAfter => { const name = $("#cName").value.trim(); if (!name) return toast("Escribe el nombre."); const c = { id: uid("c"), name, phone: $("#cPhone").value.trim(), balance: 0 }; await put("clients", c); state.clients.push(c); if (selectAfter) saleMeta.clientId = c.id; closeModal(); if (selectAfter) rerenderSale(); else renderClients(); };
window.openClient = id => { activeClientId = id; screen = "clientDetail"; render(); };
function clientMovements(id) {
  const purchases = activeCurrentSales().filter(s => s.clientId === id && s.method === "Crédito").map(s => ({ id: `s_${s.id}`, kind: "sale", createdAt: s.createdAt, amount: Number(s.total || 0), saleId: s.id, title: `Compra a crédito · Comprobante #${s.number}`, detail: s.items.map(i => `${i.qty} × ${i.name}${i.variant ? ` ${i.variant}` : ""}`).join(" · ") }));
  const payments = currentCreditMoves().filter(m => m.clientId === id && m.type === "payment").map(m => ({ id: m.id, kind: "payment", createdAt: m.createdAt, amount: -Number(m.amount || 0), title: `Abono · ${m.method || ""}`, detail: m.note || "" }));
  return [...purchases, ...payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function renderClientDetail() {
  const c = state.clients.find(x => x.id === activeClientId);
  if (!c) { screen = "clients"; return renderClients(); }
  const movements = clientMovements(c.id);
  const totalCredit = activeCurrentSales().filter(s => s.clientId === c.id && s.method === "Crédito").reduce((a, b) => a + Number(b.total || 0), 0);
  const history = movements.length ? movements.map(m => `<div class="row-card ${m.kind === "sale" ? "clickable" : ""}" ${m.kind === "sale" ? `onclick="openSale('${m.saleId}')"` : ""}><div class="movement"><div><strong>${esc(m.title)}</strong><div class="movement-meta">${dateTime(m.createdAt)}</div>${m.detail ? `<div class="movement-meta">${esc(m.detail)}</div>` : ""}</div><strong class="amount ${m.amount >= 0 ? "positive" : "negative"}">${m.amount >= 0 ? "+" : "−"}${money(Math.abs(m.amount))}</strong></div>${m.kind === "sale" ? `<div class="muted" style="margin-top:8px">Toca para ver el comprobante</div>` : ""}</div>`).join("") : `<div class="empty">Este cliente todavía no tiene movimientos de crédito.</div>`;
  $("#app").innerHTML = shell(`<button class="back-link" onclick="go('clients')">‹ Clientes</button><section class="screen-title"><h2>${esc(c.name)}</h2><p>${esc(c.phone || "Sin teléfono")}</p></section><div class="panel"><div class="client-summary"><div><span class="muted">Saldo pendiente</span><div class="balance-big">${money(clientModuleBalance(c.id))}</div></div><div style="text-align:right"><span class="muted">Comprado a crédito</span><div style="font-size:21px;font-weight:850;margin-top:5px">${money(totalCredit)}</div></div></div>${clientModuleBalance(c.id) > 0 ? `<button class="btn primary full" style="margin-top:16px" onclick="abono('${c.id}')">Registrar abono</button>` : ""}</div><section class="screen-title" style="margin-top:24px"><h2 style="font-size:26px">Movimientos</h2><p>Compras a crédito y abonos.</p></section><div class="list">${history}</div>`, "more");
}
window.abono = id => { const c = state.clients.find(x => x.id === id); if (!c) return; const balance=clientModuleBalance(id); modal(`<h3>Registrar abono</h3><p>${esc(c.name)} · Saldo ${money(balance)}</p><div class="field"><label>Monto</label><input id="payAmount" type="number" inputmode="decimal"></div><div class="field"><label>Método</label><select id="payMethod"><option>Efectivo</option><option>SINPE</option><option>Tarjeta/Otro</option></select></div><div class="field"><label>Nota opcional</label><input id="payNote" placeholder="Ej. abono semanal"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveAbono('${id}')">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`); };
window.saveAbono = async id => {
  const c = state.clients.find(x => x.id === id), amount = Number($("#payAmount").value || 0), method = $("#payMethod").value, note = $("#payNote").value.trim();
  if (!c || amount <= 0) return toast("Escribe un monto válido.");
  const balance = clientModuleBalance(id);
  if (amount > balance) return toast("El abono no puede superar el saldo pendiente.");
  const move = { id: uid("credit"), type: "payment", clientId: id, amount, method, note, createdAt: new Date().toISOString(), shiftId: currentShift()?.id || null, businessType: type() };
  await put("creditMoves", move); state.creditMoves.push(move);
  if (isFood() && currentShift() && method === "Efectivo") { const m = { id: uid("move"), type: "creditPayment", clientId: id, amount, method, createdAt: move.createdAt, shiftId: currentShift().id }; await put("cashMoves", m); state.cashMoves.push(m); }
  closeModal(); activeClientId = id; screen = "clientDetail"; renderClientDetail(); toast("Abono registrado.");
};

