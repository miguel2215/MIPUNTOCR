# PUNTO YA CR · Hacienda 4.4 · Estado v7.44

## Ya implementado

- Perfil fiscal por negocio en Panel.
- Credenciales y `.p12` enviados al backend y cifrados antes de persistir.
- Producción bloqueada durante CIERRE/PRE-BETA.
- Prueba OAuth de sandbox.
- Consulta pública de contribuyente por identificación con cache server-side.
- Guardado del receptor para reutilizarlo en futuras ventas.
- Selección de actividad económica cuando Hacienda reporta varias.
- Regla de precio con IVA incluido o IVA agregado al cobro.
- Plantilla única de representación: vista previa, PDF e impresión 58/80 mm.
- Endpoint de envío de XML ya firmado y endpoint de consulta por clave.
- `fiscal_documents` recibe el XML firmado/estado técnico cuando se utilizan esos endpoints.

## Bloque fiscal que falta para poder habilitar producción

PUNTO YA CR todavía necesita un emisor backend que haga el recorrido completo sin exponer la llave al navegador:

1. Reservar consecutivo fiscal de forma atómica.
2. Generar clave de 50 dígitos.
3. Construir el XML versión 4.4 según el tipo de comprobante.
4. Validarlo contra el XSD oficial vigente.
5. Firmarlo XAdES-EPES con el `.p12` del emisor almacenado cifrado.
6. Enviar el XML firmado a Hacienda.
7. Consultar `ind-estado` hasta resultado final.
8. Guardar XML firmado + XML de respuesta + clave + consecutivo + estado.
9. Reflejar ese estado en la venta y generar/entregar la representación gráfica.
10. Probar factura, tiquete y notas que realmente vaya a soportar PUNTO YA CR.

No se debe sustituir la prueba real de sandbox con una simulación local. Producción solo se habilita después de obtener al menos un flujo completo aceptado y repetir QA con casos de rechazo.
