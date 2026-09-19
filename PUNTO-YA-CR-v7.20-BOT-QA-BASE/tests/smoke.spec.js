const { test, expect } = require('@playwright/test');

async function enterIsolatedTestBusiness(page) {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('PUNTO YA CR');

  const guest = page.getByRole('button', { name: /sin cuenta/i });
  if (await guest.isVisible().catch(() => false)) {
    await guest.click();
    await page.getByLabel('Nombre del negocio').fill('BOT QA');
    await page.getByLabel('Tipo de negocio').selectOption('products');
    await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  }

  await expect(page.locator('body')).toContainText('BOT QA');
}

test.describe('PUNTO YA CR - smoke seguro', () => {
  test('carga sin errores JavaScript graves y muestra la aplicación', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', error => jsErrors.push(error.message));

    await enterIsolatedTestBusiness(page);
    await expect(page.getByText('Inicio', { exact: true }).first()).toBeVisible();
    expect(jsErrors, `Errores JavaScript detectados:\n${jsErrors.join('\n')}`).toEqual([]);
  });

  test('las pantallas críticas existentes pueden abrirse', async ({ page }) => {
    const jsErrors = [];
    const failedSameOrigin = [];
    page.on('pageerror', error => jsErrors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(page.url().split('/').slice(0, 3).join('/')) && response.status() >= 400) {
        failedSameOrigin.push(`${response.status()} ${response.url()}`);
      }
    });

    await enterIsolatedTestBusiness(page);

    const screens = [
      ['sale', /Venta|Vender/i],
      ['orders', /Pedidos/i],
      ['tables', /Mesas/i],
      ['products', /Productos/i],
      ['clients', /Clientes/i],
      ['cash', /Caja/i],
      ['sales', /Mis ventas/i],
      ['catalog', /Catálogo QR/i],
      ['settings', /Configuración/i]
    ];

    for (const [target, expected] of screens) {
      await test.step(`Abrir ${target}`, async () => {
        await page.evaluate(t => window.go(t), target);
        await expect(page.locator('body')).toContainText(expected);
      });
    }

    expect(jsErrors, `Errores JavaScript detectados:\n${jsErrors.join('\n')}`).toEqual([]);
    expect(failedSameOrigin, `Solicitudes locales fallidas:\n${failedSameOrigin.join('\n')}`).toEqual([]);
  });
});
