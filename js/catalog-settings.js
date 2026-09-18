/* =========================
   CATÁLOGO
========================= */
function renderCatalog() {
  const label = isFood() ? "Menú QR" : "Catálogo QR";
  const catalogItems = currentProducts();
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${label}</h2><p>Vista previa de lo que verá el cliente.</p></section><div class="panel">${catalogItems.length ? catalogItems.map(p => `<div class="catalog-card"><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category || "")}</div></div><strong>${money(p.price)}</strong></div>`).join("") : `<div class="empty">Todavía no hay contenido.</div>`}</div><div class="panel" style="margin-top:14px"><strong>QR público</strong><p class="muted">El QR será únicamente para consultar este ${isFood() ? "menú" : "catálogo"}. No genera pedidos ni solicitudes dentro del POS.</p></div>`, "more");
}

/* =========================
   CONFIGURACIÓN
========================= */
function renderSettings() {
  if (role !== "owner") { screen = "home"; return renderHome(); }
  settingsFormDirty = false;
  const s = state.settings;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Configuración</h2><p>Datos del negocio y protección del propietario.</p></section><div class="panel"><div class="form-grid"><div class="field"><label>Tipo de negocio</label><select id="sType" onchange="settingsFormDirty=true"><option value="food" ${type() === "food" ? "selected" : ""}>Comida / Soda / Repostería</option><option value="products" ${type() === "products" ? "selected" : ""}>Venta de artículos</option><option value="services" ${type() === "services" ? "selected" : ""}>Servicios</option></select></div>${isFood() ? `<div class="field"><label>Cantidad de mesas</label><input id="sTableCount" type="number" min="0" max="100" value="${Number(s.tableCount || 0)}"></div>` : ""}<div class="field"><label>Nombre del negocio</label><input id="sName" value="${esc(s.businessName)}"></div><div class="field"><label>Propietario</label><input value="${esc(s.ownerName || "")}" disabled></div><div class="field"><label>Correo activado</label><input value="${esc(s.email || "")}" disabled></div><div class="field"><label>Teléfono</label><input id="sPhone" value="${esc(s.phone || "")}"></div><div class="field"><label>WhatsApp</label><input id="sWa" value="${esc(s.whatsapp)}"></div><div class="field"><label>Número SINPE</label><input id="sSinpe" value="${esc(s.sinpe)}"></div><div class="field"><label>Impuesto</label><select id="sTax"><option value="included" ${s.taxMode === "included" ? "selected" : ""}>Incluido</option><option value="added" ${s.taxMode === "added" ? "selected" : ""}>Se suma al cobrar</option><option value="exempt" ${s.taxMode === "exempt" ? "selected" : ""}>Exento</option></select></div><div class="field"><label>Porcentaje</label><input id="sRate" type="number" value="${Number(s.taxRate || 13)}"></div><div class="field"><label>Código del negocio</label><input value="${esc(s.businessId || "")}" disabled></div></div><button class="btn primary full" style="margin-top:14px" onclick="saveSettings()">Guardar cambios</button></div><div class="panel" style="margin-top:14px"><strong>Activación</strong><p class="muted">Estado: ${s.activated ? "Activado" : "Pendiente"}. El código de activación es de un solo uso.</p><button class="btn ghost" onclick="logoutOwner()">Cerrar sesión</button></div>`, "more");
}
window.saveSettings = async () => { const previousType=type(); const nextType=$("#sType").value; state.settings = { ...state.settings, businessType: nextType, businessName: $("#sName").value.trim() || "Mi Punto CR", phone: $("#sPhone").value.trim(), whatsapp: $("#sWa").value.trim(), sinpe: $("#sSinpe").value.trim(), taxMode: $("#sTax").value, taxRate: Number($("#sRate").value || 0), tableCount: nextType === "food" ? Number($("#sTableCount")?.value || state.settings.tableCount || 0) : Number(state.settings.tableCount || 0) }; await put("settings", state.settings); settingsFormDirty = false; quickCategory = ""; cart=[]; resetSaleMeta(); screen = "home"; render(); toast(previousType===nextType?"Configuración guardada.":"Módulo cambiado. Inventario y ventas independientes."); };

function renderMore() {
  let cards = "";
  if (isFood()) cards += card("tables", "Mesas", "Cuentas abiertas del salón") + card("products", "Productos", "Comidas, bebidas y stock") + card("clients", "Clientes / Crédito", "Compras, saldos y abonos") + card("cash", "Caja", "Apertura y cierre") + card("sales", "Mis ventas", "Comprobantes e historial") + card("catalog", "Menú QR", "Vista del menú");
  if (isProducts()) cards += card("products", "Productos", "Artículos, variantes y stock") + card("clients", "Clientes / Crédito", "Compras, saldos y abonos") + card("sales", "Mis ventas", "Comprobantes e historial") + card("catalog", "Catálogo QR", "Vista del catálogo");
  if (isServices()) cards += card("products", "Servicios", "Precios y categorías") + card("clients", "Clientes", "Compras y crédito") + card("sales", "Mis ventas", "Comprobantes e historial") + card("catalog", "Catálogo QR", "Vista de servicios");
  if (role === "owner") cards += card("settings", "Configuración", "Datos básicos");
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Más</h2><p>Solo herramientas útiles para este negocio.</p></section><div class="home-grid">${cards}</div>`, "more");
}

