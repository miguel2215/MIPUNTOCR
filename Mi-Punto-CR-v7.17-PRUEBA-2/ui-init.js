/* =========================
   BLOQUEO / MODALES
========================= */
let lockPinBuffer = "";
function renderLock() {
  lockPinBuffer = "";
  $("#app").innerHTML = `<div class="lock-screen"><div class="lock-card pin-pad-card"><div class="lock-brand">${brandVertical("brand-logo-vertical")}</div><p>${state.settings.guestMode ? "Ingresa tu código." : "Ingresa tu código."}</p><div class="pin-display" id="lockPinDisplay">${"_".repeat(Math.max(4, String(state.settings.ownerPin || "").length || 4))}</div><div class="pin-keypad">${[1,2,3,4,5,6,7,8,9].map(n => `<button onclick="lockPinKey('${n}')">${n}</button>`).join("")}<button class="key-delete" onclick="lockPinBackspace()">⌫</button><button onclick="lockPinKey('0')">0</button><button class="key-clear" onclick="lockPinClear()">×</button></div><div id="lockPinStatus" class="muted" style="text-align:center;margin-top:10px"></div></div></div>`;
}
function drawLockPin() {
  const len = Math.max(4, String(state.settings.ownerPin || "").length || 4);
  const el = $("#lockPinDisplay");
  if (el) el.textContent = "•".repeat(lockPinBuffer.length) + "_".repeat(Math.max(0, len - lockPinBuffer.length));
}
window.lockPinKey = digit => {
  const len = String(state.settings.ownerPin || "").length || 4;
  if (lockPinBuffer.length >= len) return;
  lockPinBuffer += String(digit);
  drawLockPin();
  if (lockPinBuffer.length === len) setTimeout(unlock, 100);
};
window.lockPinBackspace = () => { lockPinBuffer = lockPinBuffer.slice(0, -1); drawLockPin(); };
window.lockPinClear = () => { lockPinBuffer = ""; drawLockPin(); };
window.unlock = () => {
  const p = lockPinBuffer;
  if (state.settings.ownerPin && p === state.settings.ownerPin) {
    role = ["owner","admin","employee"].includes(state.settings.cloudRole) ? state.settings.cloudRole : role;
    locked = false;
    lockPinBuffer = "";
    lastActivityAt = Date.now();
    return render();
  }
  const status = $("#lockPinStatus");
  if (status) status.textContent = "Código incorrecto.";
  lockPinBuffer = "";
  drawLockPin();
};
function modal(html) { closeModal(); const e = document.createElement("div"); e.id = "modalRoot"; e.className = "modal-backdrop"; e.innerHTML = `<div class="modal">${html}</div>`; e.onclick = ev => { if (ev.target === e) closeModal(); }; document.body.appendChild(e); }
window.closeModal = () => $("#modalRoot")?.remove();
function toast(text) { const old = document.querySelector(".toast"); old?.remove(); const e = document.createElement("div"); e.className = "toast"; e.textContent = text; document.body.appendChild(e); setTimeout(() => e.remove(), 2400); }

let resizeTimer;
function handleViewportChange() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const active = document.activeElement;
    const editing = active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName);
    if (screen === "settings" && (settingsFormDirty || editing)) return;
    if (!document.querySelector("#modalRoot")) render();
  }, 180);
}
window.addEventListener("resize", handleViewportChange);
window.addEventListener("orientationchange", handleViewportChange);
window.addEventListener("online", async () => {
  if (mpCloudSession?.user) {
    try { await cloudHydrateSession(mpCloudSession); } catch (error) { console.error(error); }
  } else if (state.settings.cloudLinked) {
    try { await cloudSyncCatalogClients({ silent: true }); } catch (error) { console.error(error); }
    try { await cloudSyncOperations({ silent: true }); } catch (error) { console.error(error); }
  }
  render();
});
window.addEventListener("offline", render);
window.addEventListener("pageshow", () => {
  setTimeout(() => {
    if (db && !document.querySelector("#modalRoot")) {
      if (!checkInactivityLock()) render();
    }
  }, 80);
});

["pointerdown", "keydown", "touchstart"].forEach(eventName => {
  window.addEventListener(eventName, registerUserActivity, { passive: true });
});
window.addEventListener("scroll", registerUserActivity, { passive: true });
window.addEventListener("focus", () => checkInactivityLock());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkInactivityLock();
});

(async () => {
  injectStyles();
  injectV7Styles();
  db = await openDB();
  await load();
  await initCloudAuth();
  locked = !!state.settings.pinEnabled;
  lastActivityAt = Date.now();
  render();
  // Hotfix v7.1: algunos navegadores restauran la página antes de repintar #app.
  // Forzamos un segundo render estable; el mismo efecto que provocaba F12 al redimensionar.
  requestAnimationFrame(() => { if (!document.querySelector("#modalRoot")) render(); });
  setTimeout(() => { if (!document.querySelector("#modalRoot")) render(); }, 250);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(console.error);
})().catch(err => {
  console.error(err);
  injectStyles();
  document.querySelector("#app").innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<h2>No se pudo iniciar</h2><p>Ocurrió un error al abrir los datos locales.</p><pre style="white-space:pre-wrap;font-size:12px">${esc(err?.message || err)}</pre></div></section>`;
});
