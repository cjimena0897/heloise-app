# AJVC Inventario

PWA mobile-first para gestión de inventario K-beauty AJVC.

## Desarrollo

```bash
npm install
npm run dev
```

Abre la URL que muestre Vite (típicamente http://localhost:5173) desde tu teléfono en la misma red WiFi para probar el escáner QR.

> El acceso a la cámara requiere **HTTPS** o `localhost`. En Vercel funciona automáticamente. Si pruebas desde la red local, usa el navegador en el mismo equipo, o un túnel HTTPS (ngrok, Cloudflare Tunnel).

## Build

```bash
npm run build
```

## Deploy a Vercel

1. Sube el repositorio a GitHub.
2. En vercel.com → "Add new project" → importa el repo.
3. Framework preset: **Vite**. Build command: `npm run build`. Output dir: `dist`.
4. Deploy. El archivo `vercel.json` ya maneja el routing SPA.

## Datos

**Para compartir datos entre varios celulares, sigue [FIREBASE.md](FIREBASE.md).** Sin esa configuración, la app funciona en modo local:

Todo se guarda en `localStorage` del navegador **de cada teléfono** (los datos no se comparten entre dispositivos). El botón **Reset** borra todo: productos, movimientos y ventas.

## Vistas

- **Inventario** — listado, búsqueda, filtros por marca/categoría, alta/edición/eliminación de productos, entradas y salidas rápidas.
- **Escáner** — lee la etiqueta del producto con la cámara: códigos de barras alfanuméricos (Code 128, Code 39, EAN, UPC, ITF, Codabar) o QR. Busca por **código de etiqueta** o por `id`. Muestra el precio con descuentos rápidos (10/15/20/25/30 %, oferta, % libre o precio manual) y permite agregarlo a la venta. Si el código no existe, ofrece asignarlo a un producto o crear uno nuevo.
- **Venta en curso (carrito)** — barra amarilla flotante. Al cobrar se registra cliente, celular, evento/showroom y pago: completo, mitad, crédito u otro monto (Efectivo, Yape, Plin, Transferencia, Tarjeta). Descuenta el stock automáticamente.
- **Ventas** — informe con vendido, cobrado, por cobrar, ganancia aprox. y descuentos dados; filtros por periodo y evento. Pestañas *Ventas*, *Por cobrar* (agrupado por cliente, con recordatorio por WhatsApp) y *Por producto*. Registro de abonos, anulación de ventas (devuelve el stock), exportación a Excel (CSV) e impresión.
- **Movimientos** — historial completo con totales y exportación CSV.
- **QR** — genera códigos QR imprimibles para los productos seleccionados.

## Stack

- React 18 + Vite 5
- React Router (HashRouter para máxima compatibilidad con hosting estático)
- `html5-qrcode` para lectura QR
- `qrcode.react` para generación QR
- Service worker básico para funcionamiento offline
