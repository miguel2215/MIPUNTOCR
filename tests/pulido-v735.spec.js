const { test, expect } = require('@playwright/test');
const {
  entrarComoNegocioQA,
  capturarErrores,
  esperarSinErrores,
  abrirModulo,
  crearProductoRetail
} = require('./helpers');

test.describe('PUNTO YA CR - cierre v7.35', () => {
  test('Apple queda oculto en los métodos de acceso', async ({ page }) => {
    const control = capturarErrores(page);
    await page.goto('/');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page.locator('body')).toContainText(/Continuar con Google/i);
    await expect(page.locator('body')).not.toContainText(/Apple/i);
    await page.getByRole('button', { name: /volver/i }).click();
    await page.getByRole('button', { name: /crear cuenta/i }).click();
    await expect(page.locator('body')).toContainText(/Crear cuenta con Google/i);
    await expect(page.locator('body')).not.toContainText(/Apple/i);
    esperarSinErrores(control);
  });

  test('Más se simplifica solo en móvil y conserva accesos completos en PC', async ({ page }, testInfo) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA MAS', tipo: 'products' });
    await page.evaluate(() => window.go('more'));
    const grid = page.locator('.home-grid').first();
    await expect(grid).toContainText(/Gastos y utilidad/i);
    await expect(grid).toContainText(/Configuración/i);
    await expect(grid).toContainText(/Legal y privacidad/i);

    const titulo = text => grid.locator('.big-card strong').filter({ hasText: new RegExp(`^${text}$`, 'i') });
    if (testInfo.project.name === 'Movil-Chromium') {
      await expect(titulo('Productos')).toHaveCount(0);
      await expect(titulo('Clientes / Crédito')).toHaveCount(0);
      await expect(titulo('Caja')).toHaveCount(0);
      await expect(titulo('Mis ventas')).toHaveCount(0);
      await expect(titulo('Catálogo virtual')).toHaveCount(0);
      await expect(titulo('Pedidos')).toHaveCount(0);
    } else {
      await expect(titulo('Productos')).toBeVisible();
      await expect(titulo('Clientes / Crédito')).toBeVisible();
      await expect(titulo('Caja')).toBeVisible();
      await expect(titulo('Mis ventas')).toBeVisible();
      await expect(titulo('Catálogo virtual')).toBeVisible();
      await expect(titulo('Pedidos')).toBeVisible();
    }
    esperarSinErrores(control);
  });

  test('PRO muestra los precios acordados sin simular un cobro real', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA PRO PRECIO', tipo: 'products' });
    await page.evaluate(() => window.openProPlans());
    await expect(page.locator('body')).toContainText(/₡4\.990\s*\/\s*mes/i);
    await expect(page.locator('body')).toContainText(/₡49\.900\s*\/\s*año/i);
    await page.getByRole('button', { name: /₡4\.990 \/ mes/i }).click();
    await expect(page.locator('body')).toContainText(/Activa tu cuenta para usar PRO/i);
    await expect(page.locator('body')).toContainText(/asocia a la cuenta del negocio/i);
    esperarSinErrores(control);
  });

  test('Factura electrónica aparece al cobrar solo con PRO y configuración fiscal activa', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA FACTURA', tipo: 'products', factura: 'yes' });
    await crearProductoRetail(page, {
      nombre: 'ARTICULO FACTURA QA', precio: 3000, costo: 1500, stock: 5, categoria: 'QA', codigo: '7410000000735'
    });
    await page.getByRole('button', { name: /^Guardar$/i }).click();
    await abrirModulo(page, 'Vender');
    const categoria = page.getByRole('button', { name: 'QA', exact: true }).first();
    if (await categoria.isVisible().catch(() => false)) await categoria.click();
    await page.locator('button').filter({ hasText: 'ARTICULO FACTURA QA' }).first().click();

    await page.getByRole('button', { name: /^Efectivo$/i }).click();
    await expect(page.locator('.checkout-document')).toHaveCount(0);
    await page.getByRole('button', { name: /^Cancelar$/i }).click();

    await page.evaluate(async () => {
      state.settings.planTier = 'pro';
      state.settings.planSource = 'qa';
      state.settings.planExpiresAt = '';
      state.settings.fiscalUsesEInvoice = true;
      await put('settings', state.settings);
    });
    await page.getByRole('button', { name: /^Efectivo$/i }).click();
    await expect(page.getByText('Factura electrónica', { exact: true })).toBeVisible();
    await page.getByText('Factura electrónica', { exact: true }).click();
    await expect(page.locator('#invoiceCustomerName')).toBeVisible();
    await expect(page.locator('#invoiceCustomerId')).toBeVisible();
    await expect(page.locator('#invoiceCustomerEmail')).toBeVisible();
    await expect(page.locator('body')).toContainText(/no es una factura electrónica oficial|emisión oficial a Hacienda/i);
    esperarSinErrores(control);
  });
});
