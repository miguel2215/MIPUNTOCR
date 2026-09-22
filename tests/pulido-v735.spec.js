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

  test('PRO usa Google Play para comprar y el código se activa en la web', async ({ page, request }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA PRO PLAY', tipo: 'products' });

    await page.evaluate(() => window.openProPlans());
    await expect(page.locator('body')).toContainText(/Compra PRO en Google Play/i);
    await expect(page.locator('body')).toContainText(/Recibe tu código por correo/i);
    await expect(page.getByRole('button', { name: /Comprar PRO con Google Play/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ya tengo mi código/i })).toBeVisible();

    const response = await request.get('/panel.html');
    expect(response.ok()).toBeTruthy();
    const source = await response.text();
    expect(source).toMatch(/Google Play/i);
    expect(source).toMatch(/recibirás por correo/i);
    expect(source).toMatch(/Código PRO|Código de activación/i);
    expect(source).toMatch(/Activar PRO/i);
    expect(source).not.toContain('₡4.990');
    expect(source).not.toContain('₡49.900');

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
    await expect(page.locator('#invoiceCustomerId')).toBeVisible();
    await expect(page.locator('#invoiceCustomerName')).toBeHidden();
    await expect(page.locator('#invoiceCustomerEmail')).toBeHidden();
    await expect(page.getByRole('button', { name: /Ingresar datos manualmente/i })).toBeVisible();
    await page.getByRole('button', { name: /Ingresar datos manualmente/i }).click();
    await expect(page.locator('#invoiceCustomerName')).toBeVisible();
    await expect(page.locator('#invoiceCustomerEmail')).toBeVisible();
    await expect(page.locator('body')).toContainText(/XML 4\.4|firmado, enviado y aceptado por Hacienda/i);
    esperarSinErrores(control);
  });
});
