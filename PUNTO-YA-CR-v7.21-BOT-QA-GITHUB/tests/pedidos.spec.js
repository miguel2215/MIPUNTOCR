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


// ======================================================
// PUNTO YA CR - PEDIDOS
// ======================================================

test.describe('PUNTO YA CR - Pedidos', () => {


  // ====================================================
  // PRUEBA 1
  // ABRIR PEDIDOS
  // ====================================================

  test(
    'abre Pedidos correctamente en PC y móvil',
    async ({ page }) => {

      const erroresJS = [];
      const respuestasFallidas = [];

      // --------------------------------------
      // DETECTAR ERRORES JAVASCRIPT
      // --------------------------------------

      page.on('pageerror', error => {
        erroresJS.push(error.message);
      });

      // --------------------------------------
      // DETECTAR RESPUESTAS HTTP FALLIDAS
      // --------------------------------------

      page.on('response', response => {
        if (response.status() >= 400) {
          respuestasFallidas.push(
            `${response.status()} ${response.url()}`
          );
        }
      });

      // --------------------------------------
      // ENTRAR AL NEGOCIO QA
      // --------------------------------------

      await entrarComoNegocioQA(page);

      // --------------------------------------
      // ABRIR PEDIDOS
      // --------------------------------------

      const accesoPedidos = page.getByText(
        'Pedidos',
        { exact: true }
      ).first();

      await expect(accesoPedidos)
        .toBeVisible();

      await accesoPedidos.click();

      // --------------------------------------
      // COMPROBAR QUE PEDIDOS ABRIÓ
      // --------------------------------------

      await expect(page.locator('body'))
        .toContainText(/Pedidos/i);

      // --------------------------------------
      // ESTADOS ACTUALES
      // --------------------------------------

      await expect(page.locator('body'))
        .toContainText(/Recibido/i);

      await expect(page.locator('body'))
        .toContainText(/Listo/i);

      await expect(page.locator('body'))
        .toContainText(/Entregado/i);

      // --------------------------------------
      // ESTADOS QUE NO DEBEN REGRESAR
      // --------------------------------------

      await expect(page.locator('body'))
        .not.toContainText(/En preparación/i);

      await expect(page.locator('body'))
        .not.toContainText(/En camino/i);

      // --------------------------------------
      // COMPROBAR ERRORES JAVASCRIPT
      // --------------------------------------

      expect(
        erroresJS,
        `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
      ).toEqual([]);

      // --------------------------------------
      // COMPROBAR ERRORES DE RED
      // --------------------------------------

      const fallosImportantes =
        respuestasFallidas.filter(
          fallo =>
            !fallo.includes('favicon') &&
            !fallo.includes('supabase')
        );

      expect(
        fallosImportantes,
        `Solicitudes fallidas:\n${fallosImportantes.join('\n')}`
      ).toEqual([]);
    }
  );


  // ====================================================
  // PRUEBA 2
  // INICIAR PEDIDO WHATSAPP
  // ====================================================

  test(
    'inicia un Pedido WhatsApp y llega al siguiente paso',
    async ({ page }) => {

      const erroresJS = [];

      // --------------------------------------
      // DETECTAR ERRORES JAVASCRIPT
      // --------------------------------------

      page.on('pageerror', error => {
        erroresJS.push(error.message);
      });

      // --------------------------------------
      // ENTRAR AL NEGOCIO QA
      // --------------------------------------

      await entrarComoNegocioQA(page);

      // --------------------------------------
      // ABRIR PEDIDOS
      // --------------------------------------

      const accesoPedidos = page.getByText(
        'Pedidos',
        { exact: true }
      ).first();

      await expect(accesoPedidos)
        .toBeVisible();

      await accesoPedidos.click();

      await expect(page.locator('body'))
        .toContainText(/Pedidos/i);

      // --------------------------------------
      // ABRIR PEDIDO WHATSAPP
      // --------------------------------------

const botonWhatsApp = page.getByRole(
  'button',
  {
    name: 'Nuevo pedido WhatsApp',
    exact: true
  }
);

await expect(botonWhatsApp)
  .toBeVisible();

await botonWhatsApp.click();

      // --------------------------------------
      // COMPROBAR VENTANA
      // --------------------------------------

      await expect(
        page.getByRole('heading', {
          name: 'Pedido WhatsApp'
        })
      ).toBeVisible();

      await expect(page.locator('body'))
        .toContainText(
          'Registra el cliente y el tipo de entrega.'
        );

      // --------------------------------------
      // DATOS DEL CLIENTE QA
      // --------------------------------------

      const nombre =
        page.getByPlaceholder('Ej. Juan');

      const telefono =
        page.getByPlaceholder('8888-8888');

      await expect(nombre)
        .toBeVisible();

      await expect(telefono)
        .toBeVisible();

      await nombre.fill(
        'CLIENTE BOT QA'
      );

      await telefono.fill(
        '8000-0000'
      );

      // --------------------------------------
      // TIPO DE ENTREGA
      // --------------------------------------

      const tipo =
        page.locator('select:visible').first();

      await expect(tipo)
        .toBeVisible();

      // Elegimos por el texto real mostrado.
      // No dependemos del value interno.
      await tipo.selectOption({
        label: 'Recoger'
      });

      // --------------------------------------
      // CONTINUAR
      // --------------------------------------

      const continuar =
        page.getByRole('button', {
          name: /^Continuar$/i
        });

      await expect(continuar)
        .toBeVisible();

      await continuar.click();

      // --------------------------------------
      // COMPROBAR QUE AVANZÓ
      // --------------------------------------

      await expect(
        page.getByPlaceholder('Ej. Juan')
      ).not.toBeVisible();

      // --------------------------------------
      // DESCUBRIR SEGUNDO PASO
      // --------------------------------------

      // Todavía no asumimos qué contiene.
      // Solo comprobamos que existe una
      // interfaz con la que el usuario
      // puede continuar trabajando.

      const controlesSiguientePaso =
        page.locator(
          'button:visible, ' +
          'input:visible, ' +
          'select:visible, ' +
          'textarea:visible'
        );

      const cantidadControles =
        await controlesSiguientePaso.count();

      expect(
        cantidadControles
      ).toBeGreaterThan(0);

      // --------------------------------------
      // IMPORTANTE
      // --------------------------------------
      // La prueba termina aquí.
      //
      // NO confirmamos el pedido.
      // NO enviamos WhatsApp.
      // NO generamos PDF.
      // NO cambiamos estados.
      // --------------------------------------

      expect(
        erroresJS,
        `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`
      ).toEqual([]);
    }
  );

});
