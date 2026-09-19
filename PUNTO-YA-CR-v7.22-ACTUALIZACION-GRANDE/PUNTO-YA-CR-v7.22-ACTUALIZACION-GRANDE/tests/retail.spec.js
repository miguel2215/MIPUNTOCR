const { test, expect } = require('@playwright/test');
const {
  entrarComoNegocioQA,
  capturarErrores,
  esperarSinErrores,
  abrirModulo,
  crearProductoRetail
} = require('./helpers');

const moneda = n => new RegExp(`₡\\s*${String(n).replace(/0{3}$/, '[\\s\\u00A0\\u202F]*000')}`);

test.describe('PUNTO YA CR - Retail, inventario y escáner', () => {
  test('calcula mercadería, venta potencial y ganancia proyectada al registrar un artículo', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA RETAIL', tipo: 'products' });

    await crearProductoRetail(page, {
      nombre: 'CAMISA BOT QA',
      precio: 8000,
      costo: 5000,
      stock: 10,
      categoria: 'Ropa',
      codigo: '7501234567890'
    });

    await expect(page.getByText('Resumen de este artículo', { exact: true })).toBeVisible();
    await expect(page.locator('#pFinancialPreview')).toContainText(/₡\s*50[\s\u00A0\u202F]*000/);
    await expect(page.locator('#pFinancialPreview')).toContainText(/₡\s*80[\s\u00A0\u202F]*000/);
    await expect(page.locator('#pFinancialPreview')).toContainText(/₡\s*30[\s\u00A0\u202F]*000/);

    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await expect(page.getByText('CAMISA BOT QA', { exact: true })).toBeVisible();
    await expect(page.locator('body')).toContainText(/Mercadería:\s*₡\s*50[\s\u00A0\u202F]*000/);
    await expect(page.locator('body')).toContainText(/Ganancia proyectada:\s*₡\s*30[\s\u00A0\u202F]*000/);

    // Volver a Productos y comprobar el resumen global del inventario.
    await abrirModulo(page, 'Productos');
    await expect(page.getByText('Valor de mi mercadería', { exact: true })).toBeVisible();
    await expect(page.locator('body')).toContainText(/Dinero en mercadería/);
    await expect(page.locator('body')).toContainText(/₡\s*50[\s\u00A0\u202F]*000/);
    await expect(page.locator('body')).toContainText(/₡\s*80[\s\u00A0\u202F]*000/);
    await expect(page.locator('body')).toContainText(/₡\s*30[\s\u00A0\u202F]*000/);

    esperarSinErrores(control);
  });

  test('el escáner manual encuentra el artículo con Buscar y también con Enter', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA ESCANER', tipo: 'products' });

    await crearProductoRetail(page, {
      nombre: 'ARTICULO CODIGO QA',
      precio: 2500,
      costo: 1000,
      stock: 5,
      categoria: 'QA',
      codigo: '1234567890123'
    });
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await abrirModulo(page, 'Vender');

    // Buscar usando el botón.
    await page.getByRole('button', { name: 'Escanear', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Escanear código' })).toBeVisible();
    await page.locator('#manualBarcode').fill('1234567890123');
    await page.getByRole('button', { name: /^Buscar$/i }).click();

    // El artículo encontrado debe agregarse a la venta.
    await expect(page.locator('body')).toContainText('ARTICULO CODIGO QA');
    await expect(page.locator('body')).toContainText(/₡\s*2[\s\u00A0\u202F]*500/);

    // Vaciar, abrir de nuevo y buscar con Enter.
    const vaciar = page.getByRole('button', { name: /^Vaciar$/i }).first();
    if (await vaciar.isVisible().catch(() => false)) await vaciar.click();

    await page.getByRole('button', { name: 'Escanear', exact: true }).click();
    await page.locator('#manualBarcode').fill('1234567890123');
    await page.locator('#manualBarcode').press('Enter');
    await expect(page.locator('body')).toContainText('ARTICULO CODIGO QA');

    esperarSinErrores(control);
  });

  test('un código inexistente ofrece crear el artículo y un código duplicado no se guarda', async ({ page }) => {
    const control = capturarErrores(page);
    await entrarComoNegocioQA(page, { nombre: 'BOT QA CODIGOS', tipo: 'products' });

    await crearProductoRetail(page, {
      nombre: 'PRIMERO QA', precio: 1000, costo: 500, stock: 2, categoria: 'QA', codigo: '9990001112223'
    });
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await abrirModulo(page, 'Vender');
    await page.getByRole('button', { name: 'Escanear', exact: true }).click();
    await page.locator('#manualBarcode').fill('0001112223334');
    await page.getByRole('button', { name: /^Buscar$/i }).click();
    await expect(page.getByRole('heading', { name: 'Código no registrado' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Crear artículo con este código/i })).toBeVisible();

    await page.getByRole('button', { name: /Crear artículo con este código/i }).click();
    await expect(page.locator('#pBarcode')).toHaveValue('0001112223334');
    await page.getByRole('button', { name: /^Cancelar$/i }).click();

    await abrirModulo(page, 'Productos');
    await page.getByRole('button', { name: /nuevo producto/i }).click();
    await page.locator('#pName').fill('DUPLICADO QA');
    await page.locator('#pPrice').fill('1200');
    await page.locator('#pCategory').fill('QA');
    await page.locator('#pStock').fill('1');
    await page.locator('#pCost').fill('500');
    await page.locator('#pBarcode').fill('9990001112223');
    await page.getByRole('button', { name: /^Guardar$/i }).click();

    await expect(page.locator('body')).toContainText(/Ese código ya pertenece a PRIMERO QA/i);

    esperarSinErrores(control);
  });
});
