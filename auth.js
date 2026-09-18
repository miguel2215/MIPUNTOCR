/* =========================
   CUENTA / AUTENTICACIÓN
   Supabase Auth v7.9
========================= */
function renderOnboarding() {
  if (state.settings.pendingCloudConfirmation && authStep === "welcome") authStep = "activation";
  if (state.settings.needsBusinessJoin && state.settings.sessionActive !== false && authStep === "welcome") authStep = "joinExisting";

  if (authStep === "welcome") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal()}<h2>Bienvenido</h2><p>Configura tu negocio una sola vez y empieza a vender.</p><div class="choice-grid"><button class="btn primary full" onclick="startAccount()">Crear nueva cuenta</button><button class="btn ghost full" onclick="existingAccount()">Ya tengo una cuenta</button><button class="btn ghost full" onclick="startJoinBusiness()">Tengo código de invitación</button></div></div></section>`;
    return;
  }

  if (authStep === "join") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Unirme a un negocio</h2><p>Usa el código que te compartió el dueño.</p><div class="field"><label>Código de invitación</label><input id="joinCode" autocomplete="one-time-code" style="text-transform:uppercase" value="${esc(state.settings.pendingInviteCode || "")}" placeholder="MP-ABC-123"></div><div class="field"><label>Tu nombre</label><input id="joinName" autocomplete="name"></div><div class="field"><label>Correo</label><input id="joinEmail" type="email" autocomplete="email"></div><div class="field"><label>Contraseña</label><input id="joinPass" type="password" autocomplete="new-password"></div><div class="field"><label>Confirmar contraseña</label><input id="joinPass2" type="password" autocomplete="new-password"></div><button id="joinCreateButton" class="btn primary full" onclick="createMemberAccount()">Crear acceso y unirme</button><button class="btn ghost full" style="margin-top:9px" onclick="authStep='joinExisting';renderOnboarding()">Ya tengo una cuenta</button></div></section>`;
    return;
  }

  if (authStep === "joinExisting") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Unirme con mi cuenta</h2><p>Inicia sesión y usa el código de invitación.</p><div class="field"><label>Código de invitación</label><input id="joinCodeExisting" autocomplete="one-time-code" style="text-transform:uppercase" value="${esc(state.settings.pendingInviteCode || "")}" placeholder="MP-ABC-123"></div><div class="field"><label>Correo</label><input id="joinEmailExisting" type="email" autocomplete="email" value="${esc(state.settings.email || "")}"></div><div class="field"><label>Contraseña</label><input id="joinPassExisting" type="password" autocomplete="current-password"></div><button id="joinExistingButton" class="btn primary full" onclick="joinExistingMemberAccount()">Entrar y unirme</button><button class="btn ghost full" style="margin-top:9px" onclick="authStep='join';renderOnboarding()">Crear una cuenta nueva</button></div></section>`;
    return;
  }

  if (authStep === "account") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Crear nueva cuenta</h2><p>Tu cuenta se guardará en la nube y quedará vinculada a tu negocio.</p><div class="field"><label>Nombre del propietario</label><input id="aOwner" autocomplete="name" value="${esc(setupDraft.ownerName || "")}"></div><div class="field"><label>Nombre del negocio</label><input id="aBusiness" value="${esc(setupDraft.businessName || "")}"></div><div class="field"><label>Correo</label><input id="aEmail" type="email" inputmode="email" autocomplete="email" value="${esc(setupDraft.email || "")}"></div><div class="field"><label>Contraseña</label><input id="aPass" type="password" autocomplete="new-password"></div><div class="field"><label>Confirmar contraseña</label><input id="aPass2" type="password" autocomplete="new-password"></div><button id="createAccountNext" class="btn primary full" onclick="accountNext()">Continuar</button></div></section>`;
    return;
  }

  if (authStep === "type") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('account')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>¿Qué tipo de negocio tienes?</h2><p>Esta elección quedará asociada a tu negocio.</p><div class="choice-grid"><button class="type-choice" onclick="chooseBusinessType('food')"><strong>Comida / Soda / Repostería</strong><small>Ventas, pedidos, caja y menú.</small></button><button class="type-choice" onclick="chooseBusinessType('products')"><strong>Venta de artículos</strong><small>Colonias, ropa, cosméticos, accesorios y otros productos.</small></button><button class="type-choice" onclick="chooseBusinessType('services')"><strong>Servicios</strong><small>Belleza, reparaciones, trabajos y otros servicios.</small></button></div></div></section>`;
    return;
  }

  renderActivation();
}

window.startAccount = () => {
  setupDraft = {};
  authStep = "account";
  renderOnboarding();
};

window.startJoinBusiness = () => {
  authStep = "join";
  renderOnboarding();
};

window.createMemberAccount = async () => {
  const inviteCode = $("#joinCode")?.value.trim().toUpperCase() || "";
  const fullName = $("#joinName")?.value.trim() || "";
  const email = $("#joinEmail")?.value.trim().toLowerCase() || "";
  const password = $("#joinPass")?.value || "";
  const password2 = $("#joinPass2")?.value || "";
  const button = $("#joinCreateButton");
  if (!inviteCode || !fullName || !/^\S+@\S+\.\S+$/.test(email)) return toast("Completa código, nombre y correo.");
  if (password.length < 6) return toast("La contraseña debe tener al menos 6 caracteres.");
  if (password !== password2) return toast("Las contraseñas no coinciden.");
  if (!navigator.onLine) return toast("Necesitas Internet para crear el acceso.");
  if (button) { button.disabled = true; button.textContent = "Creando…"; }
  try {
    state.settings.pendingInviteCode = inviteCode;
    state.settings.email = email;
    await put("settings", state.settings);
    const data = await cloudRegisterMember({ fullName, email, password, inviteCode });
    state.settings.accountCreated = true;
    state.settings.pendingCloudConfirmation = !data?.session;
    state.settings.sessionActive = !!data?.session;
    state.settings.needsBusinessJoin = !data?.session;
    await put("settings", state.settings);
    if (data?.session && state.settings.onboardingComplete) { authStep = "welcome"; screen = "home"; render(); toast("Te uniste al negocio."); return; }
    authStep = "activation";
    renderOnboarding();
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Crear acceso y unirme"; }
  }
};

window.joinExistingMemberAccount = async () => {
  const inviteCode = $("#joinCodeExisting")?.value.trim().toUpperCase() || "";
  const email = $("#joinEmailExisting")?.value.trim().toLowerCase() || "";
  const password = $("#joinPassExisting")?.value || "";
  const button = $("#joinExistingButton");
  if (!inviteCode || !email || !password) return toast("Completa código, correo y contraseña.");
  if (!navigator.onLine) return toast("Necesitas Internet para unirte al negocio.");
  if (button) { button.disabled = true; button.textContent = "Uniendo…"; }
  try {
    state.settings.pendingInviteCode = inviteCode;
    await put("settings", state.settings);
    await cloudJoinExistingAccount(email, password, inviteCode);
    state.settings.pendingInviteCode = "";
    state.settings.needsBusinessJoin = false;
    state.settings.sessionActive = true;
    await put("settings", state.settings);
    authStep = "welcome"; screen = "home"; toast("Te uniste al negocio."); render();
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Entrar y unirme"; }
  }
};

window.authBack = step => {
  authStep = step;
  renderOnboarding();
};

window.existingAccount = () => {
  renderLogin();
};

window.accountNext = () => {
  const ownerName = $("#aOwner").value.trim();
  const businessName = $("#aBusiness").value.trim();
  const email = $("#aEmail").value.trim().toLowerCase();
  const pass = $("#aPass").value;
  const pass2 = $("#aPass2").value;

  if (!ownerName || !businessName || !email) return toast("Completa nombre, negocio y correo.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Escribe un correo válido.");
  if (pass.length < 6) return toast("La contraseña debe tener al menos 6 caracteres.");
  if (pass !== pass2) return toast("Las contraseñas no coinciden.");

  setupDraft = { ownerName, businessName, email, password: pass };
  authStep = "type";
  renderOnboarding();
};

function friendlyBusinessCode() {
  const arr = new Uint32Array(2);
  crypto.getRandomValues(arr);
  return `MPCR-${(arr[0].toString(36) + arr[1].toString(36)).toUpperCase().slice(0, 10)}`;
}

window.chooseBusinessType = async businessType => {
  if (!setupDraft.password) return toast("Vuelve y completa la cuenta.");
  if (!navigator.onLine) return toast("Necesitas Internet para crear la cuenta.");

  const buttons = $$(".type-choice");
  buttons.forEach(b => b.disabled = true);

  try {
    const pending = { ...setupDraft };
    const data = await cloudRegisterOwner(pending, businessType);

    state.settings = {
      ...state.settings,
      ownerName: pending.ownerName,
      businessName: pending.businessName,
      email: pending.email,
      businessType,
      businessId: state.settings.businessId || friendlyBusinessCode(),
      accountCreated: true,
      pendingCloudConfirmation: !data?.session,
      onboardingComplete: !!data?.session,
      activated: !!data?.session?.user?.email_confirmed_at,
      activationUsed: !!data?.session?.user?.email_confirmed_at,
      sessionActive: !!data?.session,
      tableCount: state.settings.tableCount || 0
    };
    await put("settings", state.settings);

    setupDraft = {};

    if (data?.session) {
      authStep = "welcome";
      screen = "home";
      toast("Cuenta creada y conectada a la nube.");
      render();
      return;
    }

    authStep = "activation";
    renderOnboarding();
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
    buttons.forEach(b => b.disabled = false);
  }
};

function renderActivation() {
  const email = state.settings.email || "tu correo";
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<p class="onboard-sub">Activa tu negocio</p><h2>Revisa tu correo</h2><p>Enviamos la confirmación a <strong>${esc(email)}</strong>.</p><div class="setup-note">Abre el correo de Supabase, confirma tu dirección y vuelve a Mi Punto CR.${state.settings.pendingInviteCode ? " Después de confirmar usaremos tu código de invitación para entrar al negocio." : ""}</div><button class="btn primary full" style="margin-top:16px" onclick="finishEmailConfirmation()">Ya confirmé mi correo</button><button class="btn ghost full" style="margin-top:9px" onclick="resendActivation()">Reenviar correo</button><button class="btn ghost full" style="margin-top:9px" onclick="renderLogin()">Ir a iniciar sesión</button></div></section>`;
}

window.resendActivation = async () => {
  const email = state.settings.email;
  if (!email) return toast("No encontramos el correo de la cuenta.");
  try {
    await cloudResendSignup(email);
    toast("Correo reenviado.");
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
  }
};

window.finishEmailConfirmation = async () => {
  try {
    const session = await cloudRefreshConfirmedSession();
    if (session) {
      state.settings.pendingCloudConfirmation = false;
      state.settings.activated = true;
      state.settings.activationUsed = true;
      state.settings.sessionActive = true;
      await put("settings", state.settings);
      authStep = state.settings.needsBusinessJoin ? "joinExisting" : "welcome";
      screen = "home";
      toast(state.settings.needsBusinessJoin ? "Correo confirmado. Escribe tu código de invitación." : "Correo confirmado. Bienvenido.");
      render();
      return;
    }
    toast("Si ya confirmaste el correo, inicia sesión con tu contraseña.");
    renderLogin();
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
  }
};

function renderLogin() {
  const note = "Usa una cuenta real de Mi Punto CR. Cada negocio queda vinculado a su propia cuenta de Supabase.";
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<p class="onboard-sub">Acceso a Mi Punto CR</p><h2>Iniciar sesión</h2><div class="field"><label>Correo</label><input id="loginEmail" type="email" autocomplete="email" value="${esc(state.settings.cloudLinked ? (state.settings.email || "") : "")}"></div><div class="field"><label>Contraseña</label><input id="loginPass" type="password" autocomplete="current-password"></div><button id="loginButton" class="btn primary full" onclick="loginOwner()">Entrar</button><button class="btn ghost full" style="margin-top:9px" onclick="renderForgotPassword()">Olvidé mi contraseña</button><button class="btn ghost full" style="margin-top:9px" onclick="startAccount()">Crear nueva cuenta</button><button class="btn ghost full" style="margin-top:9px" onclick="startJoinBusiness()">Tengo código de invitación</button><p class="setup-note" style="margin-top:14px">${note}</p></div></section>`;
}
window.renderLogin = renderLogin;

window.renderForgotPassword = () => {
  const email = state.settings.email || "";
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="renderLogin()">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<p class="onboard-sub">Recuperación de cuenta</p><h2>Restablecer contraseña</h2><p>Escribe el correo de tu cuenta. Te enviaremos un enlace seguro para crear una contraseña nueva.</p><div class="field"><label>Correo</label><input id="recoveryEmail" type="email" inputmode="email" autocomplete="email" value="${esc(email)}"></div><button id="recoveryButton" class="btn primary full" onclick="sendPasswordRecovery()">Enviar enlace</button></div></section>`;
};

window.sendPasswordRecovery = async () => {
  const email = $("#recoveryEmail")?.value.trim().toLowerCase() || "";
  const button = $("#recoveryButton");
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Escribe un correo válido.");
  if (!navigator.onLine) return toast("Necesitas Internet para recuperar la contraseña.");
  if (button) { button.disabled = true; button.textContent = "Enviando…"; }
  try {
    await cloudSendPasswordReset(email);
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<p class="onboard-sub">Revisa tu correo</p><h2>Enlace enviado</h2><p>Si existe una cuenta para <strong>${esc(email)}</strong>, recibirás un enlace para cambiar la contraseña.</p><div class="setup-note">Por seguridad no mostramos si el correo está registrado o no. Abre el enlace desde este dispositivo o desde otro navegador.</div><button class="btn primary full" style="margin-top:16px" onclick="renderLogin()">Volver a iniciar sesión</button></div></section>`;
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Enviar enlace"; }
  }
};

function renderPasswordRecovery() {
  const email = mpCloudUser?.email || state.settings.email || "";
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<p class="onboard-sub">Cuenta verificada</p><h2>Crea una contraseña nueva</h2>${email ? `<p>Cuenta: <strong>${esc(email)}</strong></p>` : ""}<div class="field"><label>Nueva contraseña</label><input id="recoveryNewPass" type="password" autocomplete="new-password" minlength="6"></div><div class="field"><label>Confirmar contraseña</label><input id="recoveryNewPass2" type="password" autocomplete="new-password" minlength="6"></div><button id="saveRecoveryButton" class="btn primary full" onclick="saveRecoveredPassword()">Guardar contraseña</button></div></section>`;
}
window.renderPasswordRecovery = renderPasswordRecovery;

window.saveRecoveredPassword = async () => {
  const pass = $("#recoveryNewPass")?.value || "";
  const pass2 = $("#recoveryNewPass2")?.value || "";
  const button = $("#saveRecoveryButton");
  if (pass.length < 6) return toast("La contraseña debe tener al menos 6 caracteres.");
  if (pass !== pass2) return toast("Las contraseñas no coinciden.");
  if (!navigator.onLine) return toast("Necesitas Internet para cambiar la contraseña.");
  if (button) { button.disabled = true; button.textContent = "Guardando…"; }
  try {
    await cloudUpdateRecoveredPassword(pass);
    mpPasswordRecovery = false;
    await cloudLogoutOwner();
    state.settings.sessionActive = false;
    await put("settings", state.settings);
    toast("Contraseña actualizada. Inicia sesión nuevamente.");
    renderLogin();
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Guardar contraseña"; }
  }
};

window.loginOwner = async () => {
  const email = $("#loginEmail").value.trim().toLowerCase();
  const pass = $("#loginPass").value;
  const button = $("#loginButton");

  if (!email || !pass) return toast("Escribe correo y contraseña.");
  if (!navigator.onLine) return toast("Necesitas Internet para iniciar sesión.");
  if (button) { button.disabled = true; button.textContent = "Entrando…"; }

  try {
    await cloudLoginOwner(email, pass);
    state.settings.sessionActive = true;
    state.settings.pendingCloudConfirmation = false;
    await put("settings", state.settings);
    locked = !!state.settings.pinEnabled;
    screen = "home";
    if (state.settings.needsBusinessJoin) { authStep = "joinExisting"; toast("Esta cuenta aún no está unida a un negocio."); renderOnboarding(); return; }
    toast("Sesión iniciada.");
    render();
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
  } finally {
    if (button) { button.disabled = false; button.textContent = "Entrar"; }
  }
};

window.logoutOwner = async () => {
  if (mpCloud || initCloudClient()) await cloudLogoutOwner();
  state.settings.sessionActive = false;
  await put("settings", state.settings);
  clearInactivityTimer();
  locked = false;
  role = "owner";
  screen = "home";
  authStep = "welcome";
  renderLogin();
};

window.lockApp = () => {
  if (!state.settings.pinEnabled || !state.settings.ownerPin) {
    return openPinSettings();
  }
  closeModal();
  clearInactivityTimer();
  locked = true;
  screen = "home";
  render();
};

window.openPinSettings = () => {
  const configured = !!(state.settings.pinEnabled && state.settings.ownerPin);
  modal(`<h3>${configured ? "Cambiar PIN" : "Configurar bloqueo"}</h3><p class="muted">El PIN sirve para bloquear rápidamente Mi Punto CR sin cerrar la sesión.</p><div class="field"><label>PIN de acceso</label><input id="newOwnerPin" type="password" inputmode="numeric" maxlength="6" placeholder="4 a 6 dígitos"></div><div class="field"><label>Confirmar PIN</label><input id="newOwnerPin2" type="password" inputmode="numeric" maxlength="6" placeholder="Repite el PIN"></div><div class="modal-actions">${configured ? `<button class="btn danger" onclick="disablePinLock()">Desactivar PIN</button>` : ""}<button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="savePinLock()">Guardar</button></div>`);
};

window.savePinLock = async () => {
  const pin = $("#newOwnerPin")?.value.trim() || "";
  const pin2 = $("#newOwnerPin2")?.value.trim() || "";
  if (!/^\d{4,6}$/.test(pin)) return toast("El PIN debe tener entre 4 y 6 números.");
  if (pin !== pin2) return toast("Los PIN no coinciden.");
  state.settings.ownerPin = pin;
  state.settings.pinEnabled = true;
  await put("settings", state.settings);
  lastActivityAt = Date.now();
  closeModal();
  toast("Bloqueo con PIN activado.");
  render();
};

window.disablePinLock = async () => {
  state.settings.pinEnabled = false;
  state.settings.ownerPin = "";
  state.settings.cashierPin = "";
  await put("settings", state.settings);
  clearInactivityTimer();
  closeModal();
  toast("Bloqueo con PIN desactivado.");
  render();
};

window.openCloudLink = () => {
  modal(`<h3>Conectar este negocio a la nube</h3><p class="muted">Conservaremos los datos que ya tienes en este dispositivo. En esta etapa solo conectaremos la cuenta y el negocio; la migración de ventas, productos y clientes se hará en el siguiente paso.</p><div class="field"><label>Correo</label><input id="cloudLinkEmail" type="email" value="${esc(state.settings.email || "")}"></div><div class="field"><label>Nueva contraseña para la nube</label><input id="cloudLinkPass" type="password" autocomplete="new-password"></div><div class="field"><label>Confirmar contraseña</label><input id="cloudLinkPass2" type="password" autocomplete="new-password"></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button id="cloudLinkButton" class="btn primary" onclick="connectCurrentBusinessToCloud()">Conectar</button></div>`);
};

window.connectCurrentBusinessToCloud = async () => {
  const email = $("#cloudLinkEmail").value.trim().toLowerCase();
  const pass = $("#cloudLinkPass").value;
  const pass2 = $("#cloudLinkPass2").value;
  const button = $("#cloudLinkButton");

  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Escribe un correo válido.");
  if (pass.length < 6) return toast("La contraseña debe tener al menos 6 caracteres.");
  if (pass !== pass2) return toast("Las contraseñas no coinciden.");
  if (!navigator.onLine) return toast("Necesitas Internet para conectar la nube.");

  if (button) { button.disabled = true; button.textContent = "Conectando…"; }

  try {
    const data = await cloudConnectLegacyBusiness(email, pass);
    state.settings.email = email;
    state.settings.accountCreated = true;
    state.settings.pendingCloudConfirmation = !data?.session;
    state.settings.sessionActive = !!data?.session;
    await put("settings", state.settings);
    closeModal();

    if (data?.session) {
      toast("Negocio conectado a Supabase.");
      render();
      return;
    }

    authStep = "activation";
    renderActivation();
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Conectar"; }
  }
};
