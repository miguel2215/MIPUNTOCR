PUNTO YA CR · BOT QA FINAL · compatible con v7.34

QUÉ CUBRE
- Carga inicial y navegación principal diferenciando PC y móvil.
- Regresión del registro inicial: nombre y tipo de negocio no deben borrarse por un repintado.
- Vista Retail en PC y móvil.
- Confirma que Retail no muestre controles de restaurante ni mesas dentro de Pedidos.
- Alta de artículos con costo, precio, stock y código usando selectores estables.
- Dinero en mercadería, valor potencial y ganancia proyectada.
- Escáner manual: botón Buscar y tecla Enter.
- Código no registrado y prevención de códigos duplicados.
- Pedidos y estados Recibido / Listo / Entregado.
- Pedido WhatsApp Retail sin exigir caja abierta y sin enviar mensajes.
- Catálogo QR en modo sin cuenta.
- Plan Gratis / funciones PRO.
- Legal, privacidad y pantalla de eliminación sin confirmar borrado.
- Captura errores JavaScript y respuestas HTTP relevantes.
- Ejecuta en PC Chromium y móvil Pixel 7.

INSTALACIÓN
1. Coloca la carpeta tests, package.json y playwright.config.js en la raíz de PUNTO YA CR.
2. Ejecuta: npm install
3. Ejecuta: npx playwright install chromium
4. Ejecuta: npm run test:qa

PARA PROBAR UNA WEB YA PUBLICADA
Windows PowerShell:
  $env:QA_BASE_URL="https://TU-DOMINIO/"; npm run test:qa

CMD:
  set QA_BASE_URL=https://TU-DOMINIO/ && npm run test:qa

COMANDOS ÚTILES
- npm run test:qa:pc
- npm run test:qa:mobile
- npm run test:qa:retail
- npm run test:qa:critical
- npm run test:qa:report

SEGURIDAD DEL BOT
- Usa negocios temporales en modo "sin cuenta".
- No confirma eliminaciones.
- No envía WhatsApp.
- No emite facturas electrónicas.
- No necesita datos reales.
