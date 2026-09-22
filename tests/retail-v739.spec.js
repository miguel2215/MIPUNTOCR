const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores } = require('./helpers');

test.describe('PUNTO YA CR - Retail compras / reposición · v7.43', () => {
  test('Retail separa operación de administración y conserva el flujo correcto de compras/reposición', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA RETAIL 743', tipo: 'products' });

    await page.evaluate(() => window.go('home'));
    await expect(page.locator('body')).toContainText(/Compras \/ Reposición/i);
    await expect(page.locator('body')).toContainText(/Panel del Emprendedor/i);

    await page.evaluate(() => window.go('purchases'));
    await expect(page.getByRole('heading', { name: /Compras \/ Reposición/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pedido a proveedor/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar compra ya recibida/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Proveedores$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Movimientos$/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/Enviar un pedido no altera el stock/i);
    await expect(page.locator('body')).toContainText(/Recepciones recientes/i);
    await expect(page.locator('body')).toContainText(/Estas entradas sí aumentaron el inventario/i);
    await expect(page.locator('body')).toContainText(/Cuentas por pagar/i);

    await page.evaluate(() => window.go('settings'));
    await expect(page.locator('body')).toContainText(/Panel del Emprendedor/i);
    await expect(page.locator('body')).toContainText(/Control de caja en Retail/i);
    await expect(page.locator('body')).toContainText(/suscripción Pro/i);
    await expect(page.locator('body')).toContainText(/configuración fiscal/i);

    esperarSinErrores(control);
  });
});
