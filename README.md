# Mi Punto CR v7.13 — Usuarios, roles y permisos

Esta versión parte de v7.12 y completa el Punto 8.

## Antes de publicar
Ejecuta una vez en Supabase → SQL Editor:

`SQL-v7.13-usuarios-permisos.sql`

## Roles
- Dueño: acceso completo y administración de usuarios.
- Administrador: permisos operativos amplios por defecto, sin acceso a configuración crítica ni administración del dueño.
- Empleado: acceso básico y permisos configurables por el dueño.

## Cambios
- Nueva sección **Usuarios**.
- Invitaciones mediante código ligado al correo invitado.
- Flujo **Tengo código de invitación** para usuarios nuevos o existentes.
- Permisos individuales para Vender, Pedidos, Mesas, Caja, Productos/Servicios, Clientes/Crédito, Mis ventas, Catálogo QR y Anular ventas.
- Activar/desactivar miembros.
- El PIN solo bloquea/desbloquea; ya no cambia el rol del usuario.
- Los permisos se cargan desde `business_members` en Supabase.
- RLS actualizado para limitar escritura según permisos.
- Cada miembro entra al mismo negocio sin crear otro negocio accidentalmente.

No borra ventas, productos, clientes ni otros datos existentes.
