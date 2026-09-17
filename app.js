const DB_NAME = "mipuntocr";
const DB_VERSION = 4;
const STORES = ["products", "clients", "sales", "orders", "cashMoves", "cashSessions", "settings", "creditMoves"];

let db;
let screen = "home";
let cart = [];
let locked = false;
let role = "owner";
let activeClientId = "";
let quickCategory = "";
let authStep = "welcome";
let setupDraft = {};
let saleMeta = { clientId: "", orderType: "Mostrador", table: "", note: "" };

const state = {
  products: [],
  clients: [],
  sales: [],
  orders: [],
  cashMoves: [],
  cashSessions: [],
  creditMoves: [],
  settings: {
    id: "main",
    businessName: "Mi Punto CR",
    ownerName: "",
    email: "",
    phone: "",
    whatsapp: "",
    sinpe: "",
    taxMode: "included",
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
    sessionActive: true
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
const currentShift = () => [...state.cashSessions].reverse().find(x => x.status === "open");
const canSell = () => !isFood() || !!currentShift();
const isQuickLandscape = () => window.matchMedia?.("(orientation: landscape) and (max-height: 600px)")?.matches === true;
const isDesktopPOS = () => window.matchMedia?.("(min-width: 1100px) and (min-height: 650px)")?.matches === true;

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
  });
}
function store(name, mode = "readonly") { return db.transaction(name, mode).objectStore(name); }
function all(name) { return new Promise((res, rej) => { const r = store(name).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
function put(name, value) { return new Promise((res, rej) => { const r = store(name, "readwrite").put(value); r.onsuccess = () => res(value); r.onerror = () => rej(r.error); }); }
function del(name, id) { return new Promise((res, rej) => { const r = store(name, "readwrite").delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }

async function load() {
  for (const name of ["products", "clients", "sales", "orders", "cashMoves", "cashSessions", "creditMoves"]) state[name] = await all(name);
  const saved = await all("settings");
  if (saved[0]) state.settings = { ...state.settings, ...saved[0] };
  if (state.settings.businessType === "general") state.settings.businessType = "food";
  if (state.settings.businessType === "retail") state.settings.businessType = "products";
  if (typeof state.settings.sessionActive !== "boolean") state.settings.sessionActive = true;
  await put("settings", state.settings);
}

function injectStyles() {
  if (document.getElementById("mpcr-v2-style")) return;
  const s = document.createElement("style");
  s.id = "mpcr-v2-style";
  s.textContent = `
    :root{--bg:#f7f7f3;--card:#fff;--text:#202938;--muted:#7b8492;--primary:#4e8b83;--primary-dark:#39766f;--soft:#eaf4f2;--line:#e4e7e5;--danger:#b42318;--warning:#8a5a00;--radius:24px}
    *{box-sizing:border-box}html,body{min-height:100%;background:var(--bg)}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:var(--text);-webkit-tap-highlight-color:transparent}button,input,select,textarea{font:inherit;color:inherit}button{cursor:pointer}#app{min-height:100vh}.shell{max-width:1050px;margin:0 auto;padding:22px 20px 118px}.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:30px}.brand h1{font-size:clamp(30px,5vw,46px);margin:0;font-weight:850;letter-spacing:-1.4px}.brand p{font-size:clamp(17px,3vw,23px);margin:5px 0 0;color:var(--muted)}.status-row{padding-top:8px}.badge{display:inline-flex;align-items:center;gap:6px;padding:10px 15px;border-radius:999px;font-weight:800;background:#e8eceb;color:#4b5563;white-space:nowrap}.badge.online{background:#dff7e8;color:#2f6f45}.badge.offline{background:#fbe8e5;color:#9f2f26}.offline-note{background:#fff1d6;color:#7a5200;border:1px solid #f0d9a1;padding:12px 14px;border-radius:16px;margin:-10px 0 18px}.screen-title{margin-bottom:20px}.screen-title h2{font-size:clamp(30px,5vw,44px);letter-spacing:-1px;margin:0 0 5px}.screen-title p{font-size:clamp(17px,3vw,22px);color:var(--muted);margin:0}.home-grid{display:grid;grid-template-columns:1fr;gap:14px}.big-card{width:100%;border:1px solid var(--line);background:var(--card);border-radius:30px;min-height:118px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:18px;text-align:left;box-shadow:0 8px 26px rgba(32,41,56,.035)}.big-card strong{display:block;font-size:clamp(23px,4vw,30px);font-weight:850}.big-card small{display:block;color:var(--muted);font-size:clamp(16px,2.8vw,20px);margin-top:7px}.big-card.primary{background:var(--primary);color:#fff;border-color:transparent}.big-card.primary small{color:#e5f2f0}.card-arrow{font-size:48px;font-weight:300;opacity:.65}.kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.kpi{background:#fff;border:1px solid var(--line);border-radius:24px;padding:18px 20px;min-height:102px}.kpi .muted,.kpi>span{font-size:18px}.kpi strong{display:block;margin-top:8px;font-size:clamp(24px,4vw,34px);color:#0b84ff}.panel{background:#fff;border:1px solid var(--line);border-radius:26px;padding:20px;box-shadow:0 8px 24px rgba(32,41,56,.025)}.row-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.muted{color:var(--muted)}.sale-layout{display:grid;gap:16px}.search{width:100%;border:1px solid var(--line);background:#fff;padding:15px 16px;border-radius:16px;font-size:17px;margin-bottom:14px}.category-grid{display:grid;grid-template-columns:1fr;gap:11px}.category-card{position:relative;width:100%;border:1px solid var(--line);background:#fff;border-radius:22px;padding:19px 50px 19px 20px;text-align:left}.category-name{display:block;font-size:21px;font-weight:850}.category-count{display:block;color:var(--muted);margin-top:6px;font-size:16px}.category-arrow{position:absolute;right:20px;top:50%;transform:translateY(-50%);font-size:38px;color:#89909a}.category-modal-header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.category-modal-header h3{margin:0;font-size:26px}.modal-close{border:0;background:#eef0ef;border-radius:999px;width:42px;height:42px;font-size:27px}.category-products,.variant-list{display:grid;gap:10px;margin-top:14px}.category-product{width:100%;border:1px solid var(--line);background:#fff;border-radius:18px;padding:16px;display:flex;justify-content:space-between;align-items:center;gap:16px;text-align:left}.category-product strong{font-size:18px}.category-product small{display:block;color:var(--muted);margin-top:4px}.category-product-price{font-size:18px;font-weight:850;color:var(--primary-dark);white-space:nowrap}.cart-list{margin-top:10px}.cart-item{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}.cart-item strong{font-size:18px}.qty{display:flex;align-items:center;gap:9px}.qty button{width:42px;height:42px;border:1px solid var(--line);border-radius:14px;background:#f8faf9;color:#1766b2;font-size:24px;font-weight:800}.divider{height:1px;background:var(--line);margin:16px 0}.ticket-line{display:flex;justify-content:space-between;gap:18px;padding:5px 0}.ticket-total{font-weight:850;font-size:18px}.total-box{display:flex;justify-content:space-between;align-items:center;font-size:26px;font-weight:900;padding:16px 0}.payment-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.pay-btn{border:0;border-radius:17px;padding:16px 10px;font-weight:850}.pay-cash{background:#e0f4e7;color:#22633c}.pay-sinpe{background:#e2efff;color:#245fa9}.pay-card{background:#eee9fb;color:#6540a0}.pay-credit{background:#fff2cf;color:#8a5a00}.toolbar{display:flex;gap:9px;flex-wrap:wrap;margin:10px 0}.btn{border:0;border-radius:15px;padding:13px 17px;font-weight:850;background:#eceeed}.btn.primary{background:var(--primary);color:#fff}.btn.ghost{background:#fff;border:1px solid var(--line)}.btn.danger{background:#fde9e7;color:var(--danger)}.btn.full{width:100%}.list{display:grid;gap:12px}.row-card{background:#fff;border:1px solid var(--line);border-radius:23px;padding:18px}.row-card.clickable{cursor:pointer}.field{display:grid;gap:6px;margin-bottom:12px}.field label{font-weight:800;color:var(--muted);font-size:14px}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);background:#fff;border-radius:16px;padding:14px 15px;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:#86aaa5;box-shadow:0 0 0 3px #e6f1ef}.form-grid{display:grid;gap:2px}.catalog-card{display:flex;justify-content:space-between;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}.empty{color:var(--muted);text-align:center;padding:28px 12px}.bottom-nav{position:fixed;z-index:20;left:18px;right:18px;bottom:18px;max-width:1000px;margin:auto;display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid var(--line);border-radius:28px;padding:8px;box-shadow:0 14px 40px rgba(32,41,56,.12)}.bottom-nav button{border:0;background:transparent;border-radius:22px;padding:15px 5px;color:#697281;font-weight:850;font-size:16px}.bottom-nav button.active{background:var(--soft);color:var(--primary-dark)}.modal-backdrop{position:fixed;inset:0;z-index:60;background:rgba(32,41,56,.46);display:flex;align-items:flex-end;justify-content:center}.modal{background:#fff;width:min(680px,100%);max-height:92vh;overflow:auto;border-radius:30px 30px 0 0;padding:26px 24px calc(26px + env(safe-area-inset-bottom));box-shadow:0 -20px 50px rgba(0,0,0,.08)}.modal h3{font-size:28px;margin:0 0 14px}.toast{position:fixed;z-index:100;left:50%;bottom:110px;transform:translateX(-50%);background:#202938;color:#fff;border-radius:15px;padding:12px 16px;font-weight:750;max-width:min(90vw,520px);text-align:center}.ticket-business{text-align:center}.ticket-business h3{margin-bottom:6px}.cash-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:14px 0}.cash-chip{border:1px solid var(--line);background:#f7f9f8;border-radius:16px;padding:14px 6px;font-weight:850}.cash-chip.active{background:var(--soft);border-color:#94b9b3;color:var(--primary-dark)}.change-card{background:#f7f9f8;border:1px solid var(--line);border-radius:18px;padding:15px;display:flex;justify-content:space-between;align-items:center;margin-top:10px}.client-summary{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.balance-big{font-size:30px;font-weight:900;color:var(--primary-dark)}.movement{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.movement .amount.positive{color:#8a5a00}.movement .amount.negative{color:#287548}.movement-meta{font-size:14px;color:var(--muted);margin-top:4px}.back-link{border:0;background:transparent;padding:0;color:var(--primary-dark);font-weight:850;margin-bottom:14px}.onboarding{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(180deg,#f8f8f4,#f1f4f2)}.onboard-card{width:min(520px,100%);background:#fff;border:1px solid var(--line);border-radius:32px;padding:28px;box-shadow:0 18px 50px rgba(32,41,56,.08)}.onboard-brand{font-size:38px;font-weight:900;letter-spacing:-1.2px;margin:0}.onboard-sub{color:var(--muted);font-size:18px;margin:6px 0 26px}.onboard-card h2{font-size:29px;margin:0 0 8px}.onboard-card p{color:var(--muted)}.choice-grid{display:grid;gap:11px;margin-top:18px}.type-choice{border:1px solid var(--line);background:#fff;border-radius:20px;padding:18px;text-align:left}.type-choice strong{display:block;font-size:19px}.type-choice small{display:block;color:var(--muted);margin-top:5px;line-height:1.4}.activation-code{font-size:28px;font-weight:900;letter-spacing:3px;text-align:center;background:#f5f7f6;border:1px dashed #aab3af;border-radius:18px;padding:16px;margin:14px 0}.setup-note{font-size:13px;color:#6e7783;background:#f6f7f7;border-radius:14px;padding:11px 12px}.quick-shell{position:fixed;inset:0;background:#f4f5f2;padding:8px;display:grid;grid-template-columns:170px 1fr 310px;gap:8px;overflow:hidden}.quick-col{background:#fff;border:1px solid var(--line);border-radius:20px;padding:12px;overflow:auto}.quick-brand{font-size:18px;font-weight:900;margin:2px 4px 12px}.quick-category{width:100%;border:0;background:#f4f6f5;border-radius:14px;padding:12px;text-align:left;font-weight:800;margin-bottom:7px}.quick-category.active{background:var(--primary);color:#fff}.quick-products{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.quick-product{border:1px solid var(--line);background:#fff;border-radius:16px;padding:13px;text-align:left;min-height:84px}.quick-product strong{display:block;font-size:15px}.quick-product span{display:block;color:var(--primary-dark);font-weight:900;margin-top:8px}.quick-cart{display:flex;flex-direction:column;height:100%}.quick-cart-list{flex:1;overflow:auto;min-height:0}.quick-total{font-size:25px;font-weight:900;display:flex;justify-content:space-between;padding:10px 0}.quick-pay{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.quick-pay button{padding:12px 6px}.quick-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.quick-meta button{border:1px solid var(--line);background:#f7f8f7;border-radius:12px;padding:8px 10px;font-size:12px;font-weight:800}.quick-meta button.active{background:var(--soft);color:var(--primary-dark);border-color:#abc6c2}.lock-screen{min-height:100vh;display:grid;place-items:center;padding:20px}.lock-card{width:min(420px,100%);background:#fff;border:1px solid var(--line);border-radius:28px;padding:26px}.pin-input{width:100%;border:1px solid var(--line);border-radius:16px;padding:14px;font-size:24px;letter-spacing:7px;text-align:center}
    @media(min-width:700px){.shell{padding-bottom:38px}.home-grid{grid-template-columns:repeat(2,1fr)}.category-grid{grid-template-columns:repeat(2,1fr)}.sale-layout{grid-template-columns:minmax(0,1.25fr) minmax(340px,.75fr)}.bottom-nav{position:sticky;bottom:18px}.form-grid{grid-template-columns:repeat(2,1fr);gap:12px}.modal{border-radius:30px;margin:auto;align-self:center}.modal-backdrop{align-items:center;padding:18px}}
    @media(max-width:699px){.shell{padding:18px 16px 118px}.topbar{margin-bottom:24px}.big-card{min-height:104px;padding:20px}.screen-title h2{font-size:31px}.screen-title p{font-size:18px}.kpi{padding:15px}.payment-grid{grid-template-columns:1fr 1fr}.cash-quick-grid{grid-template-columns:1fr 1fr 1fr}}
    @media(orientation:landscape) and (max-height:600px){body{overflow:hidden}.modal{max-height:96vh;border-radius:24px;margin:auto;width:min(620px,92vw);padding:18px}.modal-backdrop{align-items:center;padding:8px}.toast{bottom:12px}.cash-quick-grid{grid-template-columns:repeat(4,1fr)}}
    @media(min-width:1100px) and (min-height:650px){
      body{overflow:hidden}.bottom-nav{display:none!important}.shell{max-width:none;margin:0;padding:0}.topbar{display:none}.offline-note{margin:0 0 14px}.screen-title{margin-bottom:14px}.screen-title h2{font-size:30px}.screen-title p{font-size:16px}.home-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.big-card{min-height:98px;border-radius:20px;padding:18px 20px}.big-card strong{font-size:20px}.big-card small{font-size:14px;margin-top:5px}.card-arrow{font-size:34px}.kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.kpi{min-height:88px;border-radius:18px;padding:15px 17px}.kpi .muted,.kpi>span{font-size:14px}.kpi strong{font-size:25px;margin-top:5px}.panel{border-radius:20px}.modal{border-radius:24px;margin:auto;align-self:center}.modal-backdrop{align-items:center;padding:18px}.toast{bottom:24px}
      .desktop-app{height:100vh;display:grid;grid-template-columns:230px minmax(0,1fr);background:#f5f6f3}.desktop-sidebar{background:#fff;border-right:1px solid var(--line);padding:22px 14px 18px;display:flex;flex-direction:column;min-height:0}.desktop-logo{padding:0 12px 20px;border-bottom:1px solid var(--line);margin-bottom:14px}.desktop-logo strong{display:block;font-size:23px;font-weight:900;letter-spacing:-.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.desktop-logo small{display:block;color:var(--muted);font-size:12px;margin-top:3px}.desktop-nav{display:grid;gap:5px;overflow:auto;padding-right:2px}.desktop-nav button{border:0;background:transparent;border-radius:13px;padding:11px 12px;text-align:left;font-size:14px;font-weight:800;color:#5f6875}.desktop-nav button:hover{background:#f3f6f5}.desktop-nav button.active{background:var(--soft);color:var(--primary-dark)}.desktop-sidebar-foot{margin-top:auto;border-top:1px solid var(--line);padding:14px 10px 0;font-size:12px;color:var(--muted)}.desktop-main{min-width:0;height:100vh;display:flex;flex-direction:column;overflow:hidden}.desktop-topbar{height:72px;flex:0 0 72px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.88);backdrop-filter:blur(10px)}.desktop-topbar-title strong{display:block;font-size:17px}.desktop-topbar-title span{display:block;color:var(--muted);font-size:12px;margin-top:2px}.desktop-page{flex:1;min-height:0;overflow:auto;padding:22px 28px 34px}.desktop-home{max-width:1120px}.desktop-home h2{font-size:28px;margin:0 0 4px}.desktop-home-sub{color:var(--muted);font-size:15px;margin-bottom:18px}.desktop-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}.desktop-kpi{border:1px solid var(--line);background:#fff;border-radius:18px;padding:16px 18px;min-height:88px;text-align:left}.desktop-kpi span{color:var(--muted);font-size:13px}.desktop-kpi strong{display:block;font-size:25px;margin-top:7px}.desktop-kpi.actionable{cursor:pointer}.desktop-primary-action{width:100%;min-height:92px;border:0;border-radius:20px;background:var(--primary);color:#fff;padding:18px 22px;text-align:left;display:flex;justify-content:space-between;align-items:center;margin:0 0 14px}.desktop-primary-action strong{display:block;font-size:22px}.desktop-primary-action small{display:block;font-size:14px;color:#e8f4f2;margin-top:4px}.desktop-primary-action b{font-size:34px;font-weight:400}.desktop-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.desktop-tool{border:1px solid var(--line);background:#fff;border-radius:18px;padding:16px;text-align:left;min-height:84px}.desktop-tool strong{display:block;font-size:16px}.desktop-tool span{display:block;color:var(--muted);font-size:12px;margin-top:5px;line-height:1.35}.desktop-cash-state{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border-radius:999px;background:#eef2f0;color:#5d6672;font-size:12px;font-weight:800}.desktop-cash-state.open{background:#e1f4e8;color:#2d6c43}
      .desktop-pos-page{height:100%;display:flex;flex-direction:column;min-height:0}.desktop-pos-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px;flex:0 0 auto}.desktop-pos-header h2{font-size:25px;margin:0}.desktop-pos-header p{font-size:13px;color:var(--muted);margin:3px 0 0}.desktop-pos-layout{display:grid;grid-template-columns:180px minmax(0,1fr) 340px;gap:10px;min-height:0;flex:1}.desktop-pos-box{background:#fff;border:1px solid var(--line);border-radius:18px;min-height:0;overflow:hidden}.desktop-category-pane{padding:12px;overflow:auto}.desktop-category-title{font-size:12px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin:3px 5px 10px}.desktop-category-btn{width:100%;border:0;background:#f5f7f6;border-radius:12px;padding:11px 10px;margin-bottom:6px;text-align:left;font-size:13px;font-weight:800}.desktop-category-btn.active{background:var(--primary);color:#fff}.desktop-product-pane{display:flex;flex-direction:column;min-width:0}.desktop-product-toolbar{padding:12px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px}.desktop-product-toolbar .search{margin:0;padding:11px 12px;border-radius:12px;font-size:14px}.desktop-product-grid{padding:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;overflow:auto;align-content:start}.desktop-product{border:1px solid var(--line);background:#fff;border-radius:14px;padding:13px;text-align:left;min-height:92px}.desktop-product:hover{border-color:#a9c7c2;background:#fbfdfc}.desktop-product strong{display:block;font-size:14px;line-height:1.25}.desktop-product small{display:block;color:var(--muted);font-size:11px;margin-top:4px}.desktop-product span{display:block;color:var(--primary-dark);font-weight:900;font-size:15px;margin-top:10px}.desktop-cart-pane{display:flex;flex-direction:column;padding:12px}.desktop-cart-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.desktop-cart-head h3{font-size:17px;margin:0}.desktop-cart-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:7px}.desktop-cart-meta button{border:1px solid var(--line);background:#f7f8f7;border-radius:10px;padding:7px 9px;font-size:11px;font-weight:800}.desktop-cart-meta button.active{background:var(--soft);color:var(--primary-dark);border-color:#abc6c2}.desktop-cart-list{flex:1;min-height:0;overflow:auto;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:4px 0}.desktop-cart-list .cart-item{padding:9px 0}.desktop-cart-list .cart-item strong{font-size:13px}.desktop-cart-list .muted{font-size:11px}.desktop-cart-list .qty{gap:5px}.desktop-cart-list .qty button{width:30px;height:30px;border-radius:9px;font-size:18px}.desktop-summary{padding:9px 0 7px}.desktop-summary .ticket-line{font-size:12px}.desktop-summary .total-box{font-size:22px;padding:8px 0}.desktop-pay-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.desktop-pay-grid .pay-btn{padding:11px 6px;border-radius:12px;font-size:12px}.desktop-client-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.desktop-client-row span{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.desktop-client-row button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:7px 9px;font-size:11px;font-weight:800;white-space:nowrap}
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
      .desktop-category-btn:hover{border-color:#d9e4e0;background:#f8faf9}.desktop-category-btn.active{border-color:transparent}
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

function badge() { return navigator.onLine ? `<span class="badge online">● En línea</span>` : `<span class="badge offline">● Sin conexión</span>`; }
function navBtn(target, label, active) { return `<button class="${active === target ? "active" : ""}" onclick="go('${target}')">${label}</button>`; }
function desktopNavItems() {
  const items = [["home", "Inicio"], ["sale", isServices() ? "Nuevo servicio" : "Vender"]];
  if (isFood()) items.push(["orders", "Pedidos"], ["products", "Productos"], ["clients", "Clientes / Crédito"], ["cash", "Caja"], ["sales", "Mis ventas"], ["catalog", "Menú QR"]);
  if (isProducts()) items.push(["products", "Productos"], ["clients", "Clientes / Crédito"], ["sales", "Mis ventas"], ["catalog", "Catálogo QR"]);
  if (isServices()) items.push(["products", "Servicios"], ["clients", "Clientes"], ["sales", "Mis ventas"], ["catalog", "Catálogo QR"]);
  if (role === "owner") items.push(["settings", "Configuración"]);
  return items;
}
function desktopShell(content, active = "home") {
  const current = screen || active;
  const nav = desktopNavItems().map(([target, label]) => `<button class="${current === target ? "active" : ""}" onclick="go('${target}')">${label}</button>`).join("");
  const shift = currentShift();
  return `<div class="desktop-app"><aside class="desktop-sidebar"><div class="desktop-logo"><strong>${esc(state.settings.businessName)}</strong><small>Mi Punto CR</small></div><nav class="desktop-nav">${nav}</nav><div class="desktop-sidebar-foot">${isFood() ? (shift ? `Caja abierta · ${dateTime(shift.openedAt)}` : "Caja cerrada") : "Listo para cobrar"}</div></aside><main class="desktop-main"><header class="desktop-topbar"><div class="desktop-topbar-title"><strong>${esc(state.settings.businessName)}</strong><span>${isFood() ? (shift ? "Punto de venta · Caja abierta" : "Punto de venta · Caja cerrada") : (isServices() ? "Servicios" : "Punto de venta")}</span></div>${badge()}</header><div class="desktop-page">${!navigator.onLine ? `<div class="offline-note">Sin conexión. Las funciones internas siguen guardándose en este dispositivo.</div>` : ""}${content}</div></main></div>`;
}
function shell(content, active = "home") {
  if (isDesktopPOS()) return desktopShell(content, active);
  const third = isFood() ? ["orders", "Pedidos"] : ["sales", "Mis ventas"];
  return `<main class="shell">
    <header class="topbar"><div class="brand"><h1>${esc(state.settings.businessName)}</h1><p>Tu negocio, más simple</p></div><div class="status-row">${badge()}</div></header>
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
function resetSaleMeta() { saleMeta = { clientId: "", orderType: "Mostrador", table: "", note: "" }; }

window.go = target => {
  if (target === "sale" && !canSell()) { toast("Primero debes abrir la caja."); screen = "cash"; return render(); }
  screen = target;
  render();
};

function render() {
  if (!state.settings.onboardingComplete) return renderOnboarding();
  if (state.settings.sessionActive === false) return renderLogin();
  if (locked) return renderLock();
  if (isQuickLandscape()) return renderQuickSale();
  const routes = {
    home: renderHome,
    sale: renderSale,
    orders: renderOrders,
    products: renderProducts,
    clients: renderClients,
    clientDetail: renderClientDetail,
    cash: renderCash,
    catalog: renderCatalog,
    sales: renderSales,
    settings: renderSettings
  };
  (routes[screen] || renderMore)();
}

/* =========================
   CUENTA / ACTIVACIÓN
========================= */
function renderOnboarding() {
  if (state.settings.accountCreated && state.settings.pendingActivationCode && authStep === "welcome") authStep = "activation";
  if (authStep === "welcome") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><h1 class="onboard-brand">Mi Punto CR</h1><p class="onboard-sub">Tu negocio, más simple</p><h2>Bienvenido</h2><p>Configura tu negocio una sola vez y empieza a vender.</p><div class="choice-grid"><button class="btn primary full" onclick="startAccount()">Crear nueva cuenta</button><button class="btn ghost full" onclick="existingAccount()">Ya tengo una cuenta</button></div></div></section>`;
    return;
  }
  if (authStep === "account") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('welcome')">‹ Volver</button><h2>Crear nueva cuenta</h2><p>Los datos del propietario se usan para proteger el negocio.</p><div class="field"><label>Nombre del propietario</label><input id="aOwner" autocomplete="name" value="${esc(setupDraft.ownerName || "")}"></div><div class="field"><label>Nombre del negocio</label><input id="aBusiness" value="${esc(setupDraft.businessName || "")}"></div><div class="field"><label>Correo</label><input id="aEmail" type="email" inputmode="email" autocomplete="email" value="${esc(setupDraft.email || "")}"></div><div class="field"><label>Contraseña</label><input id="aPass" type="password" autocomplete="new-password"></div><div class="field"><label>Confirmar contraseña</label><input id="aPass2" type="password" autocomplete="new-password"></div><button class="btn primary full" onclick="accountNext()">Continuar</button></div></section>`;
    return;
  }
  if (authStep === "type") {
    $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><button class="back-link" onclick="authBack('account')">‹ Volver</button><h2>¿Qué tipo de negocio tienes?</h2><p>Mi Punto CR mostrará solo las herramientas que necesitas.</p><div class="choice-grid"><button class="type-choice" onclick="chooseBusinessType('food')"><strong>Comida / Soda / Repostería</strong><small>Ventas, pedidos, caja y menú.</small></button><button class="type-choice" onclick="chooseBusinessType('products')"><strong>Venta de artículos</strong><small>Colonias, ropa, cosméticos, accesorios y otros productos.</small></button><button class="type-choice" onclick="chooseBusinessType('services')"><strong>Servicios</strong><small>Belleza, reparaciones, trabajos y otros servicios.</small></button></div></div></section>`;
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
    sessionActive: true
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
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><h1 class="onboard-brand">Mi Punto CR</h1><p class="onboard-sub">Activa tu negocio</p><h2>Código de activación</h2><p>${sent ? `Enviamos un código único a <strong>${esc(state.settings.email)}</strong>.` : `El correo real todavía no está conectado en esta versión. La pantalla ya está lista y, para probarla ahora, usa el código mostrado abajo.`}</p>${!sent && testCode ? `<div class="activation-code">${esc(testCode)}</div><div class="setup-note">Este código es de un solo uso en este negocio. Cuando conectemos el servicio de correo, dejará de mostrarse aquí y llegará al correo del propietario.</div>` : ""}<div class="field" style="margin-top:16px"><label>Escribe el código</label><input id="activationInput" autocomplete="one-time-code" style="text-transform:uppercase;text-align:center;font-size:22px;letter-spacing:2px" placeholder="XXXX-XXXX"></div><button class="btn primary full" onclick="activateBusiness()">Activar Mi Punto CR</button><button class="btn ghost full" style="margin-top:9px" onclick="resendActivation()">Generar / reenviar código</button></div></section>`;
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
  $("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><h1 class="onboard-brand">Mi Punto CR</h1><p class="onboard-sub">Acceso del propietario</p><div class="field"><label>Correo</label><input id="loginEmail" type="email" value="${esc(state.settings.email || "")}"></div><div class="field"><label>Contraseña</label><input id="loginPass" type="password"></div><button class="btn primary full" onclick="loginOwner()">Entrar</button><p class="setup-note" style="margin-top:14px">Este acceso funciona en el dispositivo donde se creó la cuenta. El inicio de sesión entre dispositivos se conectará junto con la nube.</p></div></section>`;
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

/* =========================
   INICIO
========================= */
function renderHome() {
  const today = new Date().toDateString();
  const todaySales = state.sales.filter(s => new Date(s.createdAt).toDateString() === today);
  const sold = todaySales.reduce((a, b) => a + Number(b.total || 0), 0);
  const credit = state.clients.reduce((a, b) => a + Number(b.balance || 0), 0);
  const shiftOpen = !!currentShift();

  if (isDesktopPOS()) {
    const primaryTitle = isFood() ? (shiftOpen ? "Nueva venta" : "Abrir caja") : (isServices() ? "Nuevo servicio" : "Nueva venta");
    const primarySub = isFood() ? (shiftOpen ? "Selecciona productos y cobra" : "Abre la caja para comenzar a vender") : (isServices() ? "Selecciona un servicio y cobra" : "Selecciona artículos y cobra");
    const primaryAction = isFood() && !shiftOpen ? "openCash()" : "go('sale')";
    const statusText = isFood() ? (shiftOpen ? "Abierta" : "Cerrada") : "No requerida";
    const statusClass = isFood() && shiftOpen ? "open" : "";
    const tools = [];
    if (isFood()) tools.push(["orders", "Pedidos", "Pendientes y preparación"], ["products", "Productos", "Comidas, bebidas y stock"], ["clients", "Clientes / Crédito", "Saldos y abonos"], ["cash", "Caja", shiftOpen ? "Turno abierto" : "Abrir turno"], ["sales", "Mis ventas", "Comprobantes e historial"], ["catalog", "Menú QR", "Vista del menú"]);
    if (isProducts()) tools.push(["products", "Productos", "Artículos, variantes y stock"], ["clients", "Clientes / Crédito", "Saldos y abonos"], ["sales", "Mis ventas", "Comprobantes e historial"], ["catalog", "Catálogo QR", "Vista del catálogo"]);
    if (isServices()) tools.push(["products", "Servicios", "Precios y categorías"], ["clients", "Clientes", "Contactos y crédito"], ["sales", "Mis ventas", "Comprobantes e historial"], ["catalog", "Catálogo QR", "Vista de servicios"]);
    const toolsHtml = tools.map(([target, title, sub]) => `<button class="desktop-tool" onclick="go('${target}')"><strong>${title}</strong><span>${sub}</span></button>`).join("");
    const html = `<section class="desktop-home"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px"><div><h2>Inicio</h2><div class="desktop-home-sub">Accesos rápidos para trabajar.</div></div><span class="desktop-cash-state ${statusClass}">${isFood() ? `Caja ${statusText.toLowerCase()}` : "Cobro directo"}</span></div><div class="desktop-kpis"><button class="desktop-kpi actionable" onclick="go('sales')"><span>Ventas hoy</span><strong>${money(sold)}</strong></button><button class="desktop-kpi actionable" onclick="go('clients')"><span>Por cobrar</span><strong>${money(credit)}</strong></button><div class="desktop-kpi"><span>${isFood() ? "Caja" : "Tipo de negocio"}</span><strong style="font-size:18px;margin-top:11px">${isFood() ? statusText : (isServices() ? "Servicios" : "Artículos")}</strong></div></div><button class="desktop-primary-action" onclick="${primaryAction}"><span><strong>${primaryTitle}</strong><small>${primarySub}</small></span><b>›</b></button><div class="desktop-tools">${toolsHtml}</div></section>`;
    $("#app").innerHTML = shell(html, "home");
    return;
  }

  let cards = "";
  if (isFood()) cards = `${card("sale", "Nueva venta", shiftOpen ? "Vende y cobra rápido" : "Abre caja para poder vender", true, !shiftOpen)}${card("orders", "Pedidos", "Pendientes, preparando y listos")}${card("cash", shiftOpen ? "Caja abierta" : "Abrir caja", shiftOpen ? "Ventas y cierre" : "Fondo inicial y apertura")}${card("products", "Productos", "Comidas, bebidas y stock")}${card("clients", "Clientes / Crédito", "Compras, saldos y abonos")}${card("catalog", "Menú QR", "Vista del menú")}`;
  if (isProducts()) cards = `${card("sale", "Vender", "Selecciona artículos y cobra", true)}${card("products", "Productos", "Artículos, variantes y stock")}${card("clients", "Clientes / Crédito", "Compras, saldos y abonos")}${card("catalog", "Catálogo QR", "Vista del catálogo")}${card("sales", "Mis ventas", "Comprobantes e historial")}`;
  if (isServices()) cards = `${card("sale", "Nuevo servicio", "Selecciona el servicio y cobra", true)}${card("products", "Servicios", "Precios y categorías")}${card("clients", "Clientes", "Contactos, compras y crédito")}${card("catalog", "Catálogo QR", "Vista de servicios")}${card("sales", "Mis ventas", "Comprobantes e historial")}`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>¿Qué necesitas hacer?</h2><p>Solo mostramos lo que realmente sirve para tu negocio.</p></section><div class="kpi-grid"><button class="kpi" style="text-align:left" onclick="go('sales')"><span class="muted">Ventas hoy</span><strong>${money(sold)}</strong></button><button class="kpi" style="text-align:left" onclick="go('clients')"><span class="muted">Por cobrar</span><strong>${money(credit)}</strong></button></div><div class="home-grid" style="margin-top:14px">${cards}${role === "owner" ? card("settings", "Configuración", "Datos básicos del negocio") : ""}</div>`, "home");
}

function totals(subtotal) {
  const rate = Number(state.settings.taxRate || 0), mode = state.settings.taxMode;
  if (mode === "added") return { subtotal, tax: subtotal * rate / 100, total: subtotal * (1 + rate / 100) };
  if (mode === "included" && rate > 0) return { subtotal, tax: subtotal - subtotal / (1 + rate / 100), total: subtotal };
  return { subtotal, tax: 0, total: subtotal };
}
function saleSubtotal() { return cart.reduce((a, b) => a + Number(b.price || 0) * Number(b.qty || 0), 0); }
function clientName(id) { return state.clients.find(x => x.id === id)?.name || ""; }

/* =========================
   VENTA VERTICAL
========================= */
function renderSale() {
  if (isDesktopPOS()) return renderDesktopSale();
  if (!canSell()) { screen = "cash"; return renderCash(); }
  const t = totals(saleSubtotal());
  const categories = [...new Set(state.products.map(p => p.category?.trim() || "Otros"))];
  const categoryHtml = categories.map(c => {
    const count = state.products.filter(p => (p.category?.trim() || "Otros") === c).length;
    return `<button class="category-card" onclick="openCategory(decodeURIComponent('${enc(c)}'))"><span class="category-name">${esc(c)}</span><span class="category-count">${count} ${isServices() ? (count === 1 ? "servicio" : "servicios") : (count === 1 ? "producto" : "productos")}</span><span class="category-arrow">›</span></button>`;
  }).join("");
  const cartHtml = cart.length ? cart.map(i => `<div class="cart-item"><div><strong>${esc(i.name)}</strong>${i.variant ? `<div class="muted">${esc(i.variant)}</div>` : ""}<div class="muted">${money(i.price)} c/u</div></div><div class="qty"><button onclick="qty('${i.cartId}',-1)">−</button><strong>${i.qty}</strong><button onclick="qty('${i.cartId}',1)">+</button></div></div>`).join("") : `<div class="empty">Selecciona una categoría para comenzar.</div>`;
  const foodMeta = isFood() ? `<div class="quick-meta"><button class="${saleMeta.orderType === "Mostrador" ? "active" : ""}" onclick="setOrderType('Mostrador')">Mostrador</button><button class="${saleMeta.orderType === "Para llevar" ? "active" : ""}" onclick="setOrderType('Para llevar')">Para llevar</button><button class="${saleMeta.orderType === "Mesa" ? "active" : ""}" onclick="askTable()">${saleMeta.table ? `Mesa ${esc(saleMeta.table)}` : "Mesa"}</button><button onclick="editSaleNote()">${saleMeta.note ? "Nota ✓" : "Nota"}</button></div>` : "";
  const selectedClient = saleMeta.clientId ? `<span><strong>${esc(clientName(saleMeta.clientId))}</strong></span>` : `<span class="muted">Sin cliente</span>`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${isServices() ? "Nuevo servicio" : "Nueva venta"}</h2><p>Selecciona una categoría.</p></section><div class="sale-layout"><section class="panel"><input class="search" placeholder="Buscar categoría..." oninput="filterCategories(this.value)"><div class="category-grid">${categoryHtml || `<div class="empty">Primero agrega ${isServices() ? "servicios" : "productos"}.</div>`}</div></section><section class="panel">${foodMeta}<div class="row-head"><h3 style="margin:0">${isServices() ? "Servicio actual" : "Venta actual"}</h3><button class="btn ghost" onclick="clearCart()">Vaciar</button></div><div class="row-head" style="margin:12px 0"><div>${selectedClient}</div><button class="btn ghost" onclick="selectSaleClient()">${saleMeta.clientId ? "Cambiar cliente" : "Cliente opcional"}</button></div><div class="cart-list">${cartHtml}</div>${state.settings.taxMode !== "exempt" ? `<div class="divider"></div><div class="ticket-line"><span class="muted">Impuesto</span><span>${money(t.tax)}</span></div>` : ""}<div class="total-box"><span>Total</span><span>${money(t.total)}</span></div><div class="payment-grid"><button class="pay-btn pay-cash" onclick="pay('cash')">Efectivo</button><button class="pay-btn pay-sinpe" onclick="pay('sinpe')">SINPE</button><button class="pay-btn pay-card" onclick="pay('card')">Tarjeta / Otro</button><button class="pay-btn pay-credit" onclick="pay('credit')">Crédito</button></div></section></div>`, "sale");
}
window.openCategory = c => {
  const items = state.products.filter(p => (p.category?.trim() || "Otros") === c);
  modal(`<div class="category-modal-header"><div><h3>${esc(c)}</h3><p class="muted">Toca ${isServices() ? "un servicio" : "un producto"} para agregarlo.</p></div><button class="modal-close" onclick="closeModal()">×</button></div><div class="category-products">${items.map(p => `<button class="category-product" onclick="pickProduct('${p.id}')"><span><strong>${esc(p.name)}</strong>${!isServices() ? `<small>Stock: ${Number(p.stock || 0)}</small>` : ""}</span><span class="category-product-price">${money(p.price)}</span></button>`).join("")}</div>`);
};
window.pickProduct = id => {
  const p = state.products.find(x => x.id === id); if (!p) return;
  if (p.variants?.length) return modal(`<h3>${esc(p.name)}</h3><p class="muted">Elige una opción.</p><div class="variant-list">${p.variants.map(v => `<button class="category-product" onclick="addCart('${p.id}',decodeURIComponent('${enc(v)}'))"><strong>${esc(v)}</strong><span class="category-product-price">${money(p.price)}</span></button>`).join("")}</div>`);
  addCart(id, "");
};
window.addCart = (id, variant = "") => {
  const p = state.products.find(x => x.id === id); if (!p) return;
  const cartId = `${id}_${variant || "normal"}`;
  const old = cart.find(x => x.cartId === cartId);
  if (old) old.qty++;
  else cart.push({ ...p, cartId, variant, qty: 1 });
  closeModal(); rerenderSale(); toast(`${p.name} agregado`);
};
window.qty = (id, change) => { const i = cart.find(x => x.cartId === id); if (!i) return; i.qty += change; if (i.qty <= 0) cart = cart.filter(x => x.cartId !== id); rerenderSale(); };
window.clearCart = () => { cart = []; resetSaleMeta(); rerenderSale(); };
window.filterCategories = q => $$(".category-card").forEach(el => el.style.display = el.innerText.toLowerCase().includes(q.toLowerCase().trim()) ? "" : "none");
window.setOrderType = value => { saleMeta.orderType = value; if (value !== "Mesa") saleMeta.table = ""; rerenderSale(); };
window.askTable = () => modal(`<h3>Mesa</h3><div class="field"><label>Número o nombre</label><input id="tableValue" value="${esc(saleMeta.table)}" inputmode="numeric"></div><div class="toolbar"><button class="btn primary" onclick="saveTable()">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveTable = () => { saleMeta.orderType = "Mesa"; saleMeta.table = $("#tableValue").value.trim(); closeModal(); rerenderSale(); };
window.editSaleNote = () => modal(`<h3>Nota de la venta</h3><div class="field"><textarea id="saleNote" rows="4" placeholder="Ej. sin cebolla, entregar a las 3...">${esc(saleMeta.note)}</textarea></div><div class="toolbar"><button class="btn primary" onclick="saveSaleNote()">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveSaleNote = () => { saleMeta.note = $("#saleNote").value.trim(); closeModal(); rerenderSale(); };
window.selectSaleClient = () => {
  const opts = state.clients.map(c => `<option value="${c.id}" ${saleMeta.clientId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  modal(`<h3>Cliente</h3><div class="field"><label>Selecciona</label><select id="saleClient"><option value="">Sin cliente</option>${opts}</select></div><div class="toolbar"><button class="btn primary" onclick="saveSaleClient()">Guardar</button><button class="btn ghost" onclick="newClientFromSale()">Nuevo cliente</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
};
window.saveSaleClient = () => { saleMeta.clientId = $("#saleClient").value; closeModal(); rerenderSale(); };
window.newClientFromSale = () => modal(`<h3>Nuevo cliente</h3><div class="field"><label>Nombre</label><input id="cName"></div><div class="field"><label>Teléfono / WhatsApp</label><input id="cPhone"></div><div class="toolbar"><button class="btn primary" onclick="saveClient(true)">Guardar y seleccionar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);

/* =========================
   POS PARA COMPUTADORA
========================= */
function renderDesktopSale() {
  if (!canSell()) { screen = "cash"; return renderCash(); }
  const categories = [...new Set(state.products.map(p => p.category?.trim() || "Otros"))];
  if (!quickCategory || !categories.includes(quickCategory)) quickCategory = categories[0] || "";
  const items = state.products.filter(p => (p.category?.trim() || "Otros") === quickCategory);
  const t = totals(saleSubtotal());
  const catHtml = categories.map(c => `<button class="desktop-category-btn ${c === quickCategory ? "active" : ""}" onclick="desktopSetCategory(decodeURIComponent('${enc(c)}'))">${esc(c)}</button>`).join("") || `<div class="empty" style="padding:10px">Sin categorías.</div>`;
  const itemHtml = items.map(p => `<button class="desktop-product" data-desktop-product="1" data-search="${esc((p.name + " " + (p.category || "")).toLowerCase())}" onclick="pickProduct('${p.id}')"><strong>${esc(p.name)}</strong>${p.variants?.length ? `<small>${p.variants.length} opciones</small>` : (!isServices() ? `<small>Stock: ${Number(p.stock || 0)}</small>` : `<small>${esc(p.category || "Servicio")}</small>`)}<span>${money(p.price)}</span></button>`).join("") || `<div class="empty" style="grid-column:1/-1">No hay ${isServices() ? "servicios" : "productos"} en esta categoría.</div>`;
  const cartHtml = cart.length ? cart.map(i => `<div class="cart-item"><div style="min-width:0"><strong>${esc(i.name)}</strong>${i.variant ? `<div class="muted">${esc(i.variant)}</div>` : ""}<div class="muted">${money(i.price)} c/u</div></div><div class="qty"><button onclick="qty('${i.cartId}',-1)">−</button><strong>${i.qty}</strong><button onclick="qty('${i.cartId}',1)">+</button></div></div>`).join("") : `<div class="empty" style="padding:18px 8px">Selecciona ${isServices() ? "un servicio" : "un producto"}.</div>`;
  const foodMeta = isFood() ? `<div class="desktop-cart-meta"><button class="${saleMeta.orderType === "Mostrador" ? "active" : ""}" onclick="setOrderType('Mostrador')">Mostrador</button><button class="${saleMeta.orderType === "Para llevar" ? "active" : ""}" onclick="setOrderType('Para llevar')">Para llevar</button><button class="${saleMeta.orderType === "Mesa" ? "active" : ""}" onclick="askTable()">${saleMeta.table ? `Mesa ${esc(saleMeta.table)}` : "Mesa"}</button><button onclick="editSaleNote()">${saleMeta.note ? "Nota ✓" : "Nota"}</button></div>` : "";
  const selectedClient = saleMeta.clientId ? esc(clientName(saleMeta.clientId)) : "Sin cliente";
  const shift = currentShift();
  const content = `<section class="desktop-pos-page"><div class="desktop-pos-header"><div><h2>${isServices() ? "Nuevo servicio" : "Punto de venta"}</h2><p>${isServices() ? "Selecciona el servicio y cobra." : "Selecciona productos y cobra desde la misma pantalla."}</p></div>${isFood() ? `<span class="desktop-cash-state open">Caja abierta${shift ? ` · ${dateTime(shift.openedAt)}` : ""}</span>` : `<span class="desktop-cash-state open">Listo para cobrar</span>`}</div><div class="desktop-pos-layout"><aside class="desktop-pos-box desktop-category-pane"><div class="desktop-category-title">Categorías</div>${catHtml}</aside><section class="desktop-pos-box desktop-product-pane"><div class="desktop-product-toolbar"><input class="search" placeholder="Buscar en ${esc(quickCategory || (isServices() ? "servicios" : "productos"))}..." oninput="desktopFilterProducts(this.value)"></div><div class="desktop-product-grid">${itemHtml}</div></section><aside class="desktop-pos-box desktop-cart-pane">${foodMeta}<div class="desktop-cart-head"><h3>${isServices() ? "Servicio actual" : "Venta actual"}</h3><button class="btn ghost" style="padding:7px 9px;font-size:11px" onclick="clearCart()">Vaciar</button></div><div class="desktop-client-row"><span><strong>${selectedClient}</strong></span><button onclick="selectSaleClient()">${saleMeta.clientId ? "Cambiar" : "Cliente"}</button></div><div class="desktop-cart-list">${cartHtml}</div><div class="desktop-summary">${state.settings.taxMode !== "exempt" ? `<div class="ticket-line"><span class="muted">Impuesto</span><span>${money(t.tax)}</span></div>` : ""}<div class="total-box"><span>Total</span><span>${money(t.total)}</span></div></div><div class="desktop-pay-grid"><button class="pay-btn pay-cash" onclick="pay('cash')">Efectivo</button><button class="pay-btn pay-sinpe" onclick="pay('sinpe')">SINPE</button><button class="pay-btn pay-card" onclick="pay('card')">Tarjeta</button><button class="pay-btn pay-credit" onclick="pay('credit')">Crédito</button></div></aside></div></section>`;
  $("#app").innerHTML = shell(content, "sale");
}
window.desktopSetCategory = c => { quickCategory = c; renderDesktopSale(); };
window.desktopFilterProducts = q => {
  const v = String(q || "").trim().toLowerCase();
  $$('[data-desktop-product="1"]').forEach(el => { el.style.display = !v || (el.dataset.search || "").includes(v) ? "" : "none"; });
};

/* =========================
   MODO COBRO RÁPIDO HORIZONTAL
========================= */
function renderQuickSale() {
  if (!state.settings.onboardingComplete || state.settings.sessionActive === false || locked) return render();
  if (!canSell()) {
    $("#app").innerHTML = `<section class="quick-shell" style="grid-template-columns:1fr"><div class="quick-col" style="display:grid;place-items:center"><div style="max-width:420px;text-align:center"><h2>Caja cerrada</h2><p class="muted">Primero debes abrir la caja para vender comida.</p><button class="btn primary" onclick="openCash()">Abrir caja</button></div></div></section>`;
    return;
  }
  const categories = [...new Set(state.products.map(p => p.category?.trim() || "Otros"))];
  if (!quickCategory || !categories.includes(quickCategory)) quickCategory = categories[0] || "";
  const items = state.products.filter(p => (p.category?.trim() || "Otros") === quickCategory);
  const t = totals(saleSubtotal());
  const catHtml = categories.map(c => `<button class="quick-category ${c === quickCategory ? "active" : ""}" onclick="quickSetCategory(decodeURIComponent('${enc(c)}'))">${esc(c)}</button>`).join("");
  const itemHtml = items.map(p => `<button class="quick-product" onclick="pickProduct('${p.id}')"><strong>${esc(p.name)}</strong>${p.variants?.length ? `<small class="muted">${p.variants.length} opciones</small>` : ""}<span>${money(p.price)}</span></button>`).join("") || `<div class="empty">No hay ${isServices() ? "servicios" : "productos"}.</div>`;
  const cartHtml = cart.length ? cart.map(i => `<div class="cart-item" style="padding:8px 0"><div><strong style="font-size:14px">${esc(i.name)}</strong>${i.variant ? `<div class="muted" style="font-size:11px">${esc(i.variant)}</div>` : ""}</div><div class="qty"><button style="width:32px;height:32px" onclick="qty('${i.cartId}',-1)">−</button><strong>${i.qty}</strong><button style="width:32px;height:32px" onclick="qty('${i.cartId}',1)">+</button></div></div>`).join("") : `<div class="empty" style="padding:12px">Toca un artículo.</div>`;
  const foodButtons = isFood() ? `<div class="quick-meta"><button class="${saleMeta.orderType === "Mostrador" ? "active" : ""}" onclick="setOrderType('Mostrador')">Mostrador</button><button class="${saleMeta.orderType === "Para llevar" ? "active" : ""}" onclick="setOrderType('Para llevar')">Para llevar</button><button class="${saleMeta.orderType === "Mesa" ? "active" : ""}" onclick="askTable()">${saleMeta.table ? `Mesa ${esc(saleMeta.table)}` : "Mesa"}</button><button onclick="editSaleNote()">${saleMeta.note ? "Nota ✓" : "Nota"}</button></div>` : "";
  $("#app").innerHTML = `<section class="quick-shell"><aside class="quick-col"><div class="quick-brand">Mi Punto CR</div>${catHtml}</aside><main class="quick-col"><div class="row-head" style="margin-bottom:9px"><strong>${esc(quickCategory || (isServices() ? "Servicios" : "Productos"))}</strong><span class="muted">Cobro rápido</span></div><div class="quick-products">${itemHtml}</div></main><aside class="quick-col quick-cart">${foodButtons}<div class="quick-meta"><button onclick="selectSaleClient()">${saleMeta.clientId ? esc(clientName(saleMeta.clientId)) : "Cliente"}</button><button onclick="clearCart()">Vaciar</button></div><div class="quick-cart-list">${cartHtml}</div><div class="quick-total"><span>Total</span><span>${money(t.total)}</span></div><div class="quick-pay"><button class="pay-btn pay-cash" onclick="pay('cash')">Efectivo</button><button class="pay-btn pay-sinpe" onclick="pay('sinpe')">SINPE</button><button class="pay-btn pay-card" onclick="pay('card')">Tarjeta</button><button class="pay-btn pay-credit" onclick="pay('credit')">Crédito</button></div></aside></section>`;
}
window.quickSetCategory = c => { quickCategory = c; renderQuickSale(); };
window.renderPortraitFallback = () => { if (isQuickLandscape()) { toast("Pon el teléfono vertical para administrar la caja."); } else render(); };

/* =========================
   COBRO
========================= */
window.pay = method => {
  if (!cart.length) return toast(isServices() ? "Agrega al menos un servicio." : "Agrega al menos un producto.");
  const t = totals(saleSubtotal());
  if (method === "cash") {
    modal(`<h3>Cobro en efectivo</h3><p>Total: <strong>${money(t.total)}</strong></p><div class="cash-quick-grid"><button class="cash-chip" data-cash="1000" onclick="setCashReceived(1000,${t.total})">₡1.000</button><button class="cash-chip" data-cash="2000" onclick="setCashReceived(2000,${t.total})">₡2.000</button><button class="cash-chip" data-cash="5000" onclick="setCashReceived(5000,${t.total})">₡5.000</button><button class="cash-chip" data-cash="10000" onclick="setCashReceived(10000,${t.total})">₡10.000</button><button class="cash-chip" data-cash="20000" onclick="setCashReceived(20000,${t.total})">₡20.000</button><button class="cash-chip" data-cash="exact" onclick="setCashReceived(${t.total},${t.total},'exact')">Exacto</button></div><div class="field"><label>Otro monto</label><input id="received" type="number" inputmode="decimal" placeholder="Escribe el monto recibido" oninput="cashCustomInput(${t.total})"></div><div class="change-card"><span>Vuelto</span><strong id="changeValue">${money(0)}</strong></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="finishCash()">Confirmar cobro</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
  }
  if (method === "sinpe") modal(`<h3>Cobro por SINPE</h3><p>Total: <strong>${money(t.total)}</strong></p><div class="panel" style="box-shadow:none">${state.settings.sinpe ? `Número SINPE: <strong>${esc(state.settings.sinpe)}</strong>` : "Configura tu número SINPE."}</div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="finishSale('SINPE')">Confirmar pago</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
  if (method === "card") modal(`<h3>Tarjeta / Otro</h3><p>Total: <strong>${money(t.total)}</strong></p><div class="field"><label>Referencia opcional</label><input id="ref"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="finishSale('Tarjeta/Otro',$('#ref').value)">Confirmar pago</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
  if (method === "credit") {
    const opts = state.clients.map(c => `<option value="${c.id}" ${(saleMeta.clientId === c.id) ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    modal(`<h3>Venta a crédito</h3><p>Total: <strong>${money(t.total)}</strong></p><div class="field"><label>Cliente</label><select id="creditClient"><option value="">Selecciona cliente</option>${opts}</select></div>${!state.clients.length ? `<p class="muted">Primero crea un cliente.</p>` : ""}<div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="finishCredit()">Guardar crédito</button><button class="btn ghost" onclick="newClientFromCredit()">Nuevo cliente</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
  }
};
window.setCashReceived = (amount, total, kind = "") => {
  const input = $("#received"); if (!input) return;
  input.value = Math.round(Number(amount || 0));
  $$(".cash-chip").forEach(b => b.classList.remove("active"));
  const target = kind === "exact" ? document.querySelector('[data-cash="exact"]') : document.querySelector(`[data-cash="${Math.round(Number(amount || 0))}"]`);
  target?.classList.add("active");
  changeText(total);
};
window.cashCustomInput = total => { $$(".cash-chip").forEach(b => b.classList.remove("active")); changeText(total); };
window.changeText = total => { const v = Number($("#received")?.value || 0); if ($("#changeValue")) $("#changeValue").textContent = money(Math.max(0, v - total)); };
window.finishCash = async () => { const received = Number($("#received")?.value || 0); const t = totals(saleSubtotal()); if (received < t.total) return toast("El monto recibido es menor al total."); await saveSale("Efectivo", "", saleMeta.clientId, received); };
window.finishSale = async (method, ref = "") => saveSale(method, ref, saleMeta.clientId);
window.finishCredit = async () => {
  const clientId = $("#creditClient").value;
  if (!clientId) return toast("Selecciona un cliente.");
  const t = totals(saleSubtotal());
  const c = state.clients.find(x => x.id === clientId);
  c.balance = Number(c.balance || 0) + t.total;
  await put("clients", c);
  saleMeta.clientId = clientId;
  await saveSale("Crédito", "", clientId);
};
window.newClientFromCredit = () => modal(`<h3>Nuevo cliente</h3><div class="field"><label>Nombre</label><input id="cName"></div><div class="field"><label>Teléfono / WhatsApp</label><input id="cPhone"></div><div class="toolbar"><button class="btn primary" onclick="saveClientForCredit()">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveClientForCredit = async () => {
  const name = $("#cName").value.trim(); if (!name) return toast("Escribe el nombre.");
  const c = { id: uid("c"), name, phone: $("#cPhone").value.trim(), balance: 0 };
  await put("clients", c); state.clients.push(c); saleMeta.clientId = c.id; closeModal(); pay("credit");
};

async function saveSale(method, reference = "", clientId = "", received = null) {
  const t = totals(saleSubtotal());
  const sale = {
    id: uid("sale"),
    number: state.sales.length + 1,
    createdAt: new Date().toISOString(),
    shiftId: currentShift()?.id || null,
    businessType: type(),
    items: cart.map(i => ({ id: i.id, name: i.name, variant: i.variant || "", price: i.price, qty: i.qty })),
    subtotal: t.subtotal,
    tax: t.tax,
    total: t.total,
    method,
    reference,
    clientId: clientId || "",
    received,
    change: received === null ? 0 : Math.max(0, received - t.total),
    orderType: saleMeta.orderType || "Mostrador",
    table: saleMeta.table || "",
    note: saleMeta.note || ""
  };
  await put("sales", sale);
  state.sales.push(sale);
  if (!isServices()) {
    for (const item of cart) {
      const p = state.products.find(x => x.id === item.id);
      if (p) { p.stock = Math.max(0, Number(p.stock || 0) - item.qty); await put("products", p); }
    }
  }
  cart = [];
  resetSaleMeta();
  closeModal();
  showReceipt(sale);
}

/* =========================
   COMPROBANTE / PDF
========================= */
function receiptTypeLabel(sale) {
  if (sale.businessType === "food") return "COMPROBANTE DE COMIDA";
  if (sale.businessType === "services") return "COMPROBANTE DE SERVICIO";
  return "COMPROBANTE DE VENTA";
}
function showReceipt(sale) {
  const c = sale.clientId ? state.clients.find(x => x.id === sale.clientId) : null;
  const context = sale.businessType === "food" ? `<div class="ticket-line"><span>Pedido</span><strong>${esc(sale.orderType || "Mostrador")}${sale.table ? ` · Mesa ${esc(sale.table)}` : ""}</strong></div>` : "";
  modal(`<div class="ticket"><div class="ticket-business"><h3>${esc(state.settings.businessName)}</h3><div class="muted">${receiptTypeLabel(sale)}</div><div class="muted">Comprobante #${sale.number} · ${dateTime(sale.createdAt)}</div></div><div class="divider"></div>${context}${c ? `<div class="ticket-line"><span>Cliente</span><strong>${esc(c.name)}</strong></div>` : ""}${sale.items.map(i => `<div class="ticket-line"><span>${i.qty} × ${esc(i.name)}${i.variant ? ` · ${esc(i.variant)}` : ""}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}${sale.note ? `<div class="panel" style="box-shadow:none;margin-top:10px"><span class="muted">Nota</span><div>${esc(sale.note)}</div></div>` : ""}<div class="divider"></div>${sale.tax > 0 ? `<div class="ticket-line"><span>Impuesto</span><span>${money(sale.tax)}</span></div>` : ""}<div class="ticket-line ticket-total"><span>Total</span><span>${money(sale.total)}</span></div><div class="ticket-line"><span>Pago</span><span>${esc(sale.method)}</span></div>${sale.change > 0 ? `<div class="ticket-line"><span>Vuelto</span><span>${money(sale.change)}</span></div>` : ""}${sale.method === "Crédito" ? `<div class="panel" style="box-shadow:none;margin-top:10px;background:#fff5dc"><strong>Saldo pendiente: ${money(sale.total)}</strong></div>` : ""}<div class="divider"></div><div class="toolbar"><button class="btn primary" onclick="sharePdf('${sale.id}')">Compartir PDF</button><button class="btn ghost" onclick="closeModal();go('sale')">Nueva venta</button><button class="btn" onclick="closeModal();go('home')">Inicio</button></div></div>`);
}
function loadExternalScript(src, id) {
  return new Promise((resolve, reject) => {
    const old = document.getElementById(id);
    if (old) {
      if (old.dataset.loaded === "true") return resolve();
      old.addEventListener("load", resolve, { once: true }); old.addEventListener("error", reject, { once: true }); return;
    }
    const script = document.createElement("script"); script.id = id; script.src = src; script.async = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); }; script.onerror = reject; document.head.appendChild(script);
  });
}
async function ensurePdfLibraries() {
  if (!window.html2canvas) await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js", "mipunto-html2canvas");
  if (!window.jspdf?.jsPDF) await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", "mipunto-jspdf");
}
function receiptItemsHtml(sale) {
  if (sale.businessType === "services") {
    return sale.items.map(i => `<div style="padding:12px 0;border-bottom:1px solid #e6e8e7"><div style="font-weight:800;font-size:15px">${esc(i.name)}</div>${i.variant ? `<div style="color:#77808d;font-size:12px;margin-top:3px">${esc(i.variant)}</div>` : ""}<div style="display:flex;justify-content:space-between;margin-top:6px"><span style="color:#77808d">${i.qty > 1 ? `${i.qty} servicios` : "Servicio"}</span><strong>${money(i.price * i.qty)}</strong></div></div>`).join("");
  }
  if (sale.businessType === "products") {
    return sale.items.map(i => `<div style="padding:11px 0;border-bottom:1px solid #e6e8e7"><div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font-weight:800;font-size:15px">${esc(i.name)}</div>${i.variant ? `<div style="color:#77808d;font-size:12px;margin-top:3px">${esc(i.variant)}</div>` : ""}<div style="color:#77808d;font-size:12px;margin-top:3px">${i.qty} × ${money(i.price)}</div></div><strong style="white-space:nowrap">${money(i.price * i.qty)}</strong></div></div>`).join("");
  }
  return sale.items.map(i => `<div style="display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid #e6e8e7"><div style="font-weight:800;font-size:15px">${i.qty} × ${esc(i.name)}${i.variant ? `<div style="color:#77808d;font-size:12px;font-weight:500;margin-top:3px">${esc(i.variant)}</div>` : ""}</div><strong style="white-space:nowrap">${money(i.price * i.qty)}</strong></div>`).join("");
}
function buildReceiptElement(sale) {
  const client = sale.clientId ? state.clients.find(x => x.id === sale.clientId) : null;
  const receipt = document.createElement("div");
  receipt.style.cssText = `position:fixed;left:-10000px;top:0;width:360px;background:#fff;color:#202938;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;box-sizing:border-box;z-index:-1`;
  const foodInfo = sale.businessType === "food" ? `<div style="margin-top:13px;padding:11px 12px;background:#f5f8f7;border-radius:12px;font-size:12px"><strong>${esc(sale.orderType || "Mostrador")}${sale.table ? ` · Mesa ${esc(sale.table)}` : ""}</strong>${sale.note ? `<div style="margin-top:4px;color:#697281">${esc(sale.note)}</div>` : ""}</div>` : "";
  const serviceInfo = sale.businessType === "services" && client ? `<div style="margin-top:13px;padding:11px 12px;background:#f5f8f7;border-radius:12px;font-size:12px"><span style="color:#77808d">Cliente</span><div style="font-weight:800;margin-top:2px">${esc(client.name)}</div></div>` : "";
  receipt.innerHTML = `<div style="text-align:center"><div style="font-size:23px;font-weight:900">${esc(state.settings.businessName || "Mi Punto CR")}</div>${state.settings.phone ? `<div style="color:#77808d;font-size:12px;margin-top:4px">${esc(state.settings.phone)}</div>` : ""}<div style="display:inline-block;margin-top:16px;padding:7px 12px;background:#eaf4f2;color:#39766f;border-radius:999px;font-size:11px;font-weight:900">${receiptTypeLabel(sale)}</div><div style="color:#77808d;font-size:11px;margin-top:8px">#${sale.number} · ${dateTime(sale.createdAt)}</div></div>${foodInfo}${serviceInfo}${sale.businessType === "products" && client ? `<div style="margin-top:13px;padding:10px 0;font-size:12px"><span style="color:#77808d">Cliente: </span><strong>${esc(client.name)}</strong></div>` : ""}<div style="margin-top:17px;border-top:2px solid #202938">${receiptItemsHtml(sale)}</div><div style="margin-top:15px">${sale.tax > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;color:#77808d;padding:4px 0"><span>Impuesto${state.settings.taxMode === "included" ? " incluido" : ""}</span><span>${money(sale.tax)}</span></div>` : ""}<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding:13px 0;border-top:2px solid #202938;border-bottom:2px solid #202938"><span style="font-size:17px;font-weight:900">TOTAL</span><span style="font-size:22px;font-weight:900;color:#39766f">${money(sale.total)}</span></div></div><div style="margin-top:15px;font-size:12px;line-height:1.55"><div style="display:flex;justify-content:space-between"><span style="color:#77808d">Forma de pago</span><strong>${esc(sale.method)}</strong></div>${sale.reference ? `<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="color:#77808d">Referencia</span><strong>${esc(sale.reference)}</strong></div>` : ""}${sale.change > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="color:#77808d">Vuelto</span><strong>${money(sale.change)}</strong></div>` : ""}${client && sale.businessType !== "services" && sale.businessType !== "products" ? `<div style="display:flex;justify-content:space-between;margin-top:4px"><span style="color:#77808d">Cliente</span><strong>${esc(client.name)}</strong></div>` : ""}${sale.method === "Crédito" ? `<div style="margin-top:12px;padding:11px;background:#fff4d6;border-radius:12px;color:#8a5a00"><div style="font-size:10px;font-weight:800">SALDO A CRÉDITO</div><div style="font-size:19px;font-weight:900;margin-top:2px">${money(sale.total)}</div></div>` : ""}</div><div style="text-align:center;margin-top:24px;padding-top:15px;border-top:1px dashed #cdd3d0;color:#77808d;font-size:11px;line-height:1.5">Gracias por su compra.${state.settings.whatsapp ? `<br>WhatsApp: ${esc(state.settings.whatsapp)}` : ""}<br>Comprobante de venta</div>`;
  document.body.appendChild(receipt);
  return receipt;
}
async function createReceiptPdf(sale) {
  await ensurePdfLibraries();
  const receipt = buildReceiptElement(sale);
  try {
    const canvas = await window.html2canvas(receipt, { scale: 3, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const image = canvas.toDataURL("image/png");
    const pdfWidth = 80;
    const pdfHeight = Math.max(90, pdfWidth * canvas.height / canvas.width);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pdfWidth, pdfHeight] });
    pdf.addImage(image, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
    return pdf.output("blob");
  } finally { receipt.remove(); }
}
window.sharePdf = async id => {
  const sale = state.sales.find(x => x.id === id); if (!sale) return;
  try {
    toast("Generando comprobante...");
    const blob = await createReceiptPdf(sale);
    const file = new File([blob], `comprobante-${sale.number}.pdf`, { type: "application/pdf" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) return navigator.share({ title: `Comprobante #${sale.number}`, text: `${state.settings.businessName} · Comprobante #${sale.number}`, files: [file] });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); toast("PDF generado.");
  } catch (e) { console.error(e); toast("No se pudo generar el PDF. Necesitas conexión la primera vez."); }
};

/* =========================
   MIS VENTAS
========================= */
function renderSales() {
  const sorted = [...state.sales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Mis ventas</h2><p>Comprobantes generados.</p></section><div class="toolbar"><button class="btn ghost" onclick="filterSales('today')">Hoy</button><button class="btn ghost" onclick="filterSales('yesterday')">Ayer</button><button class="btn ghost" onclick="filterSales('week')">Esta semana</button><button class="btn ghost" onclick="filterSales('all')">Todas</button></div><div id="salesList" class="list">${salesHtml(sorted)}</div>`, isFood() ? "more" : "sales");
}
function salesHtml(items) { return items.length ? items.map(s => `<button class="row-card" style="width:100%;text-align:left" onclick="openSale('${s.id}')"><div class="row-head"><div><strong>Comprobante #${s.number}</strong><div class="muted">${dateTime(s.createdAt)}</div></div><strong>${money(s.total)}</strong></div><div class="muted" style="margin-top:7px">${esc(s.method)}${s.clientId ? ` · ${esc(clientName(s.clientId))}` : ""}</div></button>`).join("") : `<div class="empty">No hay ventas en este período.</div>`; }
window.filterSales = mode => { const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), yesterday = new Date(today), week = new Date(today); yesterday.setDate(yesterday.getDate() - 1); const d = week.getDay() || 7; week.setDate(week.getDate() - d + 1); let list = [...state.sales]; if (mode === "today") list = list.filter(s => new Date(s.createdAt) >= today); if (mode === "yesterday") list = list.filter(s => { const x = new Date(s.createdAt); return x >= yesterday && x < today; }); if (mode === "week") list = list.filter(s => new Date(s.createdAt) >= week); list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); $("#salesList").innerHTML = salesHtml(list); };
window.openSale = id => { const s = state.sales.find(x => x.id === id); if (s) showReceipt(s); };

/* =========================
   PRODUCTOS / SERVICIOS
========================= */
function renderProducts() {
  const label = isServices() ? "Servicios" : "Productos", singular = isServices() ? "servicio" : "producto";
  const html = state.products.length ? state.products.map(p => `<div class="row-card"><div class="row-head"><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category || "Sin categoría")}</div>${!isServices() ? `<div class="muted">Stock: ${Number(p.stock || 0)}</div>` : ""}${p.variants?.length ? `<div class="muted">${p.variants.map(esc).join(" · ")}</div>` : ""}</div><strong>${money(p.price)}</strong></div><div class="toolbar" style="margin-top:12px;margin-bottom:0"><button class="btn ghost" onclick="productForm('${p.id}')">Editar</button><button class="btn danger" onclick="askDeleteProduct('${p.id}')">Eliminar</button></div></div>`).join("") : `<div class="empty">No hay ${label.toLowerCase()}.</div>`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${label}</h2><p>Organiza por categorías para vender más rápido.</p></section><div class="toolbar"><button class="btn primary" onclick="productForm('')">Nuevo ${singular}</button></div><div class="list">${html}</div>`, "more");
}
window.productForm = id => { const p = id ? state.products.find(x => x.id === id) : null; modal(`<h3>${p ? "Editar" : "Nuevo"} ${isServices() ? "servicio" : "producto"}</h3><div class="form-grid"><div class="field"><label>Nombre</label><input id="pName" value="${esc(p?.name || "")}"></div><div class="field"><label>Precio</label><input id="pPrice" type="number" value="${Number(p?.price || 0)}"></div><div class="field"><label>Categoría</label><input id="pCategory" value="${esc(p?.category || "")}"></div>${!isServices() ? `<div class="field"><label>Stock</label><input id="pStock" type="number" value="${Number(p?.stock || 0)}"></div><div class="field"><label>Variantes opcionales</label><input id="pVariants" value="${esc(p?.variants?.join(", ") || "")}" placeholder="Ej. 50ml, 100ml o S, M, L"></div>` : `<input id="pStock" type="hidden" value="0"><input id="pVariants" type="hidden" value="">`}</div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveProduct('${p?.id || ""}')">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`); };
window.saveProduct = async id => { const name = $("#pName").value.trim(), price = Number($("#pPrice").value || 0); if (!name || price <= 0) return toast("Nombre y precio son obligatorios."); let p = id ? state.products.find(x => x.id === id) : null; if (!p) { p = { id: uid("p") }; state.products.push(p); } p.name = name; p.price = price; p.category = $("#pCategory").value.trim() || "Otros"; p.stock = Number($("#pStock").value || 0); p.variants = $("#pVariants").value.split(",").map(x => x.trim()).filter(Boolean); await put("products", p); closeModal(); renderProducts(); toast("Guardado."); };
window.askDeleteProduct = id => { const p = state.products.find(x => x.id === id); if (!p) return; modal(`<h3>Eliminar</h3><p>¿Quieres eliminar <strong>${esc(p.name)}</strong>?</p><p class="muted">Las ventas anteriores no se borrarán.</p><div class="toolbar"><button class="btn danger" onclick="deleteProduct('${id}')">Sí, eliminar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`); };
window.deleteProduct = async id => { await del("products", id); state.products = state.products.filter(x => x.id !== id); cart = cart.filter(x => x.id !== id); closeModal(); renderProducts(); toast("Eliminado."); };

/* =========================
   CLIENTES / CRÉDITO
========================= */
function renderClients() {
  const html = state.clients.length ? state.clients.map(c => `<div class="row-card clickable" onclick="openClient('${c.id}')"><div class="row-head"><div><strong style="font-size:20px">${esc(c.name)}</strong><div class="muted">${esc(c.phone || "Sin teléfono")}</div></div><strong style="font-size:23px">${money(c.balance || 0)}</strong></div><div class="toolbar" style="margin-top:10px;margin-bottom:0"><button class="btn ghost" onclick="event.stopPropagation();openClient('${c.id}')">Ver movimientos</button>${Number(c.balance || 0) > 0 ? `<button class="btn primary" onclick="event.stopPropagation();abono('${c.id}')">Registrar abono</button>` : ""}</div></div>`).join("") : `<div class="empty">No hay clientes.</div>`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${isServices() ? "Clientes" : "Clientes / Crédito"}</h2><p>Compras, saldos y abonos de cada cliente.</p></section><div class="toolbar"><button class="btn primary" onclick="newClient()">Nuevo cliente</button></div><div class="list">${html}</div>`, "more");
}
window.newClient = () => modal(`<h3>Nuevo cliente</h3><div class="form-grid"><div class="field"><label>Nombre</label><input id="cName"></div><div class="field"><label>Teléfono / WhatsApp</label><input id="cPhone"></div></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveClient(false)">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveClient = async selectAfter => { const name = $("#cName").value.trim(); if (!name) return toast("Escribe el nombre."); const c = { id: uid("c"), name, phone: $("#cPhone").value.trim(), balance: 0 }; await put("clients", c); state.clients.push(c); if (selectAfter) saleMeta.clientId = c.id; closeModal(); if (selectAfter) rerenderSale(); else renderClients(); };
window.openClient = id => { activeClientId = id; screen = "clientDetail"; render(); };
function clientMovements(id) {
  const purchases = state.sales.filter(s => s.clientId === id && s.method === "Crédito").map(s => ({ id: `s_${s.id}`, kind: "sale", createdAt: s.createdAt, amount: Number(s.total || 0), saleId: s.id, title: `Compra a crédito · Comprobante #${s.number}`, detail: s.items.map(i => `${i.qty} × ${i.name}${i.variant ? ` ${i.variant}` : ""}`).join(" · ") }));
  const payments = state.creditMoves.filter(m => m.clientId === id && m.type === "payment").map(m => ({ id: m.id, kind: "payment", createdAt: m.createdAt, amount: -Number(m.amount || 0), title: `Abono · ${m.method || ""}`, detail: m.note || "" }));
  return [...purchases, ...payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function renderClientDetail() {
  const c = state.clients.find(x => x.id === activeClientId);
  if (!c) { screen = "clients"; return renderClients(); }
  const movements = clientMovements(c.id);
  const totalCredit = state.sales.filter(s => s.clientId === c.id && s.method === "Crédito").reduce((a, b) => a + Number(b.total || 0), 0);
  const history = movements.length ? movements.map(m => `<div class="row-card ${m.kind === "sale" ? "clickable" : ""}" ${m.kind === "sale" ? `onclick="openSale('${m.saleId}')"` : ""}><div class="movement"><div><strong>${esc(m.title)}</strong><div class="movement-meta">${dateTime(m.createdAt)}</div>${m.detail ? `<div class="movement-meta">${esc(m.detail)}</div>` : ""}</div><strong class="amount ${m.amount >= 0 ? "positive" : "negative"}">${m.amount >= 0 ? "+" : "−"}${money(Math.abs(m.amount))}</strong></div>${m.kind === "sale" ? `<div class="muted" style="margin-top:8px">Toca para ver el comprobante</div>` : ""}</div>`).join("") : `<div class="empty">Este cliente todavía no tiene movimientos de crédito.</div>`;
  $("#app").innerHTML = shell(`<button class="back-link" onclick="go('clients')">‹ Clientes</button><section class="screen-title"><h2>${esc(c.name)}</h2><p>${esc(c.phone || "Sin teléfono")}</p></section><div class="panel"><div class="client-summary"><div><span class="muted">Saldo pendiente</span><div class="balance-big">${money(c.balance || 0)}</div></div><div style="text-align:right"><span class="muted">Comprado a crédito</span><div style="font-size:21px;font-weight:850;margin-top:5px">${money(totalCredit)}</div></div></div>${Number(c.balance || 0) > 0 ? `<button class="btn primary full" style="margin-top:16px" onclick="abono('${c.id}')">Registrar abono</button>` : ""}</div><section class="screen-title" style="margin-top:24px"><h2 style="font-size:26px">Movimientos</h2><p>Compras a crédito y abonos.</p></section><div class="list">${history}</div>`, "more");
}
window.abono = id => { const c = state.clients.find(x => x.id === id); if (!c) return; modal(`<h3>Registrar abono</h3><p>${esc(c.name)} · Saldo ${money(c.balance)}</p><div class="field"><label>Monto</label><input id="payAmount" type="number" inputmode="decimal"></div><div class="field"><label>Método</label><select id="payMethod"><option>Efectivo</option><option>SINPE</option><option>Tarjeta/Otro</option></select></div><div class="field"><label>Nota opcional</label><input id="payNote" placeholder="Ej. abono semanal"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveAbono('${id}')">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`); };
window.saveAbono = async id => {
  const c = state.clients.find(x => x.id === id), amount = Number($("#payAmount").value || 0), method = $("#payMethod").value, note = $("#payNote").value.trim();
  if (!c || amount <= 0) return toast("Escribe un monto válido.");
  if (amount > Number(c.balance || 0)) return toast("El abono no puede superar el saldo pendiente.");
  c.balance = Math.max(0, Number(c.balance || 0) - amount); await put("clients", c);
  const move = { id: uid("credit"), type: "payment", clientId: id, amount, method, note, createdAt: new Date().toISOString(), shiftId: currentShift()?.id || null };
  await put("creditMoves", move); state.creditMoves.push(move);
  if (isFood() && currentShift() && method === "Efectivo") { const m = { id: uid("move"), type: "creditPayment", clientId: id, amount, method, createdAt: move.createdAt, shiftId: currentShift().id }; await put("cashMoves", m); state.cashMoves.push(m); }
  closeModal(); activeClientId = id; screen = "clientDetail"; renderClientDetail(); toast("Abono registrado.");
};

/* =========================
   PEDIDOS
========================= */
function renderOrders() {
  if (!isFood()) { screen = "home"; return renderHome(); }
  const html = state.orders.length ? [...state.orders].reverse().map(o => `<div class="row-card"><div class="row-head"><strong>Pedido #${o.number}</strong><span class="badge">${esc(o.status)}</span></div>${o.customer ? `<div class="muted">${esc(o.customer)}</div>` : ""}<div style="margin-top:10px">${(o.items || []).map(i => `<div class="ticket-line"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}${o.notes ? `<div>${esc(o.notes)}</div>` : ""}</div><div class="toolbar" style="margin-top:10px">${o.status === "Pendiente" ? `<button class="btn primary" onclick="orderStatus('${o.id}','Preparando')">Preparando</button>` : ""}${o.status === "Preparando" ? `<button class="btn primary" onclick="orderStatus('${o.id}','Listo')">Listo</button>` : ""}${o.status === "Listo" ? `<button class="btn primary" onclick="orderStatus('${o.id}','Entregado')">Entregado</button>` : ""}</div></div>`).join("") : `<div class="empty">No hay pedidos.</div>`;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Pedidos</h2><p>Pendiente → preparando → listo → entregado.</p></section><div class="toolbar"><button class="btn primary" onclick="newOrder()">Nuevo pedido</button></div><div class="list">${html}</div>`, "orders");
}
window.newOrder = () => modal(`<h3>Nuevo pedido</h3><div class="field"><label>Cliente opcional</label><input id="oClient"></div><div class="field"><label>Productos / nota</label><textarea id="oNote" rows="4" placeholder="Ej. 2 casados, 1 fresco, sin cebolla"></textarea></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveOrder()">Guardar pedido</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveOrder = async () => { const note = $("#oNote").value.trim(); if (!note) return toast("Escribe el pedido."); const o = { id: uid("o"), number: state.orders.length + 1, customer: $("#oClient").value.trim(), notes: note, items: [], status: "Pendiente", createdAt: new Date().toISOString() }; await put("orders", o); state.orders.push(o); closeModal(); renderOrders(); };
window.orderStatus = async (id, status) => { const o = state.orders.find(x => x.id === id); if (!o) return; o.status = status; await put("orders", o); renderOrders(); };

/* =========================
   CAJA
========================= */
function renderCash() {
  if (!isFood()) { screen = "home"; return renderHome(); }
  const shift = currentShift();
  if (!shift) {
    $("#app").innerHTML = shell(`<section class="screen-title"><h2>Caja</h2><p>Debes abrir la caja antes de vender.</p></section><div class="panel"><h3>Caja cerrada</h3>${role === "owner" ? `<button class="btn primary full" onclick="openCash()">Abrir caja</button>` : `<p class="muted">El dueño debe abrir la caja.</p>`}</div>`, "more"); return;
  }
  const sales = state.sales.filter(s => s.shiftId === shift.id);
  const sumMethod = m => sales.filter(s => s.method === m).reduce((a, b) => a + Number(b.total || 0), 0);
  const cash = sumMethod("Efectivo"), sinpe = sumMethod("SINPE"), cardTotal = sumMethod("Tarjeta/Otro"), credit = sumMethod("Crédito");
  const moves = state.cashMoves.filter(m => m.shiftId === shift.id || new Date(m.createdAt) >= new Date(shift.openedAt));
  const ins = moves.filter(m => m.type === "in").reduce((a, b) => a + Number(b.amount || 0), 0);
  const outs = moves.filter(m => m.type === "out").reduce((a, b) => a + Number(b.amount || 0), 0);
  const creditCash = moves.filter(m => m.type === "creditPayment" && m.method === "Efectivo").reduce((a, b) => a + Number(b.amount || 0), 0);
  const expected = Number(shift.opening || 0) + cash + ins + creditCash - outs;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Caja</h2><p>Todo lo vendido en este turno queda ligado aquí.</p></section><div class="kpi-grid"><div class="kpi"><span class="muted">Efectivo</span><strong>${money(cash)}</strong></div><div class="kpi"><span class="muted">SINPE</span><strong>${money(sinpe)}</strong></div><div class="kpi"><span class="muted">Tarjeta</span><strong>${money(cardTotal)}</strong></div><div class="kpi"><span class="muted">Crédito</span><strong>${money(credit)}</strong></div></div><div class="panel" style="margin-top:14px"><div class="ticket-line"><span>Fondo inicial</span><strong>${money(shift.opening)}</strong></div><div class="ticket-line"><span>Abonos en efectivo</span><strong>${money(creditCash)}</strong></div><div class="ticket-line"><span>Entradas</span><strong>${money(ins)}</strong></div><div class="ticket-line"><span>Salidas</span><strong>${money(outs)}</strong></div><div class="ticket-line ticket-total"><span>Efectivo esperado</span><strong>${money(expected)}</strong></div></div><div class="toolbar"><button class="btn ghost" onclick="cashMoveForm('in')">Entrada de efectivo</button><button class="btn ghost" onclick="cashMoveForm('out')">Salida de efectivo</button></div>${role === "owner" ? `<button class="btn primary full" style="margin-top:4px" onclick="closeCash(${expected})">Cerrar caja</button>` : ""}`, "more");
}
window.openCash = () => modal(`<h3>Abrir caja</h3><div class="field"><label>Fondo inicial</label><input id="opening" type="number" value="0"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveOpenCash()">Abrir caja</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveOpenCash = async () => { const s = { id: uid("shift"), opening: Number($("#opening").value || 0), openedAt: new Date().toISOString(), status: "open" }; await put("cashSessions", s); state.cashSessions.push(s); closeModal(); screen = "home"; render(); toast("Caja abierta. Ya puedes vender."); };
window.cashMoveForm = kind => modal(`<h3>${kind === "in" ? "Entrada" : "Salida"} de efectivo</h3><div class="field"><label>Monto</label><input id="cashMoveAmount" type="number" inputmode="decimal"></div><div class="field"><label>Motivo</label><input id="cashMoveNote"></div><div class="toolbar"><button class="btn primary" onclick="saveCashMove('${kind}')">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveCashMove = async kind => { const amount = Number($("#cashMoveAmount").value || 0), note = $("#cashMoveNote").value.trim(), shift = currentShift(); if (!shift || amount <= 0) return toast("Escribe un monto válido."); const m = { id: uid("move"), type: kind, amount, note, method: "Efectivo", shiftId: shift.id, createdAt: new Date().toISOString() }; await put("cashMoves", m); state.cashMoves.push(m); closeModal(); renderCash(); };
window.closeCash = expected => modal(`<h3>Cerrar caja</h3><p>Esperado: <strong>${money(expected)}</strong></p><div class="field"><label>Efectivo contado</label><input id="counted" type="number" inputmode="decimal"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveCloseCash(${expected})">Confirmar cierre</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveCloseCash = async expected => { const s = currentShift(); if (!s) return; s.expected = expected; s.counted = Number($("#counted").value || 0); s.difference = s.counted - expected; s.closedAt = new Date().toISOString(); s.status = "closed"; await put("cashSessions", s); closeModal(); screen = "home"; render(); toast(`Caja cerrada. Diferencia: ${money(s.difference)}`); };

/* =========================
   CATÁLOGO
========================= */
function renderCatalog() {
  const label = isFood() ? "Menú QR" : "Catálogo QR";
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>${label}</h2><p>Vista previa de lo que verá el cliente.</p></section><div class="panel">${state.products.length ? state.products.map(p => `<div class="catalog-card"><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category || "")}</div></div><strong>${money(p.price)}</strong></div>`).join("") : `<div class="empty">Todavía no hay contenido.</div>`}</div><div class="panel" style="margin-top:14px"><strong>QR público</strong><p class="muted">La vista ya está preparada. Para que un cliente escanee desde otro teléfono y el pedido llegue automáticamente a Mi Punto CR, falta conectar la nube.</p></div>`, "more");
}

/* =========================
   CONFIGURACIÓN
========================= */
function renderSettings() {
  if (role !== "owner") { screen = "home"; return renderHome(); }
  const s = state.settings;
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Configuración</h2><p>Datos del negocio y protección del propietario.</p></section><div class="panel"><div class="form-grid"><div class="field"><label>Tipo de negocio</label><select id="sType"><option value="food" ${type() === "food" ? "selected" : ""}>Comida / Soda / Repostería</option><option value="products" ${type() === "products" ? "selected" : ""}>Venta de artículos</option><option value="services" ${type() === "services" ? "selected" : ""}>Servicios</option></select></div><div class="field"><label>Nombre del negocio</label><input id="sName" value="${esc(s.businessName)}"></div><div class="field"><label>Propietario</label><input value="${esc(s.ownerName || "")}" disabled></div><div class="field"><label>Correo activado</label><input value="${esc(s.email || "")}" disabled></div><div class="field"><label>Teléfono</label><input id="sPhone" value="${esc(s.phone || "")}"></div><div class="field"><label>WhatsApp</label><input id="sWa" value="${esc(s.whatsapp)}"></div><div class="field"><label>Número SINPE</label><input id="sSinpe" value="${esc(s.sinpe)}"></div><div class="field"><label>Impuesto</label><select id="sTax"><option value="included" ${s.taxMode === "included" ? "selected" : ""}>Incluido</option><option value="added" ${s.taxMode === "added" ? "selected" : ""}>Se suma al cobrar</option><option value="exempt" ${s.taxMode === "exempt" ? "selected" : ""}>Exento</option></select></div><div class="field"><label>Porcentaje</label><input id="sRate" type="number" value="${Number(s.taxRate || 13)}"></div><div class="field"><label>Código del negocio</label><input value="${esc(s.businessId || "")}" disabled></div></div><button class="btn primary full" style="margin-top:14px" onclick="saveSettings()">Guardar cambios</button></div><div class="panel" style="margin-top:14px"><strong>Activación</strong><p class="muted">Estado: ${s.activated ? "Activado" : "Pendiente"}. El código de activación es de un solo uso.</p><button class="btn ghost" onclick="logoutOwner()">Cerrar sesión</button></div>`, "more");
}
window.saveSettings = async () => { state.settings = { ...state.settings, businessType: $("#sType").value, businessName: $("#sName").value.trim() || "Mi Punto CR", phone: $("#sPhone").value.trim(), whatsapp: $("#sWa").value.trim(), sinpe: $("#sSinpe").value.trim(), taxMode: $("#sTax").value, taxRate: Number($("#sRate").value || 0) }; await put("settings", state.settings); quickCategory = ""; screen = "home"; render(); toast("Configuración guardada."); };

function renderMore() {
  let cards = "";
  if (isFood()) cards += card("products", "Productos", "Comidas, bebidas y stock") + card("clients", "Clientes / Crédito", "Compras, saldos y abonos") + card("cash", "Caja", "Apertura y cierre") + card("sales", "Mis ventas", "Comprobantes e historial") + card("catalog", "Menú QR", "Vista del menú");
  if (isProducts()) cards += card("products", "Productos", "Artículos, variantes y stock") + card("clients", "Clientes / Crédito", "Compras, saldos y abonos") + card("sales", "Mis ventas", "Comprobantes e historial") + card("catalog", "Catálogo QR", "Vista del catálogo");
  if (isServices()) cards += card("products", "Servicios", "Precios y categorías") + card("clients", "Clientes", "Compras y crédito") + card("sales", "Mis ventas", "Comprobantes e historial") + card("catalog", "Catálogo QR", "Vista de servicios");
  if (role === "owner") cards += card("settings", "Configuración", "Datos básicos");
  $("#app").innerHTML = shell(`<section class="screen-title"><h2>Más</h2><p>Solo herramientas útiles para este negocio.</p></section><div class="home-grid">${cards}</div>`, "more");
}

/* =========================
   BLOQUEO / MODALES
========================= */
function renderLock() { $("#app").innerHTML = `<div class="lock-screen"><div class="lock-card"><h1>Mi Punto CR</h1><p>Ingresa tu PIN.</p><input id="pin" class="pin-input" type="password" inputmode="numeric"><button class="btn primary full" style="margin-top:14px" onclick="unlock()">Entrar</button></div></div>`; }
window.unlock = () => { const p = $("#pin").value.trim(); if (state.settings.ownerPin && p === state.settings.ownerPin) { role = "owner"; locked = false; return render(); } if (state.settings.cashierPin && p === state.settings.cashierPin) { role = "cashier"; locked = false; return render(); } toast("PIN incorrecto."); };
function modal(html) { closeModal(); const e = document.createElement("div"); e.id = "modalRoot"; e.className = "modal-backdrop"; e.innerHTML = `<div class="modal">${html}</div>`; e.onclick = ev => { if (ev.target === e) closeModal(); }; document.body.appendChild(e); }
window.closeModal = () => $("#modalRoot")?.remove();
function toast(text) { const old = document.querySelector(".toast"); old?.remove(); const e = document.createElement("div"); e.className = "toast"; e.textContent = text; document.body.appendChild(e); setTimeout(() => e.remove(), 2400); }

let resizeTimer;
function handleViewportChange() { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!document.querySelector("#modalRoot")) render(); }, 120); }
window.addEventListener("resize", handleViewportChange);
window.addEventListener("orientationchange", handleViewportChange);
window.addEventListener("online", render);
window.addEventListener("offline", render);

(async () => {
  injectStyles();
  db = await openDB();
  await load();
  locked = !!state.settings.pinEnabled;
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(console.error);
})().catch(err => {
  console.error(err);
  injectStyles();
  document.querySelector("#app").innerHTML = `<section class="onboarding"><div class="onboard-card"><h1 class="onboard-brand">Mi Punto CR</h1><h2>No se pudo iniciar</h2><p>Ocurrió un error al abrir los datos locales.</p><pre style="white-space:pre-wrap;font-size:12px">${esc(err?.message || err)}</pre></div></section>`;
});
