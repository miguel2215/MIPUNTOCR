# Mi Punto CR v7.10 — catálogo y clientes en la nube

- Supabase es la fuente principal para categorías, productos/servicios y clientes.
- Al iniciar sesión se sincronizan los datos del negocio correcto.
- Crear o editar productos/servicios guarda en Supabase y mantiene copia local.
- Crear clientes guarda en Supabase y mantiene copia local.
- Si se pierde Internet, los nuevos registros quedan pendientes y se sincronizan al volver la conexión.
- Eliminar productos requiere conexión para evitar borrar solo la copia local.
- Ventas, Caja, pagos, crédito, mesas y pedidos siguen pendientes del siguiente bloque.


## v7.11 · Operación en la nube

- Caja, ventas, detalle de venta y métodos de pago en Supabase.
- Crédito y abonos sincronizados.
- Mesas y cuentas abiertas sincronizadas.
- Pedidos de restaurante y sus estados sincronizados.
- Anulaciones e historial sincronizados.
- IndexedDB queda como caché/offline; al volver Internet se intenta subir lo pendiente.

Requiere haber ejecutado el SQL v7.11 indicado en la conversación.
