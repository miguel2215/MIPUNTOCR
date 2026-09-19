/* =========================
   ACCESO SIMPLE v7.17
========================= */
let employeeCodeBuffer = "";

function accessSocialButtons(mode) {
  const verb = mode === "create" ? "Crear cuenta con" : "Continuar con";
  return `<div class="choice-grid" style="margin-top:12px">
    <button class="btn ghost full" onclick="startSocialAccess('google','${mode}')">G · ${verb} Google</button>
    <button class="btn ghost full" onclick="startSocialAccess('apple','${mode}')"> ${verb} Apple</button>
    <button class="btn primary full" onclick="${mode === "create" ? "startAccount()" : "renderLogin()"}">✉ ${verb} correo</button>
  </div>`;
}

function renderAccessHome() {
  const canContinueGuest = !!(state.settings.guestMode && state.settings.onboardingComplete && state.settings.localDataBusinessId);
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal()}<p class="onboard-sub">Tu negocio, más simple</p><h2>¿Cómo quieres empezar?</h2><div class="choice-grid">
    ${canContinueGuest ? `<button class="btn primary full" onclick="continueGuestBusiness()">Continuar en este dispositivo</button>` : `<button class="btn primary full" onclick="startGuestBusiness()">Empezar sin cuenta</button>`}
    <button class="btn ghost full" onclick="showOwnerAccess('login')">Iniciar sesión</button>
    <button class="btn ghost full" onclick="showOwnerAccess('create')">Crear cuenta</button>
    <button class="btn ghost full" onclick="startEmployeeAccess()">Acceso de empleado</button>
  </div><div class="setup-note" style="margin-top:14px">Puedes empezar sin cuenta. La nube y la sincronización se activan cuando creas una cuenta.</div></div></section>`;
}
window.renderAccessHome = renderAccessHome;

function renderOnboarding() {
  if (state.settings.pendingCloudConfirmation && authStep === "welcome") authStep = "activation";

  if (authStep === "guestSetup") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Empezar sin cuenta</h2><p>Solo necesitamos dos datos para comenzar.</p><div class="field"><label>Nombre del negocio</label><input id="guestBusiness" value="${esc(state.settings.guestMode ? state.settings.businessName : "")}" placeholder="Mi negocio"></div><div class="field"><label>Tipo de negocio</label><select id="guestType"><option value="food">Comida / Soda / Repostería</option><option value="products">Venta de artículos</option><option value="services">Servicios</option></select></div><button class="btn primary full" onclick="finishGuestBusiness()">Empezar</button></div></section>`;
    return;
  }

  if (authStep === "ownerLoginMethods") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Iniciar sesión</h2><p>Elige la forma más cómoda para entrar.</p>${accessSocialButtons("login")}</div></section>`;
    return;
  }

  if (authStep === "ownerCreateMethods") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Crear cuenta</h2><p>Tu negocio quedará protegido y sincronizado en la nube.</p>${accessSocialButtons("create")}</div></section>`;
    return;
  }

  if (authStep === "socialSetup") {
    const provider = setupDraft.oauthProvider || "google";
    const providerLabel = provider === "apple" ? "Apple" : "Google";
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="showOwnerAccess('create')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Tu negocio</h2><p>Después continuarás con ${providerLabel}.</p><div class="field"><label>Nombre del negocio</label><input id="socialBusiness" value="${esc(setupDraft.businessName || "")}"></div><div class="field"><label>Tipo de negocio</label><select id="socialType"><option value="food">Comida / Soda / Repostería</option><option value="products">Venta de artículos</option><option value="services">Servicios</option></select></div><button class="btn primary full" onclick="continueSocialCreate()">Continuar con ${providerLabel}</button></div></section>`;
    return;
  }

  if (authStep === "employee") {
    return renderEmployeeAccess();
  }

  if (authStep === "account") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="showOwnerAccess('create')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Crear cuenta con correo</h2><div class="field"><label>Tu nombre</label><input id="aOwner" autocomplete="name" value="${esc(setupDraft.ownerName || "")}"></div><div class="field"><label>Nombre del negocio</label><input id="aBusiness" value="${esc(setupDraft.businessName || "")}"></div><div class="field"><label>Correo</label><input id="aEmail" type="email" inputmode="email" autocomplete="email" value="${esc(setupDraft.email || "")}"></div><div class="field"><label>Contraseña</label><input id="aPass" type="password" autocomplete="new-password"></div><div class="field"><label>Confirmar contraseña</label><input id="aPass2" type="password" autocomplete="new-password"></div><button id="createAccountNext" class="btn primary full" onclick="accountNext()">Continuar</button></div></section>`;
    return;
  }

  if (authStep === "type") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('account')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>¿Qué tipo de negocio tienes?</h2><div class="choice-grid"><button class="type-choice" onclick="chooseBusinessType('food')"><strong>Comida / Soda / Repostería</strong><small>Ventas, pedidos, caja y menú.</small></button><button class="type-choice" onclick="chooseBusinessType('products')"><strong>Venta de artículos</strong><small>Productos, variantes y stock.</small></button><button class="type-choice" onclick="chooseBusinessType('services')"><strong>Servicios</strong><small>Servicios, clientes y cobros.</small></button></div></div></section>`;
    return;
  }

  if (authStep === "activation") return renderActivation();
  renderAccessHome();
}

window.showOwnerAccess = mode => {
  authStep = mode === "create" ? "ownerCreateMethods" : "ownerLoginMethods";
  renderOnboarding();
};

window.authBack = step => {
  authStep = step;
  renderOnboarding();
};

window.startGuestBusiness = () => {
  authStep = "guestSetup";
  renderOnboarding();
};

window.continueGuestBusiness = async () => {
  state.settings.sessionActive = true;
  state.settings.onboardingComplete = true;
  role = "owner";
  await put("settings", state.settings);
  screen = "home";
  render();
};

window.finishGuestBusiness = async () => {
  const businessName = $("#guestBusiness")?.value.trim() || "Mi negocio";
  const businessType = $("#guestType")?.value || "food";
  try { if (mpCloud || initCloudClient()) await cloudLogoutOwner(); } catch (_) {}
  if (!state.settings.guestMode || state.settings.cloudLinked) await resetLocalBusinessCache();
  const guestId = state.settings.guestMode && state.settings.localDataBusinessId ? state.settings.localDataBusinessId : `guest-${crypto?.randomUUID ? crypto.randomUUID() : Date.now()}`;
  state.settings = {
    ...state.settings,
    businessName,
    businessType,
    ownerName: "",
    email: "",
    guestMode: true,
    accountCreated: false,
    onboardingComplete: true,
    activated: false,
    activationUsed: false,
    sessionActive: true,
    pendingCloudConfirmation: false,
    cloudLinked: false,
    cloudUserId: "",
    cloudBusinessId: "",
    cloudRole: "owner",
    cloudPermissions: {},
    memberDisplayName: "",
    employeeId: "",
    employeeCode: "",
    needsBusinessJoin: false,
    pendingInviteCode: "",
    localDataBusinessId: guestId,
    businessId: state.settings.businessId || friendlyBusinessCode()
  };
  role = "owner";
  await put("settings", state.settings);
  authStep = "welcome";
  screen = "home";
  toast("Listo. Ya puedes empezar a vender.");
  render();
};

window.startAccount = () => {
  setupDraft = {};
  authStep = "account";
  renderOnboarding();
};

window.startSocialAccess = async (provider, mode) => {
  if (!navigator.onLine) return toast("Necesitas Internet para continuar.");
  if (mode === "create") {
    setupDraft = { oauthProvider: provider };
    authStep = "socialSetup";
    renderOnboarding();
    return;
  }
  try {
    await cloudOAuthSignIn(provider, "login");
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
  }
};

window.continueSocialCreate = async () => {
  const businessName = $("#socialBusiness")?.value.trim() || "";
  const businessType = $("#socialType")?.value || "food";
  if (!businessName) return toast("Escribe el nombre del negocio.");
  state.settings.businessName = businessName;
  state.settings.businessType = businessType;
  state.settings.guestMode = false;
  await put("settings", state.settings);
  try {
    await cloudOAuthSignIn(setupDraft.oauthProvider || "google", "create");
  } catch (error) {
    console.error(error);
    toast(cloudAuthErrorMessage(error));
  }
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
      guestMode: false,
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
      toast("Cuenta creada.");
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
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<h2>Revisa tu correo</h2><p>Enviamos un enlace a <strong>${esc(email)}</strong>.</p><div class="setup-note">Toca el enlace del correo y vuelve a Mi Punto CR. No necesitas escribir ningún código.</div><button class="btn primary full" style="margin-top:16px" onclick="finishEmailConfirmation()">Ya confirmé mi correo</button><button class="btn ghost full" style="margin-top:9px" onclick="resendActivation()">Reenviar correo</button><button class="btn ghost full" style="margin-top:9px" onclick="renderAccessHome()">Volver</button></div></section>`;
}

window.resendActivation = async () => {
  const email = state.settings.email;
  if (!email) return toast("No encontramos el correo de la cuenta.");
  try { await cloudResendSignup(email); toast("Correo reenviado."); }
  catch (error) { console.error(error); toast(cloudAuthErrorMessage(error)); }
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
      authStep = "welcome";
      screen = "home";
      toast("Correo confirmado. Bienvenido.");
      render();
      return;
    }
    toast("Si ya confirmaste el correo, inicia sesión.");
    showOwnerAccess("login");
  } catch (error) { console.error(error); toast(cloudAuthErrorMessage(error)); }
};

function renderLogin() {
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="showOwnerAccess('login')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Entrar con correo</h2><div class="field"><label>Correo</label><input id="loginEmail" type="email" autocomplete="email" value="${esc(state.settings.email || "")}"></div><div class="field"><label>Contraseña</label><input id="loginPass" type="password" autocomplete="current-password"></div><button id="loginButton" class="btn primary full" onclick="loginOwner()">Entrar</button><button class="btn ghost full" style="margin-top:9px" onclick="renderForgotPassword()">Olvidé mi contraseña</button></div></section>`;
}
window.renderLogin = renderLogin;

window.renderForgotPassword = () => {
  const email = state.settings.email || "";
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="renderLogin()">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Restablecer contraseña</h2><p>Escribe el correo de tu cuenta.</p><div class="field"><label>Correo</label><input id="recoveryEmail" type="email" inputmode="email" autocomplete="email" value="${esc(email)}"></div><button id="recoveryButton" class="btn primary full" onclick="sendPasswordRecovery()">Enviar enlace</button></div></section>`;
};

window.sendPasswordRecovery = async () => {
  const email = $("#recoveryEmail")?.value.trim().toLowerCase() || "";
  const button = $("#recoveryButton");
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Escribe un correo válido.");
  if (!navigator.onLine) return toast("Necesitas Internet para recuperar la contraseña.");
  if (button) { button.disabled = true; button.textContent = "Enviando…"; }
  try {
    await cloudSendPasswordReset(email);
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<h2>Revisa tu correo</h2><p>Si existe una cuenta para <strong>${esc(email)}</strong>, recibirás un enlace para cambiar la contraseña.</p><button class="btn primary full" style="margin-top:16px" onclick="renderAccessHome()">Volver</button></div></section>`;
  } catch (error) {
    console.error(error); toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Enviar enlace"; }
  }
};

function renderPasswordRecovery() {
  const email = mpCloudUser?.email || state.settings.email || "";
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<h2>Nueva contraseña</h2>${email ? `<p>Cuenta: <strong>${esc(email)}</strong></p>` : ""}<div class="field"><label>Nueva contraseña</label><input id="recoveryNewPass" type="password" autocomplete="new-password" minlength="6"></div><div class="field"><label>Confirmar contraseña</label><input id="recoveryNewPass2" type="password" autocomplete="new-password" minlength="6"></div><button id="saveRecoveryButton" class="btn primary full" onclick="saveRecoveredPassword()">Guardar contraseña</button></div></section>`;
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
    toast("Contraseña actualizada.");
    renderAccessHome();
  } catch (error) {
    console.error(error); toast(cloudAuthErrorMessage(error));
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
    state.settings.guestMode = false;
    state.settings.sessionActive = true;
    state.settings.pendingCloudConfirmation = false;
    await put("settings", state.settings);
    locked = !!state.settings.pinEnabled;
    screen = "home";
    toast("Sesión iniciada.");
    render();
  } catch (error) {
    console.error(error); toast(cloudAuthErrorMessage(error));
  } finally {
    if (button) { button.disabled = false; button.textContent = "Entrar"; }
  }
};

function renderEmployeeAccess() {
  employeeCodeBuffer = employeeCodeBuffer || "";
  const linkedBusinessId = state.settings.lastCloudBusinessId || state.settings.cloudBusinessId || (String(state.settings.localDataBusinessId || "").match(/^[0-9a-f-]{36}$/i) ? state.settings.localDataBusinessId : "");
  if (!linkedBusinessId) {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Acceso de empleado</h2><p>Este dispositivo todavía no está vinculado a un negocio.</p><div class="setup-note">El Dueño debe iniciar sesión una vez en este dispositivo. Después los empleados podrán entrar solo con su código CR.</div></div></section>`;
    return;
  }
  $("#app").innerHTML = `<div class="lock-screen"><div class="lock-card employee-code-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button><div class="lock-brand">${brandVertical("brand-logo-vertical")}</div><p>Ingresa tu código.</p><div class="employee-code-display"><span>CR</span><strong id="employeeCodeDigits">${employeeCodeBuffer ? "•".repeat(employeeCodeBuffer.length) : "____"}</strong></div><div class="pin-keypad">${[1,2,3,4,5,6,7,8,9].map(n => `<button onclick="employeeCodeKey('${n}')">${n}</button>`).join("")}<button class="key-delete" onclick="employeeCodeBackspace()">⌫</button><button onclick="employeeCodeKey('0')">0</button><button class="key-clear" onclick="employeeCodeClear()">×</button></div><div id="employeeCodeStatus" class="muted" style="text-align:center;margin-top:10px"></div></div></div>`;
}
window.renderEmployeeAccess = renderEmployeeAccess;
window.startEmployeeAccess = () => { employeeCodeBuffer = ""; authStep = "employee"; renderOnboarding(); };
window.employeeCodeKey = digit => {
  if (employeeCodeBuffer.length >= 4) return;
  employeeCodeBuffer += String(digit);
  const el = $("#employeeCodeDigits"); if (el) el.textContent = "•".repeat(employeeCodeBuffer.length) + "_".repeat(4 - employeeCodeBuffer.length);
  if (employeeCodeBuffer.length === 4) setTimeout(employeeCodeSubmit, 120);
};
window.employeeCodeBackspace = () => { employeeCodeBuffer = employeeCodeBuffer.slice(0,-1); const el=$("#employeeCodeDigits"); if(el) el.textContent=(employeeCodeBuffer?"•".repeat(employeeCodeBuffer.length):"")+"_".repeat(4-employeeCodeBuffer.length); };
window.employeeCodeClear = () => { employeeCodeBuffer = ""; const el=$("#employeeCodeDigits"); if(el) el.textContent="____"; };
async function employeeCodeSubmit() {
  const code = Number(employeeCodeBuffer || 0);
  const status = $("#employeeCodeStatus");
  if (status) status.textContent = "Ingresando…";
  try {
    await cloudEmployeeCodeLogin(code);
    employeeCodeBuffer = "";
    authStep = "welcome";
    locked = false;
    screen = "home";
    toast(`Hola, ${state.settings.memberDisplayName || "Empleado"}.`);
    render();
  } catch (error) {
    console.error(error);
    if (status) status.textContent = cloudAuthErrorMessage(error);
    employeeCodeBuffer = "";
    const el=$("#employeeCodeDigits"); if(el) el.textContent="____";
  }
}

window.logoutOwner = async () => {
  if (!state.settings.guestMode && (mpCloud || initCloudClient())) await cloudLogoutOwner();
  state.settings.sessionActive = false;
  state.settings.employeeId = "";
  state.settings.employeeCode = "";
  await put("settings", state.settings);
  clearInactivityTimer();
  locked = false;
  role = "owner";
  screen = "home";
  authStep = "welcome";
  renderAccessHome();
};

window.lockApp = () => {
  if (!state.settings.guestMode && isProPlan()) {
    closeModal(); clearInactivityTimer(); locked = true; screen = "home"; render(); return;
  }
  if (!state.settings.pinEnabled || !state.settings.ownerPin) return openPinSettings();
  closeModal(); clearInactivityTimer(); locked = true; screen = "home"; render();
};

window.openPinSettings = () => {
  if (!state.settings.guestMode && isProPlan()) { toast("En Pro, el bloqueo usa códigos CR."); return; }
  const configured = !!(state.settings.pinEnabled && state.settings.ownerPin);
  modal(`<h3>${configured ? "Cambiar PIN" : "Configurar bloqueo"}</h3><p class="muted">${state.settings.guestMode ? "Este código protege Mi Punto CR en este dispositivo." : "Este código protege rápidamente Mi Punto CR sin cerrar la sesión."}</p><div class="field"><label>PIN</label><input id="newOwnerPin" type="password" inputmode="numeric" maxlength="4" placeholder="4 dígitos"></div><div class="field"><label>Confirmar PIN</label><input id="newOwnerPin2" type="password" inputmode="numeric" maxlength="4" placeholder="Repite los 4 dígitos"></div><div class="modal-actions">${configured ? `<button class="btn danger" onclick="disablePinLock()">Desactivar PIN</button>` : ""}<button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="savePinLock()">Guardar</button></div>`);
};
window.savePinLock = async () => {
  const pin = $("#newOwnerPin")?.value.trim() || "";
  const pin2 = $("#newOwnerPin2")?.value.trim() || "";
  if (!/^\d{4}$/.test(pin)) return toast("El código debe tener 4 números.");
  if (pin !== pin2) return toast("Los PIN no coinciden.");
  state.settings.ownerPin = pin; state.settings.pinEnabled = true; await put("settings", state.settings); lastActivityAt = Date.now(); closeModal(); toast(state.settings.guestMode ? "Código de bloqueo activado." : "Bloqueo activado."); render();
};
window.disablePinLock = async () => {
  state.settings.pinEnabled = false; state.settings.ownerPin = ""; state.settings.cashierPin = ""; await put("settings", state.settings); clearInactivityTimer(); closeModal(); toast("Bloqueo con PIN desactivado."); render();
};

window.openCloudLink = () => {
  modal(`<h3>Guardar mi negocio en la nube</h3><p class="muted">Conservaremos lo que ya hiciste en este dispositivo.</p><div class="field"><label>Correo</label><input id="cloudLinkEmail" type="email" value="${esc(state.settings.email || "")}"></div><div class="field"><label>Contraseña</label><input id="cloudLinkPass" type="password" autocomplete="new-password"></div><div class="field"><label>Confirmar contraseña</label><input id="cloudLinkPass2" type="password" autocomplete="new-password"></div><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button id="cloudLinkButton" class="btn primary" onclick="connectCurrentBusinessToCloud()">Crear cuenta y guardar</button></div>`);
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
  if (button) { button.disabled = true; button.textContent = "Guardando…"; }
  try {
    const data = await cloudConnectLegacyBusiness(email, pass);
    state.settings.email = email; state.settings.accountCreated = true; state.settings.guestMode = false;
    state.settings.pendingCloudConfirmation = !data?.session; state.settings.sessionActive = !!data?.session;
    await put("settings", state.settings); closeModal();
    if (data?.session) { toast("Negocio guardado en la nube."); render(); return; }
    authStep = "activation"; renderActivation();
  } catch (error) {
    console.error(error); toast(cloudAuthErrorMessage(error));
    if (button) { button.disabled = false; button.textContent = "Crear cuenta y guardar"; }
  }
};

window.employeeSessionLock = async () => {
  state.settings.employeeId = "";
  state.settings.employeeCode = "";
  state.settings.memberDisplayName = "";
  await put("settings", state.settings);
  role = "owner";
  locked = true;
  screen = "home";
  render();
};
