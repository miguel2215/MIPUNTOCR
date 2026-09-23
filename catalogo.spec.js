const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo, crearProductoRetail } = require('./helpers');

test.describe('PUNTO YA CR - Catálogo virtual Retail', () => {
  test('muestra productos y explica que una cuenta es necesaria para compartir el QR público', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA CATALOGO', tipo: 'products' });

    await crearProductoRetail(page, {
      nombre: 'CATALOGO BOT QA', precio: 3500, costo: 1500, stock: 4, categoria: 'Catálogo', codigo: '7411111111111'
    });
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await abrirModulo(page, 'Catálogo virtual');
    await expect(page.getByRole('heading', { name: 'Catálogo virtual' })).toBeVisible();
    await expect(page.locator('body')).toContainText('CATALOGO BOT QA');
    await expect(page.locator('body')).toContainText(/Para compartir este catálogo necesitas una cuenta/i);
    await expect(page.getByRole('button', { name: /Crear cuenta/i })).toBeVisible();

    esperarSinErrores(control);
  });
});
