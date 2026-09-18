/* =========================
   USUARIOS, ROLES Y PERMISOS v7.13
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
let teamMembersCache = [];
let teamInvitesCache = [];

function teamDefaultPermissions(memberRole) {
  return { ...(ROLE_PERMISSION_DEFAULTS[memberRole] || ROLE_PERMISSION_DEFAULTS.employee) };
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
function teamStatusLabel(member) {
  return member.active === false ? "Desactivado" : "Activo";
}
function teamDisplayName(member) {
  if (member.role === "owner") return member.display_name || state.settings.ownerName || "Dueño";
  return member.display_name || member.email || "Usuario";
}
function inviteStatusLabel(invite) {
  if (invite.status === "accepted") return "Aceptada";
  if (invite.status === "cancelled") return "Cancelada";
  if (invite.status === "expired") return "Vencida";
  return "Pendiente";
}

async function renderUsers() {
  if (role !== "owner") { screen = "home"; toast("Solo el dueño puede administrar usuarios."); return renderHome(); }
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Usuarios</h2><p>Administra quién puede entrar y qué puede hacer.</p></section><div class="panel"><div class="row-head"><div><strong>Equipo</strong><div class="muted">Dueño, administradores y empleados.</div></div><button class="btn primary" onclick="openInviteUser()">Invitar usuario</button></div><div id="teamList" style="margin-top:14px"><div class="empty">Cargando usuarios…</div></div></div><div class="panel" style="margin-top:14px"><strong>Invitaciones</strong><p class="muted">Comparte el código con la persona. Podrá crear o usar su cuenta sin crear otro negocio.</p><div id="inviteList" style="margin-top:12px"><div class="empty">Cargando invitaciones…</div></div></div>`, "users");
  try {
    const data = await cloudLoadTeam();
    teamMembersCache = data.members || [];
    teamInvitesCache = data.invites || [];
    drawTeamLists();
  } catch (error) {
    console.error(error);
    const el = $("#teamList");
    if (el) el.innerHTML = `<div class="empty">No se pudieron cargar los usuarios. Revisa Internet.</div>`;
  }
}
window.renderUsers = renderUsers;

function drawTeamLists() {
  const membersEl = $("#teamList");
  const invitesEl = $("#inviteList");
  if (membersEl) {
    membersEl.innerHTML = teamMembersCache.length ? teamMembersCache.map(member => {
      const self = member.user_id === state.settings.cloudUserId;
      const isOwner = member.role === "owner";
      const actions = isOwner ? "" : `<div class="toolbar" style="margin-top:10px"><button class="btn ghost" onclick="openEditMember('${member.user_id}')">Permisos</button><button class="btn ${member.active === false ? "primary" : "danger"}" onclick="toggleTeamMember('${member.user_id}',${member.active === false ? "true" : "false"})">${member.active === false ? "Activar" : "Desactivar"}</button></div>`;
      return `<div class="row-card"><div class="row-head"><div><strong>${esc(teamDisplayName(member))}${self ? " · Tú" : ""}</strong><div class="muted">${esc(member.email || "")} · ${roleLabel(member.role)}</div></div><span class="badge ${member.active === false ? "offline" : "online"}">● ${teamStatusLabel(member)}</span></div>${actions}</div>`;
    }).join("") : `<div class="empty">No hay usuarios todavía.</div>`;
  }
  if (invitesEl) {
    const pending = teamInvitesCache.filter(i => i.status === "pending");
    invitesEl.innerHTML = pending.length ? pending.map(invite => `<div class="row-card"><div class="row-head"><div><strong>${esc(invite.email)}</strong><div class="muted">${roleLabel(invite.role)} · ${inviteStatusLabel(invite)}</div></div><strong style="letter-spacing:1px">${esc(invite.invite_code)}</strong></div><div class="toolbar" style="margin-top:10px"><button class="btn ghost" onclick="copyInviteCode('${invite.invite_code}')">Copiar código</button><button class="btn danger" onclick="cancelTeamInvite('${invite.id}')">Cancelar</button></div></div>`).join("") : `<div class="empty">No hay invitaciones pendientes.</div>`;
  }
}

window.openInviteUser = () => {
  const defaults = teamDefaultPermissions("employee");
  modal(`<h3>Invitar usuario</h3><p class="muted">La persona recibirá un código para unirse a este negocio.</p><div class="field"><label>Correo</label><input id="inviteEmail" type="email" autocomplete="email"></div><div class="field"><label>Rol</label><select id="inviteRole" onchange="applyInviteRoleDefaults()"><option value="employee">Empleado</option><option value="admin">Administrador</option></select></div><div class="panel" style="box-shadow:none;margin-top:12px"><strong>Permisos</strong><div id="invitePermissions">${teamPermissionCheckboxes("invitePerm", defaults)}</div></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button id="inviteSaveButton" class="btn primary" onclick="saveTeamInvite()">Crear invitación</button></div>`);
};
window.applyInviteRoleDefaults = () => {
  const memberRole = $("#inviteRole")?.value || "employee";
  const el = $("#invitePermissions");
  if (el) el.innerHTML = teamPermissionCheckboxes("invitePerm", teamDefaultPermissions(memberRole));
};
window.saveTeamInvite = async () => {
  const email = $("#inviteEmail")?.value.trim().toLowerCase() || "";
  const memberRole = $("#inviteRole")?.value || "employee";
  const button = $("#inviteSaveButton");
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Escribe un correo válido.");
  if (button) { button.disabled = true; button.textContent = "Creando…"; }
  try {
    const invite = await cloudCreateTeamInvite(email, memberRole, teamReadPermissions("invitePerm"));
    closeModal();
    await renderUsers();
    modal(`<h3>Invitación creada</h3><p>Comparte este código con <strong>${esc(email)}</strong>:</p><div class="activation-code">${esc(invite.invite_code)}</div><p class="muted">En Mi Punto CR debe elegir <strong>Tengo código de invitación</strong>.</p><div class="modal-actions"><button class="btn ghost" onclick="copyInviteCode('${invite.invite_code}')">Copiar código</button><button class="btn primary" onclick="closeModal()">Listo</button></div>`);
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Crear invitación"; }
  }
};
window.copyInviteCode = async code => {
  try { await navigator.clipboard.writeText(code); toast("Código copiado."); }
  catch (_) { modal(`<h3>Código de invitación</h3><div class="activation-code">${esc(code)}</div><button class="btn primary full" onclick="closeModal()">Cerrar</button>`); }
};
window.cancelTeamInvite = async id => {
  try { await cloudCancelInvite(id); await renderUsers(); toast("Invitación cancelada."); }
  catch (error) { console.error(error); toast(cloudAuthErrorMessage(error)); }
};

window.openEditMember = userId => {
  const member = teamMembersCache.find(m => m.user_id === userId);
  if (!member || member.role === "owner") return;
  const permissions = { ...teamDefaultPermissions(member.role), ...(member.permissions || {}) };
  modal(`<h3>Permisos de ${esc(teamDisplayName(member))}</h3><div class="field"><label>Rol</label><select id="editMemberRole" onchange="applyEditRoleDefaults()"><option value="employee" ${member.role === "employee" ? "selected" : ""}>Empleado</option><option value="admin" ${member.role === "admin" ? "selected" : ""}>Administrador</option></select></div><div class="panel" style="box-shadow:none;margin-top:12px"><strong>Permisos</strong><div id="editPermissions">${teamPermissionCheckboxes("editPerm", permissions)}</div></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveMemberPermissions('${userId}')">Guardar</button></div>`);
};
window.applyEditRoleDefaults = () => {
  const memberRole = $("#editMemberRole")?.value || "employee";
  const el = $("#editPermissions");
  if (el) el.innerHTML = teamPermissionCheckboxes("editPerm", teamDefaultPermissions(memberRole));
};
window.saveMemberPermissions = async userId => {
  const memberRole = $("#editMemberRole")?.value || "employee";
  try {
    await cloudUpdateTeamMember(userId, { role: memberRole, permissions: teamReadPermissions("editPerm") });
    closeModal(); await renderUsers(); toast("Permisos actualizados.");
  } catch (error) { console.error(error); toast(cloudAuthErrorMessage(error)); }
};
window.toggleTeamMember = async (userId, active) => {
  try { await cloudUpdateTeamMember(userId, { active: !!active }); await renderUsers(); toast(active ? "Usuario activado." : "Usuario desactivado."); }
  catch (error) { console.error(error); toast(cloudAuthErrorMessage(error)); }
};
