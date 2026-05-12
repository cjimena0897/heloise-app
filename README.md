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

Todo se guarda en `localStorage` del navegador. El botón **Reset** (esquina superior) restaura los datos de ejemplo.

## Vistas

- **Inventario** — listado, búsqueda, filtros por marca/categoría, alta/edición/eliminación de productos, entradas y salidas rápidas.
- **Escáner QR** — usa la cámara para leer el QR de un producto (el QR codifica el `id`).
- **Movimientos** — historial completo con totales y exportación CSV.
- **QR** — genera códigos QR imprimibles para los productos seleccionados.

## Stack

- React 18 + Vite 5
- React Router (HashRouter para máxima compatibilidad con hosting estático)
- `html5-qrcode` para lectura QR
- `qrcode.react` para generación QR
- Service worker básico para funcionamiento offline
