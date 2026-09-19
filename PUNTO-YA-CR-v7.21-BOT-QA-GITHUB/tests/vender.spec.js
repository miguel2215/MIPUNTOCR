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

  await page.locator('#guestBusiness').fill('BOT QA');
  await page.locator('#guestType').selectOption('products');

  await page.getByRole('button', {
    name: /^Empezar$/i
  }).click();

  await expect(
    page.getByText('Inicio', { exact: true }).first()
  ).toBeVisible();
}

test.describe('PUNTO YA CR - Vender', () => {

  test('abre Vender y muestra correctamente los controles', async ({ page }, testInfo) => {

    const erroresJS = [];

    page.on('pageerror', error => {
      erroresJS.push(error.message);
    });

    await entrarComoNegocioQA(page);

    // Abrir Vender
    await page.getByText('Vender', { exact: true }).first().click();

    const esMovil = testInfo.project.name
      .toLowerCase()
      .includes('mobile');

    if (esMovil) {

      // =========================
      // INTERFAZ MÓVIL
      // =========================

      await expect(
        page.getByText('Nueva venta', { exact: true })
      ).toBeVisible();

      await expect(
        page.getByPlaceholder('Buscar categoría...')
      ).toBeVisible();

      await expect(page.locator('body'))
        .toContainText('Primero agrega productos');

      await expect(
        page.getByRole('button', { name: /Cliente opcional/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /^Efectivo$/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /^SINPE$/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /Tarjeta \/ Otro/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /^Crédito$/i })
      ).toBeVisible();

    } else {

      // =========================
      // INTERFAZ PC
      // =========================

      await expect(
        page.getByText('Punto de venta', { exact: true })
      ).toBeVisible();

      await expect(
        page.getByPlaceholder('Buscar en productos...')
      ).toBeVisible();

      await expect(
        page.getByText('Venta actual', { exact: true })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /^Cliente$/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /^Efectivo$/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /^SINPE$/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /Tarjeta/i })
      ).toBeVisible();

      await expect(
        page.getByRole('button', { name: /^Crédito$/i })
      ).toBeVisible();

      await expect(
        page.getByText('Mostrador', { exact: true })
      ).toBeVisible();

      await expect(
        page.getByText('Para llevar', { exact: true })
      ).toBeVisible();

      await expect(
        page.getByText('Express', { exact: true })
      ).toBeVisible();

      await expect(
        page.getByText('Mesa', { exact: true })
      ).toBeVisible();

      await expect(page.locator('body'))
        .toContainText('No hay productos en esta categoría.');
    }

    // =========================
    // CONTROL GENERAL
    // =========================

    expect(
      erroresJS,
      `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
    ).toEqual([]);
  });

});
