const { test, expect } = require('@playwright/test');
const {
  entrarComoNegocioQA,
  capturarErrores,
  esperarSinErrores,
  abrirModulo,
  crearProductoRetail
} = require('./helpers');

test.describe('PUNTO YA CR - Producto → Vender', () => {
  test('crea un producto QA y lo encuentra en Vender', async ({ page }) => {
    const control = capturarErrores(page);

    await entrarComoNegocioQA(page, {
      nombre: 'BOT QA PRODUCTO',
      tipo: 'products'
    });

    await crearProductoRetail(page, {
      nombre: 'PRODUCTO BOT QA',
      precio: 1000,
      costo: 400,
      stock: 10,
      categoria: 'QA',
      codigo: '7410000000001'
    });

    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await expect(page.getByText('PRODUCTO BOT QA', { exact: true }).first()).toBeVisible();

    await abrirModulo(page, 'Vender');
    await expect(page.getByRole('heading', { name: /Vender artículos|Punto de venta/i })).toBeVisible();

    // La categoría actual se muestra como "QA" tanto en móvil como en PC.
    const categoriaQA = page.getByRole('button', { name: 'QA', exact: true }).first();
    await expect(categoriaQA).toBeVisible();
    await categoriaQA.click();

    // Comprobamos el artículo mediante su botón, no por textos auxiliares que pueden cambiar.
    const productoQA = page.locator('button').filter({ hasText: 'PRODUCTO BOT QA' }).first();
    await expect(productoQA).toBeVisible();
    await expect(productoQA).toContainText(/Stock:\s*10/i);
    await expect(productoQA).toContainText(/₡\s*1[\s\u00A0\u202F]*000/);

    // Agregar una unidad.
    await productoQA.click();
    await expect(page.locator('body')).toContainText(/₡\s*1[\s\u00A0\u202F]*000/);

    // Volver a tocar el mismo artículo aumenta la cantidad también en móvil.
    const productoQA2 = page.locator('button').filter({ hasText: 'PRODUCTO BOT QA' }).first();
    await expect(productoQA2).toBeVisible();
    await productoQA2.click();

    await expect(page.locator('body')).toContainText(/₡\s*2[\s\u00A0\u202F]*000/);
    await expect(page.locator('body')).not.toContainText(/₡\s*2[\s\u00A0\u202F]*260/);

    esperarSinErrores(control);
  });
});
