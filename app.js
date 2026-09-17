function renderSale() {
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const totals = calculateTotals(subtotal);

  /* Crear categorías automáticamente */
  const categories = [
    ...new Set(
      appState.products.map(
        product =>
          product.category?.trim() ||
          "Otros"
      )
    )
  ];

  const categoriesHTML = categories
    .map(category => {
      const productsInCategory =
        appState.products.filter(
          product =>
            (product.category?.trim() ||
              "Otros") === category
        );

      return `
        <button
          class="category-card"
          onclick="openCategory('${escapeAttr(category)}')"
        >
          <span class="category-name">
            ${escapeHtml(category)}
          </span>

          <span class="category-count">
            ${productsInCategory.length}
            ${
              productsInCategory.length === 1
                ? "producto"
                : "productos"
            }
          </span>

          <span class="category-arrow">›</span>
        </button>
      `;
    })
    .join("");

  const cartHTML = cart.length
    ? cart
        .map(
          item => `
            <div class="cart-item">

              <div>

                <strong>
                  ${escapeHtml(item.name)}
                </strong>

                ${
                  item.variant
                    ? `
                      <div class="muted">
                        ${escapeHtml(item.variant)}
                      </div>
                    `
                    : ""
                }

                <div class="muted">
                  ${money(item.price)} c/u
                </div>

              </div>

              <div class="qty">

                <button
                  onclick="changeQty('${item.cartId}', -1)"
                >
                  −
                </button>

                <strong>
                  ${item.qty}
                </strong>

                <button
                  onclick="changeQty('${item.cartId}', 1)"
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
        Selecciona una categoría para comenzar.
      </div>
    `;

  document.querySelector(
    "#app"
  ).innerHTML = shell(
    `
      <section class="screen-title">

        <h2>Nueva venta</h2>

        <p>
          Selecciona una categoría.
        </p>

      </section>

      <div class="sale-layout">

        <section class="panel">

          <input
            class="search"
            placeholder="Buscar categoría..."
            oninput="filterCategories(this.value)"
          >

          <div
            id="categoryGrid"
            class="category-grid"
          >
            ${categoriesHTML}
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
            appState.settings.taxMode !==
            "exempt"
              ? `
                <div class="divider"></div>

                <div class="ticket-line">

                  <span class="muted">
                    Impuesto
                  </span>

                  <span>
                    ${money(totals.tax)}
                  </span>

                </div>
              `
              : ""
          }


          <div class="total-box">

            <span>Total</span>

            <span>
              ${money(totals.total)}
            </span>

          </div>


          <div class="payment-grid">

            <button
              class="pay-btn pay-cash"
              onclick="pay('cash')"
            >
              Efectivo
            </button>

            <button
              class="pay-btn pay-sinpe"
              onclick="pay('sinpe')"
            >
              SINPE
            </button>

            <button
              class="pay-btn pay-card"
              onclick="pay('card')"
            >
              Tarjeta / Otro
            </button>

            <button
              class="pay-btn pay-credit"
              onclick="pay('credit')"
            >
              Fiado
            </button>

          </div>

        </section>

      </div>
    `,
    "sale"
  );
}