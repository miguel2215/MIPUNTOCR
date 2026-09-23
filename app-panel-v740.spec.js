const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo } = require('./helpers');

test.describe('PUNTO YA CR - v7.40 app operativa + panel', () => {
  test('Restaurante deja administración avanzada fuera de la app', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA RESTAURANTE PANEL', tipo: 'food', factura: 'yes' });

    await expect(page.locator(`button[onclick="go('expenses')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('growth')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('fiscal')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('users')"]:visible`)).toHaveCount(0);
    await expect(page.getByText('Panel del Emprendedor', { exact: true }).first()).toBeVisible();

    await abrirModulo(page, 'Configuración');
    await expect(page.locator('#sFiscalUses')).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('growth')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('fiscal')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('users')"]:visible`)).toHaveCount(0);
    await expect(page.getByText('Panel del Emprendedor', { exact: true }).first()).toBeVisible();
    esperarSinErrores(control);
  });

  test('Retail conserva operación y mueve administración al panel', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA RETAIL PANEL', tipo: 'products', factura: 'yes' });

    await expect(page.locator(`button[onclick="go('expenses')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('growth')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('fiscal')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('users')"]:visible`)).toHaveCount(0);
    await expect(page.getByText('Panel del Emprendedor', { exact: true }).first()).toBeVisible();
    esperarSinErrores(control);
  });
});
