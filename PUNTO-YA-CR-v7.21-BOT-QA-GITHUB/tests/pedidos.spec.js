
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
    .fill('BOT QA PEDIDOS');

  await page.locator('#guestType')
    .selectOption('products');

  await page.getByRole('button', {
    name: /^Empezar$/i
  }).click();

  await expect(
    page.getByText('Inicio', { exact: true }).first()
  ).toBeVisible();
}

test.describe('PUNTO YA CR - Pedidos', () => {

  test('abre Pedidos correctamente en PC y móvil', async ({ page }) => {

    const erroresJS = [];
    const respuestasFallidas = [];

    page.on('pageerror', error => {
      erroresJS.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        respuestasFallidas.push(
          `${response.status()} ${response.url()}`
        );
      }
    });

    await entrarComoNegocioQA(page);

    // ==============================
    // ABRIR PEDIDOS
    // ==============================

    const accesoPedidos = page.getByText(
      'Pedidos',
      { exact: true }
    ).first();

    await expect(accesoPedidos).toBeVisible();
    await accesoPedidos.click();

    // ==============================
    // COMPROBAR QUE PEDIDOS ABRIÓ
    // ==============================

    await expect(page.locator('body'))
      .toContainText(/Pedidos/i);

    // ==============================
    // ESTADOS QUE YA EXISTEN
    // ==============================

    await expect(page.locator('body'))
      .toContainText(/Recibido/i);

    await expect(page.locator('body'))
      .toContainText(/Listo/i);

    await expect(page.locator('body'))
      .toContainText(/Entregado/i);

    // No queremos que regresen estados eliminados.
    await expect(page.locator('body'))
      .not.toContainText(/En preparación/i);

    await expect(page.locator('body'))
      .not.toContainText(/En camino/i);

    // ==============================
    // CONTROL JAVASCRIPT
    // ==============================

    expect(
      erroresJS,
      `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
    ).toEqual([]);

    // ==============================
    // CONTROL DE RED
    // ==============================

    const fallosImportantes = respuestasFallidas.filter(
      fallo =>
        !fallo.includes('favicon') &&
        !fallo.includes('supabase')
    );

    expect(
      fallosImportantes,
      `Solicitudes fallidas:\n${fallosImportantes.join('\n')}`
    ).toEqual([]);
  });

});
