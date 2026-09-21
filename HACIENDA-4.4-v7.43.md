# PUNTO YA CR · Hacienda 4.4 · v7.43 PRE-BETA

Esta actualización separa correctamente a cada emisor fiscal. PUNTO YA CR como negocio usa sus propios datos/credenciales; cada restaurante o retail cliente usa los suyos. Nunca se reutiliza la llave de PUNTO YA CR para facturas de un cliente.

## Ya preparado en el ZIP

- Panel fiscal por negocio con datos no sensibles.
- Sucursal de 3 dígitos y terminal/punto de venta de 5 dígitos.
- Carga segura de usuario, contraseña, PIN y `.p12` hacia Edge Function.
- Cifrado AES-GCM antes de guardar secretos en Supabase.
- RLS sin acceso directo de `anon`/`authenticated` a los secretos.
- OAuth de sandbox con `api-stag` y realm `rut-stag`.
- Prueba de conexión sin devolver el token al navegador.
- Gateway para enviar un XML **ya firmado** a `/recepcion` y consultar su estado por clave.
- Producción bloqueada en código durante PRE-BETA.

## Bloque que todavía exige prueba técnica real

El XML 4.4 debe firmarse con XAdES-EPES usando la llave del emisor. Antes de habilitar producción hay que validar el firmador con una llave de pruebas real, XSD 4.4 y una respuesta aceptada por Hacienda. No se debe simular ni marcar como listo sin esa prueba.

## Para activar el backend fiscal

1. Ejecutar `SUPABASE-HACIENDA-v7.43.sql` en el SQL Editor de Supabase.
2. Crear un secreto fuerte `FISCAL_MASTER_KEY` en Supabase Edge Functions (no ponerlo en HTML/JS).
3. Desplegar: `hacienda-status`, `hacienda-credentials`, `hacienda-test-connection`, `hacienda-submit-signed` y `hacienda-check-status`.
4. En el Panel → Configuración → Factura electrónica, conectar únicamente el usuario de **pruebas** y la llave de pruebas.
5. Ejecutar “Probar conexión”.
6. No habilitar producción hasta completar firma XAdES-EPES + XSD + envío/aceptación + PDF + notas/REP + QA.
