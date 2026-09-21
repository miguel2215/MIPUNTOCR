const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores } = require('./helpers');

test.describe('PUNTO YA CR - Retail v7.39', () => {
  test('Retail separa operación de administración y agrega compras/reposición', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA RETAIL 739', tipo: 'products' });

    await page.evaluate(() => window.go('home'));
    await expect(page.locator('body')).toContainText(/Compras \/ Reposición/i);
    await expect(page.locator('body')).toContainText(/Panel del Emprendedor/i);

    await page.evaluate(() => window.go('purchases'));
    await expect(page.getByRole('heading', { name: /Compras \/ Reposición/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/Nueva compra/i);
    await expect(page.locator('body')).toContainText(/Proveedores/i);
    await expect(page.locator('body')).toContainText(/Movimientos/i);

    await page.evaluate(() => window.go('settings'));
    await expect(page.locator('body')).toContainText(/Panel del Emprendedor/i);
    await expect(page.locator('body')).toContainText(/Control de caja en Retail/i);
    await expect(page.locator('body')).toContainText(/Facturación electrónica, empleados, reportes, crecimiento/i);
    esperarSinErrores(control);
  });
});
