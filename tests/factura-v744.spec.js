const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo, crearProductoRetail } = require('./helpers');

test.describe('PUNTO YA CR - Facturación rápida v7.44', () => {
  test('el tipo de negocio queda fijo después del alta para clientes normales', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA TIPO FIJO', tipo: 'products' });
    await abrirModulo(page, 'Configuración');

    await expect(page.locator('select#sType')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Modo interno de pruebas/i);
    const tipoActual = await page.evaluate(() => state.settings.businessType);
    expect(tipoActual).toBe('products');
    esperarSinErrores(control);
  });

  test('la factura PRO pide identificación, permite ingreso manual y usa la plantilla única', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA FACTURA 744', tipo: 'products', factura: 'yes' });

    await crearProductoRetail(page, {
      nombre: 'PRODUCTO FACTURA QA', precio: 5000, costo: 2500, stock: 5, categoria: 'QA', codigo: '7440000000744'
    });
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await page.evaluate(async () => {
      state.settings.planTier = 'pro';
      state.settings.planSource = 'qa';
      state.settings.planExpiresAt = new Date(Date.now() + 86400000).toISOString();
      state.settings.fiscalUsesEInvoice = true;
      state.settings.fiscalLegalName = 'BOT QA FACTURA 744 S.A.';
      state.settings.fiscalIdType = '02';
      state.settings.fiscalId = '3101123456';
      state.settings.fiscalEconomicActivityCode = '620100';
      state.settings.fiscalEconomicActivityName = 'Programación informática';
      await put('settings', state.settings);
      window.go('sale');
    });

    const categoria = page.getByRole('button', { name: 'QA', exact: true }).first();
    await expect(categoria).toBeVisible();
    await categoria.click();

    // Retail usa tarjetas distintas según el tamaño de pantalla:
    // PC: .desktop-product · móvil: .retail-product
    const product = page
      .locator('button.desktop-product, button.retail-product')
      .filter({ hasText: 'PRODUCTO FACTURA QA' })
      .first();
    await expect(product).toBeVisible();
    await product.click();

    await page.getByRole('button', { name: /^Cobrar$/i }).click();
    await page.getByRole('button', { name: /^Tarjeta \/ Otro$/i }).click();

    const electronic = page.locator('input[name="checkoutDocument"][value="electronic_invoice"]');
    await expect(electronic).toBeEnabled();
    await electronic.check();

    await expect(page.getByLabel('Cédula / identificación del cliente')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Buscar$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ingresar datos manualmente/i })).toBeVisible();

    await page.getByLabel('Cédula / identificación del cliente').fill('112345678');
    await page.getByRole('button', { name: /Ingresar datos manualmente/i }).click();
    await page.getByLabel('Nombre / razón social').fill('CLIENTE FACTURA QA');
    await page.locator('#invoiceManualIdType select').selectOption('01');

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: /^Vista previa$/i }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup.locator('body')).toContainText(/SOLICITUD DE FACTURA ELECTRÓNICA/i);
    await expect(popup.locator('body')).toContainText('CLIENTE FACTURA QA');
    await expect(popup.locator('body')).toContainText(/PRODUCTO FACTURA QA/i);
    await popup.close();

    esperarSinErrores(control);
  });

  test('el IVA fiscal respeta precio con IVA incluido o precio antes de IVA', async ({ page }) => {
    await entrarComoNegocioQA(page, { nombre: 'BOT QA IVA 744', tipo: 'products' });
    const result = await page.evaluate(() => {
      state.settings.fiscalDefaultTaxRate = 13;
      const included = fiscalLineAmounts({ fiscalTaxRate: 13 }, 1130, true);
      const added = fiscalLineAmounts({ fiscalTaxRate: 13 }, 1000, false);
      return { included, added };
    });

    expect(result.included.base).toBeCloseTo(1000, 6);
    expect(result.included.tax).toBeCloseTo(130, 6);
    expect(result.included.total).toBeCloseTo(1130, 6);
    expect(result.added.base).toBeCloseTo(1000, 6);
    expect(result.added.tax).toBeCloseTo(130, 6);
    expect(result.added.total).toBeCloseTo(1130, 6);
  });

  test('la factura térmica usa la misma plantilla y respeta 58/80 mm', async ({ page, request }) => {
    const response = await request.get('/index.html');
    expect(response.ok()).toBeTruthy();
    const source = await response.text();
    expect(source).toMatch(/function printUnifiedElectronicInvoice\(sale\)/);
    expect(source).toMatch(/unifiedInvoiceHtml\(sale/);

    await entrarComoNegocioQA(page, { nombre: 'BOT QA TERMICA 744', tipo: 'products' });
    const widths = await page.evaluate(() => {
      state.settings.printerWidth = '58';
      const w58 = { page: thermalWidth(), body: thermalBodyWidth() };
      state.settings.printerWidth = '80';
      const w80 = { page: thermalWidth(), body: thermalBodyWidth() };
      return { w58, w80 };
    });
    expect(widths.w58).toEqual({ page: 58, body: 50 });
    expect(widths.w80).toEqual({ page: 80, body: 72 });
  });

  test('el Panel describe Google Play -> correo -> código web, sin checkout web ficticio', async ({ request }) => {
    const response = await request.get('/panel.html');
    expect(response.ok()).toBeTruthy();
    const source = await response.text();
    expect(source).toMatch(/Google Play/i);
    expect(source).toMatch(/recibirás por correo/i);
    expect(source).toMatch(/Activar PRO/i);
    expect(source).not.toMatch(/Obtener PRO mensual/i);
    expect(source).not.toMatch(/Obtener PRO anual/i);
  });
});
