const DB_NAME = "mipuntocr";
const DB_VERSION = 3;

const STORES = [
  "products",
  "clients",
  "sales",
  "orders",
  "cashMoves",
  "cashSessions",
  "settings"
];

let db;
let currentScreen = "home";
let cart = [];
let orderDraft = [];
let publicCart = [];
let locked = false;
let currentRole = "owner";

const appState = {
  products: [],
  clients: [],
  sales: [],
  orders: [],
  cashMoves: [],
  cashSessions: [],

  settings: {
    id: "main",
    businessName: "Mi Punto CR",
    phone: "",
    whatsapp: "",
    sinpe: "",
    currency: "CRC",
    taxMode: "included",
    taxRate: 13,
    businessType: "food",
    pinEnabled: false,
    ownerPin: "",
    cashierPin: ""
  }
};


/* =========================================
   UTILIDADES
========================================= */

const money = value =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0
  }).format(Number(value || 0));


function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}


function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}


function escapeAttr(value = "") {
  return escapeHtml(value);
}


function encoded(value = "") {
  return encodeURIComponent(String(value))
    .replace(/'/g, "%27");
}


/* =========================================
   BASE DE DATOS LOCAL
========================================= */

function openDB() {
  return new Promise((resolve, reject) => {

    const request =
      indexedDB.open(
        DB_NAME,
        DB_VERSION
      );


    request.onupgradeneeded = () => {

      const database =
        request.result;


      STORES.forEach(storeName => {

        if (
          !database
            .objectStoreNames
            .contains(storeName)
        ) {

          database
            .createObjectStore(
              storeName,
              {
                keyPath: "id"
              }
            );
        }
      });
    };


    request.onsuccess = () =>
      resolve(request.result);


    request.onerror = () =>
      reject(request.error);
  });
}


function getStore(
  name,
  mode = "readonly"
) {

  return db
    .transaction(name, mode)
    .objectStore(name);
}


function idbPut(
  storeName,
  object
) {

  return new Promise(
    (resolve, reject) => {

      const request =
        getStore(
          storeName,
          "readwrite"
        ).put(object);


      request.onsuccess = () =>
        resolve(object);


      request.onerror = () =>
        reject(request.error);
    }
  );
}


function idbDelete(
  storeName,
  id
) {

  return new Promise(
    (resolve, reject) => {

      const request =
        getStore(
          storeName,
          "readwrite"
        ).delete(id);


      request.onsuccess = () =>
        resolve();


      request.onerror = () =>
        reject(request.error);
    }
  );
}


function idbAll(storeName) {

  return new Promise(
    (resolve, reject) => {

      const request =
        getStore(
          storeName
        ).getAll();


      request.onsuccess = () =>
        resolve(
          request.result || []
        );


      request.onerror = () =>
        reject(request.error);
    }
  );
}


/* =========================================
   CARGAR DATOS
========================================= */

async function loadAll() {

  appState.products =
    await idbAll("products");

  appState.clients =
    await idbAll("clients");

  appState.sales =
    await idbAll("sales");

  appState.orders =
    await idbAll("orders");

  appState.cashMoves =
    await idbAll("cashMoves");

  appState.cashSessions =
    await idbAll("cashSessions");


  const settings =
    await idbAll("settings");


  if (settings.length) {

    appState.settings = {
      ...appState.settings,
      ...settings[0]
    };
  }


  if (!appState.products.length) {

    const demo = [

      {
        id: uid("p"),
        name: "Casado",
        price: 2500,
        cost: 1500,
        category: "Comida",
        stock: 20,
        variants: []
      },

      {
        id: uid("p"),
        name: "Hamburguesa",
        price: 2800,
        cost: 1600,
        category: "Comida",
        stock: 15,
        variants: []
      },

      {
        id: uid("p"),
        name: "Café",
        price: 1200,
        cost: 400,
        category: "Bebidas",
        stock: 30,
        variants: []
      },

      {
        id: uid("p"),
        name: "Fresco",
        price: 1000,
        cost: 350,
        category: "Bebidas",
        stock: 25,
        variants: []
      }
    ];


    for (const product of demo) {

      await idbPut(
        "products",
        product
      );
    }


    appState.products =
      demo;
  }
}


/* =========================================
   TIPO DE NEGOCIO
========================================= */

function businessType() {

  const type =
    appState.settings
      .businessType ||
    "food";


  return [
    "food",
    "products",
    "services"
  ].includes(type)
    ? type
    : "food";
}


function isFood() {
  return businessType() === "food";
}


function isProducts() {
  return businessType() === "products";
}


function isServices() {
  return businessType() === "services";
}


/* =========================================
   CAJA ACTUAL
========================================= */

function currentShift() {

  return [
    ...appState.cashSessions
  ]
    .reverse()
    .find(
      session =>
        session.status ===
        "open"
    );
}


function canSell() {

  /*
    Comida necesita caja abierta.
    Productos y servicios NO.
  */

  return (
    !isFood() ||
    Boolean(currentShift())
  );
}


/* =========================================
   CABECERA
========================================= */

function connectionBadge() {

  if (navigator.onLine) {

    return `
      <span class="badge online">
        ● En línea
      </span>
    `;
  }


  return `
    <span class="badge offline">
      ● Sin conexión
    </span>
  `;
}


function navButton(
  screen,
  label,
  active
) {

  return `
    <button
      class="${
        active === screen
          ? "active"
          : ""
      }"

      onclick="
        go('${screen}')
      "
    >
      ${label}
    </button>
  `;
}


function shell(
  content,
  active = "home"
) {

  return `

    <main class="shell">

      <header class="topbar">

        <div class="brand">

          <h1>
            ${escapeHtml(
              appState.settings
                .businessName ||
              "Mi Punto CR"
            )}
          </h1>

          <p>
            Tu negocio, más simple
          </p>

        </div>


        <div class="status-row">
          ${connectionBadge()}
        </div>

      </header>


      ${
        !navigator.onLine

          ? `
            <div class="offline-note">

              Sin conexión.
              Tus datos siguen
              guardándose localmente.

            </div>
          `

          : ""
      }


      ${content}


    </main>


    <nav class="bottom-nav">

      ${navButton(
        "home",
        "Inicio",
        active
      )}


      ${navButton(
        "sale",
        isServices()
          ? "Servicio"
          : "Vender",
        active
      )}


      ${navButton(
        isFood()
          ? "orders"
          : "sales",

        isFood()
          ? "Pedidos"
          : "Mis ventas",

        active
      )}


      ${navButton(
        "more",
        "Más",
        active
      )}

    </nav>
  `;
}


function homeCard(
  screen,
  title,
  subtitle,
  primary = false,
  disabled = false
) {

  return `
    <button
      class="
        big-card
        ${primary ? "primary" : ""}
      "

      ${
        disabled
          ? "disabled"
          : `onclick="go('${screen}')"`
      }

      style="${
        disabled
          ? "opacity:.55;cursor:not-allowed"
          : ""
      }"
    >

      <span>

        <strong>
          ${title}
        </strong>

        <small>
          ${subtitle}
        </small>

      </span>


      <span class="card-arrow">
        ›
      </span>

    </button>
  `;
}


/* =========================================
   NAVEGACIÓN
========================================= */

function go(screen) {

  if (
    screen === "sale" &&
    !canSell()
  ) {

    toast(
      "Primero debes abrir la caja."
    );


    currentScreen =
      "cash";


    render();

    return;
  }


  currentScreen =
    screen;


  render();
}


window.go = go;


function render() {

  if (locked) {

    renderLock();

    return;
  }


  if (
    currentScreen === "home"
  ) {

    renderHome();
  }

  else if (
    currentScreen === "sale"
  ) {

    renderSale();
  }

  else if (
    currentScreen === "orders"
  ) {

    renderOrders();
  }

  else if (
    currentScreen === "products"
  ) {

    renderProducts();
  }

  else if (
    currentScreen === "clients"
  ) {

    renderClients();
  }

  else if (
    currentScreen === "cash"
  ) {

    renderCash();
  }

  else if (
    currentScreen === "catalog"
  ) {

    renderCatalog();
  }

  else if (
    currentScreen === "sales"
  ) {

    renderSalesHistory();
  }

  else if (
    currentScreen === "settings"
  ) {

    renderSettings();
  }

  else {

    renderMore();
  }
}


/* =========================================
   INICIO
========================================= */

function renderHome() {

  const today =
    new Date()
      .toDateString();


  const todaySales =
    appState.sales.filter(
      sale =>
        new Date(
          sale.createdAt
        ).toDateString() ===
        today
    );


  const totalToday =
    todaySales.reduce(
      (
        total,
        sale
      ) =>
        total +
        Number(
          sale.total || 0
        ),
      0
    );


  const pending =
    appState.clients.reduce(
      (
        total,
        client
      ) =>
        total +
        Number(
          client.balance || 0
        ),
      0
    );


  const shiftOpen =
    Boolean(
      currentShift()
    );


  let cards = "";


  /* COMIDA / SODA */

  if (isFood()) {

    cards = `

      ${homeCard(
        "sale",

        "Nueva venta",

        shiftOpen
          ? "Vende y cobra rápido"
          : "Abre caja para poder vender",

        true,

        !shiftOpen
      )}


      ${homeCard(
        "orders",
        "Pedidos",
        "Pendientes, preparando y listos"
      )}


      ${homeCard(
        "cash",
        shiftOpen
          ? "Caja abierta"
          : "Abrir caja",

        shiftOpen
          ? "Ventas, efectivo y cierre"
          : "Fondo inicial y apertura"
      )}


      ${homeCard(
        "products",
        "Productos",
        "Comidas, bebidas y stock"
      )}


      ${homeCard(
        "clients",
        "Clientes / Crédito",
        "Saldos y abonos"
      )}


      ${homeCard(
        "catalog",
        "Menú QR",
        "Comparte tu menú"
      )}
    `;
  }


  /* ARTÍCULOS */

  if (isProducts()) {

    cards = `

      ${homeCard(
        "sale",
        "Vender",
        "Selecciona artículos y genera comprobante",
        true
      )}


      ${homeCard(
        "products",
        "Productos",
        "Artículos, variantes y stock"
      )}


      ${homeCard(
        "catalog",
        "Catálogo QR",
        "Comparte tus productos"
      )}


      ${homeCard(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      )}


      ${homeCard(
        "clients",
        "Clientes / Crédito",
        "Saldos y abonos"
      )}
    `;
  }


  /* SERVICIOS */

  if (isServices()) {

    cards = `

      ${homeCard(
        "sale",
        "Nuevo servicio",
        "Selecciona servicio y genera comprobante",
        true
      )}


      ${homeCard(
        "products",
        "Servicios",
        "Precios y categorías"
      )}


      ${homeCard(
        "catalog",
        "Catálogo QR",
        "Comparte tus servicios"
      )}


      ${homeCard(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      )}


      ${homeCard(
        "clients",
        "Clientes",
        "Contactos y crédito si lo usas"
      )}
    `;
  }


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          ¿Qué necesitas hacer?
        </h2>

        <p>
          Solo mostramos lo que
          realmente sirve para
          tu negocio.
        </p>

      </section>


      <div class="kpi-grid">


        <button
          class="kpi"

          style="
            text-align:left;
            border:1px solid var(--line)
          "

          onclick="
            go('sales')
          "
        >

          <span class="muted">
            Ventas hoy
          </span>

          <strong>
            ${money(totalToday)}
          </strong>

        </button>


        <button
          class="kpi"

          style="
            text-align:left;
            border:1px solid var(--line)
          "

          onclick="
            go('clients')
          "
        >

          <span class="muted">
            Por cobrar
          </span>

          <strong>
            ${money(pending)}
          </strong>

        </button>


      </div>


      <div
        class="home-grid"
        style="margin-top:14px"
      >

        ${cards}


        ${
          currentRole === "owner"

            ? homeCard(
                "settings",
                "Configuración",
                "Datos básicos del negocio"
              )

            : ""
        }

      </div>

    `, "home");
}


/* =========================================
   IMPUESTOS
========================================= */

function calculateTotals(
  subtotal
) {

  const rate =
    Number(
      appState.settings
        .taxRate || 0
    );


  const mode =
    appState.settings
      .taxMode;


  let tax = 0;

  let total =
    subtotal;


  if (
    mode === "added"
  ) {

    tax =
      subtotal *
      (rate / 100);


    total =
      subtotal +
      tax;
  }


  if (
    mode === "included" &&
    rate > 0
  ) {

    tax =
      subtotal -
      subtotal /
      (
        1 +
        rate / 100
      );
  }


  if (
    mode === "exempt"
  ) {

    tax = 0;
  }


  return {
    subtotal,
    tax,
    total
  };
}


/* =========================================
   VENTA
========================================= */

function renderSale() {

  if (!canSell()) {

    currentScreen =
      "cash";

    renderCash();

    return;
  }


  const subtotal =
    cart.reduce(
      (
        total,
        item
      ) =>
        total +
        item.price *
        item.qty,
      0
    );


  const totals =
    calculateTotals(
      subtotal
    );


  const categories =
    [
      ...new Set(
        appState.products.map(
          product =>
            product.category
              ?.trim() ||
            "Otros"
        )
      )
    ];


  const categoriesHTML =
    categories
      .map(category => {

        const count =
          appState.products
            .filter(
              product =>
                (
                  product.category
                    ?.trim() ||
                  "Otros"
                ) === category
            )
            .length;


        return `

          <button
            class="category-card"

            onclick="
              openCategory(
                decodeURIComponent(
                  '${encoded(category)}'
                )
              )
            "
          >

            <span class="category-name">
              ${escapeHtml(category)}
            </span>


            <span class="category-count">

              ${count}

              ${
                count === 1

                  ? (
                      isServices()
                        ? "servicio"
                        : "producto"
                    )

                  : (
                      isServices()
                        ? "servicios"
                        : "productos"
                    )
              }

            </span>


            <span class="category-arrow">
              ›
            </span>

          </button>
        `;
      })
      .join("");


  const cartHTML =
    cart.length

      ? cart
          .map(
            item => `

              <div class="cart-item">

                <div>

                  <strong>
                    ${escapeHtml(
                      item.name
                    )}
                  </strong>


                  ${
                    item.variant

                      ? `
                        <div class="muted">
                          ${escapeHtml(
                            item.variant
                          )}
                        </div>
                      `

                      : ""
                  }


                  <div class="muted">

                    ${money(
                      item.price
                    )}
                    c/u

                  </div>

                </div>


                <div class="qty">

                  <button
                    onclick="
                      changeQty(
                        '${item.cartId}',
                        -1
                      )
                    "
                  >
                    −
                  </button>


                  <strong>
                    ${item.qty}
                  </strong>


                  <button
                    onclick="
                      changeQty(
                        '${item.cartId}',
                        1
                      )
                    "
                  >
                    +
                  </button>

                </div>

              </div>
            `
          )
          .join("")

      : `
        <div class="empty">
          Selecciona una categoría
          para comenzar.
        </div>
      `;


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>

          ${
            isServices()
              ? "Nuevo servicio"
              : "Nueva venta"
          }

        </h2>


        <p>
          Selecciona una categoría.
        </p>

      </section>


      <div class="sale-layout">


        <section class="panel">

          <input
            class="search"

            placeholder="
              Buscar categoría...
            "

            oninput="
              filterCategories(
                this.value
              )
            "
          >


          <div
            id="categoryGrid"
            class="category-grid"
          >

            ${
              categoriesHTML ||

              `
                <div class="empty">
                  No hay categorías todavía.
                </div>
              `
            }

          </div>

        </section>


        <section class="panel">

          <div class="row-head">

            <h3 style="margin:0">

              ${
                isServices()
                  ? "Servicio actual"
                  : "Venta actual"
              }

            </h3>


            <button
              class="btn ghost"
              onclick="clearCart()"
            >
              Vaciar
            </button>

          </div>


          <div class="cart-list">
            ${cartHTML}
          </div>


          ${
            appState.settings
              .taxMode !==
            "exempt"

              ? `

                <div class="divider">
                </div>


                <div class="ticket-line">

                  <span class="muted">
                    Impuesto
                  </span>

                  <span>
                    ${money(
                      totals.tax
                    )}
                  </span>

                </div>
              `

              : ""
          }


          <div class="total-box">

            <span>
              Total
            </span>

            <span>
              ${money(
                totals.total
              )}
            </span>

          </div>


          <div class="payment-grid">


            <button
              class="
                pay-btn
                pay-cash
              "

              onclick="
                pay('cash')
              "
            >
              Efectivo
            </button>


            <button
              class="
                pay-btn
                pay-sinpe
              "

              onclick="
                pay('sinpe')
              "
            >
              SINPE
            </button>


            <button
              class="
                pay-btn
                pay-card
              "

              onclick="
                pay('card')
              "
            >
              Tarjeta / Otro
            </button>


            <button
              class="
                pay-btn
                pay-credit
              "

              onclick="
                pay('credit')
              "
            >
              Crédito
            </button>


          </div>

        </section>

      </div>

    `, "sale");
}


/* =========================================
   ABRIR CATEGORÍA
========================================= */

window.openCategory =
category => {

  const products =
    appState.products.filter(
      product =>
        (
          product.category
            ?.trim() ||
          "Otros"
        ) ===
        category
    );


  modal(`

    <div class="
      category-modal-header
    ">

      <div>

        <h3>
          ${escapeHtml(category)}
        </h3>


        <p class="muted">

          Toca

          ${
            isServices()
              ? "un servicio"
              : "un producto"
          }

          para agregarlo.

        </p>

      </div>


      <button
        class="modal-close"
        onclick="closeModal()"
      >
        ×
      </button>

    </div>


    <div class="category-products">

      ${products
        .map(
          product => `

            <button
              class="category-product"

              onclick="
                addProductFromCategory(
                  '${product.id}'
                )
              "
            >

              <span>

                <strong>
                  ${escapeHtml(
                    product.name
                  )}
                </strong>


                ${
                  !isServices()

                    ? `
                      <small>
                        Stock:
                        ${Number(
                          product.stock ?? 0
                        )}
                      </small>
                    `

                    : ""
                }

              </span>


              <span class="
                category-product-price
              ">

                ${money(
                  product.price
                )}

              </span>

            </button>

          `
        )
        .join("")}

    </div>
  `);
};


window.addProductFromCategory =
id => {

  const product =
    appState.products.find(
      item =>
        item.id === id
    );


  if (!product) return;


  if (
    Array.isArray(
      product.variants
    ) &&
    product.variants.length
  ) {

    modal(`

      <h3>
        ${escapeHtml(
          product.name
        )}
      </h3>


      <p class="muted">
        Elige una opción.
      </p>


      <div class="variant-list">

        ${product.variants
          .map(
            variant => `

              <button
                class="category-product"

                onclick="
                  addVariantToCart(
                    '${product.id}',
                    decodeURIComponent(
                      '${encoded(variant)}'
                    )
                  )
                "
              >

                <strong>
                  ${escapeHtml(
                    variant
                  )}
                </strong>


                <span class="
                  category-product-price
                ">

                  ${money(
                    product.price
                  )}

                </span>

              </button>

            `
          )
          .join("")}

      </div>

    `);

    return;
  }


  addProductDirectly(
    product,
    ""
  );


  closeModal();

  renderSale();


  toast(
    `${product.name} agregado`
  );
};


window.addVariantToCart =
(
  productId,
  variant
) => {

  const product =
    appState.products.find(
      item =>
        item.id ===
        productId
    );


  if (!product) return;


  addProductDirectly(
    product,
    variant
  );


  closeModal();

  renderSale();


  toast(
    `${product.name} agregado`
  );
};


function addProductDirectly(
  product,
  variant = ""
) {

  const cartId =
    `${product.id}_${
      variant ||
      "normal"
    }`;


  const existing =
    cart.find(
      item =>
        item.cartId ===
        cartId
    );


  if (existing) {

    existing.qty += 1;

  } else {

    cart.push({

      ...product,

      cartId,

      variant,

      qty: 1
    });
  }
}


window.filterCategories =
value => {

  const search =
    value
      .toLowerCase()
      .trim();


  document
    .querySelectorAll(
      ".category-card"
    )
    .forEach(
      card => {

        card.style.display =
          card.innerText
            .toLowerCase()
            .includes(search)

            ? ""

            : "none";
      }
    );
};


window.changeQty =
(
  cartId,
  amount
) => {

  const item =
    cart.find(
      product =>
        product.cartId ===
        cartId
    );


  if (!item) return;


  item.qty += amount;


  if (
    item.qty <= 0
  ) {

    cart =
      cart.filter(
        product =>
          product.cartId !==
          cartId
      );
  }


  renderSale();
};


window.clearCart =
() => {

  cart = [];

  renderSale();
};


/* =========================================
   COBRO
========================================= */

window.pay =
method => {

  if (!cart.length) {

    toast(
      isServices()
        ? "Agrega al menos un servicio."
        : "Agrega al menos un producto."
    );

    return;
  }


  const subtotal =
    cart.reduce(
      (
        total,
        item
      ) =>
        total +
        item.price *
        item.qty,
      0
    );


  const totals =
    calculateTotals(
      subtotal
    );


  if (
    method === "cash"
  ) {

    showCashPayment(
      totals
    );
  }


  if (
    method === "sinpe"
  ) {

    showSinpePayment(
      totals
    );
  }


  if (
    method === "card"
  ) {

    showCardPayment(
      totals
    );
  }


  if (
    method === "credit"
  ) {

    showCreditPayment(
      totals
    );
  }
};


/* =========================================
   EFECTIVO
========================================= */

function showCashPayment(
  totals
) {

  modal(`

    <h3>
      Cobro en efectivo
    </h3>


    <p>

      Total:

      <strong>
        ${money(
          totals.total
        )}
      </strong>

    </p>


    <div class="field">

      <label>
        Recibido
      </label>


      <input
        id="cashReceived"
        type="number"
        inputmode="decimal"

        placeholder="
          Monto recibido
        "

        oninput="
          calculateChange(
            ${totals.total}
          )
        "
      >

    </div>


    <div
      class="panel"

      style="
        margin-top:10px;
        box-shadow:none;
        background:#edf9f4;
      "
    >

      Vuelto:

      <strong id="changeText">
        ${money(0)}
      </strong>

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          confirmCashPayment()
        "
      >
        Confirmar cobro
      </button>


      <button
        class="btn"

        onclick="
          closeModal()
        "
      >
        Cancelar
      </button>

    </div>
  `);
}


window.calculateChange =
total => {

  const received =
    Number(
      document
        .querySelector(
          "#cashReceived"
        )
        ?.value || 0
    );


  document
    .querySelector(
      "#changeText"
    )
    .textContent =
    money(
      Math.max(
        0,
        received -
        total
      )
    );
};


window.confirmCashPayment =
async () => {

  const received =
    Number(
      document
        .querySelector(
          "#cashReceived"
        )
        ?.value || 0
    );


  const subtotal =
    cart.reduce(
      (
        total,
        item
      ) =>
        total +
        item.price *
        item.qty,
      0
    );


  const totals =
    calculateTotals(
      subtotal
    );


  if (
    received <
    totals.total
  ) {

    toast(
      "El monto recibido es menor al total."
    );

    return;
  }


  await saveSale(
    "Efectivo",
    "",
    "",
    received
  );
};


/* =========================================
   SINPE
========================================= */

function showSinpePayment(
  totals
) {

  modal(`

    <h3>
      Cobro por SINPE
    </h3>


    <p>

      Total:

      <strong>
        ${money(
          totals.total
        )}
      </strong>

    </p>


    <div
      class="panel"

      style="
        box-shadow:none;
        background:#eef5ff;
      "
    >

      ${
        appState.settings
          .sinpe

          ? `
            Número SINPE:

            <strong>
              ${escapeHtml(
                appState.settings
                  .sinpe
              )}
            </strong>
          `

          : `
            Configura tu número
            SINPE en Configuración.
          `
      }

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          finishSale('SINPE')
        "
      >
        Confirmar pago
      </button>


      <button
        class="btn"

        onclick="
          closeModal()
        "
      >
        Cancelar
      </button>

    </div>
  `);
}


/* =========================================
   TARJETA
========================================= */

function showCardPayment(
  totals
) {

  modal(`

    <h3>
      Tarjeta / Otro
    </h3>


    <p>

      Total:

      <strong>
        ${money(
          totals.total
        )}
      </strong>

    </p>


    <div class="field">

      <label>
        Referencia o voucher
        (opcional)
      </label>


      <input
        id="paymentReference"
        placeholder="Ej. 45821"
      >

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          finishSale(
            'Tarjeta/Otro',
            document
              .querySelector(
                '#paymentReference'
              )
              .value
          )
        "
      >
        Confirmar pago
      </button>


      <button
        class="btn"

        onclick="
          closeModal()
        "
      >
        Cancelar
      </button>

    </div>
  `);
}


/* =========================================
   CRÉDITO
========================================= */

function showCreditPayment(
  totals
) {

  const options =
    appState.clients
      .map(
        client => `

          <option
            value="${client.id}"
          >
            ${escapeHtml(
              client.name
            )}
          </option>

        `
      )
      .join("");


  modal(`

    <h3>
      Venta a crédito
    </h3>


    <p>

      Total:

      <strong>
        ${money(
          totals.total
        )}
      </strong>

    </p>


    <div class="field">

      <label>
        Cliente
      </label>


      <select id="creditClient">

        <option value="">
          Selecciona cliente
        </option>

        ${options}

      </select>

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          finishCreditSale()
        "
      >
        Guardar crédito
      </button>


      <button
        class="btn"

        onclick="
          closeModal()
        "
      >
        Cancelar
      </button>

    </div>
  `);
}


window.finishCreditSale =
async () => {

  const clientId =
    document
      .querySelector(
        "#creditClient"
      )
      .value;


  if (!clientId) {

    toast(
      "Selecciona un cliente."
    );

    return;
  }


  const subtotal =
    cart.reduce(
      (
        total,
        item
      ) =>
        total +
        item.price *
        item.qty,
      0
    );


  const totals =
    calculateTotals(
      subtotal
    );


  const client =
    appState.clients.find(
      item =>
        item.id ===
        clientId
    );


  client.balance =
    Number(
      client.balance || 0
    ) +
    totals.total;


  await idbPut(
    "clients",
    client
  );


  await saveSale(
    "Crédito",
    "",
    clientId
  );
};


window.finishSale =
async (
  method,
  reference = ""
) => {

  await saveSale(
    method,
    reference
  );
};


/* =========================================
   GUARDAR VENTA
========================================= */

async function saveSale(
  method,
  reference = "",
  clientId = "",
  received = null
) {

  const subtotal =
    cart.reduce(
      (
        total,
        item
      ) =>
        total +
        item.price *
        item.qty,
      0
    );


  const totals =
    calculateTotals(
      subtotal
    );


  const shift =
    currentShift();


  const sale = {

    id:
      uid("sale"),

    number:
      appState.sales.length +
      1,

    createdAt:
      new Date()
        .toISOString(),

    businessType:
      businessType(),

    shiftId:
      shift?.id ||
      null,

    items:
      cart.map(
        item => ({

          id:
            item.id,

          name:
            item.name,

          variant:
            item.variant ||
            "",

          price:
            item.price,

          qty:
            item.qty
        })
      ),

    subtotal:
      totals.subtotal,

    tax:
      totals.tax,

    total:
      totals.total,

    method,

    reference,

    clientId,

    received,

    change:
      received === null

        ? 0

        : Math.max(
            0,
            received -
            totals.total
          )
  };


  await idbPut(
    "sales",
    sale
  );


  appState.sales.push(
    sale
  );


  /*
    Servicios no descuentan stock.
  */

  if (!isServices()) {

    for (
      const item of cart
    ) {

      const product =
        appState.products.find(
          product =>
            product.id ===
            item.id
        );


      if (!product) continue;


      product.stock =
        Math.max(
          0,
          Number(
            product.stock || 0
          ) -
          item.qty
        );


      await idbPut(
        "products",
        product
      );
    }
  }


  cart = [];


  closeModal();


  showTicket(
    sale
  );
}


/* =========================================
   COMPROBANTE
========================================= */

function showTicket(
  sale
) {

  modal(`

    <div class="ticket">


      <div class="ticket-business">

        <h3>

          ${escapeHtml(
            appState.settings
              .businessName
          )}

        </h3>


        <div class="muted">

          Comprobante
          #${sale.number}

        </div>


        <div class="muted">

          ${new Date(
            sale.createdAt
          ).toLocaleString(
            "es-CR"
          )}

        </div>

      </div>


      <div class="divider">
      </div>


      ${sale.items
        .map(
          item => `

            <div class="ticket-line">

              <span>

                ${item.qty}
                ×
                ${escapeHtml(
                  item.name
                )}

                ${
                  item.variant

                    ? `
                      (${escapeHtml(
                        item.variant
                      )})
                    `

                    : ""
                }

              </span>


              <span>

                ${money(
                  item.price *
                  item.qty
                )}

              </span>

            </div>

          `
        )
        .join("")}


      <div class="divider">
      </div>


      ${
        sale.tax > 0

          ? `
            <div class="ticket-line">

              <span>
                Impuesto
              </span>

              <span>
                ${money(
                  sale.tax
                )}
              </span>

            </div>
          `

          : ""
      }


      <div
        class="
          ticket-line
          ticket-total
        "
      >

        <span>
          Total
        </span>

        <span>
          ${money(
            sale.total
          )}
        </span>

      </div>


      <div class="ticket-line">

        <span>
          Pago
        </span>

        <span>
          ${escapeHtml(
            sale.method
          )}
        </span>

      </div>


      ${
        sale.change > 0

          ? `
            <div class="ticket-line">

              <span>
                Vuelto
              </span>

              <span>
                ${money(
                  sale.change
                )}
              </span>

            </div>
          `

          : ""
      }


      <div class="divider">
      </div>


      <div class="toolbar">

        <button
          class="btn primary"

          onclick="
            shareReceipt(
              '${sale.id}'
            )
          "
        >
          Compartir PDF
        </button>


        <button
          class="btn ghost"

          onclick="
            closeModal();
            go('sale');
          "
        >
          Nueva venta
        </button>


        <button
          class="btn"

          onclick="
            closeModal();
            go('home');
          "
        >
          Inicio
        </button>

      </div>

    </div>
  `);
}


function receiptText(
  sale
) {

  const lines = [

    appState.settings
      .businessName,

    `Comprobante #${sale.number}`,

    new Date(
      sale.createdAt
    ).toLocaleString(
      "es-CR"
    ),

    ""
  ];


  sale.items.forEach(
    item => {

      lines.push(

        `${item.qty} x ${item.name}${
          item.variant
            ? ` (${item.variant})`
            : ""
        } - ${money(
          item.price *
          item.qty
        )}`
      );
    }
  );


  lines.push("");


  if (
    sale.tax > 0
  ) {

    lines.push(
      `Impuesto: ${money(
        sale.tax
      )}`
    );
  }


  lines.push(
    `TOTAL: ${money(
      sale.total
    )}`
  );


  lines.push(
    `Pago: ${sale.method}`
  );


  if (
    sale.change > 0
  ) {

    lines.push(
      `Vuelto: ${money(
        sale.change
      )}`
    );
  }


  lines.push("");

  lines.push(
    "Gracias por su compra."
  );


  return lines.join("\n");
}


/* =========================================
   PDF
========================================= */

async function ensureJsPdf() {

  if (
    window.jspdf?.jsPDF
  ) {

    return window.jspdf
      .jsPDF;
  }


  await new Promise(
    (resolve, reject) => {

      const existing =
        document.querySelector(
          'script[data-jspdf="true"]'
        );


      if (existing) {

        existing
          .addEventListener(
            "load",
            resolve,
            {
              once: true
            }
          );


        existing
          .addEventListener(
            "error",
            reject,
            {
              once: true
            }
          );


        return;
      }


      const script =
        document.createElement(
          "script"
        );


      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";


      script.async =
        true;


      script.dataset.jspdf =
        "true";


      script.onload =
        resolve;


      script.onerror =
        reject;


      document.head
        .appendChild(
          script
        );
    }
  );


  return window.jspdf
    .jsPDF;
}


async function buildReceiptPdf(
  sale
) {

  const jsPDF =
    await ensureJsPdf();


  const doc =
    new jsPDF({
      unit: "mm",
      format: "a4"
    });


  let y = 18;


  doc.setFont(
    "helvetica",
    "bold"
  );


  doc.setFontSize(16);


  doc.text(
    appState.settings
      .businessName ||
    "Mi Punto CR",

    15,
    y
  );


  y += 8;


  doc.setFont(
    "helvetica",
    "normal"
  );


  doc.setFontSize(10);


  doc.text(
    `Comprobante #${sale.number}`,
    15,
    y
  );


  y += 5;


  doc.text(
    new Date(
      sale.createdAt
    ).toLocaleString(
      "es-CR"
    ),

    15,
    y
  );


  if (
    appState.settings
      .phone
  ) {

    y += 5;


    doc.text(
      `Tel: ${
        appState.settings
          .phone
      }`,

      15,
      y
    );
  }


  y += 9;


  doc.line(
    15,
    y,
    195,
    y
  );


  y += 7;


  sale.items.forEach(
    item => {

      const label =
        `${item.qty} x ${item.name}${
          item.variant
            ? ` (${item.variant})`
            : ""
        }`;


      doc.text(
        label.slice(
          0,
          70
        ),

        15,
        y
      );


      doc.text(
        money(
          item.price *
          item.qty
        ),

        195,
        y,

        {
          align: "right"
        }
      );


      y += 6;
    }
  );


  y += 2;


  doc.line(
    15,
    y,
    195,
    y
  );


  y += 7;


  if (
    sale.tax > 0
  ) {

    doc.text(
      "Impuesto",
      15,
      y
    );


    doc.text(
      money(
        sale.tax
      ),

      195,
      y,

      {
        align: "right"
      }
    );


    y += 6;
  }


  doc.setFont(
    "helvetica",
    "bold"
  );


  doc.setFontSize(13);


  doc.text(
    "TOTAL",
    15,
    y
  );


  doc.text(
    money(
      sale.total
    ),

    195,
    y,

    {
      align: "right"
    }
  );


  y += 8;


  doc.setFont(
    "helvetica",
    "normal"
  );


  doc.setFontSize(10);


  doc.text(
    `Pago: ${
      sale.method
    }`,

    15,
    y
  );


  if (
    sale.change > 0
  ) {

    y += 5;


    doc.text(
      `Vuelto: ${
        money(
          sale.change
        )
      }`,

      15,
      y
    );
  }


  y += 10;


  doc.text(
    "Gracias por su compra.",
    15,
    y
  );


  return doc.output(
    "blob"
  );
}


window.shareReceipt =
async saleId => {

  const sale =
    appState.sales.find(
      item =>
        item.id ===
        saleId
    );


  if (!sale) return;


  try {

    const blob =
      await buildReceiptPdf(
        sale
      );


    const file =
      new File(
        [blob],

        `comprobante-${sale.number}.pdf`,

        {
          type:
            "application/pdf"
        }
      );


    if (
      navigator.share &&
      navigator.canShare?.({
        files: [file]
      })
    ) {

      await navigator.share({

        title:
          `Comprobante #${sale.number}`,

        text:
          `${appState.settings.businessName} - Comprobante #${sale.number}`,

        files:
          [file]
      });


      return;
    }


    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    link.download =
      file.name;


    document.body
      .appendChild(
        link
      );


    link.click();

    link.remove();


    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      3000
    );


    toast(
      "PDF generado."
    );

  } catch (error) {

    console.error(error);


    window.open(

      `https://wa.me/?text=${
        encodeURIComponent(
          receiptText(sale)
        )
      }`,

      "_blank"
    );


    toast(
      "Se abrió el comprobante en texto."
    );
  }
};


/* =========================================
   HISTORIAL DE VENTAS
========================================= */

function renderSalesHistory() {

  const sorted =
    [...appState.sales]
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            b.createdAt
          ) -
          new Date(
            a.createdAt
          )
      );


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          Mis ventas
        </h2>

        <p>
          Comprobantes generados.
        </p>

      </section>


      <div class="toolbar">

        <button
          class="btn ghost"
          onclick="
            filterSales('today')
          "
        >
          Hoy
        </button>


        <button
          class="btn ghost"
          onclick="
            filterSales('yesterday')
          "
        >
          Ayer
        </button>


        <button
          class="btn ghost"
          onclick="
            filterSales('week')
          "
        >
          Esta semana
        </button>


        <button
          class="btn ghost"
          onclick="
            filterSales('all')
          "
        >
          Todas
        </button>

      </div>


      <div
        id="salesList"
        class="list"
      >

        ${salesListHTML(
          sorted
        )}

      </div>

    `,
    isFood()
      ? "more"
      : "sales"
    );
}


function salesListHTML(
  sales
) {

  if (!sales.length) {

    return `
      <div class="empty">
        No hay ventas
        en este período.
      </div>
    `;
  }


  return sales
    .map(
      sale => `

        <button
          class="row-card"

          style="
            width:100%;
            text-align:left
          "

          onclick="
            openSale(
              '${sale.id}'
            )
          "
        >

          <div class="row-head">

            <div>

              <strong>
                Comprobante
                #${sale.number}
              </strong>

              <div class="muted">

                ${new Date(
                  sale.createdAt
                ).toLocaleString(
                  "es-CR"
                )}

              </div>

            </div>


            <strong>
              ${money(
                sale.total
              )}
            </strong>

          </div>


          <div
            class="muted"
            style="margin-top:7px"
          >

            ${escapeHtml(
              sale.method
            )}

          </div>

        </button>

      `
    )
    .join("");
}


window.filterSales =
mode => {

  const now =
    new Date();


  const todayStart =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );


  const yesterdayStart =
    new Date(
      todayStart
    );


  yesterdayStart.setDate(
    yesterdayStart.getDate() -
    1
  );


  const weekStart =
    new Date(
      todayStart
    );


  const day =
    weekStart.getDay() ||
    7;


  weekStart.setDate(
    weekStart.getDate() -
    day +
    1
  );


  let sales =
    [...appState.sales];


  if (
    mode === "today"
  ) {

    sales =
      sales.filter(
        sale =>
          new Date(
            sale.createdAt
          ) >=
          todayStart
      );
  }


  if (
    mode === "yesterday"
  ) {

    sales =
      sales.filter(
        sale => {

          const date =
            new Date(
              sale.createdAt
            );


          return (
            date >=
            yesterdayStart &&
            date <
            todayStart
          );
        }
      );
  }


  if (
    mode === "week"
  ) {

    sales =
      sales.filter(
        sale =>
          new Date(
            sale.createdAt
          ) >=
          weekStart
      );
  }


  sales.sort(
    (
      a,
      b
    ) =>
      new Date(
        b.createdAt
      ) -
      new Date(
        a.createdAt
      )
  );


  document
    .querySelector(
      "#salesList"
    )
    .innerHTML =
    salesListHTML(
      sales
    );
};


window.openSale =
saleId => {

  const sale =
    appState.sales.find(
      item =>
        item.id ===
        saleId
    );


  if (sale) {

    showTicket(
      sale
    );
  }
};


/* =========================================
   PEDIDOS COMIDA
========================================= */

function renderOrders() {

  const html =
    appState.orders.length

      ? [...appState.orders]
          .reverse()
          .map(
            order => `

              <div class="row-card">

                <div class="row-head">

                  <strong>
                    Pedido
                    #${order.number}
                  </strong>

                  <span class="badge">
                    ${escapeHtml(
                      order.status
                    )}
                  </span>

                </div>


                ${
                  order.customer

                    ? `
                      <div class="muted">
                        ${escapeHtml(
                          order.customer
                        )}
                      </div>
                    `

                    : ""
                }


                <div
                  style="margin-top:10px"
                >

                  ${(order.items || [])
                    .map(
                      item => `

                        <div class="ticket-line">

                          <span>

                            ${item.qty}
                            ×
                            ${escapeHtml(
                              item.name
                            )}

                          </span>


                          <span>

                            ${money(
                              item.price *
                              item.qty
                            )}

                          </span>

                        </div>

                      `
                    )
                    .join("")}

                </div>


                ${
                  order.notes

                    ? `
                      <div
                        class="muted"
                        style="margin-top:8px"
                      >

                        ${escapeHtml(
                          order.notes
                        )}

                      </div>
                    `

                    : ""
                }


                <div
                  class="toolbar"
                  style="
                    margin-top:12px;
                    margin-bottom:0
                  "
                >

                  ${
                    order.status ===
                    "Pendiente"

                      ? `
                        <button
                          class="btn primary"

                          onclick="
                            setOrderStatus(
                              '${order.id}',
                              'Preparando'
                            )
                          "
                        >
                          Preparando
                        </button>
                      `

                      : ""
                  }


                  ${
                    order.status ===
                    "Preparando"

                      ? `
                        <button
                          class="btn primary"

                          onclick="
                            setOrderStatus(
                              '${order.id}',
                              'Listo'
                            )
                          "
                        >
                          Listo
                        </button>
                      `

                      : ""
                  }


                  ${
                    order.status ===
                    "Listo"

                      ? `
                        <button
                          class="btn primary"

                          onclick="
                            setOrderStatus(
                              '${order.id}',
                              'Entregado'
                            )
                          "
                        >
                          Entregado
                        </button>
                      `

                      : ""
                  }

                </div>

              </div>

            `
          )
          .join("")

      : `
        <div class="empty">
          No hay pedidos.
        </div>
      `;


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          Pedidos
        </h2>

        <p>
          Pendiente →
          preparando →
          listo →
          entregado.
        </p>

      </section>


      <div class="toolbar">

        <button
          class="btn primary"
          onclick="newOrder()"
        >
          Nuevo pedido
        </button>

      </div>


      <div class="list">
        ${html}
      </div>

    `, "orders");
}


window.newOrder =
() => {

  orderDraft = [];


  modal(`

    <h3>
      Nuevo pedido
    </h3>


    <div class="field">

      <label>
        Cliente opcional
      </label>

      <input
        id="orderCustomer"
        placeholder="Nombre"
      >

    </div>


    <p class="muted">
      Toca productos
      para agregarlos.
    </p>


    <div class="
      order-builder-products
    ">

      ${appState.products
        .map(
          product => `

            <button
              onclick="
                addOrderProduct(
                  '${product.id}'
                )
              "
            >

              <strong>
                ${escapeHtml(
                  product.name
                )}
              </strong>

              <br>

              <span class="muted">
                ${money(
                  product.price
                )}
              </span>

            </button>

          `
        )
        .join("")}

    </div>


    <div class="divider">
    </div>


    <div id="orderDraftView">
    </div>


    <div class="field">

      <label>
        Notas
      </label>

      <textarea
        id="orderNotes"
        rows="3"

        placeholder="
          Ej. sin cebolla,
          para llevar...
        "
      ></textarea>

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"
        onclick="saveOrder()"
      >
        Guardar pedido
      </button>


      <button
        class="btn"
        onclick="closeModal()"
      >
        Cancelar
      </button>

    </div>
  `);


  renderOrderDraft();
};


window.addOrderProduct =
id => {

  const product =
    appState.products.find(
      item =>
        item.id === id
    );


  if (!product) return;


  const existing =
    orderDraft.find(
      item =>
        item.id === id
    );


  if (existing) {

    existing.qty += 1;

  } else {

    orderDraft.push({

      id:
        product.id,

      name:
        product.name,

      price:
        product.price,

      qty: 1
    });
  }


  renderOrderDraft();
};


function renderOrderDraft() {

  const container =
    document
      .querySelector(
        "#orderDraftView"
      );


  if (!container) return;


  container.innerHTML =

    orderDraft.length

      ? orderDraft
          .map(
            item => `

              <div class="ticket-line">

                <span>

                  ${item.qty}
                  ×
                  ${escapeHtml(
                    item.name
                  )}

                </span>

                <span>

                  ${money(
                    item.price *
                    item.qty
                  )}

                </span>

              </div>

            `
          )
          .join("")

      : `
        <div class="empty">
          Aún no agregaste
          productos.
        </div>
      `;
}


window.saveOrder =
async () => {

  if (!orderDraft.length) {

    toast(
      "Agrega al menos un producto."
    );

    return;
  }


  const order = {

    id:
      uid("order"),

    number:
      appState.orders.length +
      1,

    customer:
      document
        .querySelector(
          "#orderCustomer"
        )
        .value
        .trim(),

    notes:
      document
        .querySelector(
          "#orderNotes"
        )
        .value
        .trim(),

    items:
      [...orderDraft],

    status:
      "Pendiente",

    source:
      "Manual",

    createdAt:
      new Date()
        .toISOString()
  };


  await idbPut(
    "orders",
    order
  );


  appState.orders.push(
    order
  );


  orderDraft = [];


  closeModal();

  renderOrders();


  toast(
    "Pedido guardado."
  );
};


window.setOrderStatus =
async (
  id,
  status
) => {

  const order =
    appState.orders.find(
      item =>
        item.id === id
    );


  if (!order) return;


  order.status =
    status;


  await idbPut(
    "orders",
    order
  );


  renderOrders();
};


/* =========================================
   PRODUCTOS / SERVICIOS
========================================= */

function renderProducts() {

  const label =
    isServices()
      ? "Servicios"
      : "Productos";


  const singular =
    isServices()
      ? "servicio"
      : "producto";


  const html =
    appState.products.length

      ? appState.products
          .map(
            product => `

              <div class="row-card">

                <div class="row-head">

                  <div>

                    <strong>
                      ${escapeHtml(
                        product.name
                      )}
                    </strong>


                    <div class="muted">

                      ${escapeHtml(
                        product.category ||
                        "Sin categoría"
                      )}

                    </div>


                    ${
                      !isServices()

                        ? `
                          <div class="muted">
                            Stock:
                            ${Number(
                              product.stock || 0
                            )}
                          </div>
                        `

                        : ""
                    }


                    ${
                      product.variants
                        ?.length

                        ? `
                          <div class="muted">

                            ${product.variants
                              .map(
                                escapeHtml
                              )
                              .join(" · ")}

                          </div>
                        `

                        : ""
                    }

                  </div>


                  <strong>

                    ${money(
                      product.price
                    )}

                  </strong>

                </div>


                <div
                  class="toolbar"

                  style="
                    margin-top:12px;
                    margin-bottom:0
                  "
                >

                  <button
                    class="btn ghost"

                    onclick="
                      productForm(
                        '${product.id}'
                      )
                    "
                  >
                    Editar
                  </button>


                  ${
                    currentRole ===
                    "owner"

                      ? `
                        <button
                          class="
                            btn
                            danger
                          "

                          onclick="
                            confirmDeleteProduct(
                              '${product.id}'
                            )
                          "
                        >
                          Eliminar
                        </button>
                      `

                      : ""
                  }

                </div>

              </div>

            `
          )
          .join("")

      : `
        <div class="empty">

          No hay
          ${label.toLowerCase()}.

        </div>
      `;


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          ${label}
        </h2>


        <p>

          Agrega, edita o elimina
          ${label.toLowerCase()}.

        </p>

      </section>


      <div class="toolbar">

        <button
          class="btn primary"

          onclick="
            productForm()
          "
        >

          Nuevo
          ${singular}

        </button>

      </div>


      <div class="list">
        ${html}
      </div>

    `, "more");
}


window.productForm =
id => {

  const product =
    id

      ? appState.products.find(
          item =>
            item.id === id
        )

      : null;


  const singular =
    isServices()
      ? "servicio"
      : "producto";


  modal(`

    <h3>

      ${
        product
          ? `Editar ${singular}`
          : `Nuevo ${singular}`
      }

    </h3>


    <div class="form-grid">


      <div class="field">

        <label>
          Nombre
        </label>

        <input
          id="pName"

          value="${escapeAttr(
            product?.name || ""
          )}"
        >

      </div>


      <div class="field">

        <label>
          Precio
        </label>

        <input
          id="pPrice"
          type="number"
          inputmode="decimal"

          value="${Number(
            product?.price || 0
          )}"
        >

      </div>


      ${
        !isServices()

          ? `

            <div class="field">

              <label>
                Costo opcional
              </label>

              <input
                id="pCost"
                type="number"
                inputmode="decimal"

                value="${Number(
                  product?.cost || 0
                )}"
              >

            </div>

          `

          : `
            <input
              id="pCost"
              type="hidden"
              value="0"
            >
          `
      }


      <div class="field">

        <label>
          Categoría
        </label>

        <input
          id="pCategory"

          value="${escapeAttr(
            product?.category || ""
          )}"

          placeholder="${
            isServices()
              ? "Ej. Belleza"
              : "Ej. Bebidas"
          }"
        >

      </div>


      ${
        !isServices()

          ? `

            <div class="field">

              <label>
                Stock
              </label>

              <input
                id="pStock"
                type="number"
                inputmode="numeric"

                value="${Number(
                  product?.stock || 0
                )}"
              >

            </div>


            <div class="field">

              <label>
                Variantes opcionales
              </label>

              <input
                id="pVariants"

                value="${escapeAttr(
                  product?.variants
                    ?.join(", ") ||
                  ""
                )}"

                placeholder="
                  Ej. M, L, XL
                  o 50ml, 100ml
                "
              >

            </div>

          `

          : `

            <input
              id="pStock"
              type="hidden"
              value="0"
            >


            <input
              id="pVariants"
              type="hidden"
              value=""
            >

          `
      }

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          saveProduct(
            '${product?.id || ""}'
          )
        "
      >
        Guardar
      </button>


      <button
        class="btn"

        onclick="
          closeModal()
        "
      >
        Cancelar
      </button>

    </div>
  `);
};


window.saveProduct =
async id => {

  const name =
    document
      .querySelector(
        "#pName"
      )
      .value
      .trim();


  const price =
    Number(
      document
        .querySelector(
          "#pPrice"
        )
        .value || 0
    );


  if (
    !name ||
    price <= 0
  ) {

    toast(
      "Nombre y precio son obligatorios."
    );

    return;
  }


  const variants =
    document
      .querySelector(
        "#pVariants"
      )
      .value
      .split(",")
      .map(
        item =>
          item.trim()
      )
      .filter(Boolean);


  let product =
    id

      ? appState.products.find(
          item =>
            item.id === id
        )

      : null;


  if (!product) {

    product = {
      id:
        uid("p")
    };


    appState.products
      .push(
        product
      );
  }


  product.name =
    name;


  product.price =
    price;


  product.cost =
    Number(
      document
        .querySelector(
          "#pCost"
        )
        .value || 0
    );


  product.category =
    document
      .querySelector(
        "#pCategory"
      )
      .value
      .trim() ||
    "Otros";


  product.stock =
    Number(
      document
        .querySelector(
          "#pStock"
        )
        .value || 0
    );


  product.variants =
    variants;


  await idbPut(
    "products",
    product
  );


  closeModal();

  renderProducts();


  toast(
    isServices()
      ? "Servicio guardado."
      : "Producto guardado."
  );
};


window.confirmDeleteProduct =
id => {

  const product =
    appState.products.find(
      item =>
        item.id === id
    );


  if (!product) return;


  modal(`

    <h3>

      Eliminar
      ${
        isServices()
          ? "servicio"
          : "producto"
      }

    </h3>


    <p>

      ¿Quieres eliminar

      <strong>
        ${escapeHtml(
          product.name
        )}
      </strong>

      ?

    </p>


    <p class="muted">

      Las ventas anteriores
      no se borrarán.

    </p>


    <div
      class="toolbar"
      style="margin-top:16px"
    >

      <button
        class="btn danger"

        onclick="
          deleteProduct(
            '${id}'
          )
        "
      >
        Sí, eliminar
      </button>


      <button
        class="btn"

        onclick="
          closeModal()
        "
      >
        Cancelar
      </button>

    </div>
  `);
};


window.deleteProduct =
async id => {

  await idbDelete(
    "products",
    id
  );


  appState.products =
    appState.products.filter(
      product =>
        product.id !== id
    );


  cart =
    cart.filter(
      item =>
        item.id !== id
    );


  closeModal();

  renderProducts();


  toast(
    isServices()
      ? "Servicio eliminado."
      : "Producto eliminado."
  );
};


/* =========================================
   CLIENTES / CRÉDITO
========================================= */

function renderClients() {

  const html =
    appState.clients.length

      ? appState.clients
          .map(
            client => `

              <div class="row-card">

                <div class="row-head">

                  <div>

                    <strong>
                      ${escapeHtml(
                        client.name
                      )}
                    </strong>


                    <div class="muted">

                      ${escapeHtml(
                        client.phone ||
                        "Sin teléfono"
                      )}

                    </div>

                  </div>


                  <strong>

                    ${money(
                      client.balance || 0
                    )}

                  </strong>

                </div>


                ${
                  Number(
                    client.balance || 0
                  ) > 0

                    ? `

                      <div
                        class="toolbar"

                        style="
                          margin-top:12px;
                          margin-bottom:0
                        "
                      >

                        <button
                          class="btn ghost"

                          onclick="
                            registerPayment(
                              '${client.id}'
                            )
                          "
                        >
                          Registrar abono
                        </button>


                        <button
                          class="btn ghost"

                          onclick="
                            remindClient(
                              '${client.id}'
                            )
                          "
                        >
                          WhatsApp
                        </button>

                      </div>

                    `

                    : ""
                }

              </div>

            `
          )
          .join("")

      : `
        <div class="empty">
          No hay clientes.
        </div>
      `;


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>

          ${
            isServices()
              ? "Clientes"
              : "Clientes / Crédito"
          }

        </h2>


        <p>
          Contactos,
          saldos y abonos.
        </p>

      </section>


      <div class="toolbar">

        <button
          class="btn primary"
          onclick="newClient()"
        >
          Nuevo cliente
        </button>

      </div>


      <div class="list">
        ${html}
      </div>

    `, "more");
}


window.newClient =
() => {

  modal(`

    <h3>
      Nuevo cliente
    </h3>


    <div class="form-grid">

      <div class="field">

        <label>
          Nombre
        </label>

        <input id="clientName">

      </div>


      <div class="field">

        <label>
          Teléfono / WhatsApp
        </label>

        <input
          id="clientPhone"
          inputmode="tel"
        >

      </div>


      <div class="field">

        <label>
          Notas
        </label>

        <textarea
          id="clientNotes"
          rows="3"
        ></textarea>

      </div>

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"
        onclick="saveClient()"
      >
        Guardar
      </button>


      <button
        class="btn"
        onclick="closeModal()"
      >
        Cancelar
      </button>

    </div>
  `);
};


window.saveClient =
async () => {

  const name =
    document
      .querySelector(
        "#clientName"
      )
      .value
      .trim();


  if (!name) {

    toast(
      "Escribe el nombre."
    );

    return;
  }


  const client = {

    id:
      uid("client"),

    name,

    phone:
      document
        .querySelector(
          "#clientPhone"
        )
        .value
        .trim(),

    notes:
      document
        .querySelector(
          "#clientNotes"
        )
        .value
        .trim(),

    balance: 0
  };


  await idbPut(
    "clients",
    client
  );


  appState.clients.push(
    client
  );


  closeModal();

  renderClients();


  toast(
    "Cliente guardado."
  );
};


window.registerPayment =
id => {

  const client =
    appState.clients.find(
      item =>
        item.id === id
    );


  if (!client) return;


  modal(`

    <h3>
      Registrar abono
    </h3>


    <p>
      ${escapeHtml(
        client.name
      )}
    </p>


    <p>

      Saldo:

      <strong>
        ${money(
          client.balance
        )}
      </strong>

    </p>


    <div class="field">

      <label>
        Monto
      </label>

      <input
        id="paymentAmount"
        type="number"
        inputmode="decimal"
      >

    </div>


    <div class="field">

      <label>
        Método de pago
      </label>


      <select
        id="paymentMethod"
      >

        <option value="Efectivo">
          Efectivo
        </option>

        <option value="SINPE">
          SINPE
        </option>

        <option value="Tarjeta/Otro">
          Tarjeta / Otro
        </option>

      </select>

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          saveClientPayment(
            '${id}'
          )
        "
      >
        Guardar abono
      </button>


      <button
        class="btn"
        onclick="closeModal()"
      >
        Cancelar
      </button>

    </div>
  `);
};


window.saveClientPayment =
async id => {

  const client =
    appState.clients.find(
      item =>
        item.id === id
    );


  const amount =
    Number(
      document
        .querySelector(
          "#paymentAmount"
        )
        .value || 0
    );


  const method =
    document
      .querySelector(
        "#paymentMethod"
      )
      .value;


  if (
    !client ||
    amount <= 0
  ) {

    return;
  }


  client.balance =
    Math.max(
      0,
      Number(
        client.balance || 0
      ) -
      amount
    );


  await idbPut(
    "clients",
    client
  );


  /*
    En comida, si hay caja,
    el abono queda ligado
    al turno.
  */

  if (
    isFood() &&
    currentShift()
  ) {

    const move = {

      id:
        uid("move"),

      type:
        "creditPayment",

      amount,

      method,

      note:
        `Abono de ${client.name}`,

      createdAt:
        new Date()
          .toISOString()
    };


    await idbPut(
      "cashMoves",
      move
    );


    appState.cashMoves
      .push(
        move
      );
  }


  closeModal();

  renderClients();


  toast(
    "Abono registrado."
  );
};


window.remindClient =
id => {

  const client =
    appState.clients.find(
      item =>
        item.id === id
    );


  if (!client) return;


  const text =
    `Hola ${client.name}. ` +
    `Tienes un saldo pendiente de ` +
    `${money(client.balance)}.`;


  window.open(

    `https://wa.me/?text=${
      encodeURIComponent(
        text
      )
    }`,

    "_blank"
  );
};


/* =========================================
   CAJA SOLO PARA COMIDA
========================================= */

function renderCash() {

  if (!isFood()) {

    document
      .querySelector("#app")
      .innerHTML =
      shell(`

        <section class="screen-title">

          <h2>
            Caja
          </h2>

          <p>

            Este tipo de negocio
            no necesita abrir caja
            para vender.

          </p>

        </section>

      `, "more");

    return;
  }


  const shift =
    currentShift();


  /*
    CAJA CERRADA
  */

  if (!shift) {

    document
      .querySelector("#app")
      .innerHTML =
      shell(`

        <section class="screen-title">

          <h2>
            Caja
          </h2>

          <p>
            Debes abrir la caja
            antes de vender.
          </p>

        </section>


        <div class="panel">

          <h3>
            Caja cerrada
          </h3>


          <p class="muted">

            ${
              currentRole ===
              "owner"

                ? `
                  Abre el turno
                  con un fondo inicial.
                `

                : `
                  El dueño debe abrir
                  la caja para habilitar
                  las ventas.
                `
            }

          </p>


          ${
            currentRole ===
            "owner"

              ? `
                <button
                  class="
                    btn
                    primary
                    full
                  "

                  onclick="
                    openShiftForm()
                  "
                >
                  Abrir caja
                </button>
              `

              : ""
          }

        </div>

      `, "more");

    return;
  }


  const sales =
    appState.sales.filter(
      sale =>
        sale.shiftId ===
        shift.id ||
        new Date(
          sale.createdAt
        ) >=
        new Date(
          shift.openedAt
        )
    );


  const cashSales =
    sales
      .filter(
        sale =>
          sale.method ===
          "Efectivo"
      )
      .reduce(
        (
          total,
          sale
        ) =>
          total +
          Number(
            sale.total || 0
          ),
        0
      );


  const sinpeSales =
    sales
      .filter(
        sale =>
          sale.method ===
          "SINPE"
      )
      .reduce(
        (
          total,
          sale
        ) =>
          total +
          Number(
            sale.total || 0
          ),
        0
      );


  const cardSales =
    sales
      .filter(
        sale =>
          sale.method ===
          "Tarjeta/Otro"
      )
      .reduce(
        (
          total,
          sale
        ) =>
          total +
          Number(
            sale.total || 0
          ),
        0
      );


  const creditSales =
    sales
      .filter(
        sale =>
          sale.method ===
          "Crédito"
      )
      .reduce(
        (
          total,
          sale
        ) =>
          total +
          Number(
            sale.total || 0
          ),
        0
      );


  const moves =
    appState.cashMoves.filter(
      move =>
        new Date(
          move.createdAt
        ) >=
        new Date(
          shift.openedAt
        )
    );


  const cashIn =
    moves
      .filter(
        move =>
          move.type ===
          "in"
      )
      .reduce(
        (
          total,
          move
        ) =>
          total +
          Number(
            move.amount || 0
          ),
        0
      );


  const cashOut =
    moves
      .filter(
        move =>
          move.type ===
          "out"
      )
      .reduce(
        (
          total,
          move
        ) =>
          total +
          Number(
            move.amount || 0
          ),
        0
      );


  const creditCashPayments =
    moves
      .filter(
        move =>
          move.type ===
          "creditPayment" &&
          move.method ===
          "Efectivo"
      )
      .reduce(
        (
          total,
          move
        ) =>
          total +
          Number(
            move.amount || 0
          ),
        0
      );


  const expected =
    Number(
      shift.opening || 0
    ) +
    cashSales +
    creditCashPayments +
    cashIn -
    cashOut;


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          Caja
        </h2>

        <p>
          Todo lo vendido en este
          turno queda ligado aquí.
        </p>

      </section>


      <div class="kpi-grid">

        <div class="kpi">

          <span class="muted">
            Efectivo
          </span>

          <strong>
            ${money(
              cashSales
            )}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            SINPE
          </span>

          <strong>
            ${money(
              sinpeSales
            )}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            Tarjeta
          </span>

          <strong>
            ${money(
              cardSales
            )}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            Crédito
          </span>

          <strong>
            ${money(
              creditSales
            )}
          </strong>

        </div>

      </div>


      <div
        class="panel"
        style="margin-top:14px"
      >

        <div class="ticket-line">

          <span>
            Fondo inicial
          </span>

          <strong>
            ${money(
              shift.opening
            )}
          </strong>

        </div>


        <div class="ticket-line">

          <span>
            Abonos crédito
            en efectivo
          </span>

          <strong>
            ${money(
              creditCashPayments
            )}
          </strong>

        </div>


        <div class="ticket-line">

          <span>
            Entradas
          </span>

          <strong>
            ${money(
              cashIn
            )}
          </strong>

        </div>


        <div class="ticket-line">

          <span>
            Salidas
          </span>

          <strong>
            ${money(
              cashOut
            )}
          </strong>

        </div>


        <div class="divider">
        </div>


        <div
          class="
            ticket-line
            ticket-total
          "
        >

          <span>
            Efectivo esperado
          </span>

          <strong>
            ${money(
              expected
            )}
          </strong>

        </div>

      </div>


      <div
        class="toolbar"
        style="margin-top:14px"
      >

        <button
          class="btn ghost"

          onclick="
            cashMovement('in')
          "
        >
          Entrada
        </button>


        <button
          class="btn ghost"

          onclick="
            cashMovement('out')
          "
        >
          Salida
        </button>


        ${
          currentRole ===
          "owner"

            ? `
              <button
                class="btn primary"

                onclick="
                  closeShiftForm(
                    ${expected}
                  )
                "
              >
                Cerrar caja
              </button>
            `

            : ""
        }

      </div>

    `, "more");
}


window.openShiftForm =
() => {

  if (
    currentRole !==
    "owner"
  ) {

    toast(
      "Solo el dueño puede abrir la caja."
    );

    return;
  }


  modal(`

    <h3>
      Abrir caja
    </h3>


    <div class="field">

      <label>
        Fondo inicial
      </label>

      <input
        id="openingCash"
        type="number"
        inputmode="decimal"
        value="0"
      >

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"
        onclick="openShift()"
      >
        Abrir caja
      </button>


      <button
        class="btn"
        onclick="closeModal()"
      >
        Cancelar
      </button>

    </div>
  `);
};


window.openShift =
async () => {

  const session = {

    id:
      uid("shift"),

    opening:
      Number(
        document
          .querySelector(
            "#openingCash"
          )
          .value || 0
      ),

    openedAt:
      new Date()
        .toISOString(),

    closedAt:
      null,

    status:
      "open"
  };


  await idbPut(
    "cashSessions",
    session
  );


  appState.cashSessions
    .push(
      session
    );


  closeModal();


  currentScreen =
    "home";


  renderHome();


  toast(
    "Caja abierta. Ya puedes vender."
  );
};


window.cashMovement =
type => {

  modal(`

    <h3>

      ${
        type === "in"
          ? "Entrada de efectivo"
          : "Salida de efectivo"
      }

    </h3>


    <div class="field">

      <label>
        Monto
      </label>

      <input
        id="moveAmount"
        type="number"
        inputmode="decimal"
      >

    </div>


    <div class="field">

      <label>
        Nota
      </label>

      <input
        id="moveNote"
        placeholder="Opcional"
      >

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          saveCashMovement(
            '${type}'
          )
        "
      >
        Guardar
      </button>


      <button
        class="btn"
        onclick="closeModal()"
      >
        Cancelar
      </button>

    </div>
  `);
};


window.saveCashMovement =
async type => {

  const amount =
    Number(
      document
        .querySelector(
          "#moveAmount"
        )
        .value || 0
    );


  if (
    amount <= 0
  ) {

    toast(
      "Escribe un monto válido."
    );

    return;
  }


  const move = {

    id:
      uid("move"),

    type,

    amount,

    note:
      document
        .querySelector(
          "#moveNote"
        )
        .value
        .trim(),

    createdAt:
      new Date()
        .toISOString()
  };


  await idbPut(
    "cashMoves",
    move
  );


  appState.cashMoves.push(
    move
  );


  closeModal();

  renderCash();


  toast(
    "Movimiento guardado."
  );
};


window.closeShiftForm =
expected => {

  if (
    currentRole !==
    "owner"
  ) {

    toast(
      "Solo el dueño puede cerrar la caja."
    );

    return;
  }


  modal(`

    <h3>
      Cerrar caja
    </h3>


    <p>

      Efectivo esperado:

      <strong>
        ${money(
          expected
        )}
      </strong>

    </p>


    <div class="field">

      <label>
        Efectivo contado
      </label>

      <input
        id="countedCash"
        type="number"
        inputmode="decimal"

        oninput="
          showDifference(
            ${expected}
          )
        "
      >

    </div>


    <div
      class="panel"

      style="
        margin-top:10px;
        box-shadow:none;
      "
    >

      Diferencia:

      <strong id="difference">
        ${money(0)}
      </strong>

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          closeShift(
            ${expected}
          )
        "
      >
        Confirmar cierre
      </button>


      <button
        class="btn"
        onclick="closeModal()"
      >
        Cancelar
      </button>

    </div>
  `);
};


window.showDifference =
expected => {

  const counted =
    Number(
      document
        .querySelector(
          "#countedCash"
        )
        .value || 0
    );


  document
    .querySelector(
      "#difference"
    )
    .textContent =
    money(
      counted -
      expected
    );
};


window.closeShift =
async expected => {

  const shift =
    currentShift();


  if (!shift) return;


  const counted =
    Number(
      document
        .querySelector(
          "#countedCash"
        )
        .value || 0
    );


  shift.expected =
    expected;


  shift.counted =
    counted;


  shift.difference =
    counted -
    expected;


  shift.closedAt =
    new Date()
      .toISOString();


  shift.status =
    "closed";


  await idbPut(
    "cashSessions",
    shift
  );


  closeModal();


  currentScreen =
    "home";


  renderHome();


  toast(
    "Caja cerrada. Las ventas quedan bloqueadas hasta una nueva apertura."
  );
};


/* =========================================
   CATÁLOGO QR
========================================= */

function catalogLink() {

  const url =
    new URL(
      window.location.href
    );


  url.search = "";

  url.hash = "";


  url.searchParams
    .set(
      "catalog",
      "1"
    );


  return url.toString();
}


function renderCatalog() {

  const label =
    isFood()
      ? "Menú QR"
      : "Catálogo QR";


  const link =
    catalogLink();


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          ${label}
        </h2>

        <p>
          El cliente puede abrir
          tu catálogo desde
          un enlace o QR.
        </p>

      </section>


      <div class="panel">

        ${appState.products
          .map(
            product => `

              <div class="
                catalog-card
              ">

                <div>

                  <strong>
                    ${escapeHtml(
                      product.name
                    )}
                  </strong>

                  <div class="muted">
                    ${escapeHtml(
                      product.category ||
                      ""
                    )}
                  </div>

                </div>


                <strong>

                  ${money(
                    product.price
                  )}

                </strong>

              </div>

            `
          )
          .join("")}

      </div>


      <div
        class="panel"

        style="
          margin-top:14px;
          text-align:center
        "
      >

        <p class="muted">
          Enlace público
        </p>


        <div
          style="
            word-break:break-all
          "
        >

          ${escapeHtml(
            link
          )}

        </div>


        <img

          src="
            https://quickchart.io/qr?size=220&text=${
              encodeURIComponent(
                link
              )
            }
          "

          alt="
            QR del catálogo
          "

          style="
            width:220px;
            max-width:100%;
            margin-top:14px;
            border-radius:14px
          "
        >

      </div>


      <div
        class="toolbar"
        style="margin-top:14px"
      >

        <button
          class="btn primary"

          onclick="
            copyCatalogLink()
          "
        >
          Copiar enlace
        </button>


        <button
          class="btn ghost"

          onclick="
            shareCatalog()
          "
        >
          Compartir por WhatsApp
        </button>

      </div>

    `, "more");
}


window.copyCatalogLink =
async () => {

  try {

    await navigator
      .clipboard
      .writeText(
        catalogLink()
      );


    toast(
      "Enlace copiado."
    );

  } catch {

    toast(
      "No se pudo copiar automáticamente."
    );
  }
};


window.shareCatalog =
() => {

  const text =
    `${appState.settings.businessName}\n` +
    `${
      isFood()
        ? "Menú"
        : "Catálogo"
    }: ` +
    `${catalogLink()}`;


  window.open(

    `https://wa.me/?text=${
      encodeURIComponent(
        text
      )
    }`,

    "_blank"
  );
};


/* =========================================
   MÁS
========================================= */

function renderMore() {

  const cards = [];


  if (isFood()) {

    cards.push(
      homeCard(
        "products",
        "Productos",
        "Comidas, bebidas y stock"
      )
    );


    cards.push(
      homeCard(
        "clients",
        "Clientes / Crédito",
        "Saldos y abonos"
      )
    );


    cards.push(
      homeCard(
        "cash",
        "Caja",
        "Apertura, movimientos y cierre"
      )
    );


    cards.push(
      homeCard(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      )
    );


    cards.push(
      homeCard(
        "catalog",
        "Menú QR",
        "Comparte tu menú"
      )
    );
  }


  if (isProducts()) {

    cards.push(
      homeCard(
        "products",
        "Productos",
        "Artículos, variantes y stock"
      )
    );


    cards.push(
      homeCard(
        "clients",
        "Clientes / Crédito",
        "Saldos y abonos"
      )
    );


    cards.push(
      homeCard(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      )
    );


    cards.push(
      homeCard(
        "catalog",
        "Catálogo QR",
        "Comparte tus productos"
      )
    );
  }


  if (isServices()) {

    cards.push(
      homeCard(
        "products",
        "Servicios",
        "Precios y categorías"
      )
    );


    cards.push(
      homeCard(
        "clients",
        "Clientes",
        "Contactos y crédito"
      )
    );


    cards.push(
      homeCard(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      )
    );


    cards.push(
      homeCard(
        "catalog",
        "Catálogo QR",
        "Comparte tus servicios"
      )
    );
  }


  if (
    currentRole === "owner"
  ) {

    cards.push(
      homeCard(
        "settings",
        "Configuración",
        "Datos básicos"
      )
    );
  }


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          Más
        </h2>

        <p>
          Solo herramientas útiles
          para este negocio.
        </p>

      </section>


      <div class="home-grid">

        ${cards.join("")}


        ${
          appState.settings
            .pinEnabled

            ? `

              <button
                class="big-card"

                onclick="
                  lockApp()
                "
              >

                <span>

                  <strong>
                    Bloquear
                  </strong>

                  <small>
                    Solicitar PIN nuevamente
                  </small>

                </span>


                <span class="card-arrow">
                  ›
                </span>

              </button>

            `

            : ""
        }

      </div>

    `, "more");
}


/* =========================================
   CONFIGURACIÓN
========================================= */

function renderSettings() {

  if (
    currentRole !==
    "owner"
  ) {

    go("home");

    return;
  }


  const s =
    appState.settings;


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          Configuración
        </h2>

        <p>
          Elige el tipo de negocio
          y Mi Punto CR se adapta.
        </p>

      </section>


      <div class="panel">

        <div class="form-grid">


          <div class="field">

            <label>
              Tipo de negocio
            </label>


            <select
              id="businessType"
            >

              <option
                value="food"

                ${
                  s.businessType ===
                  "food"
                    ? "selected"
                    : ""
                }
              >
                Comida / Soda / Repostería
              </option>


              <option
                value="products"

                ${
                  s.businessType ===
                  "products"
                    ? "selected"
                    : ""
                }
              >
                Venta de artículos
              </option>


              <option
                value="services"

                ${
                  s.businessType ===
                  "services"
                    ? "selected"
                    : ""
                }
              >
                Servicios
              </option>

            </select>

          </div>


          <div class="field">

            <label>
              Nombre del negocio
            </label>

            <input
              id="businessName"

              value="${escapeAttr(
                s.businessName
              )}"
            >

          </div>


          <div class="field">

            <label>
              Teléfono
            </label>

            <input
              id="businessPhone"

              value="${escapeAttr(
                s.phone
              )}"
            >

          </div>


          <div class="field">

            <label>
              WhatsApp
            </label>

            <input
              id="businessWhatsapp"

              value="${escapeAttr(
                s.whatsapp
              )}"
            >

          </div>


          <div class="field">

            <label>
              Número SINPE
            </label>

            <input
              id="businessSinpe"

              value="${escapeAttr(
                s.sinpe
              )}"
            >

          </div>


          <div class="field">

            <label>
              Impuesto
            </label>


            <select id="taxMode">

              <option
                value="included"

                ${
                  s.taxMode ===
                  "included"
                    ? "selected"
                    : ""
                }
              >
                Incluido
              </option>


              <option
                value="added"

                ${
                  s.taxMode ===
                  "added"
                    ? "selected"
                    : ""
                }
              >
                Se suma al cobrar
              </option>


              <option
                value="exempt"

                ${
                  s.taxMode ===
                  "exempt"
                    ? "selected"
                    : ""
                }
              >
                Exento
              </option>

            </select>

          </div>


          <div class="field">

            <label>
              Porcentaje
            </label>

            <input
              id="taxRate"
              type="number"

              value="${Number(
                s.taxRate || 13
              )}"
            >

          </div>


          <div class="field">

            <label>
              Usar PIN
            </label>


            <select id="pinEnabled">

              <option
                value="no"

                ${
                  !s.pinEnabled
                    ? "selected"
                    : ""
                }
              >
                No
              </option>


              <option
                value="yes"

                ${
                  s.pinEnabled
                    ? "selected"
                    : ""
                }
              >
                Sí
              </option>

            </select>

          </div>


          <div class="field">

            <label>
              PIN del dueño
            </label>

            <input
              id="ownerPin"
              type="password"
              inputmode="numeric"
              maxlength="6"

              value="${escapeAttr(
                s.ownerPin
              )}"
            >

          </div>


          <div class="field">

            <label>
              PIN de Caja
            </label>

            <input
              id="cashierPin"
              type="password"
              inputmode="numeric"
              maxlength="6"

              value="${escapeAttr(
                s.cashierPin
              )}"
            >

          </div>

        </div>


        <button
          class="
            btn
            primary
            full
          "

          style="
            margin-top:15px
          "

          onclick="
            saveSettings()
          "
        >
          Guardar cambios
        </button>

      </div>

    `, "more");
}


window.saveSettings =
async () => {

  const settings = {

    ...appState.settings,

    businessType:
      document
        .querySelector(
          "#businessType"
        )
        .value,

    businessName:
      document
        .querySelector(
          "#businessName"
        )
        .value
        .trim() ||
      "Mi Punto CR",

    phone:
      document
        .querySelector(
          "#businessPhone"
        )
        .value
        .trim(),

    whatsapp:
      document
        .querySelector(
          "#businessWhatsapp"
        )
        .value
        .trim(),

    sinpe:
      document
        .querySelector(
          "#businessSinpe"
        )
        .value
        .trim(),

    taxMode:
      document
        .querySelector(
          "#taxMode"
        )
        .value,

    taxRate:
      Number(
        document
          .querySelector(
            "#taxRate"
          )
          .value || 0
      ),

    pinEnabled:
      document
        .querySelector(
          "#pinEnabled"
        )
        .value ===
      "yes",

    ownerPin:
      document
        .querySelector(
          "#ownerPin"
        )
        .value
        .trim(),

    cashierPin:
      document
        .querySelector(
          "#cashierPin"
        )
        .value
        .trim()
  };


  await idbPut(
    "settings",
    settings
  );


  appState.settings =
    settings;


  currentScreen =
    "home";


  renderHome();


  toast(
    "Configuración guardada."
  );
};


/* =========================================
   PIN
========================================= */

window.lockApp =
() => {

  locked = true;

  render();
};


function renderLock() {

  document
    .querySelector("#app")
    .innerHTML = `

      <div class="lock-screen">

        <div class="lock-card">

          <h1>
            Mi Punto CR
          </h1>

          <p>
            Ingresa tu PIN.
          </p>


          <input
            id="unlockPin"
            class="pin-input"
            type="password"
            inputmode="numeric"
            maxlength="6"
            placeholder="••••"
          >


          <button
            class="
              btn
              primary
              full
            "

            style="
              margin-top:14px
            "

            onclick="
              unlockApp()
            "
          >
            Entrar
          </button>

        </div>

      </div>
    `;
}


window.unlockApp =
() => {

  const pin =
    document
      .querySelector(
        "#unlockPin"
      )
      .value
      .trim();


  if (
    appState.settings
      .ownerPin &&
    pin ===
    appState.settings
      .ownerPin
  ) {

    currentRole =
      "owner";

    locked = false;

    currentScreen =
      "home";

    render();

    return;
  }


  if (
    appState.settings
      .cashierPin &&
    pin ===
    appState.settings
      .cashierPin
  ) {

    currentRole =
      "cashier";

    locked = false;

    currentScreen =
      "home";

    render();

    return;
  }


  toast(
    "PIN incorrecto."
  );
};


/* =========================================
   MODAL
========================================= */

function modal(content) {

  closeModal();


  const background =
    document.createElement(
      "div"
    );


  background.id =
    "modalRoot";


  background.className =
    "modal-backdrop";


  background.innerHTML = `

    <div class="modal">
      ${content}
    </div>
  `;


  background
    .addEventListener(
      "click",
      event => {

        if (
          event.target ===
          background
        ) {

          closeModal();
        }
      }
    );


  document.body
    .appendChild(
      background
    );
}


window.closeModal =
() => {

  document
    .querySelector(
      "#modalRoot"
    )
    ?.remove();
};


/* =========================================
   AVISOS
========================================= */

function toast(message) {

  const element =
    document.createElement(
      "div"
    );


  element.className =
    "toast";


  element.textContent =
    message;


  document.body
    .appendChild(
      element
    );


  setTimeout(
    () =>
      element.remove(),
    2200
  );
}


/* =========================================
   CATÁLOGO PÚBLICO QR
========================================= */

function renderPublicCatalog() {

  const groups = {};


  appState.products
    .forEach(
      product => {

        const category =
          product.category
            ?.trim() ||
          "Otros";


        if (
          !groups[category]
        ) {

          groups[category] = [];
        }


        groups[category]
          .push(
            product
          );
      }
    );


  const total =
    publicCart.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.price *
        item.qty,
      0
    );


  document
    .querySelector("#app")
    .innerHTML = `

      <main class="shell">

        <header class="topbar">

          <div class="brand">

            <h1>
              ${escapeHtml(
                appState.settings
                  .businessName
              )}
            </h1>


            <p>

              ${
                isFood()
                  ? "Menú"
                  : isServices()
                    ? "Servicios"
                    : "Catálogo"
              }

            </p>

          </div>

        </header>


        ${Object.entries(groups)
          .map(
            (
              [
                category,
                products
              ]
            ) => `

              <section
                class="panel"
                style="margin-bottom:12px"
              >

                <h3>
                  ${escapeHtml(
                    category
                  )}
                </h3>


                ${products
                  .map(
                    product => `

                      <div class="
                        catalog-card
                      ">

                        <div>

                          <strong>
                            ${escapeHtml(
                              product.name
                            )}
                          </strong>


                          <div class="muted">

                            ${money(
                              product.price
                            )}

                          </div>

                        </div>


                        <button
                          class="btn ghost"

                          onclick="
                            addPublicItem(
                              '${product.id}'
                            )
                          "
                        >
                          Agregar
                        </button>

                      </div>

                    `
                  )
                  .join("")}

              </section>

            `
          )
          .join("")}


        <section
          class="panel"
          style="margin-top:14px"
        >

          <h3>
            Tu pedido
          </h3>


          ${
            publicCart.length

              ? publicCart
                  .map(
                    item => `

                      <div class="
                        ticket-line
                      ">

                        <span>

                          ${item.qty}
                          ×
                          ${escapeHtml(
                            item.name
                          )}

                        </span>


                        <span>

                          ${money(
                            item.price *
                            item.qty
                          )}


                          <button
                            class="btn ghost"

                            style="
                              margin-left:6px;
                              padding:5px 9px;
                              min-height:auto
                            "

                            onclick="
                              removePublicItem(
                                '${item.id}'
                              )
                            "
                          >
                            −
                          </button>

                        </span>

                      </div>

                    `
                  )
                  .join("")

              : `
                <div class="empty">
                  Selecciona lo que deseas.
                </div>
              `
          }


          <div class="divider">
          </div>


          <div
            class="
              ticket-line
              ticket-total
            "
          >

            <span>
              Total
            </span>

            <strong>
              ${money(total)}
            </strong>

          </div>


          <div
            class="field"
            style="margin-top:12px"
          >

            <label>
              Nombre
            </label>

            <input
              id="publicName"
              placeholder="Tu nombre"
            >

          </div>


          ${
            isFood()

              ? `

                <div
                  class="field"
                  style="margin-top:10px"
                >

                  <label>
                    Tipo de pedido
                  </label>


                  <select
                    id="publicOrderType"
                  >

                    <option value="Recoger">
                      Recoger
                    </option>

                    <option value="Para llevar">
                      Para llevar
                    </option>

                    <option value="Mesa">
                      Mesa
                    </option>

                  </select>

                </div>

              `

              : ""
          }


          <div
            class="field"
            style="margin-top:10px"
          >

            <label>
              Nota opcional
            </label>

            <textarea
              id="publicNote"
              rows="3"
              placeholder="Alguna indicación"
            ></textarea>

          </div>


          <button
            class="
              btn
              primary
              full
            "

            style="
              margin-top:14px
            "

            onclick="
              sendCatalogRequest()
            "

            ${
              publicCart.length
                ? ""
                : "disabled"
            }
          >
            Enviar por WhatsApp
          </button>

        </section>

      </main>
    `;
}


window.addPublicItem =
id => {

  const product =
    appState.products.find(
      item =>
        item.id === id
    );


  if (!product) return;


  const existing =
    publicCart.find(
      item =>
        item.id === id
    );


  if (existing) {

    existing.qty += 1;

  } else {

    publicCart.push({

      id:
        product.id,

      name:
        product.name,

      price:
        product.price,

      qty: 1
    });
  }


  renderPublicCatalog();
};


window.removePublicItem =
id => {

  const item =
    publicCart.find(
      item =>
        item.id === id
    );


  if (!item) return;


  item.qty -= 1;


  if (
    item.qty <= 0
  ) {

    publicCart =
      publicCart.filter(
        item =>
          item.id !== id
      );
  }


  renderPublicCatalog();
};


window.sendCatalogRequest =
() => {

  if (!publicCart.length) {

    return;
  }


  const name =
    document
      .querySelector(
        "#publicName"
      )
      ?.value
      .trim() ||
    "Cliente";


  const note =
    document
      .querySelector(
        "#publicNote"
      )
      ?.value
      .trim() ||
    "";


  const orderType =
    document
      .querySelector(
        "#publicOrderType"
      )
      ?.value ||
    "";


  const total =
    publicCart.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.price *
        item.qty,
      0
    );


  const lines = [

    `Pedido / consulta para ${
      appState.settings
        .businessName
    }`,

    `Cliente: ${name}`,

    orderType
      ? `Tipo: ${orderType}`
      : "",

    ""
  ]
    .filter(Boolean);


  publicCart.forEach(
    item => {

      lines.push(

        `${item.qty} x ${item.name} - ${
          money(
            item.price *
            item.qty
          )
        }`
      );
    }
  );


  lines.push("");

  lines.push(
    `Total: ${money(total)}`
  );


  if (note) {

    lines.push(
      `Nota: ${note}`
    );
  }


  const number =
    String(
      appState.settings
        .whatsapp ||
      ""
    )
      .replace(
        /\D/g,
        ""
      );


  const text =
    lines.join("\n");


  const url =
    number

      ? `https://wa.me/${
          number.startsWith("506")
            ? number
            : `506${number}`
        }?text=${
          encodeURIComponent(
            text
          )
        }`

      : `https://wa.me/?text=${
          encodeURIComponent(
            text
          )
        }`;


  window.open(
    url,
    "_blank"
  );
};


/* =========================================
   CONEXIÓN
========================================= */

window.addEventListener(
  "online",
  render
);


window.addEventListener(
  "offline",
  render
);


/* =========================================
   INICIAR
========================================= */

(async function init() {

  db =
    await openDB();


  await loadAll();


  /*
    Convierte automáticamente
    versiones antiguas que tenían
    "general" en Comida/Soda.
  */

  appState.settings
    .businessType =
    businessType();


  await idbPut(
    "settings",
    appState.settings
  );


  /*
    Si el enlace viene del QR,
    muestra catálogo público.
  */

  const params =
    new URLSearchParams(
      window.location.search
    );


  if (
    params.get(
      "catalog"
    ) === "1"
  ) {

    renderPublicCatalog();

    return;
  }


  if (
    appState.settings
      .pinEnabled
  ) {

    locked = true;
  }


  render();


  if (
    "serviceWorker"
    in navigator
  ) {

    navigator
      .serviceWorker
      .register(
        "./service-worker.js"
      )
      .catch(
        console.error
      );
  }

})();