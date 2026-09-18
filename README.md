# Mi Punto CR v7.8 — Frontend ordenado

Esta versión conserva el diseño y las funciones de v7.7, pero divide el frontend en bloques funcionales para reducir el riesgo de que un cambio en un módulo rompa otro.

## Estructura
- `js/core.js`: estado, IndexedDB, utilidades, navegación y shell.
- `js/auth.js`: creación de cuenta, activación e inicio/cierre de sesión.
- `js/pos.js`: Inicio, Vender, POS PC, horizontal y cobro.
- `js/receipts-sales.js`: comprobantes, PDF, anulación y Mis ventas.
- `js/inventory-clients.js`: productos/servicios, clientes y crédito.
- `js/restaurant.js`: mesas, pedidos y caja.
- `js/reports.js`: impresión y reportes del día.
- `js/catalog-settings.js`: catálogo/menú QR y configuración.
- `js/ui-init.js`: modales, eventos de pantalla e inicio de la app.

## Datos
No cambia el nombre de IndexedDB (`mipuntocr`) ni borra información local. La separación de Restaurante, Artículos y Servicios introducida en v7.5 se mantiene.

## Importante durante pruebas
El selector de tipo de negocio sigue visible en Configuración únicamente porque todavía estamos probando los tres módulos. Para la v1 final se retirará del usuario normal.
