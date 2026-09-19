const { test, expect } = require('@playwright/test');

async function enterIsolatedTestBusiness(page) {
  await page.goto('/');

  // La pantalla inicial real de PUNTO YA CR
  await expect(page.locator('body')).toContainText('Tu negocio, más simple');

  // Entrar sin cuenta para no utilizar datos reales
  const guest = page.getByRole('button', { name: /empezar sin cuenta/i });

  await expect(guest).toBeVisible();
  await guest.click();

  // Esperar a que la aplicación termine de entrar
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  return page;
}

test.describe('PUNTO YA CR - smoke seguro', () => {

  test('carga correctamente y no genera errores JavaScript graves', async ({ page }) => {
    const jsErrors = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    await enterIsolatedTestBusiness(page);

    // Confirmar que realmente salimos de la pantalla inicial
    await expect(
      page.getByRole('button', { name: /empezar sin cuenta/i })
    ).not.toBeVisible();

    expect(
      jsErrors,
      `Errores JavaScript detectados:\n${jsErrors.join('\n')}`
    ).toEqual([]);
  });

  test('las pantallas principales existentes pueden abrirse', async ({ page }) => {
    await enterIsolatedTestBusiness(page);

    const pantallas = [
      'Inicio',
      'Vender',
      'Pedidos',
      'Mesas',
      'Productos',
      'Clientes / Crédito',
      'Caja',
      'Mis ventas',
      'Catálogo QR',
      'Empleados',
      'Configuración'
    ];

    for (const nombre of pantallas) {
      const acceso = page.getByText(nombre, { exact: true }).first();

      // Solo prueba módulos que realmente estén disponibles
      if (await acceso.isVisible().catch(() => false)) {
        await acceso.click();
        await page.waitForTimeout(250);
      }
    }
  });

});
