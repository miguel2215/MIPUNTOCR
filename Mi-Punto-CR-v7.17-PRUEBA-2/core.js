const DB_NAME = "mipuntocr";
const DB_VERSION = 5;
const STORES = ["products", "clients", "sales", "orders", "cashMoves", "cashSessions", "settings", "creditMoves", "tableAccounts"];

let db;
let screen = "home";
let cart = [];
let locked = false;
let role = "owner"; // owner | admin | employee (se carga desde Supabase)
let activeClientId = "";
let quickCategory = "";
let authStep = "welcome";
let setupDraft = {};
let settingsFormDirty = false;
let saleMeta = { clientId: "", orderType: "Mostrador", table: "", note: "", tableAccountId: "" };

const AUTO_LOCK_MS = 5 * 60 * 1000;
let inactivityTimer = null;
let lastActivityAt = Date.now();

function autoLockEnabled() {
  if (!(state.settings.onboardingComplete && state.settings.sessionActive !== false) || locked) return false;
  if (role === "employee") return true;
  return !!(state.settings.pinEnabled && state.settings.ownerPin);
}
function clearInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = null;
}
function scheduleInactivityLock() {
  clearInactivityTimer();
  if (!autoLockEnabled()) return;
  const elapsed = Date.now() - lastActivityAt;
  const wait = Math.max(0, AUTO_LOCK_MS - elapsed);
  inactivityTimer = setTimeout(() => checkInactivityLock(), wait);
}
function registerUserActivity() {
  if (locked || state.settings.sessionActive === false) return;
  lastActivityAt = Date.now();
  scheduleInactivityLock();
}
function checkInactivityLock() {
  if (!autoLockEnabled()) { clearInactivityTimer(); return false; }
  if (Date.now() - lastActivityAt < AUTO_LOCK_MS) { scheduleInactivityLock(); return false; }
  window.closeModal?.();
  clearInactivityTimer();
  if (role === "employee" && typeof window.employeeSessionLock === "function") {
    window.employeeSessionLock();
    return true;
  }
  locked = true;
  screen = "home";
  render();
  return true;
}

function isProPlan() {
  const tier = String(state.settings.planTier || "free").toLowerCase();
  if (tier !== "pro") return false;
  const expires = state.settings.planExpiresAt ? new Date(state.settings.planExpiresAt) : null;
  return !expires || Number.isNaN(expires.getTime()) || expires.getTime() > Date.now();
}

function securityLockButton(extraClass = "") {
  return `<button class="lock-top-btn ${extraClass}" onclick="lockApp()" title="Bloquear Mi Punto CR">🔒 <span>Bloquear</span></button>`;
}

const state = {
  products: [],
  clients: [],
  sales: [],
  orders: [],
  cashMoves: [],
  cashSessions: [],
  creditMoves: [],
  tableAccounts: [],
  settings: {
    id: "main",
    businessName: "Mi Punto CR",
    ownerName: "",
    email: "",
    phone: "",
    whatsapp: "",
    sinpe: "",
    taxMode: "added",
    taxRate: 13,
    businessType: "food",
    pinEnabled: false,
    ownerPin: "",
    cashierPin: "",
    accountCreated: false,
    onboardingComplete: false,
    activated: false,
    activationUsed: false,
    businessId: "",
    passwordHash: "",
    pendingActivationCode: "",
    activationCodeHash: "",
    sessionActive: true,
    pendingCloudConfirmation: false,
    cloudLinked: false,
    cloudUserId: "",
    cloudBusinessId: "",
    cloudRole: "owner",
    cloudPermissions: {},
    memberDisplayName: "",
    needsBusinessJoin: false,
    pendingInviteCode: "",
    localDataBusinessId: "",
    cloudOnlyV792Migrated: false,
    catalogCloudV710Ready: false,
    catalogLastCloudSyncAt: "",
    operationsCloudV711Ready: false,
    operationsLastCloudSyncAt: "",
    databaseAuditV712Ready: true,
    tableCount: 0,
    guestMode: false,
    planTier: "free",
    planSource: "free",
    planPeriod: "",
    planExpiresAt: "",
    employeeId: "",
    employeeCode: "",
    lastCloudBusinessId: "",
    oauthNoBusiness: false
  }
};

const $ = q => document.querySelector(q);
const $$ = q => [...document.querySelectorAll(q)];
const uid = p => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const enc = v => encodeURIComponent(String(v ?? "")).replace(/'/g, "%27");
const money = n => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(Number(n || 0));
const dateTime = d => new Date(d).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" });
const type = () => state.settings.businessType || "food";
const isFood = () => type() === "food";
const isProducts = () => type() === "products";
const isServices = () => type() === "services";

const ROLE_PERMISSION_DEFAULTS = {
  admin: { sell: true, orders: true, tables: true, cash: true, products: true, clients: true, sales: true, catalog: true, void_sales: true },
  employee: { sell: true, orders: true, tables: true, cash: false, products: false, clients: true, sales: false, catalog: true, void_sales: false }
};
function roleLabel(value = role) { return value === "owner" ? "Dueño" : value === "admin" ? "Administrador" : "Empleado"; }
function currentPermissions() { return state.settings.cloudPermissions && typeof state.settings.cloudPermissions === "object" ? state.settings.cloudPermissions : {}; }
function hasPermission(name) {
  if (role === "owner") return true;
  const custom = currentPermissions();
  if (Object.prototype.hasOwnProperty.call(custom, name)) return custom[name] === true;
  return ROLE_PERMISSION_DEFAULTS[role]?.[name] === true;
}
function screenPermission(target) {
  return ({ sale:"sell", orders:"orders", tables:"tables", products:"products", clients:"clients", cash:"cash", sales:"sales", catalog:"catalog" })[target] || null;
}
function canAccessScreen(target) {
  if (["home","more"].includes(target)) return true;
  if (["settings","users"].includes(target)) return role === "owner";
  const permission = screenPermission(target);
  return !permission || hasPermission(permission);
}
function requirePermission(name, message = "No tienes permiso para realizar esta acción.") {
  if (hasPermission(name)) return true;
  toast(message);
  return false;
}
const currentProducts = () => state.products.filter(p => p.businessType === type());
const currentSales = () => state.sales.filter(s => s.businessType === type());
const activeCurrentSales = () => currentSales().filter(s => !s.voided);
const visibleCurrentSales = () => currentSales().filter(s => !s.hiddenFromSales);
const currentCreditMoves = () => state.creditMoves.filter(m => m.businessType === type());
const nextSaleNumber = () => Math.max(0, ...currentSales().map(s => Number(s.number || 0))) + 1;
const clientModuleBalance = clientId => {
  const credit = activeCurrentSales().filter(s => s.clientId === clientId && s.method === "Crédito").reduce((sum, s) => sum + Number(s.total || 0), 0);
  const paid = currentCreditMoves().filter(m => m.clientId === clientId && m.type === "payment").reduce((sum, m) => sum + Number(m.amount || 0), 0);
  return Math.max(0, credit - paid);
};
const currentShift = () => [...state.cashSessions].reverse().find(x => x.status === "open");
const canSell = () => !isFood() || !!currentShift();
const isQuickLandscape = () => window.matchMedia?.("(orientation: landscape) and (max-height: 600px)")?.matches === true;
const isDesktopPOS = () => window.matchMedia?.("(min-width: 1100px) and (min-height: 650px)")?.matches === true;
const openTableAccounts = () => state.tableAccounts.filter(a => a.status === "open");
const tableAccount = n => [...state.tableAccounts].reverse().find(a => Number(a.tableNumber) === Number(n));
const activeShiftSales = () => {
  const shift = currentShift();
  return shift ? state.sales.filter(s => s.shiftId === shift.id && s.businessType === "food" && !s.voided) : [];
};
const localDayKey = value => {
  const d = new Date(value);
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};

const BRAND = {
  horizontal: "./logo-horizontal.png",
  vertical: "./logo-vertical.png",
  icon: "./icon-192.png"
};
function brandHorizontal(className = "brand-logo-horizontal") { return `<img class="${className}" src="${BRAND.horizontal}" alt="Mi Punto CR">`; }
function brandIcon(className = "brand-icon") { return `<img class="${className}" src="${BRAND.icon}" alt="Mi Punto CR">`; }
function brandVertical(className = "brand-logo-vertical") { return `<img class="${className}" src="${BRAND.vertical}" alt="Mi Punto CR">`; }
async function waitForElementImages(el) {
  const imgs = [...el.querySelectorAll("img")];
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));
}

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => {
      const app = document.querySelector("#app");
      if (app && !app.innerHTML.trim()) {
        app.innerHTML = `<section class="onboarding"><div class="onboard-card">${brandHorizontal("brand-logo-horizontal compact")}<h2>Actualizando datos…</h2><p>Espera unos segundos. Si tienes Mi Punto CR abierto en otra pestaña, ciérrala y vuelve aquí.</p></div></section>`;
      }
    };
  });
}
function store(name, mode = "readonly") { return db.transaction(name, mode).objectStore(name); }
function all(name) { return new Promise((res, rej) => { const r = store(name).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
function put(name, value) { return new Promise((res, rej) => { const r = store(name, "readwrite").put(value); r.onsuccess = () => res(value); r.onerror = () => rej(r.error); }); }
function del(name, id) { return new Promise((res, rej) => { const r = store(name, "readwrite").delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
function clearStore(name) { return new Promise((res, rej) => { const r = store(name, "readwrite").clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
async function resetLocalBusinessCache() {
  for (const name of ["products", "clients", "sales", "orders", "cashMoves", "cashSessions", "creditMoves", "tableAccounts"]) await clearStore(name);
  state.products = [];
  state.clients = [];
  state.sales = [];
  state.orders = [];
  state.cashMoves = [];
  state.cashSessions = [];
  state.creditMoves = [];
  state.tableAccounts = [];
  cart = [];
  activeClientId = "";
  quickCategory = "";
  saleMeta = { clientId: "", orderType: "Mostrador", table: "", note: "", tableAccountId: "" };
  locked = false;
}

async function load() {
  for (const name of ["products", "clients", "sales", "orders", "cashMoves", "cashSessions", "creditMoves", "tableAccounts"]) state[name] = await all(name);
  const saved = await all("settings");
  if (saved[0]) state.settings = { ...state.settings, ...saved[0] };
  if (state.settings.businessType === "general") state.settings.businessType = "food";
  if (state.settings.businessType === "retail") state.settings.businessType = "products";
  if (typeof state.settings.sessionActive !== "boolean") state.settings.sessionActive = true;
  role = ["owner","admin","employee"].includes(state.settings.cloudRole) ? state.settings.cloudRole : "owner";

  // v7.9.2: corte limpio a cuentas reales de Supabase.
  // Las cuentas locales anteriores eran solo de prueba; al actualizar se exige
  // iniciar sesión o crear una cuenta real en la nube.
  if (!state.settings.cloudOnlyV792Migrated) {
    state.settings.cloudOnlyV792Migrated = true;
    if (!state.settings.cloudLinked) state.settings.sessionActive = false;
  }

  // Migración v7.6: el impuesto se suma al cobro por defecto.
  // Solo se aplica una vez; después el usuario puede cambiarlo en Configuración.
  if (!state.settings.taxV76Migrated) {
    if (state.settings.taxMode !== "exempt") state.settings.taxMode = "added";
    state.settings.taxV76Migrated = true;
  }

  // Migración v7.5: lo que existía antes queda asociado al tipo de negocio
  // que estaba activo. Desde aquí Restaurante, Artículos y Servicios ya no
  // comparten productos, inventario, ventas ni crédito.
  const legacyType = state.settings.businessType || "food";
  for (const p of state.products) {
    if (!p.businessType) { p.businessType = legacyType; await put("products", p); }
  }
  for (const sale of state.sales) {
    if (!sale.businessType) { sale.businessType = legacyType; await put("sales", sale); }
  }
  for (const move of state.creditMoves) {
    if (!move.businessType) { move.businessType = legacyType; await put("creditMoves", move); }
  }

  await put("settings", state.settings);
}

function injectStyles() {
  if (document.getElementById("mpcr-v2-style")) return;
  const s = document.createElement("style");
  s.id = "mpcr-v2-style";
  s.textContent = `
    :root{--bg:#f7f7f3;--card:#fff;--text:#162B38;--muted:#536B79;--primary:#11A680;--primary-dark:#065F5E;--soft:#E8F7F3;--line:#e4e7e5;--danger:#b42318;--warning:#8a5a00;--radius:24px}
    *{box-sizing:border-box}html,body{min-height:100%;background:var(--bg)}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:var(--text);-webkit-tap-highlight-color:transparent}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}#app{min-height:100vh}.shell{max-width:1050px;margin:0 auto;padding:22px 20px 118px}.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:30px}.brand h1{font-size:clamp(30px,5vw,46px);margin:0;font-weight:850;letter-spacing:-1.4px}.brand p{font-size:clamp(17px,3vw,23px);margin:5px 0 0;color:var(--muted)}.status-row{padding-top:8px;display:flex;align-items:center;gap:8px}.lock-top-btn{border:1px solid #b8cbc7;background:#fff;color:var(--primary-dark);border-radius:999px;padding:10px 14px;font-weight:900;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.lock-top-btn:hover{background:var(--soft)}.badge{display:inline-flex;align-items:center;gap:6px;padding:10px 15px;border-radius:999px;font-weight:800;background:#e8eceb;color:#4b5563;white-space:nowrap}.badge.online{background:#dff7e8;color:#2f6f45}.badge.offline{background:#fbe8e5;color:#9f2f26}.offline-note{background:#fff1d6;color:#7a5200;border:1px solid #f0d9a1;padding:12px 14px;border-radius:16px;margin:-10px 0 18px}.screen-title{margin-bottom:20px}.screen-title h2{font-size:clamp(30px,5vw,44px);letter-spacing:-1px;margin:0 0 5px}.screen-title p{font-size:clamp(17px,3vw,22px);color:var(--muted);margin:0}.home-grid{display:grid;grid-template-columns:1fr;gap:14px}.big-card{width:100%;border:1px solid var(--line);background:var(--card);border-radius:30px;min-height:118px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:18px;text-align:left;box-shadow:0 8px 26px rgba(32,41,56,.035)}.big-card strong{display:block;font-size:clamp(23px,4vw,30px);font-weight:850}.big-card small{display:block;color:var(--muted);font-size:clamp(16px,2.8vw,20px);margin-top:7px}.big-card.primary{background:var(--primary);color:#fff;border-color:transparent}.big-card.primary small{color:#e5f2f0}.card-arrow{font-size:48px;font-weight:300;opacity:.65}.kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.kpi{background:#fff;border:1px solid var(--line);border-radius:24px;padding:18px 20px;min-height:102px}.kpi .muted,.kpi>span{font-size:18px}.kpi strong{display:block;margin-top:8px;font-size:clamp(24px,4vw,34px);color:var(--primary)}.panel{background:#fff;border:1px solid var(--line);border-radius:26px;padding:20px;box-shadow:0 8px 24px rgba(32,41,56,.025)}.row-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.muted{color:var(--muted)}.sale-layout{display:grid;gap:16px}.search{width:100%;border:1px solid var(--line);background:#fff;padding:15px 16px;border-radius:16px;font-size:17px;margin-bottom:14px}.category-grid{display:grid;grid-template-columns:1fr;gap:11px}.category-card{position:relative;width:100%;border:1px solid var(--line);background:#fff;border-radius:22px;padding:19px 50px 19px 20px;text-align:left}.category-name{display:block;font-size:21px;font-weight:850}.category-count{display:block;color:var(--muted);margin-top:6px;font-size:16px}.category-arrow{position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:38px;color:#89909a}.category-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.category-modal-header h3{margin:0;font-size:26px}.modal-close{border:0;background:#eef0ef;border-radius:999px;width:42px;height:42px;font-size:27px}.category-products,.variant-list{display:grid;gap:10px;margin-top:14px}.category-product{width:100%;border:1px solid var(--line);background:#fff;border-radius:18px;padding:16px;display:flex;justify-content:space-between;align-items:center;gap:16px;text-align:left}.category-product strong{font-size:18px}.category-product small{display:block;color:var(--muted);margin-top:4px}.category-product-price{font-size:18px;font-weight:850;color:var(--primary-dark);white-space:nowrap}.cart-list{margin-top:10px}.cart-item{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}.cart-item strong{font-size:18px}.qty{display:flex;align-items:center;gap:9px}.qty button{width:42px;height:42px;border:1px solid var(--line);border-radius:14px;background:#f8faf9;color:#1766b2;font-size:24px;font-weight:800}.divider{height:1px;background:var(--line);margin:16px 0}.ticket-line{display:flex;justify-content:space-between;gap:18px;padding:5px 0}.ticket-total{font-weight:850;font-size:18px}.total-box{display:flex;justify-content:space-between;align-items:center;font-size:26px;font-weight:900;padding:16px 0}.payment-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.pay-btn{border:0;border-radius:17px;padding:16px 10px;font-weight:850}.pay-cash{background:#e0f4e7;color:#22633c}.pay-sinpe{background:#e2efff;color:#245fa9}.pay-card{background:#eee9fb;color:#6540a0}.pay-credit{background:#fff2cf;color:#8a5a00}.toolbar{display:flex;gap:9px;flex-wrap:wrap;margin:10px 0}.btn{border:0;border-radius:15px;padding:13px 17px;font-weight:850;background:#eceeed}.btn.primary{background:var(--primary);color:#fff}.btn.ghost{background:#fff;border:1px solid var(--line)}.btn.danger{background:#fde9e7;color:var(--danger)}.btn.full{width:100%}.list{display:grid;gap:12px}.row-card{background:#fff;border:1px solid var(--line);border-radius:23px;padding:18px}.row-card.clickable{cursor:pointer}.field{display:grid;gap:6px;margin-bottom:12px}.field label{font-weight:800;color:var(--muted);font-size:14px}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);background:#fff;border-radius:16px;padding:14px 15px;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:#86aaa5;box-shadow:0 0 0 3px #e6f1ef}.form-grid{display:grid;gap:2px}.catalog-card{display:flex;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}.empty{color:var(--muted);text-align:center;padding:28px 12px}.bottom-nav{position:fixed;z-index:20;left:18px;right:18px;bottom:18px;max-width:1000px;margin:auto;display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid var(--line);border-radius:28px;padding:8px;box-shadow:0 14px 40px rgba(32,41,56,.12)}.bottom-nav button{border:0;background:transparent;border-radius:22px;padding:15px 5px;color:#697281;font-weight:850;font-size:16px}.bottom-nav button.active{background:var(--soft);color:var(--primary-dark)}.modal-backdrop{position:fixed;inset:0;z-index:60;background:rgba(32,41,56,.46);display:flex;align-items:flex-end;justify-content:center}.modal{background:#fff;width:min(680px,100%);max-height:92vh;overflow:auto;border-radius:30px 30px 0 0;padding:26px 24px calc(26px + env(safe-area-inset-bottom));box-shadow:0 -20px 50px rgba(0,0,0,.08)}.modal h3{font-size:28px;margin:0 0 14px}.toast{position:fixed;z-index:100;left:50%;bottom:110px;transform:translateX(-50%);background:#202938;color:#fff;border-radius:15px;padding:12px 16px;font-weight:750;max-width:min(90vw,520px);text-align:center}.ticket-business{text-align:center}.ticket-business h3{margin-bottom:6px}.cash-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:14px 0}.cash-chip{border:1px solid var(--line);background:#f7f9f8;border-radius:16px;padding:14px 6px;font-weight:850}.cash-chip.active{background:var(--soft);border-color:#94b9b3;color:var(--primary-dark)}.change-card{background:#f7f9f8;border:1px solid var(--line);border-radius:18px;padding:15px;display:flex;justify-content:space-between;align-items:center;margin-top:10px}.client-summary{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.balance-big{font-size:30px;font-weight:900;color:var(--primary-dark)}.movement{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.movement .amount.positive{color:#8a5a00}.movement .amount.negative{color:#287548}.movement-meta{font-size:14px;color:var(--muted);margin-top:4px}.back-link{border:0;background:transparent;padding:0;color:var(--primary-dark);font-weight:850;margin-bottom:14px}.onboarding{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(180deg,#f8f8f4,#f1f4f2)}.onboard-card{width:min(520px,100%);background:#fff;border:1px solid var(--line);border-radius:32px;padding:28px;box-shadow:0 18px 50px rgba(32,41,56,.08)}.onboard-brand{font-size:38px;font-weight:900;letter-spacing:-1.2px;margin:0}.onboard-sub{color:var(--muted);font-size:18px;margin:6px 0 26px}.onboard-card h2{font-size:29px;margin:0 0 8px}.onboard-card p{color:var(--muted)}.choice-grid{display:grid;gap:11px;margin-top:18px}.type-choice{border:1px solid var(--line);background:#fff;border-radius:20px;padding:18px;text-align:left}.type-choice strong{display:block;font-size:19px}.type-choice small{display:block;color:var(--muted);margin-top:5px;line-height:1.4}.activation-code{font-size:28px;font-weight:900;letter-spacing:3px;text-align:center;background:#f5f7f6;border:1px dashed #aab3af;border-radius:18px;padding:16px;margin:14px 0}.setup-note{font-size:13px;color:#6e7783;background:#f6f7f7;border-radius:14px;padding:11px 12px}.quick-shell{position:fixed;inset:0;background:#f4f5f2;padding:8px;display:grid;grid-template-columns:170px 1fr 310px;gap:8px;overflow:hidden}.quick-col{background:#fff;border:1px solid var(--line);border-radius:20px;padding:12px;overflow:auto}.quick-brand{font-size:18px;font-weight:900;margin:2px 4px 12px}.quick-category{width:100%;border:0;background:#f4f6f5;border-radius:14px;padding:12px;text-align:left;font-weight:800;margin-bottom:7px}.quick-category.active{background:var(--primary);color:#fff}.quick-category.active:hover{background:var(--primary);color:#fff}.quick-products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.quick-product{border:1px solid var(--line);background:#fff;border-radius:16px;padding:13px;text-align:left;min-height:84px}.quick-product strong{display:block;font-size:15px}.quick-product span{display:block;color:var(--primary-dark);font-weight:900;margin-top:8px}.quick-cart{display:flex;flex-direction:column;height:100%}.quick-cart-list{flex:1;overflow:auto;min-height:0}.quick-total{font-size:25px;font-weight:900;display:flex;justify-content:space-between;padding:10px 0}.quick-pay{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.quick-pay button{padding:12px 6px}.quick-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.quick-meta button{border:1px solid var(--line);background:#f7f8f7;border-radius:12px;padding:8px 10px;font-size:12px;font-weight:800}.quick-meta button.active{background:var(--soft);color:var(--primary-dark);border-color:#abc6c2}.lock-screen{min-height:100vh;display:grid;place-items:center;padding:20px}.lock-card{width:min(420px,100%);background:#fff;border:1px solid var(--line);border-radius:28px;padding:26px}.pin-input{width:100%;border:1px solid var(--line);border-radius:16px;padding:14px;font-size:24px;letter-spacing:7px;text-align:center}
    @media(min-width:700px){.shell{padding-bottom:38px}.home-grid{grid-template-columns:repeat(2,1fr)}.category-grid{grid-template-columns:repeat(2,1fr)}.sale-layout{grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr)}.bottom-nav{position:sticky;bottom:18px}.form-grid{grid-template-columns:repeat(2,1fr);gap:12px}.modal{border-radius:30px;margin:auto;align-self:center}.modal-backdrop{align-items:center;padding:18px}}
    @media(max-width:699px){.shell{padding:18px 16px 118px}.topbar{margin-bottom:24px}.big-card{min-height:104px;padding:20px}.screen-title h2{font-size:31px}.screen-title p{font-size:18px}.kpi{padding:15px}.payment-grid{grid-template-columns:1fr 1fr}.cash-quick-grid{grid-template-columns:1fr 1fr 1fr}}
    @media(orientation:landscape) and (max-height:600px){body{overflow:hidden}.modal{max-height:96vh;border-radius:24px;margin:auto;width:min(620px,92vw);padding:18px}.modal-backdrop{align-items:center;padding:8px}.toast{bottom:12px}.cash-quick-grid{grid-template-columns:repeat(4,1fr)}}
    @media(min-width:1100px) and (min-height:650px){
      body{overflow:hidden}.bottom-nav{display:none!important}.shell{max-width:none;margin:0;padding:0}.topbar{display:none}.offline-note{margin:0 0 14px}.screen-title{margin-bottom:14px}.screen-title h2{font-size:30px}.screen-title p{font-size:16px}.home-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.big-card{min-height:98px;border-radius:20px;padding:18px 20px}.big-card strong{font-size:20px}.big-card small{font-size:14px;margin-top:5px}.card-arrow{font-size:34px}.kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.kpi{min-height:88px;border-radius:18px;padding:15px 17px}.kpi .muted,.kpi>span{font-size:14px}.kpi strong{font-size:25px;margin-top:5px}.panel{border-radius:20px}.modal{border-radius:24px;margin:auto;align-self:center}.modal-backdrop{align-items:center;padding:18px}.toast{bottom:24px}
      .desktop-app{height:100vh;display:grid;grid-template-columns:230px minmax(0,1fr);background:#f5f6f3}.desktop-sidebar{background:#fff;border-right:1px solid var(--line);padding:22px 14px 18px;display:flex;flex-direction:column;min-height:0}.desktop-logo{padding:0 12px 20px;border-bottom:1px solid var(--line);margin-bottom:14px}.desktop-logo strong{display:block;font-size:23px;font-weight:900;letter-spacing:-.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.desktop-logo small{display:block;color:var(--muted);font-size:12px;margin-top:3px}.desktop-nav{display:grid;gap:5px;overflow:auto;padding-right:2px}.desktop-nav button{border:0;background:transparent;border-radius:13px;padding:11px 12px;text-align:left;font-size:14px;font-weight:800;color:#5f6875}.desktop-nav button:hover{background:#f3f6f5}.desktop-nav button.active{background:var(--soft);color:var(--primary-dark)}.desktop-sidebar-foot{margin-top:auto;border-top:1px solid var(--line);padding:14px 10px 0;font-size:12px;color:var(--muted)}.desktop-main{min-width:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}.desktop-topbar{height:72px;flex:0 0 72px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.88);backdrop-filter:blur(10px)}.desktop-topbar-title strong{display:block;font-size:17px}.desktop-topbar-title span{display:block;color:var(--muted);font-size:12px;margin-top:2px}.desktop-page{flex:1;min-height:0;overflow:auto;padding:22px 28px 34px}.desktop-home{max-width:1120px}.desktop-home h2{font-size:28px;margin:0 0 4px}.desktop-home-sub{color:var(--muted);font-size:15px;margin-bottom:18px}.desktop-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}.desktop-kpi{border:1px solid var(--line);background:#fff;border-radius:18px;padding:16px 18px;min-height:88px;text-align:left}.desktop-kpi span{color:var(--muted);font-size:13px}.desktop-kpi strong{display:block;font-size:25px;margin-top:7px;color:var(--primary-dark)}.desktop-kpi.actionable{cursor:pointer}.desktop-primary-action{width:100%;min-height:92px;border:0;border-radius:20px;background:var(--primary);color:#fff;padding:18px 22px;text-align:left;display:flex;justify-content:space-between;align-items:center;margin:0 0 14px}.desktop-primary-action strong{display:block;font-size:22px}.desktop-primary-action small{display:block;font-size:14px;color:#e8f4f2;margin-top:4px}.desktop-primary-action b{font-size:34px;font-weight:400}.desktop-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.desktop-tool{border:1px solid var(--line);background:#fff;border-radius:18px;padding:16px;text-align:left;min-height:84px}.desktop-tool strong{display:block;font-size:16px}.desktop-tool span{display:block;color:var(--muted);font-size:12px;margin-top:5px;line-height:1.35}.desktop-cash-state{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:999px;background:#eef2f0;color:#5d6672;font-size:12px;font-weight:800}.desktop-cash-state.open{background:#e1f4e8;color:#2d6c43}
      .desktop-pos-page{height:100%;display:flex;flex-direction:column;min-height:0}.desktop-pos-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px;flex:0 0 auto}.desktop-pos-header h2{font-size:25px;margin:0}.desktop-pos-header p{font-size:13px;color:var(--muted);margin:3px 0 0}.desktop-pos-layout{display:grid;grid-template-columns:180px minmax(0,1fr) 340px;gap:10px;min-height:0;flex:1}.desktop-pos-box{background:#fff;border:1px solid var(--line);border-radius:18px;min-height:0;overflow:hidden}.desktop-category-pane{padding:12px;overflow:auto}.desktop-category-title{font-size:12px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin:3px 5px 10px}.desktop-category-btn{width:100%;border:0;background:#f5f7f6;border-radius:12px;padding:11px 10px;margin-bottom:6px;text-align:left;font-size:13px;font-weight:800}.desktop-category-btn.active{background:var(--primary);color:#fff}.desktop-category-btn.active:hover{background:var(--primary);color:#fff}.desktop-product-pane{display:flex;flex-direction:column;min-width:0}.desktop-product-toolbar{padding:12px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px}.desktop-product-toolbar .search{margin:0;padding:11px 12px;border-radius:12px;font-size:14px}.desktop-product-grid{padding:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;overflow:auto;align-content:start}.desktop-product{border:1px solid var(--line);background:#fff;border-radius:14px;padding:13px;text-align:left;min-height:92px}.desktop-product:hover{border-color:#a9c7c2;background:#fbfdfc}.desktop-product strong{display:block;font-size:14px;line-height:1.25}.desktop-product small{display:block;color:var(--muted);font-size:11px;margin-top:4px}.desktop-product span{display:block;color:var(--primary-dark);font-weight:900;font-size:15px;margin-top:10px}.desktop-cart-pane{display:flex;flex-direction:column;padding:12px}.desktop-cart-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.desktop-cart-head h3{font-size:17px;margin:0}.desktop-cart-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px}.desktop-cart-meta button{border:1px solid var(--line);background:#f7f8f7;border-radius:10px;padding:7px 9px;font-size:11px;font-weight:800}.desktop-cart-meta button.active{background:var(--soft);color:var(--primary-dark);border-color:#abc6c2}.desktop-cart-list{flex:1;min-height:0;overflow:auto;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:4px 0}.desktop-cart-list .cart-item{padding:9px 0}.desktop-cart-list .cart-item strong{font-size:13px}.desktop-cart-list .muted{font-size:11px}.desktop-cart-list .qty{gap:5px}.desktop-cart-list .qty button{width:30px;height:30px;border-radius:9px;font-size:18px}.desktop-summary{padding:9px 0 7px}.desktop-summary .ticket-line{font-size:12px}.desktop-summary .total-box{font-size:22px;padding:8px 0}.desktop-pay-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.desktop-pay-grid .pay-btn{padding:11px 6px;border-radius:12px;font-size:12px}.desktop-client-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.desktop-client-row span{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.desktop-client-row button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:7px 9px;font-size:11px;font-weight:800;white-space:nowrap}
    }
    @media(min-width:1500px) and (min-height:650px){.desktop-app{grid-template-columns:245px minmax(0,1fr)}.desktop-pos-layout{grid-template-columns:200px minmax(0,1fr) 380px}.desktop-product-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.desktop-page{padding-left:32px;padding-right:32px}}
    /* Mi Punto CR v4 · escritorio POS con tarjetas grandes y ventanas flotantes */
    @media(min-width:1100px) and (min-height:650px){
      .desktop-app{grid-template-columns:250px minmax(0,1fr);gap:14px;padding:14px;background:#eef1ee}
      .desktop-sidebar{height:100%;min-height:0;border:1px solid #dde3df;border-radius:26px;padding:20px 14px;background:#fff;box-shadow:0 16px 42px rgba(32,41,56,.07)}
      .desktop-logo{padding:4px 14px 20px;margin-bottom:16px}
      .desktop-logo strong{font-size:25px}.desktop-logo small{font-size:13px;margin-top:5px}
      .desktop-nav{gap:8px;padding:2px 2px 6px}
      .desktop-nav button{min-height:52px;border:1px solid transparent;border-radius:16px;padding:14px 15px;font-size:15px;transition:.14s ease}
      .desktop-nav button:hover{background:#f5f8f6;border-color:#e7ebe8;transform:translateX(2px)}
      .desktop-nav button.active{background:var(--soft);border-color:#d5e7e3;color:var(--primary-dark);box-shadow:inset 4px 0 0 var(--primary)}
      .desktop-sidebar-foot{padding:16px 12px 2px;font-size:13px}
      .desktop-main{height:100%;min-height:0;border-radius:26px;overflow:hidden;background:transparent}
      .desktop-topbar{height:76px;flex-basis:76px;margin:0 0 12px;border:1px solid #dde3df;border-radius:22px;background:#fff;padding:0 26px;box-shadow:0 10px 30px rgba(32,41,56,.045)}
      .desktop-page{padding:10px 4px 24px 4px}
      .desktop-home{max-width:1280px}
      .desktop-home h2{font-size:31px}.desktop-home-sub{font-size:16px;margin-bottom:20px}
      .desktop-kpis{gap:14px;margin-bottom:16px}
      .desktop-kpi{min-height:112px;border-radius:22px;padding:21px 22px;box-shadow:0 10px 28px rgba(32,41,56,.035)}
      .desktop-kpi span{font-size:14px}.desktop-kpi strong{font-size:30px;margin-top:10px}
      .desktop-primary-action{min-height:122px;border-radius:24px;padding:24px 28px;margin-bottom:16px;box-shadow:0 14px 34px rgba(78,139,131,.18)}
      .desktop-primary-action strong{font-size:27px}.desktop-primary-action small{font-size:15px;margin-top:7px}.desktop-primary-action b{font-size:44px}
      .desktop-tools{grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .desktop-tool{min-height:128px;border-radius:22px;padding:22px;box-shadow:0 10px 28px rgba(32,41,56,.035);transition:.14s ease}
      .desktop-tool:hover{border-color:#bad0cc;transform:translateY(-2px);box-shadow:0 14px 34px rgba(32,41,56,.07)}
      .desktop-tool strong{font-size:19px}.desktop-tool span{font-size:13px;margin-top:8px;line-height:1.45}
      .desktop-cash-state{font-size:13px;padding:9px 13px}

      .desktop-pos-header{margin-bottom:14px}.desktop-pos-header h2{font-size:28px}.desktop-pos-header p{font-size:14px}
      .desktop-pos-layout{grid-template-columns:210px minmax(0,1fr) 390px;gap:14px}
      .desktop-pos-box{border-radius:22px;border-color:#dde3df;box-shadow:0 10px 30px rgba(32,41,56,.04)}
      .desktop-category-pane{padding:14px}.desktop-category-title{font-size:13px;margin:5px 7px 12px}
      .desktop-category-btn{min-height:54px;border-radius:14px;padding:14px 13px;margin-bottom:8px;font-size:14px;border:1px solid transparent}
      .desktop-category-btn:hover{border-color:#d9e4e0;background:#f8faf9}.desktop-category-btn.active,.desktop-category-btn.active:hover{background:var(--primary);color:#fff;border-color:transparent}
      .desktop-product-toolbar{padding:14px}.desktop-product-toolbar .search{min-height:48px;font-size:15px;padding:12px 14px}
      .desktop-product-grid{padding:14px;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .desktop-product{min-height:125px;border-radius:18px;padding:17px;box-shadow:0 7px 18px rgba(32,41,56,.025)}
      .desktop-product strong{font-size:16px}.desktop-product small{font-size:12px;margin-top:6px}.desktop-product span{font-size:18px;margin-top:14px}
      .desktop-cart-pane{padding:16px}.desktop-cart-head h3{font-size:19px}.desktop-cart-head .btn{min-height:42px!important;padding:9px 13px!important;font-size:12px!important}
      .desktop-cart-meta{gap:8px;margin-bottom:10px}.desktop-cart-meta button{min-height:42px;padding:9px 11px;font-size:12px;border-radius:12px}
      .desktop-client-row{margin-bottom:10px}.desktop-client-row span{font-size:13px}.desktop-client-row button{min-height:42px;padding:9px 12px;font-size:12px;border-radius:12px}
      .desktop-cart-list .cart-item{padding:12px 0}.desktop-cart-list .cart-item strong{font-size:14px}.desktop-cart-list .qty button{width:36px;height:36px;border-radius:11px}
      .desktop-summary{padding:12px 0 10px}.desktop-summary .ticket-line{font-size:13px}.desktop-summary .total-box{font-size:27px;padding:11px 0}
      .desktop-pay-grid{gap:9px}.desktop-pay-grid .pay-btn{min-height:56px;padding:14px 8px;border-radius:15px;font-size:14px}

      .modal-backdrop{background:rgba(22,31,39,.42);backdrop-filter:blur(4px)}
      .modal{width:min(760px,calc(100vw - 72px));max-height:86vh;border:1px solid #e0e5e2;border-radius:26px!important;padding:28px;box-shadow:0 26px 80px rgba(18,28,36,.22)}
      .modal h3{font-size:29px}.modal .btn{min-height:46px;padding:13px 18px}.modal .field input,.modal .field select,.modal .field textarea{min-height:48px}
      .cash-quick-grid{grid-template-columns:repeat(3,1fr);gap:11px}.cash-chip{min-height:58px;border-radius:16px;font-size:16px}
    }
    @media(min-width:1500px) and (min-height:650px){
      .desktop-app{grid-template-columns:270px minmax(0,1fr)}
      .desktop-pos-layout{grid-template-columns:225px minmax(0,1fr) 420px}
      .desktop-product-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
    }
  `;
  document.head.appendChild(s);
}

function injectV7Styles() {
  if (document.getElementById("mpcr-v7-style")) return;
  const st = document.createElement("style");
  st.id = "mpcr-v7-style";
  st.textContent = `
    .brand-logo-horizontal{display:block;width:min(360px,82%);height:auto;margin:0 auto 18px}
    .brand-logo-horizontal.compact{width:min(240px,72%);margin-bottom:14px}
    .brand-logo-vertical{display:block;width:min(190px,58%);height:auto;margin:0 auto 14px}
    .brand-icon{width:42px;height:42px;border-radius:12px;object-fit:cover;flex:0 0 auto}
    .brand-icon.small{width:34px;height:34px;border-radius:10px}
    .brand-with-icon{display:flex;align-items:center;gap:11px;min-width:0}
    .brand-with-icon>div{min-width:0}.brand-with-icon h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .desktop-logo{display:flex;align-items:center;gap:11px}.desktop-logo>div{min-width:0}
    .onboard-card .brand-logo-horizontal{margin-top:-4px}
    .lock-brand{display:grid;place-items:center;margin-bottom:14px}
    .mpcr-powered{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:12px;color:#536B79;font-size:10px}
    .mpcr-powered img{width:62px;height:auto;display:block}
    .brand-powered-logo{width:86px!important;height:auto!important;margin:0!important}
    .fullscreen-btn{border:1px solid var(--line);background:#fff;border-radius:14px;padding:10px 13px;font-weight:850;margin-right:10px}
    .desktop-top-actions{display:flex;align-items:center;gap:8px}
    .product-category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .product-category-card{min-height:132px;border:1px solid var(--line);border-radius:24px;background:#fff;padding:22px;text-align:left;display:flex;justify-content:space-between;align-items:center;box-shadow:0 9px 24px rgba(32,41,56,.035)}
    .product-category-card strong{font-size:22px}.product-category-card small{display:block;color:var(--muted);font-size:14px;margin-top:8px}.product-category-card b{font-size:38px;opacity:.45}
    .category-products-page{display:grid;gap:12px}.product-row-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    .sales-scroll{max-height:calc(100vh - 245px);overflow:auto;padding-right:4px}.sales-day{margin-bottom:18px}.sales-day-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:0 0 10px;padding:0 4px}.sales-day-head h3{margin:0;font-size:22px}.sales-day-head span{color:var(--muted);font-size:14px}.sales-day-list{display:grid;gap:9px}
    .table-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.table-card{border:1px solid var(--line);background:#fff;border-radius:24px;padding:18px;text-align:center;min-height:185px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;box-shadow:0 8px 24px rgba(32,41,56,.03)}.table-card strong{font-size:19px}.table-card small{color:var(--muted)}
    .table-icon{position:relative;width:84px;height:84px;margin:0 auto}.table-icon .top,.table-icon .bottom,.table-icon .left,.table-icon .right{position:absolute;background:#202938;border-radius:4px}.table-icon .center{position:absolute;left:22px;top:22px;width:40px;height:40px;border:4px solid #202938;border-radius:5px;display:grid;place-items:center;font-weight:900;font-size:16px;background:#fff}.table-icon .top{width:26px;height:13px;left:29px;top:2px}.table-icon .bottom{width:26px;height:13px;left:29px;bottom:2px}.table-icon .left{width:13px;height:26px;left:2px;top:29px}.table-icon .right{width:13px;height:26px;right:2px;top:29px}
    .table-picker-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.table-pick{border:1px solid var(--line);background:#fff;border-radius:16px;padding:14px 8px;font-weight:850}.table-pick small{display:block;color:var(--muted);font-weight:600;margin-top:3px}
    .table-account-banner{background:#f4f7f6;border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin-bottom:12px;display:flex;justify-content:space-between;gap:10px;align-items:center}
    .report-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}.report-stat{background:#f7f9f8;border:1px solid var(--line);border-radius:16px;padding:13px}.report-stat span{display:block;color:var(--muted);font-size:12px}.report-stat strong{display:block;margin-top:5px;font-size:19px}.closing-list{display:grid;gap:10px;margin-top:14px}
    @media(min-width:1100px){.product-category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.table-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
    @media(max-width:699px){.product-category-grid{grid-template-columns:1fr}.table-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.table-picker-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.sales-scroll{max-height:none;overflow:visible}}
    @media print{
      body.print-receipt-mode *{visibility:hidden!important}
      body.print-receipt-mode #printReceiptRoot,body.print-receipt-mode #printReceiptRoot *{visibility:visible!important}
      body.print-receipt-mode #printReceiptRoot{position:absolute!important;left:0!important;top:0!important;width:80mm!important;background:#fff!important;padding:4mm!important;color:#000!important;font-family:Arial,sans-serif!important}
      @page{size:80mm auto;margin:0}
    }
  `;
  document.head.appendChild(st);
}

function badge() { return navigator.onLine ? `<span class="badge online">● En línea</span>` : `<span class="badge offline">● Sin conexión</span>`; }
function navBtn(target, label, active) { return `<button class="${active === target ? "active" : ""}" onclick="go('${target}')">${label}</button>`; }
function desktopNavItems() {
  const items = [["home", "Inicio"], ["sale", isServices() ? "Nuevo servicio" : "Vender"]];
  if (isFood()) items.push(["orders", "Pedidos"], ["tables", "Mesas"], ["products", "Productos"], ["clients", "Clientes / Crédito"], ["cash", "Caja"], ["sales", "Mis ventas"], ["catalog", "Menú QR"]);
  if (isProducts()) items.push(["products", "Productos"], ["clients", "Clientes / Crédito"], ["sales", "Mis ventas"], ["catalog", "Catálogo QR"]);
  if (isServices()) items.push(["products", "Servicios"], ["clients", "Clientes"], ["sales", "Mis ventas"], ["catalog", "Catálogo QR"]);
  if (role === "owner") { if (state.settings.cloudLinked) items.push(["users", "Empleados"]); items.push(["settings", "Configuración"]); }
  return items.filter(([target]) => canAccessScreen(target));
}
function desktopShell(content, active = "home") {
  const current = screen || active;
  const nav = desktopNavItems().map(([target, label]) => `<button class="${current === target ? "active" : ""}" onclick="go('${target}')">${label}</button>`).join("");
  const shift = currentShift();
  return `<div class="desktop-app"><aside class="desktop-sidebar"><div class="desktop-logo">${brandIcon("brand-icon small")}<div><strong>${esc(state.settings.businessName)}</strong><small>Mi Punto CR</small></div></div><nav class="desktop-nav">${nav}</nav><div class="desktop-sidebar-foot">${isFood() ? (shift ? `Caja abierta · ${dateTime(shift.openedAt)}` : "Caja cerrada") : "Listo para cobrar"}</div></aside><main class="desktop-main"><header class="desktop-topbar"><div class="desktop-topbar-title"><strong>${esc(state.settings.businessName)}</strong><span>${isFood() ? (shift ? "Punto de venta · Caja abierta" : "Punto de venta · Caja cerrada") : (isServices() ? "Servicios" : "Punto de venta")}</span></div><div class="desktop-top-actions">${securityLockButton()}<button class="fullscreen-btn" onclick="toggleFullscreen()">⛶ Pantalla completa</button>${badge()}</div></header><div class="desktop-page">${!navigator.onLine ? `<div class="offline-note">Sin conexión. Las funciones internas siguen guardándose en este dispositivo.</div>` : ""}${content}</div></main></div>`;
}
function shell(content, active = "home") {
  if (isDesktopPOS()) return desktopShell(content, active);
  const third = isFood() ? ["orders", "Pedidos"] : ["sales", "Mis ventas"];
  return `<main class="shell">
    <header class="topbar"><div class="brand brand-with-icon">${brandIcon("brand-icon")}<div><h1>${esc(state.settings.businessName)}</h1><p>Mi Punto CR</p></div></div><div class="status-row">${securityLockButton()}${badge()}</div></header>
    ${!navigator.onLine ? `<div class="offline-note">Sin conexión. Las funciones internas siguen guardándose en este dispositivo.</div>` : ""}
    ${content}
  </main>
  <nav class="bottom-nav">${navBtn("home", "Inicio", active)}${navBtn("sale", isServices() ? "Servicio" : "Vender", active)}${navBtn(third[0], third[1], active)}${navBtn("more", "Más", active)}</nav>`;
}
function card(target, title, sub, primary = false, disabled = false) {
  return `<button class="big-card ${primary ? "primary" : ""}" ${disabled ? "disabled style='opacity:.55'" : `onclick="go('${target}')"`}><span><strong>${title}</strong><small>${sub}</small></span><span class="card-arrow">›</span></button>`;
}
function rerenderSale() {
  if (isQuickLandscape()) return renderQuickSale();
  if (isDesktopPOS()) return renderDesktopSale();
  renderSale();
}
function resetSaleMeta() { saleMeta = { clientId: "", orderType: "Mostrador", table: "", note: "", tableAccountId: "" }; }

window.go = target => {
  if (!canAccessScreen(target)) { toast("No tienes permiso para abrir esta sección."); return; }
  if (screen === "settings" && target !== "settings") settingsFormDirty = false;
  if (target === "sale" && !canSell()) {
    if (hasPermission("cash")) {
      toast("Primero debes abrir la caja.");
      screen = "cash";
      return render();
    }
    toast("La caja está cerrada. Pide al dueño o administrador que la abra.");
    screen = "home";
    return render();
  }

  // Cada vez que se entra a Vender desde otro módulo,
  // comienza una venta temporal completamente limpia.
  // Las cuentas de mesa ya guardadas NO se eliminan.
  if (target === "sale" && screen !== "sale") {
    cart = [];
    resetSaleMeta();
    quickCategory = "";
  }

  screen = target;
  render();
};

window.toggleFullscreen = async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  } catch (e) { toast("El navegador no permitió pantalla completa."); }
};

function render() {
  if (typeof mpPasswordRecovery !== "undefined" && mpPasswordRecovery) { clearInactivityTimer(); return renderPasswordRecovery(); }
  if (!state.settings.onboardingComplete) { clearInactivityTimer(); return renderOnboarding(); }
  if (state.settings.sessionActive === false) { clearInactivityTimer(); return renderAccessHome(); }
  if (locked) { clearInactivityTimer(); return renderLock(); }
  scheduleInactivityLock();
  if (isQuickLandscape()) return renderQuickSale();
  const routes = {
    home: renderHome,
    sale: renderSale,
    orders: renderOrders,
    tables: renderTables,
    products: renderProducts,
    clients: renderClients,
    clientDetail: renderClientDetail,
    cash: renderCash,
    catalog: renderCatalog,
    sales: renderSales,
    users: renderUsers,
    settings: renderSettings
  };
  (routes[screen] || renderMore)();
}

