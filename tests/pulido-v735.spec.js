const { test, expect } = require('@playwright/test');
const {
  entrarComoNegocioQA,
  capturarErrores,
  esperarSinErrores,
  abrirModulo,
  crearProductoRetail
} = require('./helpers');

test.describe('PUNTO YA CR - cierre actualizado v7.43', () => {
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

  test('Más deja la administración avanzada en el Panel del Emprendedor', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA MAS', tipo: 'products' });
    await page.evaluate(() => window.go('more'));

    const body = page.locator('body');
    await expect(body).toContainText(/Panel del Emprendedor/i);
    await expect(body).toContainText(/Configuración de la app/i);
    await expect(body).toContainText(/Legal y privacidad/i);

    await expect(page.locator(`button[onclick="go('expenses')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('growth')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('fiscal')"]:visible`)).toHaveCount(0);
    await expect(page.locator(`button[onclick="go('users')"]:visible`)).toHaveCount(0);

    esperarSinErrores(control);
  });

  test('PRO conserva pago + código en el Panel y una sesión invitada no se simula', async ({ page, request }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA PRO PRECIO', tipo: 'products' });

    await page.evaluate(() => window.openProPlans());
    await expect(page).toHaveURL(/panel\.html/);
    await expect(page.locator('body')).toContainText(/Panel del Emprendedor/i);
    await expect(page.locator('body')).toContainText(/Usa la misma cuenta de PUNTO YA CR/i);
    await expect(page.locator('body')).toContainText(/Continuar con Google/i);

    // El CI local no posee una cuenta real de Supabase. Verificamos también el contrato
    // actual del Panel directamente en el archivo servido: pago mensual/anual + código PRO.
    const response = await request.get('/panel.html');
    expect(response.ok()).toBeTruthy();
    const source = await response.text();
    expect(source).toContain('₡4.990');
    expect(source).toContain('₡49.900');
    expect(source).toContain('data-pro-buy="monthly"');
    expect(source).toContain('data-pro-buy="annual"');
    expect(source).toMatch(/Código PRO|Código de activación/i);
    expect(source).toMatch(/Activar código/i);
    expect(source).toMatch(/no realizan cargos|no realiza ningún cargo/i);

    esperarSinErrores(control);
  });

  test('Factura electrónica es visible en Gratis y se habilita con PRO y configuración fiscal activa', async ({ page }) => {
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

    const abrirCobroEfectivo = async () => {
      const cobrar = page.getByRole('button', { name: /^Cobrar$/i });
      if (await cobrar.isVisible().catch(() => false)) await cobrar.click();
      await page.getByRole('button', { name: /^Efectivo$/i }).click();
    };

    await abrirCobroEfectivo();
    await expect(page.locator('.checkout-document')).toBeVisible();
    await expect(page.locator('.checkout-document')).toContainText(/Factura electrónica · PRO/i);
    await expect(page.locator('input[name="checkoutDocument"][value="electronic_invoice"]')).toBeDisabled();
    await expect(page.locator('.checkout-document')).toContainText(/disponible con PUNTO YA CR Pro/i);
    await page.getByRole('button', { name: /^Cancelar$/i }).click();

    await page.evaluate(async () => {
      state.settings.planTier = 'pro';
      state.settings.planSource = 'qa';
      state.settings.planExpiresAt = '';
      state.settings.fiscalUsesEInvoice = true;
      await put('settings', state.settings);
    });
    await abrirCobroEfectivo();
    await expect(page.getByText('Factura electrónica', { exact: true })).toBeVisible();
    await page.getByText('Factura electrónica', { exact: true }).click();
    await expect(page.locator('#invoiceCustomerName')).toBeVisible();
    await expect(page.locator('#invoiceCustomerId')).toBeVisible();
    await expect(page.locator('#invoiceCustomerEmail')).toBeVisible();
    await expect(page.locator('body')).toContainText(/todavía no emite ni transmite una factura oficial a Hacienda|factura oficial a Hacienda/i);
    esperarSinErrores(control);
  });
});
