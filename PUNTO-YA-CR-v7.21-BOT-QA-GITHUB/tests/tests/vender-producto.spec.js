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

  await page.locator('#guestBusiness').fill('BOT QA PRODUCTO');
  await page.locator('#guestType').selectOption('products');

  await page.getByRole('button', {
    name: /^Empezar$/i
  }).click();

  await expect(
    page.getByText('Inicio', { exact: true }).first()
  ).toBeVisible();
}

test.describe('PUNTO YA CR - Producto y Vender', () => {

  test('crea un producto QA y comprueba que puede usarse en Vender',
    async ({ page }) => {

      const erroresJS = [];

      page.on('pageerror', error => {
        erroresJS.push(error.message);
      });

      await entrarComoNegocioQA(page);

      // -------------------------
      // 1. ABRIR PRODUCTOS
      // -------------------------

      await page.getByText('Productos', {
        exact: true
      }).first().click();

      await expect(page.locator('body'))
        .toContainText(/productos/i);

      // -------------------------
      // 2. BUSCAR BOTÓN PARA
      //    CREAR PRODUCTO
      // -------------------------

      const nuevoProducto = page.getByRole('button', {
        name: /nuevo producto|agregar producto|crear producto/i
      }).first();

      await expect(nuevoProducto).toBeVisible();

      await nuevoProducto.click();

      // -------------------------
      // 3. COMPROBAR FORMULARIO
      // -------------------------

      // Todavía NO llenamos ni guardamos.
      // Primero queremos descubrir y validar
      // el formulario real de esta versión.

      const formularioVisible =
        page.locator('input:visible, select:visible, textarea:visible');

      expect(await formularioVisible.count())
        .toBeGreaterThan(0);

      // -------------------------
      // 4. CONTROL JAVASCRIPT
      // -------------------------

      expect(
        erroresJS,
        `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
      ).toEqual([]);
    });

});
