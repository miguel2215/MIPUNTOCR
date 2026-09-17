const DB_NAME = "mipuntocr";
const DB_VERSION = 2;

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
    businessType: "general",
    pinEnabled: false,
    ownerPin: "",
    cashierPin: ""
  }
};


/* =====================================================
   UTILIDADES
===================================================== */

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


/* =====================================================
   INDEXED DB
===================================================== */

function openDB() {
  return new Promise((resolve, reject) => {

    const request =
      indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {

      const database = request.result;

      STORES.forEach(storeName => {

        if (
          !database.objectStoreNames
            .contains(storeName)
        ) {

          database.createObjectStore(
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
        getStore(storeName)
          .getAll();

      request.onsuccess = () =>
        resolve(request.result || []);

      request.onerror = () =>
        reject(request.error);
    }
  );
}


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


  /* Productos ejemplo
     solo aparecen si no existen productos */

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


/* =====================================================
   CABECERA / NAVEGACIÓN
===================================================== */

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
      onclick="go('${screen}')"
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
              Sin conexión. Tus datos
              siguen guardándose
              localmente.
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
        "Vender",
        active
      )}

      ${navButton(
        "orders",
        "Pedidos",
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
  primary = false
) {

  return `

    <button
      class="big-card ${
        primary
          ? "primary"
          : ""
      }"

      onclick="go('${screen}')"
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


function go(screen) {

  currentScreen = screen;

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
    currentScreen === "settings"
  ) {

    renderSettings();
  }

  else {

    renderMore();
  }
}


/* =====================================================
   INICIO
===================================================== */

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


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="screen-title">

        <h2>
          ¿Qué necesitas hacer?
        </h2>

        <p>
          Todo lo importante está
          a un toque.
        </p>

      </section>


      <div class="kpi-grid">

        <div class="kpi">

          <span class="muted">
            Ventas hoy
          </span>

          <strong>
            ${money(totalToday)}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            Por cobrar
          </span>

          <strong>
            ${money(pending)}
          </strong>

        </div>

      </div>


      <div
        class="home-grid"
        style="margin-top:14px"
      >

        ${homeCard(
          "sale",
          "Nueva venta",
          "Vende y cobra rápido",
          true
        )}


        ${homeCard(
          "orders",
          "Pedidos",
          "Pendientes, preparando y listos"
        )}


        ${homeCard(
          "cash",
          "Caja",
          "Ventas y cierre"
        )}


        ${homeCard(
          "products",
          "Productos",
          "Precios y stock"
        )}


        ${homeCard(
          "clients",
          "Clientes / Fiado",
          "Saldos y abonos"
        )}


        ${
          currentRole === "owner"

            ? homeCard(
                "settings",
                "Configuración",
                "Datos básicos"
              )

            : ""
        }

      </div>

    `, "home");
}


/* =====================================================
   IMPUESTOS
===================================================== */

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
      subtotal + tax;
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


/* =====================================================
   NUEVA VENTA
   AHORA POR CATEGORÍAS
===================================================== */

function renderSale() {

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


  /*
    Las categorías se crean
    automáticamente a partir
    de los productos.
  */

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

              ${products.length}

              ${
                products.length === 1
                  ? "producto"
                  : "productos"
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
          .map(item => `

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
          `)
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
          Nueva venta
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
                  No hay categorías.
                </div>
              `
            }

          </div>


        </section>


        <section class="panel">


          <div class="row-head">

            <h3 style="margin:0">
              Venta actual
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
              Fiado
            </button>


          </div>


        </section>


      </div>

    `, "sale");
}


/* =====================================================
   ABRIR CATEGORÍA
===================================================== */

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
          ${escapeHtml(
            category
          )}
        </h3>

        <p class="muted">
          Toca un producto
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


    <div class="
      category-products
    ">


      ${products
        .map(product => `

          <button
            class="
              category-product
            "

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

              <small>
                Stock:
                ${Number(
                  product.stock ?? 0
                )}
              </small>

            </span>


            <span class="
              category-product-price
            ">

              ${money(
                product.price
              )}

            </span>

          </button>

        `)
        .join("")}


    </div>
  `);
};


/* =====================================================
   AGREGAR PRODUCTO DESDE CATEGORÍA
===================================================== */

window.addProductFromCategory =
id => {

  const product =
    appState.products.find(
      item =>
        item.id === id
    );


  if (!product) return;


  /*
    Si tiene tallas,
    aromas, tamaños, etc.
  */

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
          .map(variant => `

            <button
              class="
                category-product
              "

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

          `)
          .join("")}

      </div>

    `);

    return;
  }


  addProductDirectly(
    product,
    ""
  );


  /*
    Cerramos y actualizamos
    para que se vea la venta.
  */

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
      variant || "normal"
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


/* =====================================================
   BUSCAR CATEGORÍA
===================================================== */

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
    .forEach(card => {

      card.style.display =
        card.innerText
          .toLowerCase()
          .includes(search)

          ? ""

          : "none";
    });
};


/* =====================================================
   CANTIDADES / QUITAR DE LA VENTA
===================================================== */

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


  /*
    Si llega a cero,
    desaparece de la venta.
  */

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


window.clearCart = () => {

  cart = [];

  renderSale();
};


/* =====================================================
   COBRO
===================================================== */

window.pay =
method => {

  if (!cart.length) {

    toast(
      "Agrega al menos un producto."
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


/* =====================================================
   EFECTIVO
===================================================== */

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
        onclick="closeModal()"
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
        received - total
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


/* =====================================================
   SINPE
===================================================== */

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

        onclick="closeModal()"
      >
        Cancelar
      </button>

    </div>
  `);
}


/* =====================================================
   TARJETA / OTRO
===================================================== */

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

        placeholder="
          Ej. 45821
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


/* =====================================================
   FIADO
===================================================== */

function showCreditPayment(
  totals
) {

  const options =
    appState.clients
      .map(client => `

        <option
          value="${client.id}"
        >
          ${escapeHtml(
            client.name
          )}
        </option>

      `)
      .join("");


  modal(`

    <h3>
      Venta fiada
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
        Guardar fiado
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
    "Fiado",
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


/* =====================================================
   GUARDAR VENTA
===================================================== */

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


  const sale = {

    id: uid("sale"),

    number:
      appState.sales.length +
      1,

    createdAt:
      new Date()
        .toISOString(),

    items:
      cart.map(item => ({

        id: item.id,

        name:
          item.name,

        variant:
          item.variant || "",

        price:
          item.price,

        qty:
          item.qty
      })),

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
    Descontar inventario
  */

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


  cart = [];


  closeModal();


  showTicket(
    sale
  );
}


/* =====================================================
   TICKET
===================================================== */

function showTicket(
  sale
) {

  modal(`

    <div class="ticket">


      <div class="
        ticket-business
      ">

        <h3>

          ${escapeHtml(
            appState.settings
              .businessName
          )}

        </h3>


        <div class="muted">

          Ticket
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
        .map(item => `

          <div class="
            ticket-line
          ">

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

        `)
        .join("")}


      <div class="divider">
      </div>


      ${
        sale.tax > 0

          ? `
            <div class="
              ticket-line
            ">

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


      <div class="
        ticket-line
        ticket-total
      ">

        <span>
          Total
        </span>

        <span>
          ${money(
            sale.total
          )}
        </span>

      </div>


      <div class="
        ticket-line
      ">

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
            <div class="
              ticket-line
            ">

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
            shareTicket(
              '${sale.id}'
            )
          "
        >
          Compartir WhatsApp
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


function ticketText(
  sale
) {

  const lines = [

    appState.settings
      .businessName,

    `Ticket #${sale.number}`,

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


window.shareTicket =
saleId => {

  const sale =
    appState.sales.find(
      item =>
        item.id ===
        saleId
    );


  if (!sale) return;


  window.open(

    `https://wa.me/?text=${
      encodeURIComponent(
        ticketText(sale)
      )
    }`,

    "_blank"
  );
};


/* =====================================================
   PRODUCTOS
===================================================== */

function renderProducts() {

  const productsHTML =
    appState.products.length

      ? appState.products
          .map(product => `

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


                  <div class="muted">

                    Stock:
                    ${Number(
                      product.stock || 0
                    )}

                  </div>


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

          `)
          .join("")

      : `
        <div class="empty">
          No hay productos.
        </div>
      `;


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          Productos
        </h2>

        <p>
          Agrega, edita o elimina
          productos.
        </p>

      </section>


      <div class="toolbar">

        <button
          class="btn primary"

          onclick="
            productForm()
          "
        >
          Nuevo producto
        </button>

      </div>


      <div class="list">

        ${productsHTML}

      </div>

    `, "more");
}


/* =====================================================
   CREAR / EDITAR PRODUCTO
===================================================== */

window.productForm =
id => {

  const product =
    id

      ? appState.products.find(
          item =>
            item.id === id
        )

      : null;


  modal(`

    <h3>

      ${
        product
          ? "Editar producto"
          : "Nuevo producto"
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


      <div class="field">

        <label>
          Categoría
        </label>

        <input
          id="pCategory"

          value="${escapeAttr(
            product?.category || ""
          )}"

          placeholder="
            Ej. Bebidas
          "
        >

      </div>


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
          "
        >

      </div>


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
      id: uid("p")
    };


    appState.products.push(
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
    "Producto guardado."
  );
};


/* =====================================================
   ELIMINAR PRODUCTO
===================================================== */

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
      Eliminar producto
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


  /*
    Si estaba dentro
    de una venta actual,
    también lo quitamos.
  */

  cart =
    cart.filter(
      item =>
        item.id !== id
    );


  closeModal();

  renderProducts();

  toast(
    "Producto eliminado."
  );
};


/* =====================================================
   CLIENTES
===================================================== */

function renderClients() {

  const html =
    appState.clients.length

      ? appState.clients
          .map(client => `

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

          `)
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

      <section class="
        screen-title
      ">

        <h2>
          Clientes / Fiado
        </h2>

        <p>
          Saldos y abonos.
        </p>

      </section>


      <div class="toolbar">

        <button
          class="btn primary"

          onclick="
            newClient()
          "
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

        onclick="
          saveClient()
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

    id: uid("client"),

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

        onclick="
          closeModal()
        "
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


/* =====================================================
   PEDIDOS
===================================================== */

function renderOrders() {

  const html =
    appState.orders.length

      ? [...appState.orders]
          .reverse()
          .map(order => `

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
                  .map(item => `

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

                      </span>

                    </div>

                  `)
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

          `)
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

      <section class="
        screen-title
      ">

        <h2>
          Pedidos
        </h2>

        <p>
          Pendiente → preparando
          → listo → entregado.
        </p>

      </section>


      <div class="toolbar">

        <button
          class="btn primary"

          onclick="
            newOrder()
          "
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
      Toca productos para
      agregarlos.
    </p>


    <div class="
      order-builder-products
    ">

      ${appState.products
        .map(product => `

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

        `)
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

        onclick="
          saveOrder()
        "
      >
        Guardar pedido
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


  if (!orderDraft.length) {

    container.innerHTML = `
      <div class="empty">
        Aún no agregaste
        productos.
      </div>
    `;

    return;
  }


  container.innerHTML =
    orderDraft
      .map(item => `

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

      `)
      .join("");
}


window.saveOrder =
async () => {

  if (
    !orderDraft.length
  ) {

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


/* =====================================================
   CAJA
===================================================== */

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


function renderCash() {

  const shift =
    currentShift();


  if (!shift) {

    document
      .querySelector("#app")
      .innerHTML =
      shell(`

        <section class="
          screen-title
        ">

          <h2>
            Caja
          </h2>

          <p>
            Abre el turno para
            comenzar.
          </p>

        </section>


        <div class="panel">

          <h3>
            Caja cerrada
          </h3>


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

        </div>

      `, "more");

    return;
  }


  const sales =
    appState.sales.filter(
      sale =>
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
          move.type === "in"
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
          move.type === "out"
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
    cashIn -
    cashOut;


  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          Caja
        </h2>

        <p>
          Turno abierto.
        </p>

      </section>


      <div class="kpi-grid">


        <div class="kpi">

          <span class="muted">
            Efectivo vendido
          </span>

          <strong>
            ${money(
              cashSales
            )}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            Entradas
          </span>

          <strong>
            ${money(
              cashIn
            )}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            Salidas
          </span>

          <strong>
            ${money(
              cashOut
            )}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            Esperado
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
        style="margin-top:15px"
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

      </div>

    `, "more");
}


window.openShiftForm =
() => {

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
        openShift()
      "
    >
      Abrir caja
    </button>
  `);
};


window.openShift =
async () => {

  const shift = {

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
    shift
  );


  appState.cashSessions.push(
    shift
  );


  closeModal();

  renderCash();

  toast(
    "Caja abierta."
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
        saveCashMovement(
          '${type}'
        )
      "
    >
      Guardar
    </button>
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

  modal(`

    <h3>
      Cerrar caja
    </h3>


    <p>

      Esperado:

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
        closeShift(
          ${expected}
        )
      "
    >
      Confirmar cierre
    </button>
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

  renderCash();

  toast(
    "Caja cerrada."
  );
};


/* =====================================================
   CATÁLOGO
===================================================== */

function renderCatalog() {

  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          Catálogo
        </h2>

        <p>
          Comparte tus productos.
        </p>

      </section>


      <div class="panel">

        ${appState.products
          .map(product => `

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

          `)
          .join("")}

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
          shareCatalog()
        "
      >
        Compartir por WhatsApp
      </button>

    `, "more");
}


window.shareCatalog =
() => {

  const lines = [

    appState.settings
      .businessName,

    "",

    "Catálogo"
  ];


  appState.products.forEach(
    product => {

      lines.push(

        `${product.name} - ${
          money(
            product.price
          )
        }`
      );
    }
  );


  window.open(

    `https://wa.me/?text=${
      encodeURIComponent(
        lines.join("\n")
      )
    }`,

    "_blank"
  );
};


/* =====================================================
   MÁS
===================================================== */

function renderMore() {

  document
    .querySelector("#app")
    .innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          Más
        </h2>

        <p>
          Herramientas adicionales.
        </p>

      </section>


      <div class="home-grid">


        ${homeCard(
          "products",
          "Productos",
          "Precios y stock"
        )}


        ${homeCard(
          "clients",
          "Clientes / Fiado",
          "Saldos y abonos"
        )}


        ${homeCard(
          "cash",
          "Caja",
          "Apertura y cierre"
        )}


        ${homeCard(
          "catalog",
          "Catálogo",
          "Comparte productos"
        )}


        ${
          currentRole ===
          "owner"

            ? homeCard(
                "settings",
                "Configuración",
                "Datos básicos"
              )

            : ""
        }


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
                    Solicitar PIN
                  </small>

                </span>


                <span class="
                  card-arrow
                ">
                  ›
                </span>

              </button>

            `

            : ""
        }


      </div>

    `, "more");
}


/* =====================================================
   CONFIGURACIÓN
===================================================== */

function renderSettings() {

  if (
    currentRole !== "owner"
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

      <section class="
        screen-title
      ">

        <h2>
          Configuración
        </h2>

        <p>
          Solo lo necesario.
        </p>

      </section>


      <div class="panel">


        <div class="form-grid">


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


  renderSettings();

  toast(
    "Configuración guardada."
  );
};


/* =====================================================
   PIN
===================================================== */

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


/* =====================================================
   MODALES
===================================================== */

function modal(content) {

  closeModal();


  const background =
    document
      .createElement(
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


  document.body.appendChild(
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


/* =====================================================
   AVISOS
===================================================== */

function toast(message) {

  const element =
    document
      .createElement(
        "div"
      );


  element.className =
    "toast";


  element.textContent =
    message;


  document.body.appendChild(
    element
  );


  setTimeout(
    () =>
      element.remove(),
    2200
  );
}


/* =====================================================
   CONEXIÓN
===================================================== */

window.addEventListener(
  "online",
  render
);


window.addEventListener(
  "offline",
  render
);


/* =====================================================
   INICIAR
===================================================== */

(async function init() {

  db =
    await openDB();


  await loadAll();


  await idbPut(
    "settings",
    appState.settings
  );


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