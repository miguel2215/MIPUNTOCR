const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo } = require('./helpers');

test.describe('PUNTO YA CR - Smoke seguro', () => {
  test('abre un negocio de artículos y carga Inicio sin errores graves', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA SMOKE', tipo: 'products' });

    await expect(page.locator('body')).toContainText('¿Qué necesitas hacer?');
    await expect(page.locator('body')).toContainText('Plan Gratis');

    esperarSinErrores(control);
  });

  test('las pantallas principales del negocio de artículos pueden abrirse', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA NAV', tipo: 'products' });

    const pantallas = [
      'Vender',
      'Pedidos',
      'Productos',
      'Clientes / Crédito',
      'Caja',
      'Mis ventas',
      'Catálogo QR',
      'Configuración'
    ];

    for (const nombre of pantallas) {
      await abrirModulo(page, nombre);
      await expect(page.locator('body')).not.toBeEmpty();
    }

    esperarSinErrores(control);
  });
});
