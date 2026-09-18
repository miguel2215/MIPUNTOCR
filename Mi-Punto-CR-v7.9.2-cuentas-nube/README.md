# Mi Punto CR v7.9.2 — cuentas reales en la nube

Cambio de transición a Supabase Auth:

- La cuenta local de pruebas deja de ser el acceso principal.
- La pantalla de sesión siempre permite **Crear nueva cuenta**.
- Inicio de sesión y cierre de sesión usan Supabase.
- Al entrar a un negocio de nube distinto, el caché local anterior se limpia para no mezclar datos entre negocios.
- Los datos de prueba anteriores pueden perderse, según lo aprobado para esta etapa.
- Productos, clientes, ventas, caja, pedidos y crédito todavía no se sincronizan a Supabase en esta versión; esa migración operativa es el siguiente paso.

## Actualización desde v7.9.1
Reemplaza:
- `js/core.js`
- `js/auth.js`
- `js/cloud.js`
- `js/catalog-settings.js`
- `service-worker.js`
