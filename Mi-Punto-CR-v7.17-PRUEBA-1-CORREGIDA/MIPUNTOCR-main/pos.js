/* =========================
   INICIO
========================= */
function renderHome() {
  const today = new Date().toDateString();
  const todaySales = isFood() ? activeShiftSales() : activeCurrentSales().filter(s => new Date(s.createdAt).toDateString() === today);
  const sold = todaySales.reduce((a, b) => a + Number(b.total || 0), 0);
  const credit = state.clients.reduce((a, b) => a + clientModuleBalance(b.id), 0);
  const shiftOpen = !!currentShift();

  if (isDesktopPOS()) {
    const primaryTitle = isFood() ? (shiftOpen ? "Nueva venta" : "Abrir caja") : (isServices() ? "Nuevo servicio" : "Nueva venta");
    const primarySub = isFood() ? (shiftOpen ? "Selecciona productos y cobra" : "Abre la caja para comenzar a vender") : (isServices() ? "Selecciona un servicio y cobra" : "Selecciona artículos y cobra");
    const primaryAction = isFood() && !shiftOpen ? "openCash()" : "go('sale')";
    const primaryAllowed = hasPermission("sell") && (!isFood() || shiftOpen || hasPermission("cash"));
    const statusText = isFood() ? (shiftOpen ? "Abierta" : "Cerrada") : "No requerida";
    const statusClass = isFood() && shiftOpen ? "open" : "";
    const tools = [];
    if (isFood()) tools.push(["orders", "Pedidos", "Pendientes y preparación"], ["tables", "Mesas", "Cuentas abiertas del salón"], ["products", "Productos", "Comidas, bebidas y stock"], ["clients", "Clientes / Crédito", "Saldos y abonos"], ["cash", "Caja", shiftOpen ? "Turno abierto" : "Abrir turno"], ["sales", "Mis ventas", "Comprobantes e historial"], ["catalog", "Menú QR", "Vista del menú"]);
    if (isProducts()) tools.push(["products", "Productos", "Artículos, variantes y stock"], ["clients", "Clientes / Crédito", "Saldos y abonos"], ["sales", "Mis ventas", "Comprobantes e historial"], ["catalog", "Catálogo QR", "Vista del catálogo"]);
    if (isServices()) tools.push(["products", "Servicios", "Precios y categorías"], ["clients", "Clientes", "Contactos y crédito"], ["sales", "Mis ventas", "Comprobantes e historial"], ["catalog", "Catálogo QR", "Vista de servicios"]);
    const toolsHtml = tools.filter(([target]) => canAccessScreen(target)).map(([target, title, sub]) => `<button class="desktop-tool" onclick="go('${target}')"><strong>${title}</strong><span>${sub}</span></button>`).join("");
    const html = `<section class="desktop-home"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px"><div><h2>Inicio</h2><div class="desktop-home-sub">Accesos rápidos para trabajar.</div></div><span class="desktop-cash-state ${statusClass}">${isFood() ? `Caja ${statusText.toLowerCase()}` : "Cobro directo"}</span></div><div class="desktop-kpis"><button class="desktop-kpi actionable" onclick="go('sales')"><span>Ventas hoy</span><strong>${money(sold)}</strong></button><button class="desktop-kpi actionable" onclick="go('clients')"><span>Por cobrar</span><strong>${money(credit)}</strong></button><div class="desktop-kpi"><span>${isFood() ? "Caja" : "Tipo de negocio"}</span><strong style="font-size:18px;margin-top:11px">${isFood() ? statusText : (isServices() ? "Servicios" : "Artículos")}</strong></div></div><button class="desktop-primary-action" ${primaryAllowed ? `onclick="${primaryAction}"` : "disabled style='opacity:.55'"}><span><strong>${primaryAllowed ? primaryTitle : "Sin permiso para vender"}</strong><small>${primaryAllowed ? primarySub : "El dueño puede cambiar tus permisos"}</small></span><b>›</b></button><div class="desktop-tools">${toolsHtml}</div></section>`;
    $("#app").innerHTML = shell(html, "home");
    return;
  }

  let cards = "";
  if (isFood()) cards = `${canAccessScreen("sale") ? card("sale", "Nueva venta", shiftOpen ? "Vende y cobra rápido" : "Abre caja para poder vender", true, !shiftOpen) : ""}${canAccessScreen("orders") ? card("orders", "Pedidos", "Pendientes, preparando y listos") : ""}${canAccessScreen("tables") ? card("tables", "Mesas", "Cuentas abiertas del salón") : ""}${canAccessScreen("cash") ? card("cash", shiftOpen ? "Caja abierta" : "Abrir caja", shiftOpen ? "Ventas y cierre" : "Fondo inicial y apertura") : ""}${canAccessScreen("products") ? card("products", "Productos", "Comidas, bebidas y stock") : ""}${canAccessScreen("clients") ? card("clients", "Clientes / Crédito", "Compras, saldos y abonos") : ""}${canAccessScreen("catalog") ? card("catalog", "Menú QR", "Vista del menú") : ""}${canAccessScreen("sales") ? card("sales", "Mis ventas", "Comprobantes e historial") : ""}`;
  if (isProducts()) cards = `${canAccessScreen("sale") ? card("sale", "Vender", "Selecciona artículos y cobra", true) : ""}${canAccessScreen("products") ? card("products", "Productos", "Artículos, variantes y stock") : ""}${canAccessScreen("clients") ? card("clients", "Clientes / Crédito", "Compras, saldos y abonos") : ""}${canAccessScreen("catalog") ? card("catalog", "Catálogo QR", "Vista del catálogo") : ""}${canAccessScreen("sales") ? card("sales", "Mis ventas", "Comprobantes e historial") : ""}`;
  if (isServices()) cards = `${canAccessScreen("sale") ? card("sale", "Nuevo servicio", "Selecciona el servicio y cobra", true) : ""}${canAccessScreen("products") ? card("products", "Servicios", "Precios y categorías") : ""}${canAccessScreen("clients") ? card("clients", "Clientes", "Contactos, compras y crédito") : ""}${canAccessScreen("catalog") ? card("catalog", "Catálogo QR", "Vista de servicios") : ""}${canAccessScreen("sales") ? card("sales", "Mis ventas", "Comprobantes e historial") : ""}`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>¿Qué necesitas hacer?</h2><p>Solo mostramos lo que realmente sirve para tu negocio.</p></section><div class="kpi-grid"><button class="kpi" style="text-align:left" onclick="go('sales')"><span class="muted">Ventas hoy</span><strong>${money(sold)}</strong></button><button class="kpi" style="text-align:left" onclick="go('clients')"><span class="muted">Por cobrar</span><strong>${money(credit)}</strong></button></div><div class="home-grid" style="margin-top:14px">${cards}${role === "owner" ? card("users", "Usuarios", "Roles y permisos") + card("settings", "Configuración", "Datos básicos del negocio") : ""}</div>`, "home");
}

function totals(subtotal) {
  const rate = Number(state.settings.taxRate || 0), mode = state.settings.taxMode;
  if (mode === "added") return { subtotal, tax: subtotal * rate / 100, total: subtotal * (1 + rate / 100) };
  if (mode === "included" && rate > 0) return { subtotal, tax: subtotal - subtotal / (1 + rate / 100), total: subtotal };
  return { subtotal, tax: 0, total: subtotal };
}
function saleSubtotal() { return cart.reduce((a, b) => a + Number(b.price || 0) * Number(b.qty || 0), 0); }
function clientName(id) { return state.clients.find(x => x.id === id)?.name || ""; }

/* =========================
   VENTA VERTICAL
========================= */
function renderSale() {
  if (isDesktopPOS()) return renderDesktopSale();
  if (!canSell()) { screen = "cash"; return renderCash(); }
  const t = totals(saleSubtotal());
  const categories = [...new Set(currentProducts().map(p => p.category?.trim() || "Otros"))];
  const categoryHtml = categories.map(c => {
    const count = currentProducts().filter(p => (p.category?.trim() || "Otros") === c).length;
    return `<button class="category-card" onclick="openCategory(decodeURIComponent('${enc(c)}'))"><span class="category-name">${esc(c)}</span><span class="category-count">${count} ${isServices() ? (count === 1 ? "servicio" : "servicios") : (count === 1 ? "producto" : "productos")}</span><span class="category-arrow">›</span></button>`;
  }).join("");
  const cartHtml = cart.length ? cart.map(i => `<div class="cart-item"><div><strong>${esc(i.name)}</strong>${i.variant ? `<div class="muted">${esc(i.variant)}</div>` : ""}<div class="muted">${money(i.price)} c/u</div></div><div class="qty"><button onclick="qty('${i.cartId}',-1)">−</button><strong>${i.qty}</strong><button onclick="qty('${i.cartId}',1)">+</button></div></div>`).join("") : `<div class="empty">Selecciona una categoría para comenzar.</div>`;
  const foodMeta = isFood() ? `<div class="quick-meta"><button class="${saleMeta.orderType === "Mostrador" ? "active" : ""}" onclick="setOrderType('Mostrador')">Mostrador</button><button class="${saleMeta.orderType === "Para llevar" ? "active" : ""}" onclick="setOrderType('Para llevar')">Para llevar</button><button class="${saleMeta.orderType === "Mesa" ? "active" : ""}" onclick="askTable()">${saleMeta.table ? `Mesa ${esc(saleMeta.table)}` : "Mesa"}</button><button onclick="editSaleNote()">${saleMeta.note ? "Nota ✓" : "Nota"}</button></div>` : "";
  const selectedClient = saleMeta.clientId ? `<span><strong>${esc(clientName(saleMeta.clientId))}</strong></span>` : `<span class="muted">Sin cliente</span>`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${isServices() ? "Nuevo servicio" : "Nueva venta"}</h2><p>Selecciona una categoría.</p></section><div class="sale-layout"><section class="panel"><input class="search" placeholder="Buscar categoría..." oninput="filterCategories(this.value)"><div class="category-grid">${categoryHtml || `<div class="empty">Primero agrega ${isServices() ? "servicios" : "productos"}.</div>`}</div></section><section class="panel">${foodMeta}<div class="row-head"><h3 style="margin:0">${isServices() ? "Servicio actual" : "Venta actual"}</h3><button class="btn ghost" onclick="clearCart()">Vaciar</button></div><div class="row-head" style="margin:12px 0"><div>${selectedClient}</div><button class="btn ghost" onclick="selectSaleClient()">${saleMeta.clientId ? "Cambiar cliente" : "Cliente opcional"}</button></div><div class="cart-list">${cartHtml}</div>${state.settings.taxMode !== "exempt" ? `<div class="divider"></div><div class="ticket-line"><span class="muted">Impuesto</span><span>${money(t.tax)}</span></div>` : ""}<div class="total-box"><span>Total</span><span>${money(t.total)}</span></div>${isFood() && saleMeta.orderType === "Mesa" ? `<div class="toolbar"><button class="btn primary" onclick="saveTableAccount()">Guardar mesa</button><button class="btn ghost" onclick="previewCurrentPrebill()">Precuenta</button><button class="btn ghost" onclick="go('tables')">Ver mesas</button></div>` : ""}<div class="payment-grid"><button class="pay-btn pay-cash" onclick="pay('cash')">Efectivo</button><button class="pay-btn pay-sinpe" onclick="pay('sinpe')">SINPE</button><button class="pay-btn pay-card" onclick="pay('card')">Tarjeta / Otro</button><button class="pay-btn pay-credit" onclick="pay('credit')">Crédito</button></div></section></div>`, "sale");
}
window.openCategory = c => {
  const items = currentProducts().filter(p => (p.category?.trim() || "Otros") === c);
  modal(`<div class="category-modal-header"><div><h3>${esc(c)}</h3><p class="muted">Toca ${isServices() ? "un servicio" : "un producto"} para agregarlo.</p></div><button class="modal-close" onclick="closeModal()">×</button></div><div class="category-products">${items.map(p => `<button class="category-product" onclick="pickProduct('${p.id}')"><span><strong>${esc(p.name)}</strong>${!isServices() ? `<small>Stock: ${Number(p.stock || 0)}</small>` : ""}</span><span class="category-product-price">${money(p.price)}</span></button>`).join("")}</div>`);
};
window.pickProduct = id => {
  const p = currentProducts().find(x => x.id === id); if (!p) return;
  if (!isFood() && p.variants?.length) return modal(`<h3>${esc(p.name)}</h3><p class="muted">Elige una opción.</p><div class="variant-list">${p.variants.map(v => `<button class="category-product" onclick="addCart('${p.id}',decodeURIComponent('${enc(v)}'))"><strong>${esc(v)}</strong><span class="category-product-price">${money(p.price)}</span></button>`).join("")}</div>`);
  addCart(id, "");
};
window.addCart = (id, variant = "") => {
  const p = currentProducts().find(x => x.id === id); if (!p) return;
  const cartId = `${id}_${variant || "normal"}`;
  const old = cart.find(x => x.cartId === cartId);
  if (old) old.qty++;
  else cart.push({ ...p, cartId, variant, qty: 1 });
  closeModal(); rerenderSale(); toast(`${p.name} agregado`);
};
window.qty = (id, change) => { const i = cart.find(x => x.cartId === id); if (!i) return; i.qty += change; if (i.qty <= 0) cart = cart.filter(x => x.cartId !== id); rerenderSale(); };
window.clearCart = () => { cart = []; resetSaleMeta(); rerenderSale(); };
window.filterCategories = q => $$(".category-card").forEach(el => el.style.display = el.innerText.toLowerCase().includes(q.toLowerCase().trim()) ? "" : "none");
window.setOrderType = value => { saleMeta.orderType = value; if (value !== "Mesa") saleMeta.table = ""; rerenderSale(); };
window.askTable = () => showTablePicker();
window.editSaleNote = () => modal(`<h3>Nota de la venta</h3><div class="field"><textarea id="saleNote" rows="4" placeholder="Ej. sin cebolla, entregar a las 3...">${esc(saleMeta.note)}</textarea></div><div class="toolbar"><button class="btn primary" onclick="saveSaleNote()">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveSaleNote = () => { saleMeta.note = $("#saleNote").value.trim(); closeModal(); rerenderSale(); };
window.selectSaleClient = () => {
  const opts = state.clients.map(c => `<option value="${c.id}" ${saleMeta.clientId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  modal(`<h3>Cliente</h3><div class="field"><label>Selecciona</label><select id="saleClient"><option value="">Sin cliente</option>${opts}</select></div><div class="toolbar"><button class="btn primary" onclick="saveSaleClient()">Guardar</button><button class="btn ghost" onclick="newClientFromSale()">Nuevo cliente</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
};
window.saveSaleClient = () => { saleMeta.clientId = $("#saleClient").value; closeModal(); rerenderSale(); };
window.newClientFromSale = () => modal(`<h3>Nuevo cliente</h3><div class="field"><label>Nombre</label><input id="cName"></div><div class="field"><label>Teléfono / WhatsApp</label><input id="cPhone"></div><div class="toolbar"><button class="btn primary" onclick="saveClient(true)">Guardar y seleccionar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);

/* =========================
   POS PARA COMPUTADORA
========================= */
function renderDesktopSale() {
  if (!canSell()) { screen = "cash"; return renderCash(); }
  const categories = [...new Set(currentProducts().map(p => p.category?.trim() || "Otros"))];
  if (!quickCategory || !categories.includes(quickCategory)) quickCategory = categories[0] || "";
  const items = currentProducts().filter(p => (p.category?.trim() || "Otros") === quickCategory);
  const t = totals(saleSubtotal());
  const catHtml = categories.map(c => `<button class="desktop-category-btn ${c === quickCategory ? "active" : ""}" onclick="desktopSetCategory(decodeURIComponent('${enc(c)}'))">${esc(c)}</button>`).join("") || `<div class="empty" style="padding:10px">Sin categorías.</div>`;
  const itemHtml = items.map(p => `<button class="desktop-product" data-desktop-product="1" data-search="${esc((p.name + " " + (p.category || "")).toLowerCase())}" onclick="pickProduct('${p.id}')"><strong>${esc(p.name)}</strong>${!isFood() && p.variants?.length ? `<small>${p.variants.length} opciones</small>` : (!isServices() ? `<small>Stock: ${Number(p.stock || 0)}</small>` : `<small>${esc(p.category || "Servicio")}</small>`)}<span>${money(p.price)}</span></button>`).join("") || `<div class="empty" style="grid-column:1/-1">No hay ${isServices() ? "servicios" : "productos"} en esta categoría.</div>`;
  const cartHtml = cart.length ? cart.map(i => `<div class="cart-item"><div style="min-width:0"><strong>${esc(i.name)}</strong>${i.variant ? `<div class="muted">${esc(i.variant)}</div>` : ""}<div class="muted">${money(i.price)} c/u</div></div><div class="qty"><button onclick="qty('${i.cartId}',-1)">−</button><strong>${i.qty}</strong><button onclick="qty('${i.cartId}',1)">+</button></div></div>`).join("") : `<div class="empty" style="padding:18px 8px">Selecciona ${isServices() ? "un servicio" : "un producto"}.</div>`;
  const foodMeta = isFood() ? `<div class="desktop-cart-meta"><button class="${saleMeta.orderType === "Mostrador" ? "active" : ""}" onclick="setOrderType('Mostrador')">Mostrador</button><button class="${saleMeta.orderType === "Para llevar" ? "active" : ""}" onclick="setOrderType('Para llevar')">Para llevar</button><button class="${saleMeta.orderType === "Mesa" ? "active" : ""}" onclick="askTable()">${saleMeta.table ? `Mesa ${esc(saleMeta.table)}` : "Mesa"}</button><button onclick="editSaleNote()">${saleMeta.note ? "Nota ✓" : "Nota"}</button></div>` : "";
  const selectedClient = saleMeta.clientId ? esc(clientName(saleMeta.clientId)) : "Sin cliente";
  const shift = currentShift();
  const content = `<section class="desktop-pos-page"><div class="desktop-pos-header"><div><h2>${isServices() ? "Nuevo servicio" : "Punto de venta"}</h2><p>${isServices() ? "Selecciona el servicio y cobra." : "Selecciona productos y cobra desde la misma pantalla."}</p></div>${isFood() ? `<span class="desktop-cash-state open">Caja abierta${shift ? ` · ${dateTime(shift.openedAt)}` : ""}</span>` : `<span class="desktop-cash-state open">Listo para cobrar</span>`}</div><div class="desktop-pos-layout"><aside class="desktop-pos-box desktop-category-pane"><div class="desktop-category-title">Categorías</div>${catHtml}</aside><section class="desktop-pos-box desktop-product-pane"><div class="desktop-product-toolbar"><input class="search" placeholder="Buscar en ${esc(quickCategory || (isServices() ? "servicios" : "productos"))}..." oninput="desktopFilterProducts(this.value)"></div><div class="desktop-product-grid">${itemHtml}</div></section><aside class="desktop-pos-box desktop-cart-pane">${foodMeta}<div class="desktop-cart-head"><h3>${isServices() ? "Servicio actual" : "Venta actual"}</h3><button class="btn ghost" style="padding:7px 9px;font-size:11px" onclick="clearCart()">Vaciar</button></div><div class="desktop-client-row"><span><strong>${selectedClient}</strong></span><button onclick="selectSaleClient()">${saleMeta.clientId ? "Cambiar" : "Cliente"}</button></div><div class="desktop-cart-list">${cartHtml}</div><div class="desktop-summary">${state.settings.taxMode !== "exempt" ? `<div class="ticket-line"><span class="muted">Impuesto</span><span>${money(t.tax)}</span></div>` : ""}<div class="total-box"><span>Total</span><span>${money(t.total)}</span></div></div>${isFood() && saleMeta.orderType === "Mesa" ? `<div class="toolbar"><button class="btn primary" onclick="saveTableAccount()">Guardar mesa</button><button class="btn ghost" onclick="previewCurrentPrebill()">Precuenta</button></div>` : ""}<div class="desktop-pay-grid"><button class="pay-btn pay-cash" onclick="pay('cash')">Efectivo</button><button class="pay-btn pay-sinpe" onclick="pay('sinpe')">SINPE</button><button class="pay-btn pay-card" onclick="pay('card')">Tarjeta</button><button class="pay-btn pay-credit" onclick="pay('credit')">Crédito</button></div></aside></div></section>`;
  $("#app").innerHTML = shell(content, "sale");
}
window.desktopSetCategory = c => { quickCategory = c; renderDesktopSale(); };
window.desktopFilterProducts = q => {
  const v = String(q || "").trim().toLowerCase();
  $$('[data-desktop-product="1"]').forEach(el => { el.style.display = !v || (el.dataset.search || "").includes(v) ? "" : "none"; });
};

/* =========================
   MODO COBRO RÁPIDO HORIZONTAL
========================= */
function renderQuickSale() {
  if (!state.settings.onboardingComplete || state.settings.sessionActive === false || locked) return render();
  if (!canSell()) {
    $("#app").innerHTML = `<section class="quick-shell" style="grid-template-columns:1fr"><div class="quick-col" style="display:grid;place-items:center"><div style="max-width:420px;text-align:center"><h2>Caja cerrada</h2><p class="muted">Primero debes abrir la caja para vender comida.</p><button class="btn primary" onclick="openCash()">Abrir caja</button></div></div></section>`;
    return;
  }
  const categories = [...new Set(currentProducts().map(p => p.category?.trim() || "Otros"))];
  if (!quickCategory || !categories.includes(quickCategory)) quickCategory = categories[0] || "";
  const items = currentProducts().filter(p => (p.category?.trim() || "Otros") === quickCategory);
  const t = totals(saleSubtotal());
  const catHtml = categories.map(c => `<button class="quick-category ${c === quickCategory ? "active" : ""}" onclick="quickSetCategory(decodeURIComponent('${enc(c)}'))">${esc(c)}</button>`).join("");
  const itemHtml = items.map(p => `<button class="quick-product" onclick="pickProduct('${p.id}')"><strong>${esc(p.name)}</strong>${!isFood() && p.variants?.length ? `<small class="muted">${p.variants.length} opciones</small>` : ""}<span>${money(p.price)}</span></button>`).join("") || `<div class="empty">No hay ${isServices() ? "servicios" : "productos"}.</div>`;
  const cartHtml = cart.length ? cart.map(i => `<div class="cart-item" style="padding:8px 0"><div><strong style="font-size:14px">${esc(i.name)}</strong>${i.variant ? `<div class="muted" style="font-size:11px">${esc(i.variant)}</div>` : ""}</div><div class="qty"><button style="width:32px;height:32px" onclick="qty('${i.cartId}',-1)">−</button><strong>${i.qty}</strong><button style="width:32px;height:32px" onclick="qty('${i.cartId}',1)">+</button></div></div>`).join("") : `<div class="empty" style="padding:12px">Toca un artículo.</div>`;
  const foodButtons = isFood() ? `<div class="quick-meta"><button class="${saleMeta.orderType === "Mostrador" ? "active" : ""}" onclick="setOrderType('Mostrador')">Mostrador</button><button class="${saleMeta.orderType === "Para llevar" ? "active" : ""}" onclick="setOrderType('Para llevar')">Para llevar</button><button class="${saleMeta.orderType === "Mesa" ? "active" : ""}" onclick="askTable()">${saleMeta.table ? `Mesa ${esc(saleMeta.table)}` : "Mesa"}</button><button onclick="editSaleNote()">${saleMeta.note ? "Nota ✓" : "Nota"}</button></div>` : "";
  $("#app").innerHTML = `<section class="quick-shell"><aside class="quick-col"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px"><div class="quick-brand" style="margin:2px 4px">Mi Punto CR</div>${securityLockButton("quick-lock")}</div>${catHtml}</aside><main class="quick-col"><div class="row-head" style="margin-bottom:9px"><strong>${esc(quickCategory || (isServices() ? "Servicios" : "Productos"))}</strong><span class="muted">Cobro rápido</span></div><div class="quick-products">${itemHtml}</div></main><aside class="quick-col quick-cart">${foodButtons}<div class="quick-meta"><button onclick="selectSaleClient()">${saleMeta.clientId ? esc(clientName(saleMeta.clientId)) : "Cliente"}</button><button onclick="clearCart()">Vaciar</button></div><div class="quick-cart-list">${cartHtml}</div><div class="quick-total"><span>Total</span><span>${money(t.total)}</span></div>${isFood() && saleMeta.orderType === "Mesa" ? `<div class="quick-meta"><button class="active" onclick="saveTableAccount()">Guardar mesa</button><button onclick="previewCurrentPrebill()">Precuenta</button></div>` : ""}<div class="quick-pay"><button class="pay-btn pay-cash" onclick="pay('cash')">Efectivo</button><button class="pay-btn pay-sinpe" onclick="pay('sinpe')">SINPE</button><button class="pay-btn pay-card" onclick="pay('card')">Tarjeta</button><button class="pay-btn pay-credit" onclick="pay('credit')">Crédito</button></div></aside></section>`;
}
window.quickSetCategory = c => { quickCategory = c; renderQuickSale(); };
window.renderPortraitFallback = () => { if (isQuickLandscape()) { toast("Pon el teléfono vertical para administrar la caja."); } else render(); };

/* =========================
   COBRO
========================= */
window.pay = method => {
  if (!cart.length) return toast(isServices() ? "Agrega al menos un servicio." : "Agrega al menos un producto.");
  const t = totals(saleSubtotal());
  if (method === "cash") {
    modal(`<h3>Cobro en efectivo</h3><p>Total: <strong>${money(t.total)}</strong></p><div class="cash-quick-grid"><button class="cash-chip" data-cash="1000" onclick="setCashReceived(1000,${t.total})">₡1.000</button><button class="cash-chip" data-cash="2000" onclick="setCashReceived(2000,${t.total})">₡2.000</button><button class="cash-chip" data-cash="5000" onclick="setCashReceived(5000,${t.total})">₡5.000</button><button class="cash-chip" data-cash="10000" onclick="setCashReceived(10000,${t.total})">₡10.000</button><button class="cash-chip" data-cash="20000" onclick="setCashReceived(20000,${t.total})">₡20.000</button><button class="cash-chip" data-cash="exact" onclick="setCashReceived(${t.total},${t.total},'exact')">Exacto</button></div><div class="field"><label>Otro monto</label><input id="received" type="number" inputmode="decimal" placeholder="Escribe el monto recibido" oninput="cashCustomInput(${t.total})"></div><div class="change-card"><span>Vuelto</span><strong id="changeValue">${money(0)}</strong></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="finishCash()">Confirmar cobro</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
  }
  if (method === "sinpe") modal(`<h3>Cobro por SINPE</h3><p>Total: <strong>${money(t.total)}</strong></p><div class="panel" style="box-shadow:none">${state.settings.sinpe ? `Número SINPE: <strong>${esc(state.settings.sinpe)}</strong>` : "Configura tu número SINPE."}</div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="finishSale('SINPE')">Confirmar pago</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
  if (method === "card") modal(`<h3>Tarjeta / Otro</h3><p>Total: <strong>${money(t.total)}</strong></p><div class="field"><label>Referencia opcional</label><input id="ref"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="finishSale('Tarjeta/Otro',$('#ref').value)">Confirmar pago</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
  if (method === "credit") {
    const opts = state.clients.map(c => `<option value="${c.id}" ${(saleMeta.clientId === c.id) ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    modal(`<h3>Venta a crédito</h3><p>Total: <strong>${money(t.total)}</strong></p><div class="field"><label>Cliente</label><select id="creditClient"><option value="">Selecciona cliente</option>${opts}</select></div>${!state.clients.length ? `<p class="muted">Primero crea un cliente.</p>` : ""}<div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="finishCredit()">Guardar crédito</button><button class="btn ghost" onclick="newClientFromCredit()">Nuevo cliente</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
  }
};
window.setCashReceived = (amount, total, kind = "") => {
  const input = $("#received"); if (!input) return;
  input.value = Math.round(Number(amount || 0));
  $$(".cash-chip").forEach(b => b.classList.remove("active"));
  const target = kind === "exact" ? document.querySelector('[data-cash="exact"]') : document.querySelector(`[data-cash="${Math.round(Number(amount || 0))}"]`);
  target?.classList.add("active");
  changeText(total);
};
window.cashCustomInput = total => { $$(".cash-chip").forEach(b => b.classList.remove("active")); changeText(total); };
window.changeText = total => { const v = Number($("#received")?.value || 0); if ($("#changeValue")) $("#changeValue").textContent = money(Math.max(0, v - total)); };
window.finishCash = async () => { const received = Number($("#received")?.value || 0); const t = totals(saleSubtotal()); if (received < t.total) return toast("El monto recibido es menor al total."); await saveSale("Efectivo", "", saleMeta.clientId, received); };
window.finishSale = async (method, ref = "") => saveSale(method, ref, saleMeta.clientId);
window.finishCredit = async () => {
  const clientId = $("#creditClient").value;
  if (!clientId) return toast("Selecciona un cliente.");
  const t = totals(saleSubtotal());
  saleMeta.clientId = clientId;
  await saveSale("Crédito", "", clientId);
};
window.newClientFromCredit = () => modal(`<h3>Nuevo cliente</h3><div class="field"><label>Nombre</label><input id="cName"></div><div class="field"><label>Teléfono / WhatsApp</label><input id="cPhone"></div><div class="toolbar"><button class="btn primary" onclick="saveClientForCredit()">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveClientForCredit = async () => {
  const name = $("#cName").value.trim(); if (!name) return toast("Escribe el nombre.");
  const c = { id: (crypto?.randomUUID?crypto.randomUUID():uid("c")), name, phone: $("#cPhone").value.trim(), balance: 0 };
  cloudQueueAuditEvent(c,"create","client",null,{name:c.name,phone:c.phone});
  try{await cloudSaveClientFromApp(c);}catch(error){console.error(error);c.cloudPending=true;}
  await put("clients", c); state.clients.push(c); saleMeta.clientId = c.id; closeModal(); pay("credit");
};

async function saveSale(method, reference = "", clientId = "", received = null) {
  const t = totals(saleSubtotal());
  const sale = {
    id: uid("sale"),
    number: nextSaleNumber(),
    createdAt: new Date().toISOString(),
    shiftId: currentShift()?.id || null,
    businessType: type(),
    items: cart.map(i => ({ id: i.id, name: i.name, variant: i.variant || "", price: i.price, qty: i.qty })),
    subtotal: t.subtotal,
    tax: t.tax,
    taxMode: state.settings.taxMode,
    taxRate: Number(state.settings.taxRate || 0),
    total: t.total,
    method,
    reference,
    clientId: clientId || "",
    received,
    change: received === null ? 0 : Math.max(0, received - t.total),
    orderType: saleMeta.orderType || "Mostrador",
    table: saleMeta.table || "",
    tableAccountId: saleMeta.tableAccountId || "",
    note: saleMeta.note || ""
  };
  cloudQueueAuditEvent(sale,"create","sale",null,{number:sale.number,total:sale.total,method:sale.method,businessType:sale.businessType,clientId:sale.clientId||null,orderType:sale.orderType,table:sale.table||null});
  await put("sales", sale);
  state.sales.push(sale);
  if (!isServices()) {
    for (const item of sale.items) {
      const p = currentProducts().find(x => x.id === item.id);
      if (p) {
        const beforeStock=Number(p.stock||0);
        const afterStock=Math.max(0,beforeStock-Number(item.qty||0));
        item.stockBefore=beforeStock;
        item.stockAfter=afterStock;
        p.stock=afterStock;
        cloudQueueInventoryEvent(sale,{productLocalId:p.id,movementType:"sale",quantity:-Number(item.qty||0),previousStock:beforeStock,newStock:afterStock,linkedSale:true,notes:`Venta #${sale.number}` ,createdAt:sale.createdAt});
        p.cloudPending = cloudOperationsConnected();
        await put("products", p);
      }
    }
    await put("sales",sale);
  }
  if (isFood() && sale.orderType === "Mesa" && sale.table) {
    let acc = sale.tableAccountId ? state.tableAccounts.find(a => a.id === sale.tableAccountId) : tableAccount(Number(sale.table));
    if (!acc) {
      acc = { id: uid("table"), tableNumber: Number(sale.table), openedAt: sale.createdAt };
      state.tableAccounts.push(acc);
    }
    acc.status = "paid";
    acc.items = sale.items.map(i => ({ ...i }));
    acc.note = sale.note || "";
    acc.clientId = sale.clientId || "";
    acc.total = sale.total;
    acc.paidSaleId = sale.id;
    acc.paidAt = sale.createdAt;
    acc.updatedAt = sale.createdAt;
    await put("tableAccounts", acc);
    sale.tableAccountId = acc.id;
    await put("sales", sale);
  }
  // v7.17: el comprobante no espera a la red. La venta ya quedó guardada localmente.
  sale.cloudPending = cloudOperationsConnected();
  await put("sales", sale);
  const soldProducts = !isServices() ? sale.items.map(i => currentProducts().find(p => p.id === i.id)).filter(Boolean) : [];
  cart = [];
  resetSaleMeta();
  closeModal();
  showReceipt(sale);
  if (!state.settings.firstSaleCelebrated && state.sales.length === 1) {
    state.settings.firstSaleCelebrated = true; put("settings", state.settings).catch(console.error);
    setTimeout(() => toast(`🎉 Primera venta registrada · ${money(sale.total)}`), 350);
  }
  // Sincronización en segundo plano: nunca frena el paso al comprobante.
  setTimeout(async () => {
    try {
      await Promise.allSettled(soldProducts.map(product => cloudSaveProductFromApp(product)));
      await cloudSaveSaleFromApp(sale);
      sale.cloudPending = false;
      await put("sales", sale);
    } catch (error) {
      console.error(error);
      sale.cloudPending = true;
      await put("sales", sale);
    }
  }, 0);
}

