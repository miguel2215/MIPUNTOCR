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
  const cloudPanel = s.cloudLinked
    ? `<div class="panel" style="margin-top:14px"><strong>Nube</strong><p class="muted">Conectado a Supabase · ${esc(s.email || "")}</p><p class="muted">Cuenta y negocio están vinculados a la nube. Catálogo, clientes, ventas, Caja, crédito, mesas y pedidos se sincronizan con Supabase.</p></div>`
    : `<div class="panel" style="margin-top:14px"><strong>Nube</strong><p class="muted">Esta instalación tiene datos locales antiguos de prueba. Cierra sesión y crea o inicia una cuenta real para continuar.</p></div>`;
  const securityPanel = `<div class="panel" style="margin-top:14px"><strong>Seguridad y acceso</strong><p class="muted">${s.pinEnabled && s.ownerPin ? "PIN activado · Mi Punto CR se bloquea automáticamente después de 5 minutos sin actividad." : "Configura un PIN para activar el bloqueo manual y el bloqueo automático por inactividad."}</p><div class="toolbar">${s.pinEnabled && s.ownerPin ? `<button class="btn ghost" onclick="openPinSettings()">Cambiar PIN</button>` : `<button class="btn ghost" onclick="openPinSettings()">Configurar PIN</button>`}<button class="btn danger" onclick="logoutOwner()">Cerrar sesión</button></div></div>`;
  const usersPanel = `<div class="panel" style="margin-top:14px"><div class="row-head"><div><strong>Usuarios y permisos</strong><p class="muted" style="margin:5px 0 0">Invita administradores o empleados y decide qué puede hacer cada uno.</p></div><button class="btn primary" onclick="go('users')">Administrar usuarios</button></div></div>`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Configuración</h2><p>Datos del negocio y protección del propietario.</p></section><div class="panel"><div class="form-grid"><div class="field"><label>Tipo de negocio</label><select id="sType" onchange="settingsFormDirty=true"><option value="food" ${type() === "food" ? "selected" : ""}>Comida / Soda / Repostería</option><option value="products" ${type() === "products" ? "selected" : ""}>Venta de artículos</option><option value="services" ${type() === "services" ? "selected" : ""}>Servicios</option></select></div>${isFood() ? `<div class="field"><label>Cantidad de mesas</label><input id="sTableCount" type="number" min="0" max="100" value="${Number(s.tableCount || 0)}"></div>` : ""}<div class="field"><label>Nombre del negocio</label><input id="sName" value="${esc(s.businessName)}"></div><div class="field"><label>Propietario</label><input value="${esc(s.ownerName || "")}" disabled></div><div class="field"><label>Correo</label><input value="${esc(s.email || "")}" disabled></div><div class="field"><label>Teléfono</label><input id="sPhone" value="${esc(s.phone || "")}"></div><div class="field"><label>WhatsApp</label><input id="sWa" value="${esc(s.whatsapp)}"></div><div class="field"><label>Número SINPE</label><input id="sSinpe" value="${esc(s.sinpe)}"></div><div class="field"><label>Impuesto</label><select id="sTax"><option value="included" ${s.taxMode === "included" ? "selected" : ""}>Incluido</option><option value="added" ${s.taxMode === "added" ? "selected" : ""}>Se suma al cobrar</option><option value="exempt" ${s.taxMode === "exempt" ? "selected" : ""}>Exento</option></select></div><div class="field"><label>Porcentaje</label><input id="sRate" type="number" value="${Number(s.taxRate || 13)}"></div><div class="field"><label>Código del negocio</label><input value="${esc(s.businessId || "")}" disabled></div></div><button class="btn primary full" style="margin-top:14px" onclick="saveSettings()">Guardar cambios</button></div>${usersPanel}${cloudPanel}${securityPanel}`, "more");
}
window.saveSettings = async () => { const previousType=type(); const nextType=$("#sType").value; state.settings = { ...state.settings, businessType: nextType, businessName: $("#sName").value.trim() || "Mi Punto CR", phone: $("#sPhone").value.trim(), whatsapp: $("#sWa").value.trim(), sinpe: $("#sSinpe").value.trim(), taxMode: $("#sTax").value, taxRate: Number($("#sRate").value || 0), tableCount: nextType === "food" ? Number($("#sTableCount")?.value || state.settings.tableCount || 0) : Number(state.settings.tableCount || 0) }; await put("settings", state.settings); if (state.settings.cloudLinked && navigator.onLine) { try { await cloudSaveBusinessSettings(); } catch (error) { console.error(error); toast("Se guardó localmente, pero la nube no respondió."); } } settingsFormDirty = false; quickCategory = ""; cart=[]; resetSaleMeta(); screen = "home"; render(); toast(previousType===nextType?"Configuración guardada.":"Módulo cambiado. Inventario y ventas independientes."); };

function renderMore() {
  let cards = "";
  const add = (target, title, sub) => { if (canAccessScreen(target)) cards += card(target, title, sub); };
  if (isFood()) { add("tables", "Mesas", "Cuentas abiertas del salón"); add("products", "Productos", "Comidas, bebidas y stock"); add("clients", "Clientes / Crédito", "Compras, saldos y abonos"); add("cash", "Caja", "Apertura y cierre"); add("sales", "Mis ventas", "Comprobantes e historial"); add("catalog", "Menú QR", "Vista del menú"); }
  if (isProducts()) { add("products", "Productos", "Artículos, variantes y stock"); add("clients", "Clientes / Crédito", "Compras, saldos y abonos"); add("sales", "Mis ventas", "Comprobantes e historial"); add("catalog", "Catálogo QR", "Vista del catálogo"); }
  if (isServices()) { add("products", "Servicios", "Precios y categorías"); add("clients", "Clientes", "Compras y crédito"); add("sales", "Mis ventas", "Comprobantes e historial"); add("catalog", "Catálogo QR", "Vista de servicios"); }
  if (role === "owner") cards += card("users", "Usuarios", "Roles y permisos") + card("settings", "Configuración", "Datos básicos");

  const roleLabel = role === "owner" ? "Dueño" : role === "admin" ? "Administrador" : "Empleado";
  const email = state.settings.email ? ` · ${esc(state.settings.email)}` : "";
  const accountPanel = `<div class="panel" style="margin-top:14px"><strong>Cuenta</strong><p class="muted">${roleLabel}${email}</p><div class="toolbar">${state.settings.pinEnabled && state.settings.ownerPin ? `<button class="btn ghost" onclick="lockApp()">Bloquear</button>` : ""}<button class="btn danger" onclick="logoutOwner()">Cerrar sesión</button></div></div>`;

  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Más</h2><p>Solo herramientas útiles para este negocio.</p></section><div class="home-grid">${cards || `<div class="empty">No tienes herramientas adicionales habilitadas.</div>`}</div>${accountPanel}`, "more");
}

