/* =========================
   CATÁLOGO
========================= */
function renderCatalog() {
  const label = isFood() ? "Menú QR" : "Catálogo QR";
  const catalogItems = currentProducts();
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${label}</h2><p>Vista previa de lo que verá el cliente.</p></section><div class="panel">${catalogItems.length ? catalogItems.map(p => `<div class="catalog-card"><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category || "")}</div></div><strong>${money(p.price)}</strong></div>`).join("") : `<div class="empty">Todavía no hay contenido.</div>`}</div><div class="panel" style="margin-top:14px"><strong>QR público</strong><p class="muted">El QR será únicamente para consultar este ${isFood() ? "menú" : "catálogo"}. No genera pedidos ni solicitudes dentro del POS.</p></div>`, "more");
}

/* =========================
   ADMINISTRACIÓN / SINCRONIZACIÓN
========================= */
function adminTrackedEntities() {
  return [
    ...state.products,
    ...state.clients,
    ...state.sales,
    ...state.orders,
    ...state.cashMoves,
    ...state.cashSessions,
    ...state.creditMoves,
    ...state.tableAccounts
  ];
}

function adminPendingSyncCount() {
  return adminTrackedEntities().reduce((total, entity) => {
    if (!entity || typeof entity !== "object") return total;
    let pending = 0;
    if (entity.cloudPending) pending += 1;
    if (entity.cloudPendingDelete) pending += 1;
    if (Array.isArray(entity.cloudAuditQueue)) pending += entity.cloudAuditQueue.length;
    if (Array.isArray(entity.cloudInventoryQueue)) pending += entity.cloudInventoryQueue.length;
    return total + pending;
  }, 0);
}

function adminLastSyncAt() {
  const values = [
    state.settings.catalogLastCloudSyncAt,
    state.settings.operationsLastCloudSyncAt
  ].filter(Boolean).map(value => new Date(value)).filter(date => !Number.isNaN(date.getTime()));
  if (!values.length) return "";
  return new Date(Math.max(...values.map(date => date.getTime()))).toISOString();
}

function renderAdminSyncPanel() {
  const pending = adminPendingSyncCount();
  const online = navigator.onLine;
  const linked = !!state.settings.cloudLinked;
  const lastSync = adminLastSyncAt();

  let title = state.settings.guestMode ? "Modo sin cuenta" : "Nube no vinculada";
  let detail = state.settings.guestMode ? "Tus datos están solo en este dispositivo. Puedes crear una cuenta cuando quieras para guardarlos en la nube." : "Inicia sesión con una cuenta para sincronizar los datos del negocio.";
  if (linked && !online) {
    title = pending ? `${pending} cambio${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}` : "Sin conexión";
    detail = pending ? "Se guardaron en este dispositivo y se subirán cuando vuelva Internet." : "Los datos locales siguen disponibles. La nube se actualizará al recuperar conexión.";
  } else if (linked && pending) {
    title = `${pending} cambio${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}`;
    detail = "Puedes sincronizar ahora o dejar que Mi Punto CR lo haga automáticamente.";
  } else if (linked) {
    title = "Todo sincronizado ✓";
    detail = lastSync ? `Última sincronización: ${dateTime(lastSync)}.` : "Los datos del negocio están conectados a Supabase.";
  }

  return `<div class="panel" style="margin-top:14px">
    <div class="row-head">
      <div>
        <strong>Administración del negocio</strong>
        <p class="muted" style="margin:5px 0 0">${esc(title)} · ${esc(detail)}</p>
      </div>
      ${linked ? `<button class="btn ${pending ? "primary" : "ghost"}" onclick="syncBusinessNow()" ${online ? "" : "disabled"}>Sincronizar ahora</button>` : (state.settings.guestMode ? `<button class="btn primary" onclick="openCloudLink()">Guardar en la nube</button>` : "")}
    </div>
  </div>`;
}

function renderAdminQuickLinks() {
  const links = [];
  const add = (target, title, sub) => links.push(`<button class="home-card" onclick="go('${target}')"><strong>${title}</strong><small>${sub}</small></button>`);
  if (state.settings.cloudLinked) add("users", "Empleados", "Códigos y permisos");
  add("products", isServices() ? "Servicios" : "Productos", isServices() ? "Categorías y precios" : "Categorías, precios y stock");
  add("clients", isServices() ? "Clientes" : "Clientes / Crédito", "Clientes, movimientos y abonos");
  add("sales", "Mis ventas", "Comprobantes, historial y anulaciones");
  if (isFood()) add("cash", "Caja", "Apertura, cierre e historial");
  add("catalog", isFood() ? "Menú QR" : "Catálogo QR", "Vista pública del negocio");
  return `<div class="panel" style="margin-top:14px"><strong>Accesos de administración</strong><p class="muted">Administra las áreas principales sin salir de Configuración.</p><div class="home-grid" style="margin-top:12px">${links.join("")}</div></div>`;
}

window.syncBusinessNow = async () => {
  if (!navigator.onLine) return toast("No hay conexión a Internet.");
  if (!state.settings.cloudLinked) return toast("Este negocio no está conectado a la nube.");
  try {
    toast("Sincronizando…");
    await cloudSyncCatalogClients({ silent: true });
    await cloudSyncOperations({ silent: true });
    await put("settings", state.settings);
    renderSettings();
    toast(adminPendingSyncCount() ? "Quedan cambios pendientes de sincronizar." : "Todo sincronizado.");
  } catch (error) {
    console.error(error);
    toast("No se pudo completar la sincronización. Intenta nuevamente.");
  }
};

/* =========================
   CONFIGURACIÓN
========================= */
function renderSettings() {
  if (role !== "owner") { screen = "home"; return renderHome(); }
  settingsFormDirty = false;
  const s = state.settings;
  const cloudPanel = s.cloudLinked
    ? `<div class="panel" style="margin-top:14px"><strong>Nube</strong><p class="muted">Conectado a Supabase${s.email ? ` · ${esc(s.email)}` : ""}</p><p class="muted">Catálogo, clientes, ventas, Caja, crédito, mesas y pedidos se sincronizan con la nube.</p></div>`
    : `<div class="panel" style="margin-top:14px"><strong>Guardar mi negocio</strong><p class="muted">Estás usando Mi Punto CR sin cuenta. Puedes seguir así o crear una cuenta para guardar y sincronizar tus datos.</p><button class="btn primary" onclick="openCloudLink()">Crear cuenta y guardar en la nube</button></div>`;
  const securityPanel = `<div class="panel" style="margin-top:14px"><strong>Seguridad y acceso</strong><p class="muted">${s.pinEnabled && s.ownerPin ? "PIN activado · Mi Punto CR se bloquea automáticamente después de 5 minutos sin actividad." : "Configura un PIN para activar el bloqueo manual y el bloqueo automático por inactividad."}</p><div class="toolbar">${s.pinEnabled && s.ownerPin ? `<button class="btn ghost" onclick="openPinSettings()">Cambiar PIN</button>` : `<button class="btn ghost" onclick="openPinSettings()">Configurar PIN</button>`}<button class="btn danger" onclick="logoutOwner()">Cerrar sesión</button></div></div>`;
  const usersPanel = s.cloudLinked ? `<div class="panel" style="margin-top:14px"><div class="row-head"><div><strong>Empleados</strong><p class="muted" style="margin:5px 0 0">Crea códigos CR1000, CR1001… y define permisos.</p></div><button class="btn primary" onclick="go('users')">Administrar empleados</button></div></div>` : "";
  const backupPanel = typeof renderBackupSettingsPanel === "function" ? renderBackupSettingsPanel() : "";
  const syncPanel = renderAdminSyncPanel();
  const quickLinks = renderAdminQuickLinks();

  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Configuración</h2><p>Centro de administración del Dueño.</p></section>${syncPanel}${quickLinks}<div class="panel" style="margin-top:14px"><strong>Datos del negocio</strong><div class="form-grid" style="margin-top:12px"><div class="field"><label>Tipo de negocio</label><select id="sType" onchange="settingsFormDirty=true"><option value="food" ${type() === "food" ? "selected" : ""}>Comida / Soda / Repostería</option><option value="products" ${type() === "products" ? "selected" : ""}>Venta de artículos</option><option value="services" ${type() === "services" ? "selected" : ""}>Servicios</option></select></div>${isFood() ? `<div class="field"><label>Cantidad de mesas</label><input id="sTableCount" type="number" min="0" max="100" value="${Number(s.tableCount || 0)}"></div>` : ""}<div class="field"><label>Nombre del negocio</label><input id="sName" value="${esc(s.businessName)}"></div><div class="field"><label>Propietario</label><input value="${esc(s.ownerName || "")}" disabled></div><div class="field"><label>Correo</label><input value="${esc(s.email || "")}" disabled></div><div class="field"><label>Teléfono</label><input id="sPhone" value="${esc(s.phone || "")}"></div><div class="field"><label>WhatsApp</label><input id="sWa" value="${esc(s.whatsapp)}"></div><div class="field"><label>Número SINPE</label><input id="sSinpe" value="${esc(s.sinpe)}"></div><div class="field"><label>Impuesto</label><select id="sTax"><option value="included" ${s.taxMode === "included" ? "selected" : ""}>Incluido</option><option value="added" ${s.taxMode === "added" ? "selected" : ""}>Se suma al cobrar</option><option value="exempt" ${s.taxMode === "exempt" ? "selected" : ""}>Exento</option></select></div><div class="field"><label>Porcentaje</label><input id="sRate" type="number" value="${Number(s.taxRate || 13)}"></div><div class="field"><label>Código del negocio</label><input value="${esc(s.businessId || "")}" disabled></div></div><button class="btn primary full" style="margin-top:14px" onclick="saveSettings()">Guardar cambios</button></div>${usersPanel}${cloudPanel}${backupPanel}${securityPanel}`, "more");
}
window.saveSettings = async () => { const previousType=type(); const nextType=$("#sType").value; state.settings = { ...state.settings, businessType: nextType, businessName: $("#sName").value.trim() || "Mi Punto CR", phone: $("#sPhone").value.trim(), whatsapp: $("#sWa").value.trim(), sinpe: $("#sSinpe").value.trim(), taxMode: $("#sTax").value, taxRate: Number($("#sRate").value || 0), tableCount: nextType === "food" ? Number($("#sTableCount")?.value || state.settings.tableCount || 0) : Number(state.settings.tableCount || 0) }; await put("settings", state.settings); if (state.settings.cloudLinked && navigator.onLine) { try { await cloudSaveBusinessSettings(); } catch (error) { console.error(error); toast("Se guardó localmente, pero la nube no respondió."); } } settingsFormDirty = false; quickCategory = ""; cart=[]; resetSaleMeta(); screen = "home"; render(); toast(previousType===nextType?"Configuración guardada.":"Módulo cambiado. Inventario y ventas independientes."); };

function renderMore() {
  let cards = "";
  const add = (target, title, sub) => { if (canAccessScreen(target)) cards += card(target, title, sub); };
  if (isFood()) { add("tables", "Mesas", "Cuentas abiertas del salón"); add("products", "Productos", "Comidas, bebidas y stock"); add("clients", "Clientes / Crédito", "Compras, saldos y abonos"); add("cash", "Caja", "Apertura y cierre"); add("sales", "Mis ventas", "Comprobantes e historial"); add("catalog", "Menú QR", "Vista del menú"); }
  if (isProducts()) { add("products", "Productos", "Artículos, variantes y stock"); add("clients", "Clientes / Crédito", "Compras, saldos y abonos"); add("sales", "Mis ventas", "Comprobantes e historial"); add("catalog", "Catálogo QR", "Vista del catálogo"); }
  if (isServices()) { add("products", "Servicios", "Precios y categorías"); add("clients", "Clientes", "Compras y crédito"); add("sales", "Mis ventas", "Comprobantes e historial"); add("catalog", "Catálogo QR", "Vista de servicios"); }
  if (role === "owner") {
    if (state.settings.cloudLinked) cards += card("users", "Empleados", "Códigos y permisos");
    cards += card("settings", "Configuración", "Administración del negocio");
  }

  const roleText = state.settings.guestMode ? "Sin cuenta" : (role === "owner" ? "Dueño" : role === "admin" ? "Administrador" : "Empleado");
  const identity = role === "employee" ? `${esc(state.settings.memberDisplayName || "Empleado")}${state.settings.employeeCode ? ` · CR${esc(state.settings.employeeCode)}` : ""}` : (state.settings.email ? ` · ${esc(state.settings.email)}` : "");
  const accountPanel = `<div class="panel" style="margin-top:14px"><strong>Acceso</strong><p class="muted">${roleText}${identity}</p><div class="toolbar">${state.settings.pinEnabled && state.settings.ownerPin ? `<button class="btn ghost" onclick="lockApp()">Bloquear</button>` : ""}${state.settings.guestMode ? `<button class="btn primary" onclick="openCloudLink()">Guardar en la nube</button>` : ""}<button class="btn danger" onclick="logoutOwner()">Salir</button></div></div>`;

  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Más</h2><p>Solo herramientas útiles para este negocio.</p></section><div class="home-grid">${cards || `<div class="empty">No tienes herramientas adicionales habilitadas.</div>`}</div>${accountPanel}`, "more");
}
