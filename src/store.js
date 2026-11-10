import { useEffect, useState, useCallback } from 'react';
import { CLOUD, commitCloud, login, logout, resetPassword, subscribe, watchAuth } from './backend.js';

const PRODUCTS_KEY = 'ajvc.products.v1';
const TX_KEY = 'ajvc.transactions.v1';
const SALES_KEY = 'ajvc.sales.v1';
const CART_KEY = 'ajvc.cart.v1';
const LAST_EVENT_KEY = 'ajvc.lastEvent.v1';
const MIGRATED_KEY = 'ajvc.migrated.v1';

export const DESCUENTOS = [0, 10, 15, 20, 25, 30];
export const METODOS_PAGO = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta'];

// Colecciones (nombres en Firestore) ↔ claves de localStorage en modo local.
const COLS = { productos: PRODUCTS_KEY, movimientos: TX_KEY, ventas: SALES_KEY };

// ---------- helpers ----------

export function r2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function money(n) {
  return `S/ ${moneyFmt.format(r2(n))}`;
}

export function normCode(s) {
  return String(s ?? '').trim().toUpperCase();
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function saveLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function recompute(product) {
  const cantInicial = Number(product.cantInicial) || 0;
  const entradas = Number(product.entradas) || 0;
  const salidas = Number(product.salidas) || 0;
  return { ...product, cantInicial, entradas, salidas, stockActual: cantInicial + entradas - salidas };
}

const byFechaDesc = (a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0);
const byId = (a, b) => String(a.id).localeCompare(String(b.id), 'es', { numeric: true });

function normalize(col, docs) {
  if (col === 'productos') return docs.map(recompute).sort(byId);
  return [...docs].sort(byFechaDesc);
}

// ---------- estado en memoria + suscripción ----------

const cache = {
  productos: CLOUD ? [] : normalize('productos', loadLS(PRODUCTS_KEY, [])),
  movimientos: CLOUD ? [] : normalize('movimientos', loadLS(TX_KEY, [])),
  ventas: CLOUD ? [] : normalize('ventas', loadLS(SALES_KEY, [])),
};

let status = {
  mode: CLOUD ? 'cloud' : 'local',
  authReady: !CLOUD,
  user: null, // { email, uid }
  loaded: !CLOUD,
  pending: false, // cambios aún no subidos
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  error: null,
};

const listeners = new Set();
function notify() {
  listeners.forEach((fn) => fn());
}
function setStatus(patch) {
  status = { ...status, ...patch };
  notify();
}

function useStored(selector) {
  const [value, setValue] = useState(selector);
  useEffect(() => {
    const handler = () => setValue(selector());
    handler();
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

export const useProducts = () => useStored(() => cache.productos);
export const useTransactions = () => useStored(() => cache.movimientos);
export const useSales = () => useStored(() => cache.ventas);
export const useCart = () => useStored(loadCart);
export const useStatus = () => useStored(() => status);

// ---------- nube ----------

let started = false;
let unsubData = null;

export function startSync() {
  if (!CLOUD || started) return;
  started = true;
  window.addEventListener('online', () => setStatus({ online: true }));
  window.addEventListener('offline', () => setStatus({ online: false }));

  watchAuth(async (user) => {
    unsubData?.();
    unsubData = null;
    if (!user) {
      cache.productos = [];
      cache.movimientos = [];
      cache.ventas = [];
      setStatus({ authReady: true, user: null, loaded: false, error: null });
      return;
    }
    setStatus({ authReady: true, user: { email: user.email, uid: user.uid }, loaded: false, error: null });
    const loadedCols = new Set();
    const pendingCols = {};
    unsubData = await subscribe(
      Object.keys(COLS),
      (col, docs, meta) => {
        cache[col] = normalize(col, docs);
        loadedCols.add(col);
        pendingCols[col] = meta.pending;
        setStatus({
          loaded: loadedCols.size === Object.keys(COLS).length,
          pending: Object.values(pendingCols).some(Boolean),
        });
      },
      (err) => {
        setStatus({
          loaded: true,
          error:
            err?.code === 'permission-denied'
              ? `Tu cuenta (${user.email}) no tiene acceso. Pide que agreguen tu correo a las reglas de Firebase.`
              : err?.message || 'Error de conexión',
        });
      }
    );
  }).catch((e) => setStatus({ authReady: true, error: e?.message || 'No se pudo conectar con Firebase' }));
}

export { login, logout, resetPassword };

function vendedor() {
  return status.user?.email || '';
}

// ---------- operaciones de escritura ----------
// Todas las escrituras pasan por commit(ops). En modo local se aplican y guardan en este
// celular; en la nube se aplican al instante en pantalla y se envían a Firestore
// (si no hay internet, Firestore las guarda y las sube al volver la conexión).

function applyOps(ops) {
  const touched = new Set();
  for (const op of ops) {
    const list = cache[op.col];
    const idx = list.findIndex((d) => d.id === op.id);
    touched.add(op.col);
    if (op.t === 'set') {
      const doc = { ...op.data, id: op.id };
      cache[op.col] = idx === -1 ? [...list, doc] : list.map((d, i) => (i === idx ? doc : d));
    } else if (op.t === 'del') {
      if (idx !== -1) cache[op.col] = list.filter((_, i) => i !== idx);
    } else if (idx !== -1) {
      const d = { ...list[idx], ...(op.data || {}) };
      for (const [k, v] of Object.entries(op.inc || {})) d[k] = (Number(d[k]) || 0) + v;
      for (const [k, v] of Object.entries(op.add || {})) d[k] = [...(d[k] || []), v];
      for (const [k, v] of Object.entries(op.remove || {})) d[k] = (d[k] || []).filter((x) => x.id !== v.id);
      cache[op.col] = list.map((x, i) => (i === idx ? d : x));
    }
  }
  for (const col of touched) cache[col] = normalize(col, cache[col]);
}

function commit(ops) {
  if (!ops.length) return;
  applyOps(ops);
  if (status.mode === 'local') {
    for (const [col, key] of Object.entries(COLS)) saveLS(key, cache[col]);
  } else {
    commitCloud(ops).catch((e) => {
      const msg = e?.code === 'permission-denied' ? 'No tienes permiso para guardar cambios.' : e?.message;
      alert(`No se pudo guardar en la nube: ${msg}`);
    });
  }
  notify();
}

// Campos del producto que se escriben (stockActual siempre se calcula).
function productData(p) {
  return {
    codigo: normCode(p.codigo),
    categoria: p.categoria || 'Skincare',
    marca: p.marca || '',
    producto: p.producto || '',
    cantInicial: Number(p.cantInicial) || 0,
    entradas: Number(p.entradas) || 0,
    salidas: Number(p.salidas) || 0,
    ubicacion: p.ubicacion || '',
    foto: p.foto || '',
    costoPEN: Number(p.costoPEN) || 0,
    pVentaPEN: Number(p.pVentaPEN) || 0,
    pOfertaPEN: Number(p.pOfertaPEN) || 0,
  };
}

// ---------- productos ----------

export function getProduct(id) {
  return cache.productos.find((p) => p.id === id);
}

/** Busca por ID interno o por el código de etiqueta (sin distinguir mayúsculas). */
export function findByCode(code) {
  const c = normCode(code);
  if (!c) return null;
  return (
    cache.productos.find((p) => normCode(p.codigo) === c) ||
    cache.productos.find((p) => normCode(p.id) === c) ||
    null
  );
}

function assertCodeFree(codigo, exceptId) {
  const c = normCode(codigo);
  if (!c) return;
  const clash = cache.productos.find(
    (p) => p.id !== exceptId && (normCode(p.codigo) === c || normCode(p.id) === c)
  );
  if (clash) throw new Error(`El código ${c} ya pertenece a "${clash.producto}" (#${clash.id})`);
}

export function addProduct(input) {
  const id = (input.id && input.id.trim()) || nextId(cache.productos);
  if (id.includes('/')) throw new Error('El ID no puede contener "/"');
  if (cache.productos.some((p) => p.id === id)) {
    throw new Error(`Ya existe un producto con id ${id}`);
  }
  assertCodeFree(input.codigo, id);
  const data = productData({ ...input, entradas: 0, salidas: 0 });
  commit([{ t: 'set', col: 'productos', id, data }]);
  return getProduct(id);
}

const EDITABLE = ['codigo', 'categoria', 'marca', 'producto', 'cantInicial', 'ubicacion', 'costoPEN', 'pVentaPEN', 'pOfertaPEN', 'foto'];

export function updateProduct(id, patch) {
  if ('codigo' in patch) assertCodeFree(patch.codigo, id);
  const full = productData({ ...getProduct(id), ...patch });
  // Solo se escriben los campos editables: entradas/salidas cambian con increment()
  // para que no se pisen las ventas de otra persona.
  const data = {};
  for (const k of EDITABLE) if (k in patch) data[k] = full[k];
  commit([{ t: 'update', col: 'productos', id, data }]);
}

export function assignCode(id, codigo) {
  updateProduct(id, { codigo });
}

export function deleteProduct(id) {
  commit([{ t: 'del', col: 'productos', id }]);
}

export function registerMovement({ productId, tipo, cantidad, precio }) {
  const p = getProduct(productId);
  if (!p) throw new Error('Producto no encontrado');
  const qty = Number(cantidad);
  if (!qty || qty <= 0) throw new Error('Cantidad inválida');
  if (tipo !== 'entrada' && tipo !== 'salida') throw new Error('Tipo inválido');
  if (tipo === 'salida' && (p.stockActual || 0) < qty) throw new Error('Stock insuficiente');

  const entry = {
    id: uid(),
    fecha: new Date().toISOString(),
    productId,
    productoNombre: p.producto,
    marca: p.marca,
    tipo,
    cantidad: qty,
    precio: precio != null && precio !== '' ? Number(precio) : null,
    vendedor: vendedor(),
  };
  commit([
    { t: 'update', col: 'productos', id: productId, inc: { [tipo === 'entrada' ? 'entradas' : 'salidas']: qty } },
    { t: 'set', col: 'movimientos', id: entry.id, data: entry },
  ]);
  return entry;
}

function nextId(list) {
  const nums = list.map((p) => parseInt(p.id, 10)).filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1).padStart(2, '0');
}

export function suggestNextId() {
  return nextId(cache.productos);
}

// ---------- precios / descuentos ----------

export function precioLista(p) {
  return r2(p?.pVentaPEN || 0);
}

export function precioConDescuento(lista, pct) {
  return r2(lista * (1 - (Number(pct) || 0) / 100));
}

// ---------- carrito (venta en curso; propio de cada celular) ----------

function loadCart() {
  return loadLS(CART_KEY, []);
}
function saveCart(list) {
  saveLS(CART_KEY, list);
  notify();
}

export function addToCart({ productId, cantidad, precioUnit }) {
  const p = getProduct(productId);
  if (!p) throw new Error('Producto no encontrado');
  const qty = Number(cantidad);
  if (!qty || qty <= 0) throw new Error('Cantidad inválida');
  const unit = r2(precioUnit);
  if (unit < 0) throw new Error('Precio inválido');

  const cart = loadCart();
  const enCarrito = cart.filter((i) => i.productId === productId).reduce((s, i) => s + i.cantidad, 0);
  if (enCarrito + qty > (p.stockActual || 0)) {
    throw new Error(`Stock insuficiente: quedan ${p.stockActual} y ya hay ${enCarrito} en la venta`);
  }
  const lista = precioLista(p);
  const item = {
    key: uid(),
    productId,
    codigo: p.codigo || '',
    productoNombre: p.producto,
    marca: p.marca,
    cantidad: qty,
    precioLista: lista,
    descuentoPct: lista > 0 ? r2((1 - unit / lista) * 100) : 0,
    precioUnit: unit,
    costoUnit: r2(p.costoPEN || 0),
  };
  saveCart([...cart, item]);
  return item;
}

export function removeFromCart(key) {
  saveCart(loadCart().filter((i) => i.key !== key));
}

export function clearCart() {
  saveCart([]);
}

export function cartTotal(cart) {
  return r2(cart.reduce((s, i) => s + i.precioUnit * i.cantidad, 0));
}

export function getLastEvent() {
  return localStorage.getItem(LAST_EVENT_KEY) || '';
}

/**
 * Cierra la venta: descuenta stock, registra los movimientos y guarda la venta
 * con el pago inicial (puede ser 0 = crédito).
 */
export function checkout({ cliente, telefono, evento, pagoInicial, metodo, nota }) {
  const cart = loadCart();
  if (cart.length === 0) throw new Error('La venta está vacía');
  const nombre = (cliente || '').trim();
  if (!nombre) throw new Error('Ingresa el nombre del cliente');

  const total = cartTotal(cart);
  const pago = r2(pagoInicial);
  if (pago < 0) throw new Error('Monto inválido');
  if (pago > total + 0.005) throw new Error('El pago no puede ser mayor que el total');

  // Validar stock de todo antes de tocar nada.
  const qtyBy = {};
  for (const i of cart) qtyBy[i.productId] = (qtyBy[i.productId] || 0) + i.cantidad;
  for (const [pid, qty] of Object.entries(qtyBy)) {
    const p = getProduct(pid);
    if (!p) throw new Error('Un producto de la venta ya no existe');
    if ((p.stockActual || 0) < qty) throw new Error(`Stock insuficiente de "${p.producto}" (quedan ${p.stockActual})`);
  }

  const saleId = uid();
  const fecha = new Date().toISOString();
  const ev = (evento || '').trim();
  const quien = vendedor();

  const ops = Object.entries(qtyBy).map(([pid, qty]) => ({
    t: 'update', col: 'productos', id: pid, inc: { salidas: qty },
  }));
  for (const i of cart) {
    const id = uid();
    ops.push({
      t: 'set', col: 'movimientos', id,
      data: {
        id, fecha, productId: i.productId, productoNombre: i.productoNombre, marca: i.marca,
        tipo: 'salida', cantidad: i.cantidad, precio: i.precioUnit, saleId, cliente: nombre, vendedor: quien,
      },
    });
  }
  const sale = {
    id: saleId,
    fecha,
    cliente: nombre,
    telefono: (telefono || '').trim(),
    evento: ev,
    nota: (nota || '').trim(),
    vendedor: quien,
    items: cart,
    total,
    pagos: pago > 0 ? [{ id: uid(), fecha, monto: pago, metodo: metodo || '', vendedor: quien }] : [],
  };
  ops.push({ t: 'set', col: 'ventas', id: saleId, data: sale });

  commit(ops);
  localStorage.setItem(LAST_EVENT_KEY, ev);
  saveCart([]);
  return sale;
}

// ---------- ventas / cobranza ----------

export function saleStatus(sale) {
  const pagado = r2((sale.pagos || []).reduce((s, p) => s + p.monto, 0));
  const saldo = r2(sale.total - pagado);
  let estado = 'credito';
  if (saldo <= 0.005) estado = 'pagado';
  else if (pagado > 0) estado = 'parcial';
  return { pagado, saldo: Math.max(0, saldo), estado };
}

export const ESTADO_LABEL = { pagado: 'Pagado', parcial: 'Parcial', credito: 'Crédito' };

export function addPayment(saleId, { monto, metodo }) {
  const sale = cache.ventas.find((s) => s.id === saleId);
  if (!sale) throw new Error('Venta no encontrada');
  const m = r2(monto);
  if (!m || m <= 0) throw new Error('Monto inválido');
  const { saldo } = saleStatus(sale);
  if (m > saldo + 0.005) throw new Error(`El saldo pendiente es ${money(saldo)}`);
  const pago = { id: uid(), fecha: new Date().toISOString(), monto: m, metodo: metodo || '', vendedor: vendedor() };
  commit([{ t: 'update', col: 'ventas', id: saleId, add: { pagos: pago } }]);
}

export function deletePayment(saleId, paymentId) {
  const sale = cache.ventas.find((s) => s.id === saleId);
  const pago = sale?.pagos?.find((p) => p.id === paymentId);
  if (!pago) return;
  commit([{ t: 'update', col: 'ventas', id: saleId, remove: { pagos: pago } }]);
}

/** Anula una venta: devuelve el stock y borra sus movimientos. */
export function deleteSale(saleId) {
  const sale = cache.ventas.find((s) => s.id === saleId);
  if (!sale) return;
  const qtyBy = {};
  for (const i of sale.items) qtyBy[i.productId] = (qtyBy[i.productId] || 0) + i.cantidad;
  const ops = Object.entries(qtyBy)
    .filter(([pid]) => getProduct(pid))
    .map(([pid, qty]) => ({ t: 'update', col: 'productos', id: pid, inc: { salidas: -qty } }));
  for (const t of cache.movimientos) if (t.saleId === saleId) ops.push({ t: 'del', col: 'movimientos', id: t.id });
  ops.push({ t: 'del', col: 'ventas', id: saleId });
  commit(ops);
}

// ---------- importar pedido ----------

/**
 * Carga un pedido: crea los productos nuevos y suma unidades a los que ya existen.
 * items: salida de buildPreview (solo estado 'nuevo' o 'existe').
 * opts: { lote, actualizarPrecios }
 */
export function importInventory(items, { lote = '', actualizarPrecios = false } = {}) {
  const fecha = new Date().toISOString();
  const quien = vendedor();
  const ops = [];
  let nuevos = 0, existentes = 0, unidades = 0, i = 0;
  for (const it of items) {
    if (it.estado !== 'nuevo' && it.estado !== 'existe') continue;
    const qty = Number(it.cantidad) || 0;
    let id;
    if (it.estado === 'nuevo') {
      id = it.codigo;
      if (getProduct(id) || findByCode(id)) continue;
      ops.push({
        t: 'set', col: 'productos', id,
        data: productData({
          codigo: it.codigo, producto: it.producto, marca: it.marca, categoria: it.categoria || 'Otros',
          ubicacion: it.ubicacion, cantInicial: 0, entradas: qty, salidas: 0,
          costoPEN: it.costo, pVentaPEN: it.venta, pOfertaPEN: it.oferta, foto: it.foto,
        }),
      });
      nuevos++;
    } else {
      id = it.existente.id;
      const data = {};
      if (actualizarPrecios) {
        if (it.costo != null) data.costoPEN = it.costo;
        if (it.venta != null) data.pVentaPEN = it.venta;
        if (it.oferta != null) data.pOfertaPEN = it.oferta;
      }
      if (it.foto && !it.existente.foto) data.foto = it.foto;
      if (qty > 0 || Object.keys(data).length) {
        ops.push({ t: 'update', col: 'productos', id, data, inc: qty > 0 ? { entradas: qty } : undefined });
      }
      existentes++;
    }
    if (qty > 0) {
      const mid = `${uid()}-${i++}`;
      ops.push({
        t: 'set', col: 'movimientos', id: mid,
        data: {
          id: mid, fecha, productId: id, productoNombre: it.producto || it.existente?.producto, marca: it.marca || it.existente?.marca || '',
          tipo: 'entrada', cantidad: qty, precio: it.costo ?? null, lote: lote.trim(), vendedor: quien,
        },
      });
      unidades += qty;
    }
  }
  commit(ops);
  return { nuevos, existentes, unidades };
}

// ---------- migración local → nube ----------

/** Datos que quedaron guardados solo en este celular (de antes de conectar Firebase). */
export function localDataSummary() {
  if (!CLOUD || localStorage.getItem(MIGRATED_KEY)) return null;
  const p = loadLS(PRODUCTS_KEY, []).length;
  const m = loadLS(TX_KEY, []).length;
  const v = loadLS(SALES_KEY, []).length;
  return p + m + v > 0 ? { productos: p, movimientos: m, ventas: v } : null;
}

export function uploadLocalData() {
  const ops = [];
  let skipped = 0;
  for (const [col, key] of Object.entries(COLS)) {
    for (const d of loadLS(key, [])) {
      if (!d?.id) continue;
      if (cache[col].some((x) => x.id === d.id)) { skipped++; continue; }
      const data = col === 'productos' ? productData(d) : { ...d };
      ops.push({ t: 'set', col, id: String(d.id), data });
    }
  }
  commit(ops);
  localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
  notify();
  return { subidos: ops.length, omitidos: skipped };
}

// ---------- CSV ----------

function toCSV(header, rows) {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');
}

export function downloadFile(content, filename) {
  // BOM para que Excel muestre bien las tildes.
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

export function downloadCSV() {
  const rows = cache.movimientos.map((r) => [
    r.fecha, r.productId, r.productoNombre, r.marca, r.tipo, r.cantidad,
    r.precio == null ? '' : r.precio, r.cliente || '', r.vendedor || '',
  ]);
  const header = ['fecha', 'id_producto', 'producto', 'marca', 'tipo', 'cantidad', 'precio', 'cliente', 'registrado_por'];
  downloadFile(toCSV(header, rows), `movimientos-ajvc-${today()}.csv`);
}

/** Una fila por producto vendido. */
export function downloadSalesCSV(sales = cache.ventas) {
  const rows = [];
  for (const s of sales) {
    const st = saleStatus(s);
    for (const i of s.items) {
      rows.push([
        s.fecha.slice(0, 10), s.id, s.cliente, s.telefono, s.evento,
        i.codigo || i.productId, i.productoNombre, i.marca, i.cantidad,
        i.precioLista, i.descuentoPct, i.precioUnit, r2(i.precioUnit * i.cantidad),
        s.total, st.pagado, st.saldo, ESTADO_LABEL[st.estado], s.vendedor || '', s.nota,
      ]);
    }
  }
  const header = [
    'fecha', 'venta_id', 'cliente', 'telefono', 'evento', 'codigo', 'producto', 'marca', 'cantidad',
    'precio_lista', 'descuento_pct', 'precio_unit', 'subtotal', 'total_venta', 'pagado_venta',
    'saldo_venta', 'estado', 'vendido_por', 'nota',
  ];
  downloadFile(toCSV(header, rows), `ventas-ajvc-${today()}.csv`);
}

export function downloadDebtCSV(sales = cache.ventas) {
  const rows = sales
    .map((s) => ({ s, st: saleStatus(s) }))
    .filter(({ st }) => st.saldo > 0)
    .map(({ s, st }) => [
      s.fecha.slice(0, 10), s.cliente, s.telefono, s.evento,
      s.items.map((i) => `${i.cantidad}x ${i.productoNombre}`).join(' | '),
      s.total, st.pagado, st.saldo, ESTADO_LABEL[st.estado], s.vendedor || '',
    ]);
  const header = ['fecha', 'cliente', 'telefono', 'evento', 'productos', 'total', 'pagado', 'saldo', 'estado', 'vendido_por'];
  downloadFile(toCSV(header, rows), `por-cobrar-ajvc-${today()}.csv`);
}

/** Solo en modo local: borra todo lo guardado en este celular. */
export function useReset() {
  return useCallback(() => {
    if (status.mode !== 'local') return;
    if (!confirm('¿Borrar TODO lo guardado en este celular? (productos, movimientos y ventas)')) return;
    [PRODUCTS_KEY, TX_KEY, SALES_KEY, CART_KEY].forEach((k) => localStorage.removeItem(k));
    cache.productos = [];
    cache.movimientos = [];
    cache.ventas = [];
    notify();
  }, []);
}
