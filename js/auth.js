/* =========================
   CUENTA / ACTIVACIÓN
========================= */
function renderOnboarding() {
  if (state.settings.accountCreated && state.settings.pendingActivationCode && authStep === "welcome") authStep = "activation";
  if (authStep === "welcome") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal()}<h2>Bienvenido</h2><p>Configura tu negocio una sola vez y empieza a vender.</p><div class="choice-grid"><button class="btn primary full" onclick="startAccount()">Crear nueva cuenta</button><button class="btn ghost full" onclick="existingAccount()">Ya tengo una cuenta</button></div></div></section>`;
    return;
  }
  if (authStep === "account") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>Crear nueva cuenta</h2><p>Los datos del propietario se usan para proteger el negocio.</p><div class="field"><label>Nombre del propietario</label><input id="aOwner" autocomplete="name" value="${esc(setupDraft.ownerName || "")}"></div><div class="field"><label>Nombre del negocio</label><input id="aBusiness" value="${esc(setupDraft.businessName || "")}"></div><div class="field"><label>Correo</label><input id="aEmail" type="email" inputmode="email" autocomplete="email" value="${esc(setupDraft.email || "")}"></div><div class="field"><label>Contraseña</label><input id="aPass" type="password" autocomplete="new-password"></div><div class="field"><label>Confirmar contraseña</label><input id="aPass2" type="password" autocomplete="new-password"></div><button class="btn primary full" onclick="accountNext()">Continuar</button></div></section>`;
    return;
  }
  if (authStep === "type") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('account')">‹ Volver</button>${brandHorizontal("brand-logo-horizontal compact")}<h2>¿Qué tipo de negocio tienes?</h2><p>Mi Punto CR mostrará solo las herramientas que necesitas.</p><div class="choice-grid"><button class="type-choice" onclick="chooseBusinessType('food')"><strong>Comida / Soda / Repostería</strong><small>Ventas, pedidos, caja y menú.</small></button><button class="type-choice" onclick="chooseBusinessType('products')"><strong>Venta de artículos</strong><small>Colonias, ropa, cosméticos, accesorios y otros productos.</small></button><button class="type-choice" onclick="chooseBusinessType('services')"><strong>Servicios</strong><small>Belleza, reparaciones, trabajos y otros servicios.</small></button></div></div></section>`;
    return;
  }
  renderActivation();
}
window.startAccount = () => { setupDraft = {}; authStep = "account"; renderOnboarding(); };
window.authBack = step => { authStep = step; renderOnboarding(); };
window.existingAccount = () => {
  if (state.settings.onboardingComplete) { state.settings.sessionActive = false; put("settings", state.settings); return renderLogin(); }
  toast("En este dispositivo todavía no hay una cuenta activada.");
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

async function sha256(text) {
  const data = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function randomActivationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const chars = [...arr].map(n => alphabet[n % alphabet.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}
function normalizeActivationCode(v) { return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function businessCode() {
  const arr = new Uint32Array(2); crypto.getRandomValues(arr);
  return `MPCR-${(arr[0].toString(36) + arr[1].toString(36)).toUpperCase().slice(0, 10)}`;
}
async function trySendActivationEmail(code) {
  try {
    const res = await fetch("/api/send-activation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: state.settings.email, ownerName: state.settings.ownerName, businessName: state.settings.businessName, code })
    });
    return res.ok;
  } catch (_) { return false; }
}
window.chooseBusinessType = async businessType => {
  if (!setupDraft.password) return toast("Vuelve y completa la cuenta.");
  const code = randomActivationCode();
  state.settings = {
    ...state.settings,
    ownerName: setupDraft.ownerName,
    businessName: setupDraft.businessName,
    email: setupDraft.email,
    passwordHash: await sha256(setupDraft.password),
    businessType,
    accountCreated: true,
    onboardingComplete: false,
    activated: false,
    activationUsed: false,
    businessId: state.settings.businessId || businessCode(),
    pendingActivationCode: code,
    activationCodeHash: await sha256(normalizeActivationCode(code)),
    sessionActive: true,
    tableCount: 0
  };
  await put("settings", state.settings);
  setupDraft = {};
  const sent = await trySendActivationEmail(code);
  sessionStorage.setItem("mpcrActivationEmailSent", sent ? "1" : "0");
  authStep = "activation";
  renderOnboarding();
};
function renderActivation() {
  const sent = sessionStorage.getItem("mpcrActivationEmailSent") === "1";
  const testCode = state.settings.pendingActivationCode;
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<p class="onboard-sub">Activa tu negocio</p><h2>Código de activación</h2><p>${sent ? `Enviamos un código único a <strong>${esc(state.settings.email)}</strong>.` : `El correo real todavía no está conectado en esta versión. La pantalla ya está lista y, para probarla ahora, usa el código mostrado abajo.`}</p>${!sent && testCode ? `<div class="activation-code">${esc(testCode)}</div><div class="setup-note">Este código es de un solo uso en este negocio. Cuando conectemos el servicio de correo, dejará de mostrarse aquí y llegará al correo del propietario.</div>` : ""}<div class="field" style="margin-top:16px"><label>Escribe el código</label><input id="activationInput" autocomplete="one-time-code" style="text-transform:uppercase;text-align:center;font-size:22px;letter-spacing:2px" placeholder="XXXX-XXXX"></div><button class="btn primary full" onclick="activateBusiness()">Activar Mi Punto CR</button><button class="btn ghost full" style="margin-top:9px" onclick="resendActivation()">Generar / reenviar código</button></div></section>`;
}
window.resendActivation = async () => {
  const code = randomActivationCode();
  state.settings.pendingActivationCode = code;
  state.settings.activationCodeHash = await sha256(normalizeActivationCode(code));
  await put("settings", state.settings);
  const sent = await trySendActivationEmail(code);
  sessionStorage.setItem("mpcrActivationEmailSent", sent ? "1" : "0");
  renderActivation();
};
window.activateBusiness = async () => {
  const value = $("#activationInput").value.trim().toUpperCase();
  if (!value) return toast("Escribe el código de activación.");
  if (state.settings.activationUsed) return toast("Este negocio ya fue activado.");
  const hash = await sha256(normalizeActivationCode(value));
  if (hash !== state.settings.activationCodeHash) return toast("Código incorrecto.");
  state.settings.onboardingComplete = true;
  state.settings.activated = true;
  state.settings.activationUsed = true;
  state.settings.pendingActivationCode = "";
  state.settings.activationCodeHash = "";
  state.settings.sessionActive = true;
  await put("settings", state.settings);
  authStep = "welcome";
  screen = "home";
  toast("Negocio activado.");
  render();
};

function renderLogin() {
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<p class="onboard-sub">Acceso del propietario</p><div class="field"><label>Correo</label><input id="loginEmail" type="email" value="${esc(state.settings.email || "")}"></div><div class="field"><label>Contraseña</label><input id="loginPass" type="password"></div><button class="btn primary full" onclick="loginOwner()">Entrar</button><p class="setup-note" style="margin-top:14px">Este acceso funciona en el dispositivo donde se creó la cuenta. El inicio de sesión entre dispositivos se conectará junto con la nube.</p></div></section>`;
}
window.loginOwner = async () => {
  const email = $("#loginEmail").value.trim().toLowerCase();
  const pass = $("#loginPass").value;
  if (email !== String(state.settings.email || "").toLowerCase()) return toast("Correo incorrecto.");
  if (await sha256(pass) !== state.settings.passwordHash) return toast("Contraseña incorrecta.");
  state.settings.sessionActive = true;
  await put("settings", state.settings);
  locked = !!state.settings.pinEnabled;
  render();
};
window.logoutOwner = async () => {
  state.settings.sessionActive = false;
  await put("settings", state.settings);
  screen = "home";
  renderLogin();
};

