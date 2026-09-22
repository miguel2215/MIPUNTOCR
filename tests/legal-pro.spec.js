const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo } = require('./helpers');

test.describe('PUNTO YA CR - Gratis, PRO, legal y privacidad · v7.43', () => {
  test('el plan Gratis mantiene la operación local y deja la sincronización completa para PRO', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA FREE', tipo: 'products' });

    await expect(page.locator('body')).toContainText(/Panel del Emprendedor/i);

    await page.evaluate(() => window.openCloudLink());
    await expect(page.getByRole('heading', { name: 'Crear o conectar cuenta' })).toBeVisible();
    await expect(page.locator('body')).toContainText(/En Gratis podrás publicar tu catálogo; Pro activa respaldo y sincronización completa/i);
    await page.getByRole('button', { name: /^Cancelar$/i }).click();

    await abrirModulo(page, 'Configuración');
    await expect(page.locator('body')).toContainText(/Panel del Emprendedor/i);
    await expect(page.locator('body')).toContainText(/suscripción Pro/i);
    await expect(page.locator('body')).toContainText(/configuración fiscal/i);

    esperarSinErrores(control);
  });

  test('Legal y privacidad abre política, términos y eliminación sin borrar datos', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA LEGAL', tipo: 'products' });
    await abrirModulo(page, 'Configuración');

    const legalButton = page.getByRole('button', { name: 'Legal y privacidad', exact: true });
    await expect(legalButton).toBeVisible();
    await legalButton.click();

    await expect(page.getByRole('heading', { name: 'Legal y privacidad' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Política de privacidad/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Términos y condiciones/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Exportar mis datos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Eliminar datos locales|Solicitar eliminación de cuenta/i })).toBeVisible();

    await page.getByRole('button', { name: /Política de privacidad/i }).click();
    await expect(page.getByRole('heading', { name: 'Política de privacidad' })).toBeVisible();
    await expect(page.locator('body')).toContainText(/Cookies y almacenamiento local/i);
    await page.getByRole('button', { name: /^Cerrar$/i }).click();

    await page.getByRole('button', { name: /Eliminar datos locales|Solicitar eliminación de cuenta/i }).click();
    await expect(page.locator('body')).toContainText(/Escribe ELIMINAR para confirmar/i);
    // El bot nunca confirma: no debe borrar el negocio de prueba.
    await page.getByRole('button', { name: /^Cancelar$/i }).click();

    esperarSinErrores(control);
  });

  test('Crecimiento y Facturación electrónica siguen identificados como funciones avanzadas / PRO', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA PRO', tipo: 'products', factura: 'yes' });

    await abrirModulo(page, 'Configuración');
    await expect(page.locator('body')).toContainText(/crecimiento inteligente/i);
    await expect(page.locator('body')).toContainText(/suscripción Pro/i);
    await expect(page.locator('body')).toContainText(/configuración fiscal/i);
    await expect(page.locator('body')).toContainText(/factura electrónica/i);

    await abrirModulo(page, 'Vender');
    await expect(page.locator('body')).toContainText(/Factura electrónica · PRO/i);

    esperarSinErrores(control);
  });
});
