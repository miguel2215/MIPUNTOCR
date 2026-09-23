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

    // En móvil Retail existe el paso “Cobrar”.
    // En PC los medios de pago están visibles directamente en el panel derecho.
    const cobrar = page.getByRole('button', { name: /^Cobrar$/i });
    if (await cobrar.count()) {
      const firstCobrar = cobrar.first();
      if (await firstCobrar.isVisible()) await firstCobrar.click();
    }

    // PC muestra “Tarjeta”; móvil muestra “Tarjeta / Otro”.
    const cardButtons = page.getByRole('button', { name: /^Tarjeta(?: \/ Otro)?$/i });
    let cardClicked = false;
    for (let i = 0; i < await cardButtons.count(); i++) {
      const candidate = cardButtons.nth(i);
      if (await candidate.isVisible()) {
        await candidate.click();
        cardClicked = true;
        break;
      }
    }
    expect(cardClicked).toBeTruthy();

    // Con Facturación Electrónica activa, la venta normal inicia como Tiquete
    // y cambia automáticamente a Factura cuando se agrega un receptor.
    await expect(page.locator('#autoFiscalDocSummary')).toContainText(/Tiquete Electrónico/i);
    await page.getByRole('button', { name: /Agregar receptor/i }).click();
    await expect(page.locator('#autoFiscalDocSummary')).toContainText(/Factura Electrónica/i);

    // Estos campos tienen IDs propios; el <label> visual no usa atributo "for".
    await expect(page.locator('#invoiceCheckoutFields')).toBeVisible();
    await expect(page.locator('#invoiceCustomerId')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Buscar$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ingresar datos manualmente/i })).toBeVisible();

    await page.locator('#invoiceCustomerId').fill('112345678');
    await page.getByRole('button', { name: /Ingresar datos manualmente/i }).click();
    await expect(page.locator('#invoiceCustomerDetails')).toBeVisible();
    await page.locator('#invoiceCustomerName').fill('CLIENTE FACTURA QA');
    await page.locator('#invoiceManualIdType select').selectOption('01');

    // GitHub Actions / Chromium headless puede bloquear la ventana emergente.
    // Capturamos el HTML que la función real intenta escribir en window.open(),
    // sin cambiar la lógica de la app ni falsificar la plantilla.
    await page.evaluate(() => {
      window.__qaInvoicePreviewHtml = '';
      window.__qaOriginalOpen = window.open;
      window.open = () => ({
        document: {
          write(html) { window.__qaInvoicePreviewHtml += String(html || ''); },
          close() {}
        }
      });
    });

    await page.getByRole('button', { name: /^Vista previa$/i }).click();

    const previewHtml = await page.evaluate(() => {
      const html = window.__qaInvoicePreviewHtml || '';
      if (window.__qaOriginalOpen) window.open = window.__qaOriginalOpen;
      delete window.__qaOriginalOpen;
      return html;
    });

    expect(previewHtml).toMatch(/VISTA PREVIA/i);
    expect(previewHtml).toMatch(/FACTURA ELECTRÓNICA/i);
    expect(previewHtml).toContain('CLIENTE FACTURA QA');
    expect(previewHtml).toMatch(/PRODUCTO FACTURA QA/i);

    esperarSinErrores(control);
  });

  test('la integración fiscal queda preparada sin generar ni transmitir comprobantes', async ({ request }) => {
    const response = await request.get('/index.html');
    expect(response.ok()).toBeTruthy();
    const source = await response.text();

    expect(source).toMatch(/fiscalTransmissionPaused/);
    expect(source).toMatch(/Transmisión fiscal pausada durante la etapa de integración/);
    expect(source).toMatch(/electronicInvoiceStatus:\s*\["electronic_ticket","electronic_invoice"\]\.includes\(saleMeta\.documentType\)\s*\?\s*"prepared"/);

    // La función de emisión se conserva para la etapa futura, pero ninguna venta
    // la llama automáticamente después de showReceipt().
    const afterReceipt = source.split('showReceipt(sale);')[1]?.split('/* ===== receipts-sales.js ===== */')[0] || '';
    expect(afterReceipt).not.toMatch(/emitElectronicInvoiceSandbox\s*\(/);

    const panelResponse = await request.get('/panel.html');
    expect(panelResponse.ok()).toBeTruthy();
    const panelSource = await panelResponse.text();
    expect(panelSource).not.toMatch(/id=["']testFiscalKey["']/);
    expect(panelSource).toMatch(/generación de claves y consecutivos de prueba está pausada/i);
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

test.describe('PUNTO YA CR - Consulta pública fiscal v7.59', () => {
  test('el QR usa un token aleatorio y no expone el token como query param', async ({ request }) => {
    const response = await request.get('/index.html');
    expect(response.ok()).toBeTruthy();
    const source = await response.text();
    expect(source).toMatch(/function fiscalPublicToken\(\)/);
    expect(source).toMatch(/crypto\.getRandomValues/);
    expect(source).toMatch(/fiscalPublicToken:/);
    expect(source).toMatch(/consulta-comprobante\.html/);
    expect(source).toMatch(/u\.hash=`token=/);
    expect(source).not.toMatch(/u\.searchParams\.set\(["']token["']/);
  });

  test('la consulta pública existe y usa el endpoint dedicado sin emitir a Hacienda', async ({ request }) => {
    const response = await request.get('/consulta-comprobante.html');
    expect(response.ok()).toBeTruthy();
    const source = await response.text();
    expect(source).toMatch(/fiscal-public-receipt/);
    expect(source).toMatch(/Consulta segura PUNTO YA CR/);
    expect(source).toMatch(/Descargar XML/);
    expect(source).not.toMatch(/hacienda-sign-submit|hacienda-submit-signed|hacienda-generate-key/);
  });
});
