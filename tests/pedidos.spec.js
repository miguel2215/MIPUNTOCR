const { test, expect } = require('@playwright/test');
const { entrarComoNegocioQA, capturarErrores, esperarSinErrores, abrirModulo } = require('./helpers');

test.describe('PUNTO YA CR - Pedidos', () => {
  test('Retail muestra únicamente pedidos WhatsApp y los estados actuales', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA PEDIDOS', tipo: 'products' });
    await abrirModulo(page, 'Pedidos');

    await expect(page.locator('body')).toContainText(/Recibido/i);
    await expect(page.locator('body')).toContainText(/Recibido → Entregado/i);
    await expect(page.locator('body')).toContainText(/Entregado/i);
    await expect(page.locator('body')).not.toContainText(/Recibido → Listo/i);
    await expect(page.locator('body')).not.toContainText(/En preparación/i);
    await expect(page.locator('body')).not.toContainText(/En camino/i);

    // Retail no debe heredar las mesas del módulo Comida.
    await expect(page.getByText(/Pedidos de mesa/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Tomar pedido de mesa/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Ver mesas/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nuevo pedido WhatsApp', exact: true })).toBeVisible();

    esperarSinErrores(control);
  });

  test('inicia correctamente un Pedido WhatsApp Retail sin abrir caja ni enviarlo', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA WHATSAPP', tipo: 'products' });
    await abrirModulo(page, 'Pedidos');

    // En Retail la caja NO es requisito para registrar un pedido.
    await page.getByRole('button', { name: 'Nuevo pedido WhatsApp', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pedido WhatsApp' })).toBeVisible();

    await page.getByPlaceholder('Ej. Juan').fill('CLIENTE BOT QA');
    await page.getByPlaceholder('8888-8888').fill('8000-0000');

    const tipo = page.locator('select:visible').first();
    await tipo.selectOption({ label: 'Recoger' });

    await page.getByRole('button', { name: /^Continuar$/i }).click();
    await expect(page.getByPlaceholder('Ej. Juan')).not.toBeVisible();

    const controles = page.locator('button:visible, input:visible, select:visible, textarea:visible');
    expect(await controles.count()).toBeGreaterThan(0);

    esperarSinErrores(control);
  });
});
