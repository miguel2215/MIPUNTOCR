const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, crearProductoRetail } = require('./helpers');

test.describe('PUNTO YA CR - PRE-BETA v7.43', () => {
  test('el Panel del Emprendedor existe como página real', async ({ page }) => {
    await page.goto('/panel.html');
    await expect(page.locator('body')).toContainText(/Panel del Emprendedor/i);
    await expect(page.locator('body')).toContainText(/Continuar con Google|Mi negocio|Así va tu negocio hoy/i);
  });

  test('Retail permite crear pedido a proveedor sin cambiar stock', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA PREBETA 743', tipo: 'products' });
    await crearProductoRetail(page, {
      nombre: 'PRODUCTO PEDIDO PROVEEDOR QA', precio: 5000, costo: 2500, stock: 2, categoria: 'QA', codigo: '7420000000742'
    });
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    const before = await page.evaluate(async () => {
      const p = state.products.find(x => x.name === 'PRODUCTO PEDIDO PROVEEDOR QA');
      state.settings.retailSuppliers = [{ id:'sup-qa-742', name:'PROVEEDOR QA', phone:'88888888', whatsapp:'88888888', active:true, createdAt:new Date().toISOString() }];
      await put('settings', state.settings);
      return { id:p.id, stock:Number(p.stock||0) };
    });

    await page.evaluate(id => window.openNewSupplierOrder([id]), before.id);
    await page.locator('#supplierOrderSupplier').selectOption('sup-qa-742');
    await page.getByRole('button', { name: /^Guardar pedido$/i }).click();

    const after = await page.evaluate(id => {
      const p = state.products.find(x => x.id === id);
      return { stock:Number(p.stock||0), orders:(state.settings.retailSupplierOrders||[]).length };
    }, before.id);
    expect(after.stock).toBe(before.stock);
    expect(after.orders).toBeGreaterThan(0);

    await page.evaluate(() => window.go('purchases'));
    await expect(page.locator('body')).toContainText(/Enviar un pedido no altera el stock/i);
    await expect(page.locator('body')).toContainText(/PROVEEDOR QA/i);
    esperarSinErrores(control);
  });

  test('configuración operativa oculta 58/80 y ofrece impresión automática', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA TERMICA 743', tipo: 'products' });
    await page.evaluate(() => window.go('settings'));
    await expect(page.locator('#v741PrinterWidth')).toHaveCount(0);
    await expect(page.getByText(/Configuración automática/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Buscar impresora/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Imprimir prueba/i })).toBeVisible();
    esperarSinErrores(control);
  });
});
