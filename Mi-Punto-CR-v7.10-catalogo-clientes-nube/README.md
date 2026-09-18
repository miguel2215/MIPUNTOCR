# Mi Punto CR v7.10 — catálogo y clientes en la nube

- Supabase es la fuente principal para categorías, productos/servicios y clientes.
- Al iniciar sesión se sincronizan los datos del negocio correcto.
- Crear o editar productos/servicios guarda en Supabase y mantiene copia local.
- Crear clientes guarda en Supabase y mantiene copia local.
- Si se pierde Internet, los nuevos registros quedan pendientes y se sincronizan al volver la conexión.
- Eliminar productos requiere conexión para evitar borrar solo la copia local.
- Ventas, Caja, pagos, crédito, mesas y pedidos siguen pendientes del siguiente bloque.
