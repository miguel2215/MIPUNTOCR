const { expect } = require('@playwright/test');

const MODULE_TARGETS = {
  'Inicio': 'home',
  'Vender': 'sale',
  'Pedidos': 'orders',
  'Productos': 'products',
  'Clientes / Crédito': 'clients',
  'Caja': 'cash',
  'Mis ventas': 'sales',
  'Catálogo QR': 'catalog',
  'Catálogo virtual': 'catalog',
  'Configuración': 'settings'
};

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

  // Dejamos que termine cualquier repintado inicial antes de escribir.
  await page.waitForTimeout(320);
  await page.locator('#guestBusiness').fill(nombre);
  await page.locator('#guestType').selectOption(tipo);
  await page.locator('#guestInvoice').selectOption(factura);

  // Regresión importante: los valores no deben borrarse por un segundo render automático.
  await page.waitForTimeout(80);
  await expect(page.locator('#guestBusiness')).toHaveValue(nombre);
  await expect(page.locator('#guestType')).toHaveValue(tipo);

  await page.getByRole('button', { name: /^Empezar$/i }).click();

  await expect(page.getByText('Inicio', { exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).toContainText(nombre);
  if (tipo === 'products') {
    await expect(page.locator('body')).toContainText(/Artículos, variantes y stock|Selecciona artículos y cobra/i);
  }
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
  const target = MODULE_TARGETS[nombre];
  if (!target) {
    const acceso = page.getByText(nombre, { exact: true }).first();
    await expect(acceso).toBeVisible();
    await acceso.click();
    return;
  }

  const selector = `button[onclick="go('${target}')"]:visible`;
  let acceso = page.locator(selector).first();

  if (!(await acceso.isVisible().catch(() => false))) {
    const inicio = page.locator(`button[onclick="go('home')"]:visible`).first();
    if (await inicio.isVisible().catch(() => false)) {
      await inicio.click();
      await page.waitForTimeout(80);
    }
    acceso = page.locator(selector).first();
  }

  await expect(acceso, `No se encontró acceso visible a ${nombre}`).toBeVisible();
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

  const nuevaCategoria = page.getByRole('heading', { name: 'Nueva categoría' });
  const elegirCategoria = page.getByRole('heading', { name: '¿En qué categoría?' });
  if (await nuevaCategoria.isVisible().catch(() => false)) {
    await page.locator('#newRetailCategoryName').fill(categoria);
    await page.getByRole('button', { name: /^Continuar$/i }).click();
  } else if (await elegirCategoria.isVisible().catch(() => false)) {
    const opcion = page.getByRole('button', { name: new RegExp(`^${categoria}\b`, 'i') }).first();
    if (await opcion.isVisible().catch(() => false)) {
      await opcion.click();
    } else {
      await page.getByRole('button', { name: /Crear nueva categoría/i }).click();
      await page.locator('#newRetailCategoryName').fill(categoria);
      await page.getByRole('button', { name: /^Continuar$/i }).click();
    }
  }

  await expect(page.getByRole('heading', { name: 'Nuevo producto' })).toBeVisible();
  await expect(page.locator('#pCategory')).toHaveValue(categoria);
  await page.locator('#pName').fill(nombre);
  await page.locator('#pPrice').fill(String(precio));
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
