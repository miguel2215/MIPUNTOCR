const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo, crearProductoRetail } = require('./helpers');

test.describe('PUNTO YA CR - Retail v7.36', () => {
  test('Servicios queda oculto para negocios nuevos', async ({ page }) => {
    const control = capturarErrores(page);
    await page.goto('/');
    await page.getByRole('button', { name: /empezar sin cuenta/i }).click();
    await expect(page.locator('#guestType option[value="services"]')).toHaveCount(0);
    // La comprobación principal es el selector sin Servicios; no forzamos flujo de nube.
    esperarSinErrores(control);
  });

  test('Nuevo producto pide categoría primero y luego abre el formulario', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA CATEGORIAS', tipo: 'products' });
    await abrirModulo(page, 'Productos');
    await expect(page.locator('body')).toContainText(/Primero eliges la categoría/i);
    await page.getByRole('button', { name: /nuevo producto/i }).click();
    await expect(page.getByRole('heading', { name: 'Nueva categoría' })).toBeVisible();
    await page.locator('#newRetailCategoryName').fill('Perfumes');
    await page.getByRole('button', { name: /^Continuar$/i }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo producto' })).toBeVisible();
    await expect(page.locator('#pCategory')).toHaveValue('Perfumes');
    await expect(page.locator('#pCategory')).toHaveAttribute('readonly', '');
    esperarSinErrores(control);
  });

  test('Retail muestra estados Recibido y Entregado sin usar Listo como paso', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA FLUJO RETAIL', tipo: 'products' });
    await abrirModulo(page, 'Pedidos');
    await expect(page.locator('body')).toContainText(/Estados simples: Recibido → Entregado/i);
    await expect(page.locator('body')).not.toContainText(/Recibido → Listo → Cobrar/i);
    esperarSinErrores(control);
  });

  test('Catálogo Retail ofrece compartir todo, categoría o productos', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA SHARE', tipo: 'products' });
    await crearProductoRetail(page, { nombre:'PERFUME QA', precio:10000, costo:5000, stock:2, categoria:'Perfumes', codigo:'7410000000736' });
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await page.evaluate(async () => { state.settings.cloudLinked = true; state.settings.cloudBusinessId = '11111111-1111-4111-8111-111111111111'; await put('settings', state.settings); });
    await abrirModulo(page, 'Catálogo virtual');
    await page.getByRole('button', { name: /Compartir catálogo/i }).click();
    await expect(page.getByRole('button', { name: /Todo el catálogo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Una categoría/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Productos seleccionados/i })).toBeVisible();
    esperarSinErrores(control);
  });
});
