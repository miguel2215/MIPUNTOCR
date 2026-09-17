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
let screen = "home";
let cart = [];
let locked = false;
let role = "owner";

const state = {
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
    taxMode: "included",
    taxRate: 13,
    businessType: "food",
    pinEnabled: false,
    ownerPin: "",
    cashierPin: ""
  }
};

const $ = q =>
  document.querySelector(q);

const money = n =>
  new Intl.NumberFormat(
    "es-CR",
    {
      style: "currency",
      currency: "CRC",
      maximumFractionDigits: 0
    }
  ).format(
    Number(n || 0)
  );

const uid = p =>
  `${p}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;

const esc = v =>
  String(v ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[c]
  );

const enc = v =>
  encodeURIComponent(
    String(v ?? "")
  ).replace(
    /'/g,
    "%27"
  );


/* ================================
   BASE DE DATOS LOCAL
================================ */

function openDB() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );


      request.onupgradeneeded =
        () => {

          STORES.forEach(
            name => {

              if (
                !request.result
                  .objectStoreNames
                  .contains(name)
              ) {

                request.result
                  .createObjectStore(
                    name,
                    {
                      keyPath: "id"
                    }
                  );
              }
            }
          );
        };


      request.onsuccess =
        () =>
          resolve(
            request.result
          );


      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


function store(
  name,
  mode = "readonly"
) {

  return db
    .transaction(
      name,
      mode
    )
    .objectStore(
      name
    );
}


function all(name) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const request =
        store(name)
          .getAll();


      request.onsuccess =
        () =>
          resolve(
            request.result ||
            []
          );


      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


function put(
  name,
  value
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const request =
        store(
          name,
          "readwrite"
        ).put(
          value
        );


      request.onsuccess =
        () =>
          resolve(
            value
          );


      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


function del(
  name,
  id
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const request =
        store(
          name,
          "readwrite"
        ).delete(
          id
        );


      request.onsuccess =
        () =>
          resolve();


      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


/* ================================
   CARGAR INFORMACIÓN
================================ */

async function load() {

  for (
    const name of [
      "products",
      "clients",
      "sales",
      "orders",
      "cashMoves",
      "cashSessions"
    ]
  ) {

    state[name] =
      await all(name);
  }


  const saved =
    await all(
      "settings"
    );


  if (
    saved[0]
  ) {

    state.settings = {
      ...state.settings,
      ...saved[0]
    };
  }


  /*
    Convertimos configuraciones
    de versiones anteriores.
  */

  if (
    state.settings
      .businessType ===
    "general"
  ) {

    state.settings
      .businessType =
      "food";
  }


  if (
    state.settings
      .businessType ===
    "retail"
  ) {

    state.settings
      .businessType =
      "products";
  }


  /*
    Productos de ejemplo
    solo si no existe ninguno.
  */

  if (
    !state.products.length
  ) {

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


    for (
      const product of demo
    ) {

      await put(
        "products",
        product
      );
    }


    state.products =
      demo;
  }


  await put(
    "settings",
    state.settings
  );
}


/* ================================
   TIPO DE NEGOCIO
================================ */

const type =
  () =>
    state.settings
      .businessType ||
    "food";


const isFood =
  () =>
    type() ===
    "food";


const isProducts =
  () =>
    type() ===
    "products";


const isServices =
  () =>
    type() ===
    "services";


/* ================================
   CAJA
================================ */

const currentShift =
  () =>
    [
      ...state.cashSessions
    ]
      .reverse()
      .find(
        item =>
          item.status ===
          "open"
      );


const canSell =
  () =>
    !isFood() ||
    Boolean(
      currentShift()
    );


/* ================================
   CABECERA
================================ */

function badge() {

  if (
    navigator.onLine
  ) {

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


function navBtn(
  target,
  label,
  active
) {

  return `
    <button
      class="${
        active === target
          ? "active"
          : ""
      }"

      onclick="
        go('${target}')
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

  const third =
    isFood()
      ? [
          "orders",
          "Pedidos"
        ]
      : [
          "sales",
          "Mis ventas"
        ];


  return `

    <main class="shell">

      <header class="topbar">

        <div class="brand">

          <h1>
            ${esc(
              state.settings
                .businessName
            )}
          </h1>

          <p>
            Tu negocio, más simple
          </p>

        </div>


        <div class="status-row">
          ${badge()}
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

      ${navBtn(
        "home",
        "Inicio",
        active
      )}


      ${navBtn(
        "sale",
        isServices()
          ? "Servicio"
          : "Vender",
        active
      )}


      ${navBtn(
        third[0],
        third[1],
        active
      )}


      ${navBtn(
        "more",
        "Más",
        active
      )}

    </nav>
  `;
}


function card(
  target,
  title,
  subtitle,
  primary = false,
  disabled = false
) {

  return `

    <button
      class="
        big-card
        ${
          primary
            ? "primary"
            : ""
        }
      "

      ${
        disabled
          ? `
            disabled
            style="opacity:.55"
          `
          : `
            onclick="
              go('${target}')
            "
          `
      }
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


/* ================================
   NAVEGACIÓN
================================ */

window.go =
target => {

  if (
    target === "sale" &&
    !canSell()
  ) {

    toast(
      "Primero debes abrir la caja."
    );


    screen =
      "cash";


    render();

    return;
  }


  screen =
    target;


  render();
};


function render() {

  if (
    locked
  ) {

    renderLock();

    return;
  }


  const routes = {

    home:
      renderHome,

    sale:
      renderSale,

    orders:
      renderOrders,

    products:
      renderProducts,

    clients:
      renderClients,

    cash:
      renderCash,

    catalog:
      renderCatalog,

    sales:
      renderSales,

    settings:
      renderSettings
  };


  (
    routes[screen] ||
    renderMore
  )();
}


/* ================================
   INICIO
================================ */

function renderHome() {

  const today =
    new Date()
      .toDateString();


  const todaySales =
    state.sales.filter(
      sale =>
        new Date(
          sale.createdAt
        ).toDateString() ===
        today
    );


  const sold =
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


  const credit =
    state.clients.reduce(
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


  let cards =
    "";


  /*
    COMIDA / SODA
  */

  if (
    isFood()
  ) {

    cards = `

      ${card(
        "sale",

        "Nueva venta",

        shiftOpen
          ? "Vende y cobra rápido"
          : "Abre caja para poder vender",

        true,

        !shiftOpen
      )}


      ${card(
        "orders",
        "Pedidos",
        "Pendientes, preparando y listos"
      )}


      ${card(
        "cash",

        shiftOpen
          ? "Caja abierta"
          : "Abrir caja",

        shiftOpen
          ? "Ventas y cierre"
          : "Fondo inicial y apertura"
      )}


      ${card(
        "products",
        "Productos",
        "Comidas, bebidas y stock"
      )}


      ${card(
        "clients",
        "Clientes / Crédito",
        "Saldos y abonos"
      )}


      ${card(
        "catalog",
        "Menú QR",
        "Vista y enlace del menú"
      )}
    `;
  }


  /*
    VENTA DE ARTÍCULOS
  */

  if (
    isProducts()
  ) {

    cards = `

      ${card(
        "sale",
        "Vender",
        "Selecciona artículos y genera comprobante",
        true
      )}


      ${card(
        "products",
        "Productos",
        "Artículos, variantes y stock"
      )}


      ${card(
        "clients",
        "Clientes / Crédito",
        "Saldos y abonos"
      )}


      ${card(
        "catalog",
        "Catálogo QR",
        "Vista y enlace del catálogo"
      )}


      ${card(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      )}
    `;
  }


  /*
    SERVICIOS
  */

  if (
    isServices()
  ) {

    cards = `

      ${card(
        "sale",
        "Nuevo servicio",
        "Selecciona servicio y genera comprobante",
        true
      )}


      ${card(
        "products",
        "Servicios",
        "Precios y categorías"
      )}


      ${card(
        "clients",
        "Clientes",
        "Contactos y crédito"
      )}


      ${card(
        "catalog",
        "Catálogo QR",
        "Vista y enlace de servicios"
      )}


      ${card(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      )}
    `;
  }


  $("#app").innerHTML =
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
            ${money(sold)}
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
            ${money(credit)}
          </strong>

        </button>


      </div>


      <div
        class="home-grid"
        style="margin-top:14px"
      >

        ${cards}


        ${
          role === "owner"

            ? card(
                "settings",
                "Configuración",
                "Datos básicos del negocio"
              )

            : ""
        }

      </div>

    `,
    "home"
  );
}


/* ================================
   IMPUESTOS
================================ */

function totals(
  subtotal
) {

  const rate =
    Number(
      state.settings
        .taxRate || 0
    );


  const mode =
    state.settings
      .taxMode;


  if (
    mode === "added"
  ) {

    return {

      subtotal,

      tax:
        subtotal *
        rate /
        100,

      total:
        subtotal *
        (
          1 +
          rate /
          100
        )
    };
  }


  if (
    mode === "included" &&
    rate > 0
  ) {

    return {

      subtotal,

      tax:
        subtotal -
        subtotal /
        (
          1 +
          rate /
          100
        ),

      total:
        subtotal
    };
  }


  return {

    subtotal,

    tax: 0,

    total:
      subtotal
  };
}


/* ================================
   VENTA
================================ */

function renderSale() {

  if (
    !canSell()
  ) {

    screen =
      "cash";


    renderCash();

    return;
  }


  const totalInfo =
    totals(
      cart.reduce(
        (
          total,
          item
        ) =>
          total +
          item.price *
          item.qty,
        0
      )
    );


  const categories =
    [
      ...new Set(
        state.products.map(
          product =>
            product.category
              ?.trim() ||
            "Otros"
        )
      )
    ];


  const categoryHtml =
    categories
      .map(
        category => {

          const count =
            state.products
              .filter(
                product =>
                  (
                    product.category
                      ?.trim() ||
                    "Otros"
                  ) ===
                  category
              )
              .length;


          return `

            <button
              class="category-card"

              onclick="
                openCategory(
                  decodeURIComponent(
                    '${enc(category)}'
                  )
                )
              "
            >

              <span class="category-name">
                ${esc(category)}
              </span>


              <span class="category-count">

                ${count}

                ${
                  isServices()

                    ? (
                        count === 1
                          ? "servicio"
                          : "servicios"
                      )

                    : (
                        count === 1
                          ? "producto"
                          : "productos"
                      )
                }

              </span>


              <span class="category-arrow">
                ›
              </span>

            </button>
          `;
        }
      )
      .join("");


  const cartHtml =
    cart.length

      ? cart
          .map(
            item => `

              <div class="cart-item">

                <div>

                  <strong>
                    ${esc(
                      item.name
                    )}
                  </strong>


                  ${
                    item.variant

                      ? `
                        <div class="muted">
                          ${esc(
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
                      qty(
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
                      qty(
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


  $("#app").innerHTML =
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


          <div class="category-grid">

            ${categoryHtml}

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

              onclick="
                clearCart()
              "
            >
              Vaciar
            </button>

          </div>


          <div class="cart-list">
            ${cartHtml}
          </div>


          ${
            state.settings
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
                      totalInfo.tax
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
                totalInfo.total
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

    `,
    "sale"
  );
}


/* ================================
   ABRIR CATEGORÍA
================================ */

window.openCategory =
category => {

  const items =
    state.products.filter(
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
          ${esc(category)}
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

        onclick="
          closeModal()
        "
      >
        ×
      </button>

    </div>


    <div class="category-products">

      ${items
        .map(
          product => `

            <button
              class="
                category-product
              "

              onclick="
                pickProduct(
                  '${product.id}'
                )
              "
            >

              <span>

                <strong>
                  ${esc(
                    product.name
                  )}
                </strong>


                ${
                  !isServices()

                    ? `
                      <small>
                        Stock:
                        ${Number(
                          product.stock ||
                          0
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


/* ================================
   AGREGAR PRODUCTO
================================ */

window.pickProduct =
id => {

  const product =
    state.products.find(
      item =>
        item.id === id
    );


  if (!product) {
    return;
  }


  if (
    product.variants
      ?.length
  ) {

    modal(`

      <h3>
        ${esc(
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
                class="
                  category-product
                "

                onclick="
                  addCart(
                    '${product.id}',
                    decodeURIComponent(
                      '${enc(variant)}'
                    )
                  )
                "
              >

                <strong>
                  ${esc(
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


  addCart(
    id,
    ""
  );
};


window.addCart =
(
  id,
  variant = ""
) => {

  const product =
    state.products.find(
      item =>
        item.id === id
    );


  if (!product) {
    return;
  }


  const cartId =
    `${id}_${
      variant ||
      "normal"
    }`;


  const old =
    cart.find(
      item =>
        item.cartId ===
        cartId
    );


  if (old) {

    old.qty +=
      1;

  } else {

    cart.push({

      ...product,

      cartId,

      variant,

      qty: 1
    });
  }


  closeModal();

  renderSale();


  toast(
    `${product.name} agregado`
  );
};


window.qty =
(
  id,
  change
) => {

  const item =
    cart.find(
      product =>
        product.cartId ===
        id
    );


  if (!item) {
    return;
  }


  item.qty +=
    change;


  if (
    item.qty <= 0
  ) {

    cart =
      cart.filter(
        product =>
          product.cartId !==
          id
      );
  }


  renderSale();
};


window.clearCart =
() => {

  cart = [];

  renderSale();
};


window.filterCategories =
query => {

  document
    .querySelectorAll(
      ".category-card"
    )
    .forEach(
      element => {

        element.style.display =

          element.innerText
            .toLowerCase()
            .includes(
              query
                .toLowerCase()
                .trim()
            )

            ? ""

            : "none";
      }
    );
};


/* ================================
   COBROS
================================ */

window.pay =
method => {

  if (
    !cart.length
  ) {

    toast(
      isServices()
        ? "Agrega al menos un servicio."
        : "Agrega al menos un producto."
    );

    return;
  }


  const totalInfo =
    totals(
      cart.reduce(
        (
          total,
          item
        ) =>
          total +
          item.price *
          item.qty,
        0
      )
    );


  /*
    EFECTIVO
  */

  if (
    method ===
    "cash"
  ) {

    modal(`

      <h3>
        Cobro en efectivo
      </h3>


      <p>

        Total:

        <strong>
          ${money(
            totalInfo.total
          )}
        </strong>

      </p>


      <div class="field">

        <label>
          Recibido
        </label>

        <input
          id="received"
          type="number"
          inputmode="decimal"

          oninput="
            changeText(
              ${totalInfo.total}
            )
          "
        >

      </div>


      <div
        class="panel"

        style="
          margin-top:10px;
          box-shadow:none
        "
      >

        Vuelto:

        <strong id="changeValue">
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
            finishCash()
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


  /*
    SINPE
  */

  if (
    method ===
    "sinpe"
  ) {

    modal(`

      <h3>
        Cobro por SINPE
      </h3>


      <p>

        Total:

        <strong>
          ${money(
            totalInfo.total
          )}
        </strong>

      </p>


      <div
        class="panel"
        style="box-shadow:none"
      >

        ${
          state.settings
            .sinpe

            ? `
              Número SINPE:

              <strong>
                ${esc(
                  state.settings
                    .sinpe
                )}
              </strong>
            `

            : `
              Configura tu número
              SINPE.
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
            finishSale(
              'SINPE'
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


  /*
    TARJETA
  */

  if (
    method ===
    "card"
  ) {

    modal(`

      <h3>
        Tarjeta / Otro
      </h3>


      <p>

        Total:

        <strong>
          ${money(
            totalInfo.total
          )}
        </strong>

      </p>


      <div class="field">

        <label>
          Referencia opcional
        </label>

        <input id="ref">

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
              $('#ref').value
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


  /*
    CRÉDITO
  */

  if (
    method ===
    "credit"
  ) {

    const options =
      state.clients
        .map(
          client => `

            <option
              value="${client.id}"
            >

              ${esc(
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
            totalInfo.total
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
            finishCredit()
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
};


window.changeText =
total => {

  const value =
    Number(
      $("#received")
        ?.value ||
      0
    );


  $("#changeValue")
    .textContent =
    money(
      Math.max(
        0,
        value -
        total
      )
    );
};


window.finishCash =
async () => {

  const received =
    Number(
      $("#received")
        ?.value ||
      0
    );


  const totalInfo =
    totals(
      cart.reduce(
        (
          total,
          item
        ) =>
          total +
          item.price *
          item.qty,
        0
      )
    );


  if (
    received <
    totalInfo.total
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


window.finishCredit =
async () => {

  const clientId =
    $("#creditClient")
      .value;


  if (!clientId) {

    toast(
      "Selecciona un cliente."
    );

    return;
  }


  const totalInfo =
    totals(
      cart.reduce(
        (
          total,
          item
        ) =>
          total +
          item.price *
          item.qty,
        0
      )
    );


  const client =
    state.clients.find(
      item =>
        item.id ===
        clientId
    );


  client.balance =
    Number(
      client.balance ||
      0
    ) +
    totalInfo.total;


  await put(
    "clients",
    client
  );


  await saveSale(
    "Crédito",
    "",
    clientId
  );
};


/* ================================
   GUARDAR VENTA
================================ */

async function saveSale(
  method,
  reference = "",
  clientId = "",
  received = null
) {

  const totalInfo =
    totals(
      cart.reduce(
        (
          total,
          item
        ) =>
          total +
          item.price *
          item.qty,
        0
      )
    );


  const sale = {

    id:
      uid("sale"),

    number:
      state.sales.length +
      1,

    createdAt:
      new Date()
        .toISOString(),

    shiftId:
      currentShift()
        ?.id ||
      null,

    businessType:
      type(),

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
      totalInfo.subtotal,

    tax:
      totalInfo.tax,

    total:
      totalInfo.total,

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
            totalInfo.total
          )
  };


  await put(
    "sales",
    sale
  );


  state.sales.push(
    sale
  );


  /*
    Servicios no descuentan stock.
  */

  if (
    !isServices()
  ) {

    for (
      const item of cart
    ) {

      const product =
        state.products.find(
          product =>
            product.id ===
            item.id
        );


      if (!product) {
        continue;
      }


      product.stock =
        Math.max(
          0,
          Number(
            product.stock ||
            0
          ) -
          item.qty
        );


      await put(
        "products",
        product
      );
    }
  }


  cart = [];


  closeModal();


  showReceipt(
    sale
  );
}


/* ================================
   COMPROBANTE
================================ */

function showReceipt(
  sale
) {

  modal(`

    <div class="ticket">

      <div class="
        ticket-business
      ">

        <h3>
          ${esc(
            state.settings
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

            <div class="
              ticket-line
            ">

              <span>

                ${item.qty}
                ×
                ${esc(
                  item.name
                )}

                ${
                  item.variant

                    ? `
                      (${esc(
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


      <div class="
        ticket-line
      ">

        <span>
          Pago
        </span>

        <span>
          ${esc(
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
            sharePdf(
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


/* ================================
   PDF
================================ */

async function jsPDFClass() {

  if (
    window.jspdf
      ?.jsPDF
  ) {

    return window.jspdf
      .jsPDF;
  }


  await new Promise(
    (
      resolve,
      reject
    ) => {

      const script =
        document
          .createElement(
            "script"
          );


      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";


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


window.sharePdf =
async id => {

  const sale =
    state.sales.find(
      item =>
        item.id === id
    );


  if (!sale) {
    return;
  }


  try {

    const PDF =
      await jsPDFClass();


    const doc =
      new PDF({
        unit: "mm",
        format: "a4"
      });


    let y = 18;


    doc.setFont(
      "helvetica",
      "bold"
    );


    doc.setFontSize(
      16
    );


    doc.text(
      state.settings
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


    doc.setFontSize(
      10
    );


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


    y += 9;


    sale.items.forEach(
      item => {

        doc.text(
          `${item.qty} x ${item.name}${
            item.variant
              ? ` (${item.variant})`
              : ""
          }`.slice(
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


    y += 4;


    doc.setFont(
      "helvetica",
      "bold"
    );


    doc.setFontSize(
      13
    );


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


    doc.setFontSize(
      10
    );


    doc.text(
      `Pago: ${sale.method}`,
      15,
      y
    );


    const blob =
      doc.output(
        "blob"
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


    /*
      En iPhone abre el menú
      de compartir, donde
      aparece WhatsApp.
    */

    if (
      navigator.share &&
      navigator.canShare
        ?.({
          files: [file]
        })
    ) {

      await navigator.share({
        title:
          `Comprobante #${sale.number}`,
        files: [file]
      });


      return;
    }


    /*
      Si el navegador no permite
      compartir archivos directamente,
      descarga el PDF.
    */

    const url =
      URL.createObjectURL(
        blob
      );


    const link =
      document
        .createElement(
          "a"
        );


    link.href =
      url;


    link.download =
      file.name;


    link.click();


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

  } catch (
    error
  ) {

    console.error(
      error
    );


    toast(
      "Para generar PDF necesitas conexión la primera vez."
    );
  }
};


/* ================================
   MIS VENTAS
================================ */

function renderSales() {

  const sorted =
    [
      ...state.sales
    ].sort(
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


  $("#app").innerHTML =
    shell(`

      <section class="
        screen-title
      ">

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

        ${salesHtml(
          sorted
        )}

      </div>

    `,
    isFood()
      ? "more"
      : "sales"
  );
}


function salesHtml(
  items
) {

  if (
    !items.length
  ) {

    return `
      <div class="empty">
        No hay ventas
        en este período.
      </div>
    `;
  }


  return items
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

            ${esc(
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


  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );


  const yesterday =
    new Date(
      today
    );


  yesterday.setDate(
    yesterday.getDate() -
    1
  );


  const week =
    new Date(
      today
    );


  const day =
    week.getDay() ||
    7;


  week.setDate(
    week.getDate() -
    day +
    1
  );


  let list =
    [
      ...state.sales
    ];


  if (
    mode === "today"
  ) {

    list =
      list.filter(
        sale =>
          new Date(
            sale.createdAt
          ) >=
          today
      );
  }


  if (
    mode ===
    "yesterday"
  ) {

    list =
      list.filter(
        sale => {

          const date =
            new Date(
              sale.createdAt
            );


          return (
            date >=
            yesterday &&
            date <
            today
          );
        }
      );
  }


  if (
    mode === "week"
  ) {

    list =
      list.filter(
        sale =>
          new Date(
            sale.createdAt
          ) >=
          week
      );
  }


  list.sort(
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


  $("#salesList")
    .innerHTML =
    salesHtml(
      list
    );
};


window.openSale =
id => {

  const sale =
    state.sales.find(
      item =>
        item.id === id
    );


  if (sale) {

    showReceipt(
      sale
    );
  }
};


/* ================================
   PRODUCTOS / SERVICIOS
================================ */

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
    state.products.length

      ? state.products
          .map(
            product => `

              <div class="row-card">

                <div class="row-head">

                  <div>

                    <strong>
                      ${esc(
                        product.name
                      )}
                    </strong>


                    <div class="muted">

                      ${esc(
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
                              product.stock ||
                              0
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
                              .map(esc)
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


                  <button
                    class="btn danger"

                    onclick="
                      askDeleteProduct(
                        '${product.id}'
                      )
                    "
                  >
                    Eliminar
                  </button>

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


  $("#app").innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          ${label}
        </h2>

        <p>

          Agrega,
          edita o elimina
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

    `,
    "more"
  );
}


window.productForm =
id => {

  const product =
    id
      ? state.products.find(
          item =>
            item.id === id
        )
      : null;


  modal(`

    <h3>

      ${
        product
          ? "Editar"
          : "Nuevo"
      }

      ${
        isServices()
          ? "servicio"
          : "producto"
      }

    </h3>


    <div class="form-grid">

      <div class="field">

        <label>
          Nombre
        </label>

        <input
          id="pName"

          value="${esc(
            product?.name ||
            ""
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

          value="${Number(
            product?.price ||
            0
          )}"
        >

      </div>


      <div class="field">

        <label>
          Categoría
        </label>

        <input
          id="pCategory"

          value="${esc(
            product?.category ||
            ""
          )}"
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

                value="${Number(
                  product?.stock ||
                  0
                )}"
              >

            </div>


            <div class="field">

              <label>
                Variantes opcionales
              </label>

              <input
                id="pVariants"

                value="${esc(
                  product
                    ?.variants
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
    $("#pName")
      .value
      .trim();


  const price =
    Number(
      $("#pPrice")
        .value ||
      0
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


  let product =
    id
      ? state.products.find(
          item =>
            item.id === id
        )
      : null;


  if (!product) {

    product = {
      id:
        uid("p")
    };


    state.products.push(
      product
    );
  }


  product.name =
    name;


  product.price =
    price;


  product.category =
    $("#pCategory")
      .value
      .trim() ||
    "Otros";


  product.stock =
    Number(
      $("#pStock")
        .value ||
      0
    );


  product.variants =
    $("#pVariants")
      .value
      .split(",")
      .map(
        item =>
          item.trim()
      )
      .filter(
        Boolean
      );


  await put(
    "products",
    product
  );


  closeModal();

  renderProducts();


  toast(
    "Guardado."
  );
};


window.askDeleteProduct =
id => {

  const product =
    state.products.find(
      item =>
        item.id === id
    );


  if (!product) {
    return;
  }


  modal(`

    <h3>
      Eliminar
    </h3>


    <p>

      ¿Quieres eliminar

      <strong>
        ${esc(
          product.name
        )}
      </strong>

      ?

    </p>


    <p class="muted">
      Las ventas anteriores
      no se borrarán.
    </p>


    <div class="toolbar">

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

  await del(
    "products",
    id
  );


  state.products =
    state.products.filter(
      item =>
        item.id !== id
    );


  cart =
    cart.filter(
      item =>
        item.id !== id
    );


  closeModal();

  renderProducts();


  toast(
    "Eliminado."
  );
};


/* ================================
   CLIENTES / CRÉDITO
================================ */

function renderClients() {

  const html =
    state.clients.length

      ? state.clients
          .map(
            client => `

              <div class="row-card">

                <div class="row-head">

                  <div>

                    <strong>
                      ${esc(
                        client.name
                      )}
                    </strong>

                    <div class="muted">

                      ${esc(
                        client.phone ||
                        "Sin teléfono"
                      )}

                    </div>

                  </div>


                  <strong>

                    ${money(
                      client.balance ||
                      0
                    )}

                  </strong>

                </div>


                ${
                  Number(
                    client.balance ||
                    0
                  ) > 0

                    ? `

                      <div
                        class="toolbar"
                        style="margin-top:10px"
                      >

                        <button
                          class="btn ghost"

                          onclick="
                            abono(
                              '${client.id}'
                            )
                          "
                        >
                          Registrar abono
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


  $("#app").innerHTML =
    shell(`

      <section class="
        screen-title
      ">

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

    `,
    "more"
  );
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

        <input id="cName">

      </div>


      <div class="field">

        <label>
          Teléfono / WhatsApp
        </label>

        <input id="cPhone">

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
    $("#cName")
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
      uid("c"),

    name,

    phone:
      $("#cPhone")
        .value
        .trim(),

    balance: 0
  };


  await put(
    "clients",
    client
  );


  state.clients.push(
    client
  );


  closeModal();

  renderClients();
};


window.abono =
id => {

  const client =
    state.clients.find(
      item =>
        item.id === id
    );


  modal(`

    <h3>
      Registrar abono
    </h3>


    <p>

      ${esc(
        client.name
      )}

      ·

      Saldo

      ${money(
        client.balance
      )}

    </p>


    <div class="field">

      <label>
        Monto
      </label>

      <input
        id="payAmount"
        type="number"
      >

    </div>


    <div class="field">

      <label>
        Método
      </label>


      <select id="payMethod">

        <option>
          Efectivo
        </option>

        <option>
          SINPE
        </option>

        <option>
          Tarjeta/Otro
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
          saveAbono(
            '${id}'
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


window.saveAbono =
async id => {

  const client =
    state.clients.find(
      item =>
        item.id === id
    );


  const amount =
    Number(
      $("#payAmount")
        .value ||
      0
    );


  const method =
    $("#payMethod")
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
        client.balance ||
        0
      ) -
      amount
    );


  await put(
    "clients",
    client
  );


  /*
    Si es soda/comida y
    la caja está abierta,
    el abono queda ligado.
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

      createdAt:
        new Date()
          .toISOString()
    };


    await put(
      "cashMoves",
      move
    );


    state.cashMoves.push(
      move
    );
  }


  closeModal();

  renderClients();


  toast(
    "Abono registrado."
  );
};


/* ================================
   PEDIDOS
================================ */

function renderOrders() {

  if (
    !isFood()
  ) {

    screen =
      "home";


    renderHome();

    return;
  }


  const html =
    state.orders.length

      ? [
          ...state.orders
        ]
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

                    ${esc(
                      order.status
                    )}

                  </span>

                </div>


                ${
                  order.notes

                    ? `
                      <div
                        style="margin-top:10px"
                      >

                        ${esc(
                          order.notes
                        )}

                      </div>
                    `

                    : ""
                }


                <div
                  class="toolbar"
                  style="margin-top:10px"
                >

                  ${
                    order.status ===
                    "Pendiente"

                      ? `
                        <button
                          class="btn primary"

                          onclick="
                            orderStatus(
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
                            orderStatus(
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
                            orderStatus(
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


  $("#app").innerHTML =
    shell(`

      <section class="
        screen-title
      ">

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

    `,
    "orders"
  );
}


window.newOrder =
() => {

  modal(`

    <h3>
      Nuevo pedido
    </h3>


    <div class="field">

      <label>
        Cliente opcional
      </label>

      <input id="oClient">

    </div>


    <div class="field">

      <label>
        Productos / nota
      </label>

      <textarea
        id="oNote"
        rows="4"

        placeholder="
          Ej. 2 casados,
          1 fresco,
          sin cebolla
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
};


window.saveOrder =
async () => {

  const note =
    $("#oNote")
      .value
      .trim();


  if (!note) {

    toast(
      "Escribe el pedido."
    );

    return;
  }


  const order = {

    id:
      uid("o"),

    number:
      state.orders.length +
      1,

    customer:
      $("#oClient")
        .value
        .trim(),

    notes:
      note,

    items: [],

    status:
      "Pendiente",

    createdAt:
      new Date()
        .toISOString()
  };


  await put(
    "orders",
    order
  );


  state.orders.push(
    order
  );


  closeModal();

  renderOrders();
};


window.orderStatus =
async (
  id,
  status
) => {

  const order =
    state.orders.find(
      item =>
        item.id === id
    );


  if (!order) {
    return;
  }


  order.status =
    status;


  await put(
    "orders",
    order
  );


  renderOrders();
};


/* ================================
   CAJA - SOLO COMIDA
================================ */

function renderCash() {

  if (
    !isFood()
  ) {

    screen =
      "home";


    renderHome();

    return;
  }


  const shift =
    currentShift();


  /*
    CAJA CERRADA
  */

  if (!shift) {

    $("#app").innerHTML =
      shell(`

        <section class="
          screen-title
        ">

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


          ${
            role === "owner"

              ? `
                <button
                  class="
                    btn
                    primary
                    full
                  "

                  onclick="
                    openCash()
                  "
                >
                  Abrir caja
                </button>
              `

              : `
                <p class="muted">
                  El dueño debe
                  abrir la caja.
                </p>
              `
          }

        </div>

      `,
      "more"
    );


    return;
  }


  const sales =
    state.sales.filter(
      sale =>
        sale.shiftId ===
        shift.id
    );


  const sumMethod =
    method =>
      sales
        .filter(
          sale =>
            sale.method ===
            method
        )
        .reduce(
          (
            total,
            sale
          ) =>
            total +
            Number(
              sale.total ||
              0
            ),
          0
        );


  const cash =
    sumMethod(
      "Efectivo"
    );


  const sinpe =
    sumMethod(
      "SINPE"
    );


  const cardAmount =
    sumMethod(
      "Tarjeta/Otro"
    );


  const credit =
    sumMethod(
      "Crédito"
    );


  const moves =
    state.cashMoves.filter(
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
            move.amount ||
            0
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
            move.amount ||
            0
          ),
        0
      );


  const creditCash =
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
            move.amount ||
            0
          ),
        0
      );


  const expected =
    Number(
      shift.opening ||
      0
    ) +
    cash +
    cashIn +
    creditCash -
    cashOut;


  $("#app").innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          Caja
        </h2>

        <p>
          Todo lo vendido
          en este turno
          queda ligado aquí.
        </p>

      </section>


      <div class="kpi-grid">

        <div class="kpi">

          <span class="muted">
            Efectivo
          </span>

          <strong>
            ${money(cash)}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            SINPE
          </span>

          <strong>
            ${money(sinpe)}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            Tarjeta
          </span>

          <strong>
            ${money(
              cardAmount
            )}
          </strong>

        </div>


        <div class="kpi">

          <span class="muted">
            Crédito
          </span>

          <strong>
            ${money(credit)}
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


        <div class="
          ticket-line
          ticket-total
        ">

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


      ${
        role === "owner"

          ? `
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
                closeCash(
                  ${expected}
                )
              "
            >
              Cerrar caja
            </button>
          `

          : ""
      }

    `,
    "more"
  );
}


window.openCash =
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
        id="opening"
        type="number"
        value="0"
      >

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          saveOpenCash()
        "
      >
        Abrir caja
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


window.saveOpenCash =
async () => {

  const shift = {

    id:
      uid("shift"),

    opening:
      Number(
        $("#opening")
          .value ||
        0
      ),

    openedAt:
      new Date()
        .toISOString(),

    status:
      "open"
  };


  await put(
    "cashSessions",
    shift
  );


  state.cashSessions.push(
    shift
  );


  closeModal();


  screen =
    "home";


  renderHome();


  toast(
    "Caja abierta. Ya puedes vender."
  );
};


window.closeCash =
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
        id="counted"
        type="number"
      >

    </div>


    <div
      class="toolbar"
      style="margin-top:14px"
    >

      <button
        class="btn primary"

        onclick="
          saveCloseCash(
            ${expected}
          )
        "
      >
        Confirmar cierre
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


window.saveCloseCash =
async expected => {

  const shift =
    currentShift();


  shift.expected =
    expected;


  shift.counted =
    Number(
      $("#counted")
        .value ||
      0
    );


  shift.difference =
    shift.counted -
    expected;


  shift.closedAt =
    new Date()
      .toISOString();


  shift.status =
    "closed";


  await put(
    "cashSessions",
    shift
  );


  closeModal();


  screen =
    "home";


  renderHome();


  toast(
    "Caja cerrada."
  );
};


/* ================================
   CATÁLOGO / MENÚ QR
================================ */

function renderCatalog() {

  const label =
    isFood()
      ? "Menú QR"
      : "Catálogo QR";


  $("#app").innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          ${label}
        </h2>

        <p>
          Vista previa de
          lo que verá el cliente.
        </p>

      </section>


      <div class="panel">

        ${state.products
          .map(
            product => `

              <div class="
                catalog-card
              ">

                <div>

                  <strong>
                    ${esc(
                      product.name
                    )}
                  </strong>


                  <div class="muted">

                    ${esc(
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
        style="margin-top:14px"
      >

        <strong>
          QR público
        </strong>


        <p class="muted">

          Para que el QR funcione
          desde otro teléfono
          con tus productos reales
          y envíe pedidos
          automáticamente a
          Mi Punto CR,
          necesitamos conectar
          la nube.

        </p>


        <p class="muted">

          No vamos a simularlo
          con información falsa.

        </p>

      </div>

    `,
    "more"
  );
}


/* ================================
   CONFIGURACIÓN
================================ */

function renderSettings() {

  if (
    role !== "owner"
  ) {

    screen =
      "home";


    renderHome();

    return;
  }


  const settings =
    state.settings;


  $("#app").innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          Configuración
        </h2>

        <p>
          Mi Punto CR se adapta
          al tipo de negocio.
        </p>

      </section>


      <div class="panel">


        <div class="form-grid">


          <div class="field">

            <label>
              Tipo de negocio
            </label>


            <select id="sType">

              <option
                value="food"

                ${
                  type() ===
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
                  type() ===
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
                  type() ===
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
              id="sName"

              value="${esc(
                settings
                  .businessName
              )}"
            >

          </div>


          <div class="field">

            <label>
              WhatsApp
            </label>

            <input
              id="sWa"

              value="${esc(
                settings
                  .whatsapp
              )}"
            >

          </div>


          <div class="field">

            <label>
              Número SINPE
            </label>

            <input
              id="sSinpe"

              value="${esc(
                settings
                  .sinpe
              )}"
            >

          </div>


          <div class="field">

            <label>
              Impuesto
            </label>


            <select id="sTax">

              <option
                value="included"

                ${
                  settings
                    .taxMode ===
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
                  settings
                    .taxMode ===
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
                  settings
                    .taxMode ===
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
              id="sRate"
              type="number"

              value="${Number(
                settings
                  .taxRate ||
                13
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
            margin-top:14px
          "

          onclick="
            saveSettings()
          "
        >
          Guardar cambios
        </button>

      </div>

    `,
    "more"
  );
}


window.saveSettings =
async () => {

  state.settings = {

    ...state.settings,

    businessType:
      $("#sType")
        .value,

    businessName:
      $("#sName")
        .value
        .trim() ||
      "Mi Punto CR",

    whatsapp:
      $("#sWa")
        .value
        .trim(),

    sinpe:
      $("#sSinpe")
        .value
        .trim(),

    taxMode:
      $("#sTax")
        .value,

    taxRate:
      Number(
        $("#sRate")
          .value ||
        0
      )
  };


  await put(
    "settings",
    state.settings
  );


  screen =
    "home";


  renderHome();


  toast(
    "Configuración guardada."
  );
};


/* ================================
   MÁS
================================ */

function renderMore() {

  let cards =
    "";


  if (
    isFood()
  ) {

    cards +=

      card(
        "products",
        "Productos",
        "Comidas, bebidas y stock"
      ) +

      card(
        "clients",
        "Clientes / Crédito",
        "Saldos y abonos"
      ) +

      card(
        "cash",
        "Caja",
        "Apertura y cierre"
      ) +

      card(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      ) +

      card(
        "catalog",
        "Menú QR",
        "Vista del menú"
      );
  }


  if (
    isProducts()
  ) {

    cards +=

      card(
        "products",
        "Productos",
        "Artículos, variantes y stock"
      ) +

      card(
        "clients",
        "Clientes / Crédito",
        "Saldos y abonos"
      ) +

      card(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      ) +

      card(
        "catalog",
        "Catálogo QR",
        "Vista del catálogo"
      );
  }


  if (
    isServices()
  ) {

    cards +=

      card(
        "products",
        "Servicios",
        "Precios y categorías"
      ) +

      card(
        "clients",
        "Clientes",
        "Contactos y crédito"
      ) +

      card(
        "sales",
        "Mis ventas",
        "Comprobantes e historial"
      ) +

      card(
        "catalog",
        "Catálogo QR",
        "Vista de servicios"
      );
  }


  if (
    role === "owner"
  ) {

    cards +=
      card(
        "settings",
        "Configuración",
        "Datos básicos"
      );
  }


  $("#app").innerHTML =
    shell(`

      <section class="
        screen-title
      ">

        <h2>
          Más
        </h2>

        <p>
          Solo herramientas útiles
          para este negocio.
        </p>

      </section>


      <div class="home-grid">
        ${cards}
      </div>

    `,
    "more"
  );
}


/* ================================
   PIN
================================ */

function renderLock() {

  $("#app").innerHTML = `

    <div class="lock-screen">

      <div class="lock-card">

        <h1>
          Mi Punto CR
        </h1>

        <p>
          Ingresa tu PIN.
        </p>


        <input
          id="pin"
          class="pin-input"
          type="password"
          inputmode="numeric"
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
            unlock()
          "
        >
          Entrar
        </button>

      </div>

    </div>
  `;
}


window.unlock =
() => {

  const pin =
    $("#pin")
      .value
      .trim();


  if (
    state.settings
      .ownerPin &&
    pin ===
    state.settings
      .ownerPin
  ) {

    role =
      "owner";


    locked =
      false;


    render();

    return;
  }


  if (
    state.settings
      .cashierPin &&
    pin ===
    state.settings
      .cashierPin
  ) {

    role =
      "cashier";


    locked =
      false;


    render();

    return;
  }


  toast(
    "PIN incorrecto."
  );
};


/* ================================
   MODALES
================================ */

function modal(
  html
) {

  closeModal();


  const element =
    document
      .createElement(
        "div"
      );


  element.id =
    "modalRoot";


  element.className =
    "modal-backdrop";


  element.innerHTML = `

    <div class="modal">
      ${html}
    </div>
  `;


  element.onclick =
    event => {

      if (
        event.target ===
        element
      ) {

        closeModal();
      }
    };


  document.body
    .appendChild(
      element
    );
}


window.closeModal =
() => {

  $("#modalRoot")
    ?.remove();
};


function toast(
  text
) {

  const element =
    document
      .createElement(
        "div"
      );


  element.className =
    "toast";


  element.textContent =
    text;


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


/* ================================
   CONEXIÓN
================================ */

window.addEventListener(
  "online",
  render
);


window.addEventListener(
  "offline",
  render
);


/* ================================
   INICIAR
================================ */

(async () => {

  db =
    await openDB();


  await load();


  locked =
    Boolean(
      state.settings
        .pinEnabled
    );


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