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
  page.getByRole('heading', { name: 'Nuevo producto' })
).toBeVisible();
    
    // Usamos los labels reales del formulario
   const nombre = page.getByRole('textbox').filter({
  hasNot: page.locator('[placeholder]')
}).first();

const precio = page.getByRole('spinbutton').nth(0);

const categoria = page.getByPlaceholder('Ej. Bebidas');

const stock = page.getByRole('spinbutton').nth(1);

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
       // ========================================
    // 6. DETECTAR PC / MÓVIL
    // ========================================

    const esMovil =
      (page.viewportSize()?.width || 9999) <= 768;

    // En móvil primero aparecen las categorías.
    if (esMovil) {
      const categoriaQA = page.getByRole('button', {
        name: /QA\s+1 producto/i
      });

      await expect(categoriaQA).toBeVisible();
      await categoriaQA.click();
    }

    // ========================================
    // 7. COMPROBAR PRODUCTO EN VENDER
    // ========================================

    const productoQA = page.getByText(
      'PRODUCTO BOT QA',
      { exact: true }
    ).first();

    await expect(productoQA).toBeVisible();

    // Comprobar precio aceptando espacios normales
    // y espacios especiales usados al formatear moneda.
    await expect(page.locator('body'))
      .toContainText(/₡\s*1[\s\u00A0\u202F]*000/);

    // ========================================
    // 8. AGREGAR PRODUCTO A LA VENTA
    // ========================================

    await productoQA.click();

    // Debe aparecer una venta con ₡1.000.
    await expect(page.locator('body'))
      .toContainText(/₡\s*1[\s\u00A0\u202F]*000/);

       // ========================================
    // 9. PROBAR CANTIDAD Y TOTALES
    // ========================================

    // El producto ya fue agregado una vez.
    // Lo agregamos nuevamente para llevarlo a cantidad 2.
    await productoQA.click();

    // Ahora el total esperado es ₡2 000.
    await expect(page.locator('body'))
      .toContainText(/₡\s*2[\s\u00A0\u202F]*000/);

    // ========================================
    // 10. VACIAR LA VENTA
    // ========================================

    const botonVaciar = page.getByRole('button', {
      name: /^Vaciar$/i
    }).first();

    await expect(botonVaciar).toBeVisible();
    await botonVaciar.click();

    // Dar tiempo a la interfaz para actualizar.
    await page.waitForTimeout(300);

    // El carrito ya no debe contener el producto.
    // El producto puede seguir visible en el catálogo,
    // por eso comprobamos el estado vacío de la venta.
    await expect(page.locator('body'))
      .toContainText(/venta vacía|sin productos|agrega productos/i);

    // El total debe volver a cero.
    await expect(page.locator('body'))
      .toContainText(/₡\s*0(?:[.,]00)?/);

  });

});
