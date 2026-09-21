# QA de cierre · PUNTO YA CR v7.43 PRE-BETA

Usar esta matriz antes de llamar a la versión “BETA”. No agregar módulos durante estas pruebas.

| Área | Restaurante FREE | Restaurante PRO | Retail FREE | Retail PRO |
|---|---|---|---|---|
| Login / misma sesión Panel-POS | ☐ | ☐ | ☐ | ☐ |
| Cambiar Restaurante/Retail sin borrar datos | ☐ | ☐ | ☐ | ☐ |
| Caja abrir/cobrar/cerrar | ☐ | ☐ | ☐ | ☐ |
| Efectivo/SINPE/Tarjeta | ☐ | ☐ | ☐ | ☐ |
| Inventario / categorías / variantes | ☐ | ☐ | ☐ | ☐ |
| Clientes / crédito / abonos / PDF / WhatsApp | ☐ | ☐ | ☐ | ☐ |
| Mesas / comandas / cocina (solo Restaurante) | ☐ | ☐ | — | — |
| Pedidos WhatsApp / express | ☐ | ☐ | ☐ | ☐ |
| Proveedores / pedido / recepción parcial | — | — | ☐ | ☐ |
| Stock solo sube al recibir pedido | — | — | ☐ | ☐ |
| FREE no accede a funciones PRO reales | ☐ | — | ☐ | — |
| Activar PRO por código | ☐ | ☐ | ☐ | ☐ |
| Flujo “Obtener PRO” sin cobro accidental | ☐ | ☐ | ☐ | ☐ |
| Panel móvil / PC | ☐ | ☐ | ☐ | ☐ |
| Impresora automática + prueba | ☐ | ☐ | ☐ | ☐ |
| Lector USB/Bluetooth/cámara | ☐ | ☐ | ☐ | ☐ |
| Offline / reconexión / persistencia | ☐ | ☐ | ☐ | ☐ |
| Negocio A no puede leer/modificar B | ☐ | ☐ | ☐ | ☐ |
| Dueño/Empleado y opciones sensibles | ☐ | ☐ | ☐ | ☐ |
| Factura electrónica: perfil fiscal | — | ☐ | — | ☐ |
| Hacienda sandbox: guardar secretos cifrados | — | ☐ | — | ☐ |
| Hacienda sandbox: OAuth correcto | — | ☐ | — | ☐ |
| XML 4.4 + XAdES-EPES + XSD | — | ☐ | — | ☐ |
| Envío sandbox + estado Aceptado/Rechazado | — | ☐ | — | ☐ |
| PDF/XML respuesta y notas/REP | — | ☐ | — | ☐ |

## Criterios para cerrar PRE-BETA

- Cero pérdida de datos al cambiar de tipo de negocio o reiniciar la app.
- Cero lectura/modificación entre negocios diferentes.
- Cero secretos fiscales visibles en frontend, logs o exportaciones.
- Ningún botón PRE-BETA puede efectuar cobros PRO reales accidentalmente.
- Producción de Hacienda permanece deshabilitada hasta obtener al menos un comprobante de prueba aceptado con firma válida y pasar el QA fiscal completo.
