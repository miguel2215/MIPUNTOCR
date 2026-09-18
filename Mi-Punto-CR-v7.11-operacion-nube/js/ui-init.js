/* =========================
   BLOQUEO / MODALES
========================= */
function renderLock() { $("#app").innerHTML = `<div class="lock-screen"><div class="lock-card"><div class="lock-brand">${brandVertical("brand-logo-vertical")}</div><p>Ingresa tu PIN.</p><input id="pin" class="pin-input" type="password" inputmode="numeric"><button class="btn primary full" style="margin-top:14px" onclick="unlock()">Entrar</button></div></div>`; }
window.unlock = () => { const p = $("#pin").value.trim(); if (state.settings.ownerPin && p === state.settings.ownerPin) { role = "owner"; locked = false; lastActivityAt = Date.now(); return render(); } if (state.settings.cashierPin && p === state.settings.cashierPin) { role = "cashier"; locked = false; lastActivityAt = Date.now(); return render(); } toast("PIN incorrecto."); };
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
  if (state.settings.cloudLinked) {
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
