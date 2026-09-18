/* =========================
   BLOQUEO / MODALES
========================= */
function renderLock() { $("#app").innerHTML = `<div class="lock-screen"><div class="lock-card pin-lock-card"><div class="lock-brand">${brandVertical("brand-logo-vertical")}</div><p>Ingresa tu PIN.</p><div id="pinDots" class="pin-display">○ ○ ○ ○</div><div class="numeric-keypad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button onclick="pinKey('${n}')">${n}</button>`).join('')}<button class="key-muted" onclick="pinKey('back')">⌫</button><button onclick="pinKey('0')">0</button><button class="key-muted" onclick="pinKey('clear')">×</button></div></div></div>`; window._pinDigits=''; }
window.pinKey = key => { let p=window._pinDigits||''; if(key==='back') p=p.slice(0,-1); else if(key==='clear') p=''; else if(/^\d$/.test(key) && p.length < 6) p+=key; window._pinDigits=p; const len=Math.max(4, String(state.settings.ownerPin||'').length||4); const el=$("#pinDots"); if(el) el.textContent=Array.from({length:len},(_,i)=>i<p.length?'●':'○').join(' '); if(state.settings.ownerPin && p.length===String(state.settings.ownerPin).length){ if(p===String(state.settings.ownerPin)){ role=["owner","admin","employee"].includes(state.settings.cloudRole)?state.settings.cloudRole:role; locked=false; lastActivityAt=Date.now(); render(); } else { window._pinDigits=''; if(el) el.textContent=Array.from({length:len},()=> '○').join(' '); toast("PIN incorrecto."); } } };
window.unlock = () => {};
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
