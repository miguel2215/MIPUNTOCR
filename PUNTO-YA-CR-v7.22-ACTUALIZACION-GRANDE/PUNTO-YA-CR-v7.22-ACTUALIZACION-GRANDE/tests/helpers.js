const { expect } = require('@playwright/test');

async function entrarComoNegocioQA(page, {
  nombre = 'BOT QA',
  tipo = 'products',
  factura = 'no'
} = {}) {
  await page.goto('/');

  await expect(page.locator('body')).toContainText('Tu negocio, más simple');

  const guest = page.getByRole('button', { name: /empezar sin cuenta/i });
  await expect(guest).toBeVisible();
  await guest.click();

  await expect(page.getByText('Empezar sin cuenta', { exact: true })).toBeVisible();

  await page.locator('#guestBusiness').fill(nombre);
  await page.locator('#guestType').selectOption(tipo);
  await page.locator('#guestInvoice').selectOption(factura);

  await page.getByRole('button', { name: /^Empezar$/i }).click();

  await expect(page.getByText('Inicio', { exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).toContainText(nombre);
}

function capturarErrores(page) {
  const erroresJS = [];
  const respuestasFallidas = [];

  page.on('pageerror', error => erroresJS.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) {
      const url = response.url();
      // Servicios externos opcionales no deben romper las pruebas locales.
      if (!url.includes('supabase') && !url.includes('qrserver') && !url.includes('favicon')) {
        respuestasFallidas.push(`${response.status()} ${url}`);
      }
    }
  });

  return { erroresJS, respuestasFallidas };
}

function esperarSinErrores({ erroresJS, respuestasFallidas = [] }) {
  expect(erroresJS, `Errores JavaScript encontrados:\n${erroresJS.join('\n')}`).toEqual([]);
  expect(respuestasFallidas, `Solicitudes fallidas:\n${respuestasFallidas.join('\n')}`).toEqual([]);
}

async function abrirModulo(page, nombre) {
  const acceso = page.getByText(nombre, { exact: true }).first();
  await expect(acceso).toBeVisible();
  await acceso.click();
}

async function crearProductoRetail(page, {
  nombre = 'PRODUCTO BOT QA',
  precio = 8000,
  costo = 5000,
  stock = 10,
  categoria = 'QA',
  codigo = '7501234567890',
  variantes = ''
} = {}) {
  await abrirModulo(page, 'Productos');
  await page.getByRole('button', { name: /nuevo producto/i }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo producto' })).toBeVisible();

  await page.locator('#pName').fill(nombre);
  await page.locator('#pPrice').fill(String(precio));
  await page.locator('#pCategory').fill(categoria);
  await page.locator('#pStock').fill(String(stock));
  await page.locator('#pCost').fill(String(costo));
  await page.locator('#pBarcode').fill(codigo);
  if (variantes && await page.locator('#pVariants').count()) {
    await page.locator('#pVariants').fill(variantes);
  }

  return { nombre, precio, costo, stock, categoria, codigo, variantes };
}

module.exports = {
  entrarComoNegocioQA,
  capturarErrores,
  esperarSinErrores,
  abrirModulo,
  crearProductoRetail
};
