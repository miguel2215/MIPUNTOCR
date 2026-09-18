# Mi Punto CR v7.9 — Supabase Auth

Esta versión conecta la cuenta del propietario y el negocio con Supabase sin borrar la base local existente.

## Incluye
- Registro real con Supabase Auth.
- Confirmación de correo usando el correo predeterminado de Supabase por ahora.
- Inicio y cierre de sesión reales.
- Creación automática del negocio en `businesses` después de confirmar/iniciar sesión.
- Perfil creado por el trigger ya instalado en Supabase.
- Carga del nombre, tipo de negocio y ajustes básicos desde la nube.
- Botón para conectar a la nube un negocio local creado en versiones anteriores.
- Mantiene IndexedDB intacto para no perder productos, clientes, ventas, pedidos ni Caja existentes.
- Service Worker actualizado.

## Estado de la migración
En v7.9, Supabase ya es la fuente oficial para autenticación e identidad del negocio.
Los datos operativos (productos, ventas, clientes, Caja, pedidos y crédito) todavía permanecen en IndexedDB mientras se prepara la migración segura a las tablas de Supabase.

## Importante
La clave incluida en el frontend es la Publishable key de Supabase, no una clave secreta.
Nunca agregues `service_role` ni Secret keys al frontend.

## Correo de activación
El proyecto Free usa por ahora la plantilla predeterminada de Supabase. Cuando se conecte SMTP propio, se cambia al código OTP personalizado de Mi Punto CR.
