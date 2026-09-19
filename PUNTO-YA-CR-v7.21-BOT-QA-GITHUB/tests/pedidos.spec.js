
const { test, expect } = require('@playwright/test');

async function entrarComoNegocioQA(page) {
  await page.goto('/');

  await expect(page.locator('body'))
    .toContainText('Tu negocio, más simple');

  await page.getByRole('button', {
    name: /empezar sin cuenta/i
  }).click();

  await expect(
    page.getByText('Empezar sin cuenta', { exact: true })
  ).toBeVisible();

  await page.locator('#guestBusiness')
    .fill('BOT QA PEDIDOS');

  await page.locator('#guestType')
    .selectOption('products');

  await page.getByRole('button', {
    name: /^Empezar$/i
  }).click();

  await expect(
    page.getByText('Inicio', { exact: true }).first()
  ).toBeVisible();
}

test.describe('PUNTO YA CR - Pedidos', () => {

  test('abre Pedidos correctamente en PC y móvil', async ({ page }) => {

    const erroresJS = [];
    const respuestasFallidas = [];

    page.on('pageerror', error => {
      erroresJS.push(error.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        respuestasFallidas.push(
          `${response.status()} ${response.url()}`
        );
      }
    });

    await entrarComoNegocioQA(page);

    // ==============================
    // ABRIR PEDIDOS
    // ==============================

    const accesoPedidos = page.getByText(
      'Pedidos',
      { exact: true }
    ).first();

    await expect(accesoPedidos).toBeVisible();
    await accesoPedidos.click();

    // ==============================
    // COMPROBAR QUE PEDIDOS ABRIÓ
    // ==============================

    await expect(page.locator('body'))
      .toContainText(/Pedidos/i);

    // ==============================
    // ESTADOS QUE YA EXISTEN
    // ==============================

    await expect(page.locator('body'))
      .toContainText(/Recibido/i);

    await expect(page.locator('body'))
      .toContainText(/Listo/i);

    await expect(page.locator('body'))
      .toContainText(/Entregado/i);

    // No queremos que regresen estados eliminados.
    await expect(page.locator('body'))
      .not.toContainText(/En preparación/i);

    await expect(page.locator('body'))
      .not.toContainText(/En camino/i);

    // ==============================
    // CONTROL JAVASCRIPT
    // ==============================

    expect(
      erroresJS,
      `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
    ).toEqual([]);
    
    });

    // ==============================
    // CONTROL DE RED
    // ==============================

    const fallosImportantes = respuestasFallidas.filter(
      fallo =>
        !fallo.includes('favicon') &&
        !fallo.includes('supabase')
    );

    expect(
      fallosImportantes,
      `Solicitudes fallidas:\n${fallosImportantes.join('\n')}`
    ).toEqual([]);
      test('inicia un Pedido WhatsApp y llega al siguiente paso', async ({ page }) => {

    const erroresJS = [];

    page.on('pageerror', error => {
      erroresJS.push(error.message);
    });

    await entrarComoNegocioQA(page);

    // ========================================
    // 1. ABRIR PEDIDOS
    // ========================================

    await page.getByText('Pedidos', {
      exact: true
    }).first().click();

    await expect(page.locator('body'))
      .toContainText(/Pedidos/i);

    // ========================================
    // 2. ABRIR PEDIDO WHATSAPP
    // ========================================

    const botonWhatsApp = page.getByRole('button', {
      name: /Pedido WhatsApp/i
    }).first();

    await expect(botonWhatsApp).toBeVisible();
    await botonWhatsApp.click();

    // ========================================
    // 3. COMPROBAR VENTANA
    // ========================================

    await expect(
      page.getByRole('heading', {
        name: 'Pedido WhatsApp'
      })
    ).toBeVisible();

    await expect(page.locator('body'))
      .toContainText('Registra el cliente y el tipo de entrega.');

    // ========================================
    // 4. COMPLETAR DATOS QA
    // ========================================

    const nombre = page.getByPlaceholder('Ej. Juan');
    const telefono = page.getByPlaceholder('8888-8888');

    await expect(nombre).toBeVisible();
    await expect(telefono).toBeVisible();

    await nombre.fill('CLIENTE BOT QA');
    await telefono.fill('8000-0000');

    // ========================================
    // 5. TIPO DE ENTREGA
    // ========================================

    const tipo = page.locator('select:visible').first();

    await expect(tipo).toBeVisible();

    // No inventamos el value interno.
    // Elegimos por el texto que realmente existe.
    await tipo.selectOption({
      label: 'Recoger'
    });

    // ========================================
    // 6. CONTINUAR
    // ========================================

    await page.getByRole('button', {
      name: /^Continuar$/i
    }).click();

    // ========================================
    // 7. DESCUBRIR SIGUIENTE PASO
    // ========================================

    // El primer formulario debe haber avanzado.
    await expect(
      page.getByPlaceholder('Ej. Juan')
    ).not.toBeVisible();

    // Debe existir contenido interactivo en el
    // siguiente paso, pero todavía NO asumimos
    // qué botones o campos contiene.
    const controlesSiguientePaso = page.locator(
      'button:visible, input:visible, select:visible, textarea:visible'
    );

    expect(
      await controlesSiguientePaso.count()
    ).toBeGreaterThan(0);

    // ========================================
    // 8. NO FINALIZAR PEDIDO
    // ========================================

    // Intencionalmente terminamos aquí.
    // No guardamos, enviamos ni confirmamos
    // ningún pedido.

    expect(
      erroresJS,
      `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
    ).toEqual([]);

  });

});
