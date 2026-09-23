const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo } = require('./helpers');

test.describe('PUNTO YA CR - Vender artículos', () => {
  test('muestra la interfaz Retail actual en PC y móvil, sin controles de restaurante', async ({ page }, testInfo) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA VENDER', tipo: 'products' });
    await abrirModulo(page, 'Vender');

    const esMovil = testInfo.project.name.toLowerCase().includes('movil');

    if (esMovil) {
      await expect(page.getByRole('heading', { name: 'Vender artículos' })).toBeVisible();
      await expect(page.getByPlaceholder('Buscar producto...')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Escanear', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cobrar', exact: true })).toBeVisible();
      await expect(page.locator('body')).toContainText('Primero agrega productos');
    } else {
      await expect(page.getByText('Punto de venta', { exact: true })).toBeVisible();
      await expect(page.getByText('Categorías', { exact: true })).toBeVisible();
      await expect(page.getByText('Venta actual', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Escanear', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Cliente$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Efectivo$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^SINPE$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Tarjeta$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Crédito$/i })).toBeVisible();
    }

    // Retail NO debe heredar controles de comida/restaurante.
    await expect(page.getByText('Mostrador', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Para llevar', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Mesa', { exact: true })).toHaveCount(0);

    esperarSinErrores(control);
  });
});
