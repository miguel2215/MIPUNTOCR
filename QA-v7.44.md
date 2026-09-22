# PUNTO YA CR · QA v7.44 · Cierre App

## Automatizado en el repositorio

- BOT QA Playwright: PC Chromium + móvil Chromium.
- Scanner estático de cierre: `npm run test:prebeta-static`.
- `tests/factura-v744.spec.js` cubre:
  - tipo de negocio bloqueado para clientes normales;
  - flujo de receptor por identificación / ingreso manual;
  - vista previa de factura con plantilla única;
  - cálculo fiscal con IVA incluido y agregado;
  - misma plantilla en impresión y soporte 58/80 mm;
  - contrato PRO Google Play -> correo -> código web.

## Matriz que debe quedar verde antes de lanzar

| Área | Restaurante | Retail | FREE | PRO | Móvil | Tablet/PC |
|---|---|---|---|---|---|---|
| Alta / sesión | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Venta / cobro | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Caja | obligatoria según flujo | opcional | ✓ | ✓ | ✓ | ✓ |
| Inventario | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Clientes / crédito | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pedidos | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Devoluciones/anulaciones | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Panel | dueño | dueño | limitado | completo | ✓ | ✓ |
| Factura electrónica | — | — | visible/bloqueada | habilitada | ✓ | ✓ |
| PDF / térmica | — | — | — | misma plantilla | ✓ | ✓ |

## Pruebas manuales obligatorias antes de producción

1. Actualizar una instalación con datos existentes y confirmar que no se pierden ventas/productos/clientes/caja.
2. Probar sin Internet, recuperar conexión y revisar que no se dupliquen ventas/pagos/inventario.
3. Probar una impresora física 80 mm y una 58 mm cuando estén disponibles.
4. Probar lector de código físico.
5. Emitir en sandbox un XML 4.4 firmado XAdES-EPES y obtener `aceptado` de Hacienda.
6. Probar una compra real de prueba de Google Play Billing y verificar: compra -> backend -> correo -> código -> Panel -> ★ PRO en app.
7. Probar instalación/reinstalación del APK/AAB e inicio de sesión Google.

> Un PDF o una vista previa correcta no prueba cumplimiento fiscal. El hito fiscal final es XML 4.4 firmado + enviado + respuesta real de Hacienda guardada.
