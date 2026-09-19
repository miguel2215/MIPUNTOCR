const { test, expect } = require('@playwright/test');

async function entrarComoNegocioQA(page) {
  await page.goto('/');

  await expect(page.locator('body'))
    .toContainText('Tu negocio, más simple');

  await page.getByRole('button', {
    name: /empezar sin cuenta/i
  }).click();

  await expect(
    page.getByText('Empezar sin cuenta', { exact: true })
  ).toBeVisible();

  await page.locator('#guestBusiness')
    .fill('BOT QA PRODUCTO');

  await page.locator('#guestType')
    .selectOption('products');

  await page.getByRole('button', {
    name: /^Empezar$/i
  }).click();

  await expect(
    page.getByText('Inicio', { exact: true }).first()
  ).toBeVisible();
}

test.describe('PUNTO YA CR - Producto → Vender', () => {

  test('crea un producto QA y lo encuentra en Vender', async ({ page }) => {

    const erroresJS = [];

    page.on('pageerror', error => {
      erroresJS.push(error.message);
    });

    await entrarComoNegocioQA(page);

    // ========================================
    // 1. ABRIR PRODUCTOS
    // ========================================

    await page.getByText('Productos', {
      exact: true
    }).first().click();

    const botonNuevo = page.getByRole('button', {
      name: /nuevo producto|agregar producto|crear producto/i
    }).first();

    await expect(botonNuevo).toBeVisible();
    await botonNuevo.click();

    // ========================================
    // 2. COMPROBAR FORMULARIO REAL
    // ========================================

    await expect(
      page.getByText('Nuevo producto', { exact: true })
    ).toBeVisible();

    // Usamos los labels reales del formulario
    const nombre = page.getByLabel('Nombre', { exact: true });
    const precio = page.getByLabel('Precio', { exact: true });
    const categoria = page.getByLabel('Categoría', { exact: true });
    const stock = page.getByLabel('Stock', { exact: true });

    await expect(nombre).toBeVisible();
    await expect(precio).toBeVisible();
    await expect(categoria).toBeVisible();
    await expect(stock).toBeVisible();

    // ========================================
    // 3. CREAR PRODUCTO QA
    // ========================================

    await nombre.fill('PRODUCTO BOT QA');

    await precio.fill('1000');

    await categoria.fill('QA');

    await stock.fill('10');

    await page.getByRole('button', {
      name: /^Guardar$/i
    }).click();

    // ========================================
    // 4. COMPROBAR QUE SE GUARDÓ
    // ========================================

    await expect(
      page.getByText('PRODUCTO BOT QA', { exact: true }).first()
    ).toBeVisible();

    // ========================================
    // 5. IR A VENDER
    // ========================================

    await page.getByText('Vender', {
      exact: true
    }).first().click();

    // ========================================
    // 6. COMPROBAR QUE EL PRODUCTO
    //    LLEGÓ AL PUNTO DE VENTA
    // ========================================

    await expect(
      page.getByText('PRODUCTO BOT QA', { exact: true }).first()
    ).toBeVisible();

    await expect(page.locator('body'))
      .toContainText(/1[.,]?000/);

    // ========================================
    // 7. AGREGAR PRODUCTO A LA VENTA
    // ========================================

    await page.getByText(
      'PRODUCTO BOT QA',
      { exact: true }
    ).first().click();

    // El producto debe continuar visible
    // después de agregarlo.
    await expect(
      page.getByText('PRODUCTO BOT QA', { exact: true }).first()
    ).toBeVisible();

    // El precio esperado debe estar presente.
    await expect(page.locator('body'))
      .toContainText(/₡?\s*1[.,]?000/);

    // ========================================
    // 8. NO COBRAMOS
    // ========================================
    // Intencionalmente terminamos aquí.
    // No pulsamos Efectivo, SINPE,
    // Tarjeta ni Crédito.

    // ========================================
    // 9. CONTROL DE ERRORES JS
    // ========================================

    expect(
      erroresJS,
      `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
    ).toEqual([]);
  });

});
