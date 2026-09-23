import { readFile } from 'node:fs/promises';

const [index, panel, sw, pkg, fiscalSql, fiscal744Sql, lookupFn, submitFn, checkFn] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../panel.html', import.meta.url), 'utf8'),
  readFile(new URL('../service-worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../SUPABASE-HACIENDA-v7.43.sql', import.meta.url), 'utf8'),
  readFile(new URL('../SUPABASE-v7.44-CLIENTE-FISCAL.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/hacienda-taxpayer-lookup/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/hacienda-submit-signed/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/hacienda-check-status/index.ts', import.meta.url), 'utf8'),
]);

const checks = [
  ['Servicios sigue fuera del selector visible', /Restaurante[\s\S]*Retail/i.test(panel) && !/type-card[^>]*>[\s\S]{0,120}Servicios/i.test(panel)],
  ['PRO por código visible', /Código PRO[\s\S]*Activar PRO/i.test(panel) || /Código de activación[\s\S]*Activar PRO/i.test(panel)],
  ['PRO sigue el flujo aprobado de Google Play + código web', /Google Play/i.test(panel) && /recibirás por correo/i.test(panel) && /Activar PRO/i.test(panel)],
  ['Impresión automática presente', /Buscar impresora/i.test(panel) && /Imprimir prueba/i.test(panel)],
  ['Panel fiscal seguro presente', /Conexión segura con Hacienda/i.test(panel)],
  ['Secretos no van a localStorage', /No se guardan en localStorage/i.test(panel)],
  ['Producción fiscal bloqueada', /Producción permanece bloqueada en PRE-BETA/i.test(panel)],
  ['Tabla fiscal secreta sin grants directos', /revoke all on table public\.fiscal_secret_envelopes from anon, authenticated/i.test(fiscalSql)],
  ['Cache v7.44', /punto-ya-cr-v7-44/.test(sw)],
  ['Package 7.44.0', /"version": "7\.44\.0"/.test(pkg)],
  ['App mantiene Panel como administración avanzada', /Panel del Emprendedor/i.test(index)],
  ['Service role no está en frontend', !/SUPABASE_SERVICE_ROLE_KEY/.test(index + panel)],
  ['Master key fiscal no está en frontend', !/FISCAL_MASTER_KEY/.test(index + panel)],
  ['Consulta fiscal por identificación v7.44', /hacienda-taxpayer-lookup/.test(index) && /api\.hacienda\.go\.cr\/fe\/ae/.test(lookupFn)],
  ['Plantilla única de factura v7.44', /unifiedInvoiceHtml/.test(index) && /createElectronicInvoicePdf/.test(index) && /printUnifiedElectronicInvoice/.test(index)],
  ['Cliente fiscal se guarda para futuras compras', /persistInvoiceCustomerClient/.test(index) && /identificationNumber/.test(index)],
  ['Migración cliente fiscal v7.44', /taxpayer_lookup_cache/.test(fiscal744Sql) && /identification_number/.test(fiscal744Sql)],
  ['IVA incluido / IVA agregado configurables', /fiscalPricesIncludeTax/.test(index) && /Cómo registras los precios/.test(panel)],
  ['Factura térmica usa plantilla única y 58/80 mm', /printUnifiedElectronicInvoice/.test(index) && /printerWidth/.test(index) && /unifiedInvoiceHtml\(sale\)/.test(index)],
  ['Envío fiscal registra documento técnico', /fiscal_documents/.test(submitFn) && /status: 'sent'/.test(submitFn)],
  ['Consulta Hacienda guarda estado y XML respuesta', /fiscal_documents/.test(checkFn) && /respuesta-xml/.test(checkFn) && /fiscal_status/.test(checkFn)],
  ['PRO Android sin checkout web PRE-BETA viejo', /Comprar PRO con Google Play/i.test(index) && !/₡4\.990|₡49\.900/.test(index + panel)],
  ['No hay contraseña Hacienda hardcodeada en frontend', !/hacienda.{0,20}(password|contraseña)\s*[:=]\s*['"][^'"]+/i.test(index + panel)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`\n${failed} chequeo(s) fallaron.`);
  process.exit(1);
}
console.log('\nCIERRE APP v7.44: estructura crítica OK.');
