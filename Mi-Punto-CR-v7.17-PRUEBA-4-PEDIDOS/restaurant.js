/* =========================
   MESAS / CUENTAS ABIERTAS
========================= */
function tableIconHtml(number){return `<div class="table-icon"><span class="top"></span><span class="bottom"></span><span class="left"></span><span class="right"></span><span class="center">${number}</span></div>`;}
function tableItemsTotal(items){return totals((items||[]).reduce((a,i)=>a+Number(i.price||0)*Number(i.qty||0),0)).total;}
function renderTables(){
  if(!isFood()){screen="home";return renderHome();}
  const count=Math.max(0,Number(state.settings.tableCount||0));
  if(!count){$("#app").innerHTML=shell(`<section class="screen-title"><h2>Mesas</h2><p>Configura cuántas mesas tiene el restaurante.</p></section><div class="panel"><h3>Aún no hay mesas</h3><p class="muted">Mi Punto CR las numerará automáticamente.</p><button class="btn primary" onclick="configureTables()">Configurar mesas</button></div>`,"more");return;}
  const cards=Array.from({length:count},(_,i)=>i+1).map(n=>{const a=tableAccount(n);let status="Libre",detail="Toca para abrir cuenta";if(a?.status==="open"){status="Cuenta abierta";detail=`${money(tableItemsTotal(a.items))} · ${dateTime(a.openedAt)}`;}if(a?.status==="paid"){status="Pagada";detail=`${money(a.total||tableItemsTotal(a.items))} · pendiente de limpiar`;}return `<button class="table-card" onclick="openTable(${n})">${tableIconHtml(n)}<strong>Mesa ${n}</strong><small>${status}</small><small>${detail}</small></button>`;}).join("");
  $("#app").innerHTML=shell(`<section class="screen-title"><h2>Mesas</h2><p>Cuentas abiertas sin cobrar mientras los clientes están comiendo.</p></section><div class="toolbar"><button class="btn ghost" onclick="configureTables()">Cantidad de mesas</button></div><div class="table-grid">${cards}</div>`,"more");
}
window.configureTables=()=>modal(`<h3>Configurar mesas</h3><p class="muted">El sistema las numerará automáticamente desde Mesa 1.</p><div class="field"><label>¿Cuántas mesas tiene el restaurante?</label><input id="tableCountInput" type="number" min="1" max="100" inputmode="numeric" value="${Number(state.settings.tableCount||0)||""}"></div><div class="toolbar"><button class="btn primary" onclick="saveTableCount()">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);
window.saveTableCount=async()=>{const count=Math.floor(Number($("#tableCountInput").value||0));if(count<1||count>100)return toast("Escribe una cantidad entre 1 y 100.");const blocked=state.tableAccounts.some(a=>Number(a.tableNumber)>count);if(blocked)return toast("Hay una cuenta activa en una mesa mayor a ese número.");state.settings.tableCount=count;await put("settings",state.settings);try{await cloudSaveBusinessSettings();}catch(error){console.error(error);}closeModal();screen="tables";renderTables();toast("Mesas configuradas.");};
function tablePickerButtons(){const count=Number(state.settings.tableCount||0);return Array.from({length:count},(_,i)=>i+1).map(n=>{const a=tableAccount(n);const status=a?.status==="open"?"Abierta":a?.status==="paid"?"Pagada":"Libre";return `<button class="table-pick" onclick="selectTable(${n})">Mesa ${n}<small>${status}</small></button>`;}).join("");}
window.showTablePicker=()=>{if(!Number(state.settings.tableCount||0))return configureTables();modal(`<h3>Seleccionar mesa</h3><p class="muted">Elige una mesa para abrir o continuar su cuenta.</p><div class="table-picker-grid">${tablePickerButtons()}</div><div class="toolbar"><button class="btn ghost" onclick="closeModal();go('tables')">Ver todas las mesas</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);};
window.selectTable=n=>{closeModal();openTable(n);};
window.openTable=n=>{
  const a=tableAccount(n);
  if(a?.status==="paid") return modal(`<h3>Mesa ${n}</h3><p>La cuenta ya fue pagada.</p><p><strong>${money(a.total||tableItemsTotal(a.items))}</strong></p><div class="toolbar"><button class="btn primary" onclick="askCleanTable('${a.id}')">Limpiar mesa</button>${a.paidSaleId?`<button class="btn ghost" onclick="openSale('${a.paidSaleId}')">Ver comprobante</button>`:""}<button class="btn" onclick="closeModal()">Cerrar</button></div>`);
  cart=(a?.items||[]).map(i=>({...i,cartId:`${i.id}_${i.variant||"normal"}`}));
  saleMeta={clientId:a?.clientId||"",orderType:"Mesa",table:String(n),note:a?.note||"",tableAccountId:a?.id||""};
  screen="sale";rerenderSale();
};
window.saveTableAccount=async()=>{
  if(saleMeta.orderType!=="Mesa"||!saleMeta.table)return toast("Selecciona una mesa.");
  if(!cart.length)return toast("Agrega al menos un producto.");
  let a=saleMeta.tableAccountId?state.tableAccounts.find(x=>x.id===saleMeta.tableAccountId):tableAccount(Number(saleMeta.table));
  const now=new Date().toISOString();
  if(!a){a={id:uid("table"),tableNumber:Number(saleMeta.table),openedAt:now,status:"open"};state.tableAccounts.push(a);}
  a.status="open";a.items=cart.map(i=>({id:i.id,name:i.name,variant:i.variant||"",price:i.price,qty:i.qty}));a.note=saleMeta.note||"";a.clientId=saleMeta.clientId||"";a.updatedAt=now;a.total=tableItemsTotal(a.items);delete a.paidSaleId;delete a.paidAt;
  await put("tableAccounts",a);
  try{await cloudSaveTableAccountFromApp(a);}catch(error){console.error(error);a.cloudPending=true;await put("tableAccounts",a);}
  cart=[];resetSaleMeta();screen="tables";renderTables();toast(`Mesa ${a.tableNumber} guardada.`);
};
window.previewCurrentPrebill=()=>{if(saleMeta.orderType!=="Mesa"||!saleMeta.table)return toast("Selecciona una mesa.");if(!cart.length)return toast("La mesa no tiene productos.");const total=tableItemsTotal(cart);modal(`<h3>Precuenta · Mesa ${esc(saleMeta.table)}</h3><div>${cart.map(i=>`<div class="ticket-line"><span>${i.qty} × ${esc(i.name)}</span><strong>${money(i.price*i.qty)}</strong></div>`).join("")}</div><div class="divider"></div><div class="ticket-line ticket-total"><span>Total actual</span><strong>${money(total)}</strong></div><div class="toolbar"><button class="btn primary" onclick="printPrebill()">Imprimir precuenta</button><button class="btn" onclick="closeModal()">Cerrar</button></div>`);};
window.printPrebill=()=>printSimpleDocument(`Precuenta · Mesa ${esc(saleMeta.table)}`,cart.map(i=>`<div class="line"><span>${i.qty} × ${esc(i.name)}</span><strong>${money(i.price*i.qty)}</strong></div>`).join("")+`<hr><div class="line total"><span>TOTAL</span><strong>${money(tableItemsTotal(cart))}</strong></div><p class="center">Precuenta · No es comprobante de pago</p>`);
window.askCleanTable=id=>{const a=state.tableAccounts.find(x=>x.id===id);if(!a)return;modal(`<h3>¿Limpiar Mesa ${a.tableNumber}?</h3><p>La venta y el comprobante quedarán guardados en Mis ventas.</p><div class="toolbar"><button class="btn primary" onclick="cleanTable('${id}')">Limpiar mesa</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);};
window.cleanTable=async id=>{const a=state.tableAccounts.find(x=>x.id===id);if(!a)return;if(state.settings.cloudLinked&&!navigator.onLine)return toast("Conéctate a Internet para limpiar una mesa sincronizada.");try{await cloudDeleteTableAccountFromApp(a);}catch(error){console.error(error);return toast("No se pudo limpiar la mesa en la nube.");}await del("tableAccounts",id);state.tableAccounts=state.tableAccounts.filter(x=>x.id!==id);closeModal();cart=[];resetSaleMeta();screen="tables";renderTables();toast(`Mesa ${a.tableNumber} libre.`);};

/* =========================
   PEDIDOS · RESTAURANTE
   Flujo secuencial en ventanas flotantes:
   Mesa → Categoría → Productos → Revisar → Guardar
========================= */
let orderDraft = null;

function normalizeOrderStatus(status) {
  if (status === "Pendiente" || status === "Tomado" || status === "taken") return "Recibido";
  if (status === "Preparando" || status === "En preparación" || status === "preparing") return "Recibido";
  if (status === "ready") return "Listo";
  if (status === "delivered") return "Entregado";
  if (status === "on_way") return "En camino";
  return status || "Recibido";
}

function orderStatusTime(o) {
  const status = normalizeOrderStatus(o.status);
  const at = status === "Entregado"
    ? o.deliveredAt
    : status === "En camino"
      ? o.onWayAt
      : status === "Listo"
        ? o.readyAt
        : o.createdAt;

  return at
    ? new Date(at).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })
    : "";
}

let ordersTab = "table";
function orderKind(order) { return order.kind || (order.tableNumber ? "table" : "whatsapp"); }
function orderOriginLabel(order) {
  if (orderKind(order) === "table") return `Mesa ${order.tableNumber || "-"}`;
  return order.fulfillment === "Express" ? "WhatsApp · Express" : "WhatsApp";
}
function orderTotal(order) {
  return totals((order.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0)).total;
}
function orderAgeText(order) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt || Date.now()).getTime()) / 60000));
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `Hace ${hours} h ${mins % 60} min`;
}
function nextVisibleOrderStatus(order) {
  const status = normalizeOrderStatus(order.status);
  const express = order.fulfillment === "Express" || order.orderType === "Express";
  if (status === "Recibido") return "Listo";
  if (status === "Listo") return express ? "En camino" : "Entregado";
  if (status === "En camino") return "Entregado";
  return "";
}
function orderPhoneHref(order, text = "") {
  const digits = String(order.phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const phone = digits.length === 8 ? `506${digits}` : digits;
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

function nextOrderNumber() {
  return Math.max(0, ...state.orders.map(o => Number(o.number || 0))) + 1;
}

function orderDraftSubtotal() {
  return (orderDraft?.items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0),
    0
  );
}

function orderDraftQty() {
  return (orderDraft?.items || []).reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0
  );
}

function mergeTableItems(base = [], added = []) {
  const result = base.map(item => ({ ...item }));

  for (const item of added) {
    const variant = item.variant || "";
    const found = result.find(current =>
      current.id === item.id && (current.variant || "") === variant
    );

    if (found) {
      found.qty = Number(found.qty || 0) + Number(item.qty || 0);
    } else {
      result.push({
        id: item.id,
        name: item.name,
        variant,
        price: Number(item.price || 0),
        qty: Number(item.qty || 0)
      });
    }
  }

  return result;
}

function orderTablePickerHtml() {
  const count = Number(state.settings.tableCount || 0);

  return Array.from({ length: count }, (_, index) => index + 1)
    .map(number => {
      const account = tableAccount(number);
      const paid = account?.status === "paid";
      const label = paid
        ? "Pagada · limpiar primero"
        : account?.status === "open"
          ? `Cuenta abierta · ${money(tableItemsTotal(account.items))}`
          : "Libre";

      return `
        <button
          class="table-pick"
          ${paid ? "disabled" : ""}
          style="${paid ? "opacity:.45;cursor:not-allowed" : ""}"
          onclick="startOrderForTable(${number})"
        >
          Mesa ${number}
          <small>${label}</small>
        </button>
      `;
    })
    .join("");
}

function orderDraftSummaryHtml() {
  if (!orderDraft?.items?.length) {
    return `<div class="empty" style="padding:18px 8px">Todavía no has agregado productos.</div>`;
  }

  return orderDraft.items
    .map(item => `
      <div class="ticket-line">
        <span>${item.qty} × ${esc(item.name)}</span>
        <strong>${money(Number(item.price || 0) * Number(item.qty || 0))}</strong>
      </div>
    `)
    .join("");
}

function renderOrders() {
  if (!isFood()) { screen = "home"; return renderHome(); }

  const active = [...state.orders].filter(o => normalizeOrderStatus(o.status) !== "Entregado");
  const tableCount = active.filter(o => orderKind(o) === "table").length;
  const whatsCount = active.filter(o => orderKind(o) === "whatsapp").length;
  const list = active
    .filter(o => ordersTab === "table" ? orderKind(o) === "table" : orderKind(o) === "whatsapp")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const html = list.length ? list.map(order => {
    const status = normalizeOrderStatus(order.status);
    const next = nextVisibleOrderStatus(order);
    const account = orderKind(order) === "table"
      ? (order.tableAccountId ? state.tableAccounts.find(a => a.id === order.tableAccountId) : tableAccount(order.tableNumber))
      : null;
    const accountState = account?.status === "open"
      ? `Cuenta abierta · ${money(tableItemsTotal(account.items))}`
      : account?.status === "paid"
        ? "Cuenta pagada"
        : orderKind(order) === "table" ? "Cuenta de mesa" : `${order.customer || "Cliente"}${order.phone ? ` · ${order.phone}` : ""}`;
    const statusTime = orderStatusTime(order);
    const title = orderKind(order) === "table" ? `Mesa ${esc(order.tableNumber || "-")}` : `${esc(order.customer || "Cliente WhatsApp")}`;
    const subtitle = orderKind(order) === "table"
      ? `Pedido #${order.number} · ${dateTime(order.createdAt)}`
      : `Pedido #W-${String(order.number || "").padStart(3,"0")} · ${esc(order.fulfillment || "Recoger")} · ${dateTime(order.createdAt)}`;
    const openButton = account?.status === "open" ? `<button class="btn ghost" onclick="openTable(${Number(order.tableNumber)})">Abrir cuenta de mesa</button>` : "";
    const whatsHref = orderPhoneHref(order);
    const readyText = `Hola ${order.customer || ""}. Tu pedido #W-${String(order.number || "").padStart(3,"0")} está listo. Total: ${money(orderTotal(order))}. Gracias por comprar con nosotros.`;
    const readyHref = orderPhoneHref(order, readyText);
    const whatsappButtons = orderKind(order) === "whatsapp" ? `
      ${whatsHref ? `<a class="btn ghost" href="${whatsHref}" target="_blank" rel="noopener">Abrir chat</a>` : ""}
      ${status === "Listo" && readyHref ? `<a class="btn ghost" href="${readyHref}" target="_blank" rel="noopener">Avisar listo</a>` : ""}
    ` : "";

    return `
      <div class="row-card">
        <div class="row-head">
          <div>
            <strong style="font-size:21px">${title}</strong>
            <div class="muted">${subtitle}</div>
          </div>
          <span class="badge">${esc(status)}</span>
        </div>
        <div class="muted" style="margin-top:8px">${esc(accountState)} · ${orderAgeText(order)}${statusTime ? ` · ${esc(status)} ${esc(statusTime)}` : ""}</div>
        ${order.address ? `<div class="panel" style="box-shadow:none;margin-top:10px;padding:12px"><span class="muted">Dirección / referencia</span><div>${esc(order.address)}</div></div>` : ""}
        <div style="margin-top:12px">
          ${(order.items || []).map(item => `<div class="ticket-line"><span>${item.qty} × ${esc(item.name)}</span><strong>${money(Number(item.price || 0) * Number(item.qty || 0))}</strong></div>`).join("")}
        </div>
        ${order.notes ? `<div class="panel" style="box-shadow:none;margin-top:10px;padding:12px"><span class="muted">Nota</span><div>${esc(order.notes)}</div></div>` : ""}
        <div class="toolbar" style="margin-top:12px">
          ${next ? `<button class="btn primary" onclick="orderStatus('${order.id}','${next}')">${next}</button>` : `<span class="badge" style="background:#e8f4ec;color:#2d6d43">Entregado</span>`}
          ${whatsappButtons}
          ${openButton}
        </div>
      </div>`;
  }).join("") : `<div class="empty">No hay pedidos activos en esta sección.</div>`;

  $("#app").innerHTML = shell(`
    <section class="screen-title"><h2>Pedidos</h2><p>Recibido → Listo → Entregado. Express agrega En camino.</p></section>
    <div class="toolbar order-tabs">
      <button class="btn ${ordersTab === "table" ? "primary" : "ghost"}" onclick="ordersTab='table';renderOrders()">Pedidos de mesa (${tableCount})</button>
      <button class="btn ${ordersTab === "whatsapp" ? "primary" : "ghost"}" onclick="ordersTab='whatsapp';renderOrders()">Pedidos WhatsApp (${whatsCount})</button>
    </div>
    <div class="toolbar">
      <button class="btn primary" onclick="newOrder()">Tomar pedido de mesa</button>
      <button class="btn ghost" onclick="newWhatsappOrder()">Nuevo pedido WhatsApp</button>
      <button class="btn ghost" onclick="go('tables')">Ver mesas</button>
    </div>
    <div class="list">${html}</div>
  `, "orders");
}

window.newOrder = () => {
  if (!currentShift()) return toast("Primero debes abrir la caja.");
  if (!Number(state.settings.tableCount || 0)) return configureTables();

  orderDraft = {
    tableNumber: "",
    items: [],
    note: "",
    category: ""
  };

  showOrderTableStep();
};

window.showOrderTableStep = () => {
  if (!orderDraft) {
    orderDraft = { tableNumber: "", items: [], note: "", category: "" };
  }

  modal(`
    <div class="category-modal-header">
      <div>
        <h3>1. Elegir mesa</h3>
        <p class="muted" style="margin:5px 0 0">Selecciona la mesa donde vas a tomar el pedido.</p>
      </div>
      <button class="modal-close" onclick="cancelOrderDraft()">×</button>
    </div>

    <div class="table-picker-grid">
      ${orderTablePickerHtml()}
    </div>

    ${orderDraft.items.length ? `
      <div class="table-account-banner" style="margin-top:16px">
        <span>Tu pedido sigue guardado</span>
        <strong>${orderDraftQty()} productos · ${money(totals(orderDraftSubtotal()).total)}</strong>
      </div>
    ` : ""}

    <div class="toolbar" style="margin-top:18px">
      <button class="btn" onclick="cancelOrderDraft()">Cancelar</button>
    </div>
  `);
};

window.startOrderForTable = number => {
  const account = tableAccount(number);

  if (account?.status === "paid") {
    return toast(`Mesa ${number} ya fue pagada. Límpiala antes de usarla de nuevo.`);
  }

  if (!orderDraft) {
    orderDraft = { tableNumber: "", items: [], note: "", category: "" };
  }

  orderDraft.tableNumber = Number(number);
  showOrderCategoryStep();
};

function showOrderCategoryStep() {
  if (!orderDraft) return renderOrders();

  const categories = productCategories();
  const isWhatsappDraft = orderDraft.kind === "whatsapp";
  const account = isWhatsappDraft ? null : tableAccount(orderDraft.tableNumber);
  const accountText = isWhatsappDraft
    ? `${orderDraft.fulfillment || "Recoger"}${orderDraft.customer ? ` · ${orderDraft.customer}` : ""}`
    : account?.status === "open"
      ? `Cuenta abierta: ${money(tableItemsTotal(account.items))}`
      : "Mesa sin cuenta abierta";

  const categoryHtml = categories.length
    ? categories.map(category => {
        const count = currentProducts().filter(
          product => (product.category?.trim() || "Otros") === category
        ).length;

        return `
          <button
            class="category-card"
            onclick="orderPickCategory(decodeURIComponent('${enc(category)}'))"
          >
            <span class="category-name">${esc(category)}</span>
            <span class="category-count">${count} productos</span>
            <span class="category-arrow">›</span>
          </button>
        `;
      }).join("")
    : `<div class="empty">Primero agrega productos y categorías.</div>`;

  modal(`
    <div class="category-modal-header">
      <div>
        <h3>${isWhatsappDraft ? "Elegir categoría" : "2. Elegir categoría"}</h3>
        <p class="muted" style="margin:5px 0 0">${isWhatsappDraft ? "WhatsApp" : `Mesa ${orderDraft.tableNumber}`} · ${esc(accountText)}</p>
      </div>
      <button class="modal-close" onclick="cancelOrderDraft()">×</button>
    </div>

    <div class="category-grid" style="margin-top:16px">
      ${categoryHtml}
    </div>

    ${orderDraft.items.length ? `
      <div class="table-account-banner" style="margin-top:16px">
        <span>${orderDraftQty()} productos en este pedido</span>
        <strong>${money(totals(orderDraftSubtotal()).total)}</strong>
      </div>
    ` : ""}

    <div class="toolbar" style="margin-top:16px">
      <button class="btn ghost" onclick="orderDraft.kind === 'whatsapp' ? showWhatsappInfoStep() : showOrderTableStep()">‹ Volver</button>
      ${orderDraft.items.length ? `<button class="btn primary" onclick="showOrderReviewStep()">Revisar pedido</button>` : ""}
      <button class="btn" onclick="cancelOrderDraft()">Cancelar</button>
    </div>
  `);
}

window.orderPickCategory = category => {
  if (!orderDraft) return;
  orderDraft.category = category;
  showOrderProductsStep();
};

function showOrderProductsStep() {
  if (!orderDraft) return renderOrders();

  if (!orderDraft.category) return showOrderCategoryStep();

  const products = currentProducts().filter(
    product => (product.category?.trim() || "Otros") === orderDraft.category
  );

  const productHtml = products.length
    ? products.map(product => {
        const selected = orderDraft.items.find(item => item.id === product.id);
        return `
          <button
            class="category-product"
            onclick="addOrderProduct('${product.id}')"
          >
            <div>
              <strong>${esc(product.name)}</strong>
              <small>${selected ? `Agregado × ${selected.qty}` : "Toca para agregar"}</small>
            </div>
            <span class="category-product-price">${money(product.price)}</span>
          </button>
        `;
      }).join("")
    : `<div class="empty">No hay productos en esta categoría.</div>`;

  modal(`
    <div class="category-modal-header">
      <div>
        <h3>3. ${esc(orderDraft.category)}</h3>
        <p class="muted" style="margin:5px 0 0">${orderDraft.kind === "whatsapp" ? "WhatsApp" : `Mesa ${orderDraft.tableNumber}`} · toca cada producto para agregarlo.</p>
      </div>
      <button class="modal-close" onclick="cancelOrderDraft()">×</button>
    </div>

    <div class="category-products" style="margin-top:16px">
      ${productHtml}
    </div>

    <div class="table-account-banner" style="margin-top:16px">
      <span>${orderDraftQty()} productos seleccionados</span>
      <strong>${money(totals(orderDraftSubtotal()).total)}</strong>
    </div>

    <div class="toolbar" style="margin-top:16px">
      <button class="btn ghost" onclick="showOrderCategoryStep()">‹ Categorías</button>
      <button class="btn primary" onclick="showOrderReviewStep()">Revisar pedido</button>
      <button class="btn" onclick="cancelOrderDraft()">Cancelar</button>
    </div>
  `);
}

window.addOrderProduct = id => {
  if (!orderDraft) return;

  const product = currentProducts().find(item => item.id === id);
  if (!product) return;

  const cartId = `${product.id}_normal`;
  const found = orderDraft.items.find(item => item.cartId === cartId);

  if (found) {
    found.qty++;
  } else {
    orderDraft.items.push({
      cartId,
      id: product.id,
      name: product.name,
      variant: "",
      price: Number(product.price || 0),
      qty: 1
    });
  }

  showOrderProductsStep();
};

window.showOrderReviewStep = () => {
  if (!orderDraft) return;

  if (!orderDraft.items.length) {
    toast("Agrega al menos un producto.");
    return showOrderProductsStep();
  }

  const total = totals(orderDraftSubtotal()).total;

  modal(`
    <div class="category-modal-header">
      <div>
        <h3>4. Revisar pedido</h3>
        <p class="muted" style="margin:5px 0 0">${orderDraft.kind === "whatsapp" ? `WhatsApp · ${esc(orderDraft.fulfillment || "Recoger")}` : `Mesa ${orderDraft.tableNumber}`}</p>
      </div>
      <button class="modal-close" onclick="cancelOrderDraft()">×</button>
    </div>

    <div class="cart-list" style="margin-top:12px">
      ${orderDraft.items.map(item => `
        <div class="cart-item">
          <div>
            <strong>${esc(item.name)}</strong>
            <div class="muted">${money(item.price)} c/u</div>
          </div>
          <div class="qty">
            <button onclick="orderQty('${item.cartId}',-1)">−</button>
            <strong>${item.qty}</strong>
            <button onclick="orderQty('${item.cartId}',1)">+</button>
          </div>
        </div>
      `).join("")}
    </div>

    <div class="divider"></div>

    <div class="field">
      <label>Nota opcional</label>
      <textarea
        id="orderReviewNote"
        rows="3"
        placeholder="Ej. una hamburguesa sin cebolla"
        oninput="orderSetNote(this.value)"
      >${esc(orderDraft.note)}</textarea>
    </div>

    <div class="total-box">
      <span>Total de este pedido</span>
      <span>${money(total)}</span>
    </div>

    <div class="toolbar">
      <button class="btn ghost" onclick="showOrderProductsStep()">‹ Productos</button>
      <button class="btn primary" onclick="orderDraft.kind === 'whatsapp' ? saveWhatsappOrder() : saveTableOrder()">Guardar pedido</button>
      <button class="btn" onclick="cancelOrderDraft()">Cancelar</button>
    </div>
  `);
};

window.orderQty = (cartId, delta) => {
  if (!orderDraft) return;

  const item = orderDraft.items.find(current => current.cartId === cartId);
  if (!item) return;

  item.qty += delta;

  if (item.qty <= 0) {
    orderDraft.items = orderDraft.items.filter(current => current.cartId !== cartId);
  }

  if (!orderDraft.items.length) {
    return showOrderProductsStep();
  }

  showOrderReviewStep();
};

window.orderSetNote = value => {
  if (orderDraft) orderDraft.note = value;
};

window.clearOrderDraft = () => {
  if (!orderDraft) return;
  orderDraft.items = [];
  orderDraft.note = "";
  showOrderProductsStep();
};

window.cancelOrderDraft = () => {
  orderDraft = null;
  closeModal();
  screen = "orders";
  renderOrders();
};

window.saveTableOrder = async () => {
  if (!orderDraft?.items?.length) return toast("Agrega al menos un producto.");

  const now = new Date().toISOString();
  let account = tableAccount(orderDraft.tableNumber);

  if (account?.status === "paid") {
    return toast("Esta mesa ya fue pagada. Límpiala primero.");
  }

  if (!account) {
    account = {
      id: uid("table"),
      tableNumber: Number(orderDraft.tableNumber),
      openedAt: now,
      status: "open",
      items: [],
      orderIds: []
    };
    state.tableAccounts.push(account);
  }

  const order = {
    id: uid("o"),
    number: nextOrderNumber(),
    tableNumber: Number(orderDraft.tableNumber),
    tableAccountId: account.id,
    customer: "",
    items: orderDraft.items.map(item => ({
      id: item.id,
      name: item.name,
      variant: item.variant || "",
      price: Number(item.price || 0),
      qty: Number(item.qty || 0)
    })),
    notes: orderDraft.note.trim(),
    status: "Recibido",
    kind: "table",
    fulfillment: "Mesa",
    createdAt: now,
    statusHistory: [{ status: "Recibido", at: now }]
  };

  account.status = "open";
  account.items = mergeTableItems(account.items || [], order.items);
  account.orderIds = [...new Set([...(account.orderIds || []), order.id])];
  account.updatedAt = now;
  account.total = tableItemsTotal(account.items);
  delete account.paidSaleId;
  delete account.paidAt;

  await put("orders", order);
  state.orders.push(order);
  await put("tableAccounts", account);
  try { await cloudSaveOrderFromApp(order); } catch (error) { console.error(error); order.cloudPending = true; account.cloudPending = true; await put("orders", order); await put("tableAccounts", account); }

  orderDraft = null;
  closeModal();
  screen = "orders";
  renderOrders();
  toast(`Pedido #${order.number} guardado en Mesa ${order.tableNumber}.`);
};

window.orderStatus = async (id, status) => {
  const order = state.orders.find(item => item.id === id);
  if (!order) return;

  const now = new Date().toISOString();
  order.status = status;
  order.updatedAt = now;
  order.statusHistory = [
    ...(order.statusHistory || []),
    { status, at: now }
  ];

  if (status === "Listo") order.readyAt = now;
  if (status === "En camino") order.onWayAt = now;
  if (status === "Entregado") order.deliveredAt = now;

  await put("orders", order);
  try { await cloudSaveOrderFromApp(order); } catch (error) { console.error(error); order.cloudPending = true; await put("orders", order); }
  renderOrders();
};


window.newWhatsappOrder = () => {
  if (!currentShift()) return toast("Primero debes abrir la caja.");
  orderDraft = {
    kind: "whatsapp",
    fulfillment: "Recoger",
    customer: "",
    phone: "",
    address: "",
    items: [],
    note: "",
    category: ""
  };
  showWhatsappInfoStep();
};

function showWhatsappInfoStep() {
  if (!orderDraft) return;
  modal(`
    <div class="category-modal-header"><div><h3>Pedido WhatsApp</h3><p class="muted" style="margin:5px 0 0">Registra el cliente y el tipo de entrega.</p></div><button class="modal-close" onclick="cancelOrderDraft()">×</button></div>
    <div class="field"><label>Nombre del cliente</label><input id="waCustomer" value="${esc(orderDraft.customer || "")}" placeholder="Ej. Juan"></div>
    <div class="field"><label>Teléfono WhatsApp</label><input id="waPhone" inputmode="tel" value="${esc(orderDraft.phone || "")}" placeholder="8888-8888"></div>
    <div class="field"><label>Tipo</label><select id="waFulfillment" onchange="toggleWhatsappAddress()"><option value="Recoger" ${orderDraft.fulfillment !== "Express" ? "selected" : ""}>Recoger</option><option value="Express" ${orderDraft.fulfillment === "Express" ? "selected" : ""}>Express</option></select></div>
    <div class="field" id="waAddressWrap" style="${orderDraft.fulfillment === "Express" ? "" : "display:none"}"><label>Dirección / referencia</label><textarea id="waAddress" rows="3" placeholder="Dirección, referencia o punto de entrega">${esc(orderDraft.address || "")}</textarea></div>
    <div class="toolbar"><button class="btn primary" onclick="saveWhatsappInfoStep()">Continuar</button><button class="btn" onclick="cancelOrderDraft()">Cancelar</button></div>
  `);
}
window.toggleWhatsappAddress = () => { const w=$("#waAddressWrap"); if(w) w.style.display = $("#waFulfillment")?.value === "Express" ? "" : "none"; };
window.saveWhatsappInfoStep = () => {
  if (!orderDraft) return;
  orderDraft.customer = $("#waCustomer").value.trim();
  orderDraft.phone = $("#waPhone").value.trim();
  orderDraft.fulfillment = $("#waFulfillment").value;
  orderDraft.address = orderDraft.fulfillment === "Express" ? $("#waAddress").value.trim() : "";
  if (!orderDraft.phone) return toast("Escribe el teléfono de WhatsApp.");
  showOrderCategoryStep();
};

async function saveWhatsappOrder() {
  if (!orderDraft?.items?.length) return toast("Agrega al menos un producto.");
  const now = new Date().toISOString();
  const order = {
    id: uid("o"),
    number: nextOrderNumber(),
    kind: "whatsapp",
    fulfillment: orderDraft.fulfillment || "Recoger",
    orderType: orderDraft.fulfillment === "Express" ? "Express" : "WhatsApp",
    customer: orderDraft.customer || "Cliente",
    phone: orderDraft.phone || "",
    address: orderDraft.address || "",
    items: orderDraft.items.map(item => ({ id: item.id, name: item.name, variant: item.variant || "", price: Number(item.price || 0), qty: Number(item.qty || 0) })),
    notes: orderDraft.note.trim(),
    status: "Recibido",
    createdAt: now,
    statusHistory: [{ status: "Recibido", at: now }]
  };
  await put("orders", order);
  state.orders.push(order);
  try { await cloudSaveOrderFromApp(order); } catch (error) { console.warn("Pedido WhatsApp pendiente de sincronización", error); order.cloudPending = true; await put("orders", order); }
  orderDraft = null;
  closeModal();
  ordersTab = "whatsapp";
  screen = "orders";
  renderOrders();
  toast(`Pedido WhatsApp #W-${String(order.number).padStart(3,"0")} guardado.`);
}

/* =========================
   CAJA
========================= */
function shiftReportData(shift){
  const sales=state.sales.filter(s=>s.shiftId===shift.id&&!s.voided);
  const sum=m=>sales.filter(s=>s.method===m).reduce((a,b)=>a+Number(b.total||0),0);
  const moves=state.cashMoves.filter(m=>m.shiftId===shift.id);
  const ins=moves.filter(m=>m.type==="in").reduce((a,b)=>a+Number(b.amount||0),0);
  const outs=moves.filter(m=>m.type==="out").reduce((a,b)=>a+Number(b.amount||0),0);
  const creditCash=moves.filter(m=>m.type==="creditPayment"&&m.method==="Efectivo").reduce((a,b)=>a+Number(b.amount||0),0);
  const products={};for(const sale of sales)for(const item of sale.items||[]){const k=item.name+(item.variant?` · ${item.variant}`:"");products[k]=(products[k]||0)+Number(item.qty||0);}
  const cash=sum("Efectivo"),sinpe=sum("SINPE"),card=sum("Tarjeta/Otro"),credit=sum("Crédito");
  const creditPayments=state.creditMoves.filter(m=>m.shiftId===shift.id&&m.type==="payment").reduce((a,b)=>a+Number(b.amount||0),0);
  const orderCounts={Mostrador:0,"Para llevar":0,Express:0,Mesa:0,WhatsApp:0};
  for(const sale of sales){const key=sale.orderType||"Mostrador";orderCounts[key]=(orderCounts[key]||0)+1;}
  return {sales,count:sales.length,gross:sales.reduce((a,b)=>a+Number(b.total||0),0),tax:sales.reduce((a,b)=>a+Number(b.tax||0),0),cash,sinpe,card,credit,creditCash,creditPayments,ins,outs,expected:Number(shift.opening||0)+cash+ins+creditCash-outs,products,orderCounts};
}
function closingHistoryHtml(){const closed=[...state.cashSessions].filter(s=>s.status==="closed").sort((a,b)=>new Date(b.closedAt)-new Date(a.closedAt));return closed.length?closed.map(s=>`<button class="row-card" style="width:100%;text-align:left" onclick="showDayReport('${s.id}')"><div class="row-head"><div><strong>${new Date(s.closedAt).toLocaleDateString("es-CR")}</strong><div class="muted">${dateTime(s.openedAt)} → ${dateTime(s.closedAt)}</div></div><strong>${money(s.report?.gross||shiftReportData(s).gross)}</strong></div><div class="muted" style="margin-top:7px">${s.report?.count??shiftReportData(s).count} ventas · Diferencia ${money(s.difference||0)}</div></button>`).join(""):`<div class="empty">Todavía no hay cierres guardados.</div>`;}
function renderCash(){
  if(!isFood()){screen="home";return renderHome();}
  const shift=currentShift();
  if(!shift){$("#app").innerHTML=shell(`<section class="screen-title"><h2>Caja</h2><p>Abre una caja para comenzar un nuevo turno.</p></section><div class="panel"><h3>Caja cerrada</h3>${hasPermission("cash")?`<button class="btn primary full" onclick="openCash()">Abrir caja</button>`:`<p class="muted">No tienes permiso para abrir la caja.</p>`}</div><section class="screen-title" style="margin-top:24px"><h2 style="font-size:26px">Historial de cierres</h2><p>Reportes del día guardados.</p></section><div class="closing-list">${closingHistoryHtml()}</div>`,"more");return;}
  const r=shiftReportData(shift);
  $("#app").innerHTML=shell(`<section class="screen-title"><h2>Caja</h2><p>Todo lo vendido en este turno queda ligado aquí.</p></section><div class="kpi-grid"><div class="kpi"><span class="muted">Efectivo</span><strong>${money(r.cash)}</strong></div><div class="kpi"><span class="muted">SINPE</span><strong>${money(r.sinpe)}</strong></div><div class="kpi"><span class="muted">Tarjeta</span><strong>${money(r.card)}</strong></div><div class="kpi"><span class="muted">Crédito</span><strong>${money(r.credit)}</strong></div></div><div class="panel" style="margin-top:14px"><div class="ticket-line"><span>Ventas del turno</span><strong>${r.count}</strong></div><div class="ticket-line"><span>Fondo inicial</span><strong>${money(shift.opening)}</strong></div><div class="ticket-line"><span>Abonos en efectivo</span><strong>${money(r.creditCash)}</strong></div><div class="ticket-line"><span>Entradas</span><strong>${money(r.ins)}</strong></div><div class="ticket-line"><span>Salidas</span><strong>${money(r.outs)}</strong></div><div class="ticket-line ticket-total"><span>Efectivo esperado</span><strong>${money(r.expected)}</strong></div></div><div class="toolbar"><button class="btn ghost" onclick="cashMoveForm('in')">Entrada de efectivo</button><button class="btn ghost" onclick="cashMoveForm('out')">Salida de efectivo</button></div>${hasPermission("cash")?`<button class="btn primary full" style="margin-top:4px" onclick="closeCash(${r.expected})">Cerrar caja</button>`:""}`,"more");
}
window.openCash=()=>{if(!requirePermission("cash","No tienes permiso para abrir la caja."))return;modal(`<h3>Abrir caja</h3><div class="field"><label>Fondo inicial</label><input id="opening" type="number" value="0"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveOpenCash()">Abrir caja</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);};
window.saveOpenCash=async()=>{if(!requirePermission("cash","No tienes permiso para abrir la caja."))return;const s={id:uid("shift"),opening:Number($("#opening").value||0),openedAt:new Date().toISOString(),status:"open"};cloudQueueAuditEvent(s,"open","cash_shift",null,{opening:s.opening,status:"open"});await put("cashSessions",s);state.cashSessions.push(s);try{await cloudSaveCashSessionFromApp(s);}catch(error){console.error(error);s.cloudPending=true;await put("cashSessions",s);}closeModal();screen="home";render();toast("Caja abierta. Ya puedes vender.");};
window.cashMoveForm=kind=>{if(!requirePermission("cash","No tienes permiso para mover efectivo."))return;modal(`<h3>${kind==="in"?"Entrada":"Salida"} de efectivo</h3><div class="field"><label>Monto</label><input id="cashMoveAmount" type="number" inputmode="decimal"></div><div class="field"><label>Motivo</label><input id="cashMoveNote"></div><div class="toolbar"><button class="btn primary" onclick="saveCashMove('${kind}')">Guardar</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);};
window.saveCashMove=async kind=>{if(!requirePermission("cash","No tienes permiso para mover efectivo."))return;const amount=Number($("#cashMoveAmount").value||0),note=$("#cashMoveNote").value.trim(),shift=currentShift();if(!shift||amount<=0)return toast("Escribe un monto válido.");const m={id:uid("move"),type:kind,amount,note,method:"Efectivo",shiftId:shift.id,createdAt:new Date().toISOString()};cloudQueueAuditEvent(m,kind==="out"?"cash_out":"cash_in","cash_movement",null,{amount,note,shiftId:shift.id});await put("cashMoves",m);state.cashMoves.push(m);try{await cloudSaveCashMoveFromApp(m);}catch(error){console.error(error);m.cloudPending=true;await put("cashMoves",m);}closeModal();renderCash();};
window.closeCash=expected=>{if(!requirePermission("cash","No tienes permiso para cerrar la caja."))return;const open=openTableAccounts();if(open.length)return modal(`<h3>No puedes cerrar la caja</h3><p>Hay ${open.length} ${open.length===1?"mesa con cuenta abierta":"mesas con cuentas abiertas"}.</p><p class="muted">Cobra o resuelve esas mesas antes de cerrar.</p><div class="toolbar"><button class="btn primary" onclick="closeModal();go('tables')">Ver mesas</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);modal(`<h3>Cerrar caja</h3><p>Esperado: <strong>${money(expected)}</strong></p><div class="field"><label>Efectivo contado</label><input id="counted" type="number" inputmode="decimal"></div><div class="toolbar" style="margin-top:14px"><button class="btn primary" onclick="saveCloseCash(${expected})">Confirmar cierre</button><button class="btn" onclick="closeModal()">Cancelar</button></div>`);};
window.saveCloseCash=async expected=>{if(!requirePermission("cash","No tienes permiso para cerrar la caja."))return;const sh=currentShift();if(!sh)return;const report=shiftReportData(sh);sh.expected=expected;sh.counted=Number($("#counted").value||0);sh.difference=sh.counted-expected;sh.closedAt=new Date().toISOString();sh.status="closed";sh.report=buildShiftSnapshot(sh);cloudQueueAuditEvent(sh,"close","cash_shift",{status:"open",opening:Number(sh.opening||0)},{status:"closed",expected:Number(sh.expected||0),counted:Number(sh.counted||0),difference:Number(sh.difference||0)});await put("cashSessions",sh);try{await cloudSaveCashSessionFromApp(sh);}catch(error){console.error(error);sh.cloudPending=true;await put("cashSessions",sh);}closeModal();showDayReport(sh.id);};
window.showDayReport=id=>{const sh=state.cashSessions.find(x=>x.id===id);if(!sh)return;const r=shiftReportData(sh);const products=Object.entries(sh.report?.products||r.products);modal(`<h3>Reporte del día</h3><p class="muted">${dateTime(sh.openedAt)} → ${sh.closedAt?dateTime(sh.closedAt):"Abierto"}</p><div class="report-grid"><div class="report-stat"><span>Ventas</span><strong>${sh.report?.count??r.count}</strong></div><div class="report-stat"><span>Total vendido</span><strong>${money(sh.report?.gross??r.gross)}</strong></div><div class="report-stat"><span>Efectivo</span><strong>${money(sh.report?.cash??r.cash)}</strong></div><div class="report-stat"><span>SINPE</span><strong>${money(sh.report?.sinpe??r.sinpe)}</strong></div><div class="report-stat"><span>Tarjeta</span><strong>${money(sh.report?.card??r.card)}</strong></div><div class="report-stat"><span>Crédito</span><strong>${money(sh.report?.credit??r.credit)}</strong></div><div class="report-stat"><span>Abonos recibidos</span><strong>${money(sh.report?.creditPayments??r.creditPayments)}</strong></div><div class="report-stat"><span>Mesas / Express</span><strong>${(sh.report?.orderCounts?.Mesa??r.orderCounts.Mesa)} / ${(sh.report?.orderCounts?.Express??r.orderCounts.Express)}</strong></div></div><div class="panel" style="box-shadow:none"><div class="ticket-line"><span>Fondo inicial</span><strong>${money(sh.opening)}</strong></div><div class="ticket-line"><span>Efectivo esperado</span><strong>${money(sh.expected??r.expected)}</strong></div><div class="ticket-line"><span>Efectivo contado</span><strong>${money(sh.counted||0)}</strong></div><div class="ticket-line ticket-total"><span>Diferencia</span><strong>${money(sh.difference||0)}</strong></div></div>${products.length?`<h4>Productos vendidos</h4><div class="list">${products.map(([name,qty])=>`<div class="ticket-line"><span>${esc(name)}</span><strong>${qty}</strong></div>`).join("")}</div>`:""}<div class="toolbar" style="margin-top:16px"><button class="btn primary" onclick="shareDayReportPdf('${sh.id}')">Compartir PDF</button><button class="btn ghost" onclick="printDayReport('${sh.id}')">Imprimir</button><button class="btn" onclick="closeModal();screen='home';render()">Cerrar</button></div>`);};

