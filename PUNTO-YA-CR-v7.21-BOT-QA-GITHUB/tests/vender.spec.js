const { test, expect } = require('@playwright/test');

async function entrarComoNegocioQA(page) {
  await page.goto('/');

  await expect(page.locator('body'))
    .toContainText('Tu negocio, más simple');

  const sinCuenta = page.getByRole('button', {
    name: /empezar sin cuenta/i
  });

  await expect(sinCuenta).toBeVisible();
  await sinCuenta.click();

  // Formulario real de PUNTO YA CR
  await expect(page.getByText('Empezar sin cuenta', { exact: true }))
    .toBeVisible();

  await page.locator('#guestBusiness').fill('BOT QA');

  // Usamos Venta de artículos para esta prueba.
  await page.locator('#guestType').selectOption('products');

  await page.getByRole('button', {
    name: /^Empezar$/i
  }).click();

  await expect(page.getByText('Inicio', { exact: true }).first())
    .toBeVisible();
}

test.describe('PUNTO YA CR - Vender', () => {

  test('abre Vender y muestra los controles principales', async ({ page }) => {
    const erroresJS = [];

    page.on('pageerror', error => {
      erroresJS.push(error.message);
    });

    await entrarComoNegocioQA(page);

    // Abrir Vender
    await page.getByText('Vender', { exact: true }).first().click();

    // Elementos que realmente existen en la venta actual
    await expect(page.getByText('Nueva venta', { exact: true }))
      .toBeVisible();

    await expect(
      page.getByPlaceholder('Buscar categoría...')
    ).toBeVisible();

    await expect(page.getByText('Venta actual', { exact: true }))
      .toBeVisible();

    await expect(page.getByRole('button', { name: 'Vaciar' }))
      .toBeVisible();

    await expect(page.getByRole('button', { name: /Cliente opcional/i }))
      .toBeVisible();

    // Métodos de pago existentes
    await expect(page.getByRole('button', { name: 'Efectivo' }))
      .toBeVisible();

    await expect(page.getByRole('button', { name: 'SINPE' }))
      .toBeVisible();

    await expect(page.getByRole('button', { name: /Tarjeta/i }))
      .toBeVisible();

    await expect(page.getByRole('button', { name: 'Crédito' }))
      .toBeVisible();

    // Un negocio QA nuevo todavía no tiene productos.
    await expect(page.locator('body'))
      .toContainText('Primero agrega productos');

    expect(
      erroresJS,
      `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
    ).toEqual([]);
  });

});
