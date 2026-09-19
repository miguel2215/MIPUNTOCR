const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo } = require('./helpers');

test.describe('PUNTO YA CR - Gratis, PRO, legal y privacidad', () => {
  test('el plan Gratis muestra Pro como mejora y mantiene la nube operativa bloqueada', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA FREE', tipo: 'products' });

    await expect(page.locator('body')).toContainText(/Haz crecer tu negocio con Pro/i);

    await abrirModulo(page, 'Configuración');
    await expect(page.locator('body')).toContainText(/Plan Gratis|Modo sin cuenta/i);
    await expect(page.locator('body')).toContainText(/Nube|sincronización|respaldo/i);

    esperarSinErrores(control);
  });

  test('Legal y privacidad abre política, términos y eliminación sin borrar datos', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA LEGAL', tipo: 'products' });
    await abrirModulo(page, 'Configuración');

    await page.getByRole('button', { name: /^Abrir$/i }).filter({ has: page.locator('xpath=..') }).first().isVisible().catch(() => false);

    // Abrir el bloque Legal desde el botón de la tarjeta correspondiente.
    const legalPanel = page.locator('.panel').filter({ hasText: 'Legal y privacidad' });
    await expect(legalPanel).toBeVisible();
    await legalPanel.getByRole('button', { name: 'Abrir', exact: true }).click();

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
    // No confirmamos: el bot jamás debe borrar el negocio de prueba durante esta validación.
    await page.getByRole('button', { name: /^Cancelar$/i }).click();

    esperarSinErrores(control);
  });

  test('Crecimiento y Facturación electrónica están identificados como funciones PRO', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA PRO', tipo: 'products', factura: 'yes' });

    // En un negocio Gratis, Configuración debe explicar claramente qué aporta Pro.
    await abrirModulo(page, 'Configuración');
    await expect(page.locator('body')).toContainText(/PUNTO YA CR Pro/i);
    await expect(page.locator('body')).toContainText(/Crecimiento inteligente/i);
    await expect(page.locator('body')).toContainText(/Facturación electrónica/i);
    await expect(page.locator('body')).toContainText(/Nube y seguridad/i);

    esperarSinErrores(control);
  });
});
