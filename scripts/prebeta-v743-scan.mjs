import { readFile } from 'node:fs/promises';

const [index, panel, sw, pkg, fiscalSql] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../panel.html', import.meta.url), 'utf8'),
  readFile(new URL('../service-worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../SUPABASE-HACIENDA-v7.43.sql', import.meta.url), 'utf8'),
]);

const checks = [
  ['Servicios sigue fuera del selector PRE-BETA visible', /Restaurante[\s\S]*Retail/i.test(panel) && !/type-card[^>]*>[\s\S]{0,120}Servicios/i.test(panel)],
  ['Cambio de tipo no borra datos', /Cambiar el tipo[\s\S]*no elimina/i.test(panel)],
  ['PRO por código visible', /Código PRO[\s\S]*Activar código/i.test(panel)],
  ['PRO tiene camino de pago', /Obtener PRO mensual/i.test(panel) && /Obtener PRO anual/i.test(panel)],
  ['Impresión automática presente', /Buscar impresora/i.test(panel) && /Imprimir prueba/i.test(panel)],
  ['Panel fiscal seguro presente', /Conexión segura con Hacienda/i.test(panel)],
  ['Secretos no van a localStorage', /No se guardan en localStorage/i.test(panel)],
  ['Producción fiscal bloqueada', /Producción permanece bloqueada en PRE-BETA/i.test(panel)],
  ['Tabla fiscal secreta sin grants directos', /revoke all on table public\.fiscal_secret_envelopes from anon, authenticated/i.test(fiscalSql)],
  ['Cache v7.43', /punto-ya-cr-v7-43/.test(sw)],
  ['Package 7.43.0', /"version": "7\.43\.0"/.test(pkg)],
  ['App mantiene panel como administración avanzada', /Panel del Emprendedor/i.test(index)],
  ['Service role no está en frontend', !/SUPABASE_SERVICE_ROLE_KEY/.test(index + panel)],
  ['Master key fiscal no está en frontend', !/FISCAL_MASTER_KEY/.test(index + panel)],
  ['No hay contraseña Hacienda hardcodeada en frontend', !/hacienda.{0,20}(password|contraseña)\s*[:=]\s*['\"][^'\"]+/i.test(index + panel)],
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
console.log('\nPRE-BETA v7.43: estructura crítica OK.');
