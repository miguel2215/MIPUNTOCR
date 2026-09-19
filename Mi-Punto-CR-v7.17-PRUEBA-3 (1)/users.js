/* =========================
   EMPLEADOS POR CÓDIGO v7.17
========================= */
const TEAM_PERMISSION_OPTIONS = [
  ["sell", "Vender"],
  ["orders", "Pedidos"],
  ["tables", "Mesas"],
  ["cash", "Caja"],
  ["products", "Productos / Servicios"],
  ["clients", "Clientes / Crédito"],
  ["sales", "Mis ventas"],
  ["catalog", "Menú / Catálogo QR"],
  ["void_sales", "Anular ventas"]
];
let employeesCache = [];

function teamDefaultPermissions() {
  return { ...(ROLE_PERMISSION_DEFAULTS.employee || {}) };
}
function teamPermissionCheckboxes(prefix, permissions = {}) {
  return TEAM_PERMISSION_OPTIONS.map(([key, label]) => {
    const checked = permissions[key] === true ? "checked" : "";
    return `<label style="display:flex;align-items:center;gap:9px;padding:9px 0"><input id="${prefix}_${key}" type="checkbox" ${checked}><span>${esc(label)}</span></label>`;
  }).join("");
}
function teamReadPermissions(prefix) {
  const out = {};
  for (const [key] of TEAM_PERMISSION_OPTIONS) out[key] = !!$("#" + prefix + "_" + key)?.checked;
  return out;
}
function employeeSalesStats(employee) {
  const today = localDayKey(new Date());
  const sales = state.sales.filter(s => !s.voided && (s.employeeId === employee.id || Number(s.employeeCode || 0) === Number(employee.code_number || 0)));
  const todaySales = sales.filter(s => localDayKey(s.createdAt) === today);
  return {
    todayCount: todaySales.length,
    todayTotal: todaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    allCount: sales.length,
    allTotal: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
  };
}

async function renderUsers() {
  if (role !== "owner" || state.settings.guestMode || !isProPlan()) {
    screen = "home";
    toast("Empleados está disponible con Mi Punto CR Pro.");
    return renderHome();
  }
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Empleados</h2><p>Crea accesos simples con código CR.</p></section><div class="panel"><div class="row-head"><div><strong>Equipo</strong><div class="muted">El Dueño usa CR1000. Los empleados reciben CR1001, CR1002…</div></div><button class="btn primary" onclick="openCreateEmployee()">Crear empleado</button></div><div id="employeeList" style="margin-top:14px"><div class="empty">Cargando empleados…</div></div></div>`, "users");
  try {
    employeesCache = await cloudLoadEmployees();
    drawEmployeeList();
  } catch (error) {
    console.error(error);
    const el = $("#employeeList");
    if (el) el.innerHTML = `<div class="empty">No se pudieron cargar los empleados. Revisa Internet y que hayas ejecutado el SQL de v7.17.</div>`;
  }
}
window.renderUsers = renderUsers;

function drawEmployeeList() {
  const el = $("#employeeList");
  if (!el) return;
  if (!employeesCache.length) {
    el.innerHTML = `<div class="empty">Todavía no tienes empleados.</div>`;
    return;
  }
  el.innerHTML = employeesCache.map(employee => {
    const stats = employeeSalesStats(employee);
    return `<div class="row-card"><div class="row-head"><div><strong>${esc(employee.display_name)}</strong><div class="muted">Código <strong>CR${Number(employee.code_number)}</strong></div></div><span class="badge online">CR${Number(employee.code_number)}</span></div><div class="mini-stats" style="margin-top:10px"><div><span>Hoy</span><strong>${stats.todayCount} ventas · ${money(stats.todayTotal)}</strong></div><div><span>Histórico</span><strong>${stats.allCount} ventas · ${money(stats.allTotal)}</strong></div></div><div class="toolbar" style="margin-top:10px"><button class="btn ghost" onclick="openEditEmployee('${employee.id}')">Editar</button><button class="btn danger" onclick="confirmDeleteEmployee('${employee.id}')">Eliminar empleado</button></div></div>`;
  }).join("");
}

window.openCreateEmployee = () => {
  const defaults = teamDefaultPermissions();
  modal(`<h3>Crear empleado</h3><p class="muted">Solo escribe el nombre y define qué puede hacer. El código se genera automáticamente.</p><div class="field"><label>Nombre</label><input id="employeeName" autocomplete="off" placeholder="Ej. Carlos"></div><div class="panel" style="box-shadow:none;margin-top:12px"><strong>Permisos</strong><div>${teamPermissionCheckboxes("employeePerm", defaults)}</div></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button id="employeeSaveButton" class="btn primary" onclick="saveEmployee()">Crear empleado</button></div>`);
};

window.saveEmployee = async () => {
  const name = $("#employeeName")?.value.trim() || "";
  const button = $("#employeeSaveButton");
  if (!name) return toast("Escribe el nombre del empleado.");
  if (button) { button.disabled = true; button.textContent = "Creando…"; }
  try {
    const employee = await cloudCreateEmployee(name, teamReadPermissions("employeePerm"));
    closeModal();
    await renderUsers();
    modal(`<h3>Empleado creado</h3><p><strong>${esc(name)}</strong> entra con este código:</p><div class="activation-code">CR${Number(employee?.code_number || 0)}</div><p class="muted">En la pantalla inicial toca <strong>Acceso de empleado</strong>. El CR ya aparece fijo; solo debe escribir los 4 números.</p><button class="btn primary full" onclick="closeModal()">Listo</button>`);
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Crear empleado"; }
  }
};

window.openEditEmployee = employeeId => {
  const employee = employeesCache.find(e => e.id === employeeId);
  if (!employee) return;
  const permissions = { ...teamDefaultPermissions(), ...(employee.permissions || {}) };
  modal(`<h3>Editar empleado</h3><div class="field"><label>Nombre</label><input id="editEmployeeName" value="${esc(employee.display_name)}"></div><div class="field"><label>Código</label><input value="CR${Number(employee.code_number)}" disabled></div><div class="panel" style="box-shadow:none;margin-top:12px"><strong>Permisos</strong><div>${teamPermissionCheckboxes("editEmployeePerm", permissions)}</div></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveEmployeeChanges('${employeeId}')">Guardar</button></div>`);
};

window.saveEmployeeChanges = async employeeId => {
  const name = $("#editEmployeeName")?.value.trim() || "";
  if (!name) return toast("Escribe el nombre del empleado.");
  try {
    await cloudUpdateEmployee(employeeId, { display_name: name, permissions: teamReadPermissions("editEmployeePerm") });
    closeModal();
    await renderUsers();
    toast("Empleado actualizado.");
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
  }
};

window.confirmDeleteEmployee = employeeId => {
  const employee = employeesCache.find(e => e.id === employeeId);
  if (!employee) return;
  modal(`<h3>Eliminar empleado</h3><p>¿Eliminar a <strong>${esc(employee.display_name)}</strong>?</p><div class="setup-note">El código CR${Number(employee.code_number)} dejará de funcionar inmediatamente. Sus ventas anteriores se conservarán para que los reportes sigan correctos.</div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn danger" onclick="deleteEmployee('${employeeId}')">Eliminar</button></div>`);
};

window.deleteEmployee = async employeeId => {
  try {
    await cloudDeleteEmployee(employeeId);
    closeModal();
    await renderUsers();
    toast("Empleado eliminado.");
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
  }
};
