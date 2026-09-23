const { test, expect } = require('@playwright/test');
const {
  entrarComoNegocioQA,
  capturarErrores,
  esperarSinErrores,
  abrirModulo,
  activarCajaRetail
} = require('./helpers');

test.describe('PUNTO YA CR - Smoke seguro · v7.43', () => {
  test('abre un negocio de artículos y carga Inicio sin errores graves', async ({ page }, testInfo) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA SMOKE', tipo: 'products' });

    const esMovil = testInfo.project.name.toLowerCase().includes('movil');
    if (esMovil) {
      await expect(page.locator('body')).toContainText('¿Qué necesitas hacer?');
      await expect(page.locator('body')).toContainText('Panel del Emprendedor');
      await expect(page.locator('body')).toContainText('Configuración');
    } else {
      await expect(page.locator('body')).toContainText('Accesos rápidos para trabajar');
      await expect(page.locator('body')).toContainText('Categorías, variantes e inventario');
      await expect(page.locator('body')).toContainText('Panel del Emprendedor');
    }

    esperarSinErrores(control);
  });

  test('las pantallas principales Retail abren y Caja aparece solo cuando se activa', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA NAV', tipo: 'products' });

    const pantallas = [
      'Vender',
      'Pedidos',
      'Productos',
      'Compras / Reposición',
      'Clientes / Crédito',
      'Mis ventas',
      'Catálogo virtual',
      'Configuración'
    ];

    for (const nombre of pantallas) {
      await abrirModulo(page, nombre);
      await expect(page.locator('body')).not.toBeEmpty();
    }

    // En Retail el control de caja es opcional y viene desactivado.
    await page.evaluate(() => window.go('home'));
    await expect(page.locator(`button[onclick="go('cash')"]:visible`)).toHaveCount(0);

    // Activarlo debe crear un acceso real y permitir abrir la pantalla de Caja.
    await activarCajaRetail(page);
    await abrirModulo(page, 'Caja');
    await expect(page.getByRole('heading', { name: 'Caja', exact: true })).toBeVisible();
    await expect(page.locator('body')).toContainText(/Caja cerrada|Historial de cierres/i);

    esperarSinErrores(control);
  });
});
