const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo } = require('./helpers');

test.describe('PUNTO YA CR - Google y factura · actualizado v7.43', () => {
  test('Retail muestra Factura electrónica PRO desde Vender aun en Gratis', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA FACTURA VISIBLE', tipo: 'products' });
    await abrirModulo(page, 'Vender');
    await expect(page.locator('body')).toContainText(/Factura electrónica · PRO/i);
    esperarSinErrores(control);
  });

  test('un negocio local puede crear o conectar su cuenta con Google sin ocultar correo', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA GOOGLE LINK', tipo: 'products' });
    await page.evaluate(() => window.openCloudLink());
    await expect(page.getByRole('heading', { name: 'Crear o conectar cuenta' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar con Google/i })).toBeVisible();
    await expect(page.locator('#cloudLinkEmail')).toBeVisible();
    await expect(page.locator('#cloudLinkPass')).toBeVisible();
    await expect(page.locator('body')).toContainText(/No se borrarán los datos locales/i);
    esperarSinErrores(control);
  });

  test('en PC la configuración fiscal se administra desde el Panel y no duplica accesos', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'PC-Chromium', 'La navegación lateral se valida solo en PC');
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA FISCAL NAV', tipo: 'products' });

    await expect(page.locator('.desktop-nav')).toContainText(/Panel del Emprendedor/i);
    await expect(page.locator('.desktop-nav')).not.toContainText(/Factura electrónica · PRO/i);

    await abrirModulo(page, 'Configuración');
    await expect(page.locator('body')).toContainText(/configuración fiscal pasan al Panel del Emprendedor/i);
    await expect(page.locator('body')).toContainText(/factura electrónica sigue apareciendo durante el cobro/i);

    esperarSinErrores(control);
  });
});
