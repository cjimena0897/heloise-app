import { useEffect, useState, useCallback } from 'react';

const PRODUCTS_KEY = 'ajvc.products.v1';
const TX_KEY = 'ajvc.transactions.v1';
const SALES_KEY = 'ajvc.sales.v1';
const CART_KEY = 'ajvc.cart.v1';
const LAST_EVENT_KEY = 'ajvc.lastEvent.v1';
const SEED_FLAG = 'ajvc.seeded.v1';

// Catálogo vacío en el primer arranque. Los productos llegan al sincronizar con el Google Sheet.
export const SEED_PRODUCTS = [];

export const DESCUENTOS = [0, 10, 15, 20, 25, 30];
export const METODOS_PAGO = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta'];

// ---------- helpers ----------

export function r2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function money(n) {
  return `S/ ${r2(n).toFixed(2)}`;
}

export function normCode(s) {
  return String(s ?? '').trim().toUpperCase();
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const loadProducts = () => load(PRODUCTS_KEY, null);
const loadTransactions = () => load(TX_KEY, []);
const loadSales = () => load(SALES_KEY, []);
const loadCart = () => load(CART_KEY, []);
const saveProducts = (l) => save(PRODUCTS_KEY, l);
const saveTransactions = (l) => save(TX_KEY, l);
const saveSales = (l) => save(SALES_KEY, l);
const saveCart = (l) => save(CART_KEY, l);

export function ensureSeed() {
  if (!localStorage.getItem(SEED_FLAG)) {
    const existing = loadProducts();
    if (!existing || existing.length === 0) {
      saveProducts(SEED_PRODUCTS);
    }
    localStorage.setItem(SEED_FLAG, '1');
  }
}

function recompute(product) {
  const cantInicial = Number(product.cantInicial) || 0;
  const entradas = Number(product.entradas) || 0;
  const salidas = Number(product.salidas) || 0;
  return { ...product, cantInicial, entradas, salidas, stockActual: cantInicial + entradas - salidas };
}

// Simple pub/sub so multiple views stay in sync.
const listeners = new Set();
function notify() {
  listeners.forEach((fn) => fn());
}

function useStored(loader) {
  const [value, setValue] = useState(loader);
  useEffect(() => {
    const handler = () => setValue(loader());
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

export const useProducts = () => useStored(() => loadProducts() || []);
export const useTransactions = () => useStored(loadTransactions);
export const useSales = () => useStored(loadSales);
export const useCart = () => useStored(loadCart);

// ---------- productos ----------

export function getProduct(id) {
  return (loadProducts() || []).find((p) => p.id === id);
}

/** Busca por ID interno o por el código de etiqueta (sin distinguir mayúsculas). */
export function findByCode(code) {
  const c = normCode(code);
  if (!c) return null;
  const list = loadProducts() || [];
  return (
    list.find((p) => normCode(p.codigo) === c) ||
    list.find((p) => normCode(p.id) === c) ||
    null
  );
}

function assertCodeFree(list, codigo, exceptId) {
  const c = normCode(codigo);
  if (!c) return;
  const clash = list.find(
    (p) => p.id !== exceptId && (normCode(p.codigo) === c || normCode(p.id) === c)
  );
  if (clash) throw new Error(`El código ${c} ya pertenece a "${clash.producto}" (#${clash.id})`);
}

export function addProduct(input) {
  const list = loadProducts() || [];
  const id = (input.id && input.id.trim()) || nextId(list);
  if (list.some((p) => p.id === id)) {
    throw new Error(`Ya existe un producto con id ${id}`);
  }
  assertCodeFree(list, input.codigo, id);
  const product = recompute({
    id,
    codigo: normCode(input.codigo),
    categoria: input.categoria || 'Skincare',
    marca: input.marca || '',
    producto: input.producto || '',
    cantInicial: input.cantInicial || 0,
    entradas: 0,
    salidas: 0,
    ubicacion: input.ubicacion || '',
    costoPEN: Number(input.costoPEN) || 0,
    pVentaPEN: Number(input.pVentaPEN) || 0,
    pOfertaPEN: Number(input.pOfertaPEN) || 0,
  });
  saveProducts([...list, product]);
  notify();
  return product;
}

export function updateProduct(id, patch) {
  const list = loadProducts() || [];
  if ('codigo' in patch) {
    assertCodeFree(list, patch.codigo, id);
    patch = { ...patch, codigo: normCode(patch.codigo) };
  }
  const next = list.map((p) => (p.id === id ? recompute({ ...p, ...patch }) : p));
  saveProducts(next);
  notify();
}

export function assignCode(id, codigo) {
  updateProduct(id, { codigo });
}

export function deleteProduct(id) {
  const list = loadProducts() || [];
  saveProducts(list.filter((p) => p.id !== id));
  notify();
}

export function registerMovement({ productId, tipo, cantidad, precio }) {
  const list = loadProducts() || [];
  const idx = list.findIndex((p) => p.id === productId);
  if (idx === -1) throw new Error('Producto no encontrado');
  const qty = Number(cantidad);
  if (!qty || qty <= 0) throw new Error('Cantidad inválida');

  const p = list[idx];
  let updated;
  if (tipo === 'entrada') {
    updated = recompute({ ...p, entradas: (p.entradas || 0) + qty });
  } else if (tipo === 'salida') {
    if ((p.stockActual || 0) < qty) throw new Error('Stock insuficiente');
    updated = recompute({ ...p, salidas: (p.salidas || 0) + qty });
  } else {
    throw new Error('Tipo inválido');
  }
  const nextList = [...list];
  nextList[idx] = updated;
  saveProducts(nextList);

  const tx = loadTransactions();
  const entry = {
    id: uid(),
    fecha: new Date().toISOString(),
    productId,
    productoNombre: p.producto,
    marca: p.marca,
    tipo,
    cantidad: qty,
    precio: precio != null && precio !== '' ? Number(precio) : null,
  };
  saveTransactions([entry, ...tx]);
  notify();
  return entry;
}

function nextId(list) {
  const nums = list.map((p) => parseInt(p.id, 10)).filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return String(max + 1).padStart(2, '0');
}

export function suggestNextId() {
  return nextId(loadProducts() || []);
}

// ---------- precios / descuentos ----------

export function precioLista(p) {
  return r2(p?.pVentaPEN || 0);
}

export function precioConDescuento(lista, pct) {
  return r2(lista * (1 - (Number(pct) || 0) / 100));
}

// ---------- carrito (venta en curso) ----------

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
  notify();
  return item;
}

export function removeFromCart(key) {
  saveCart(loadCart().filter((i) => i.key !== key));
  notify();
}

export function clearCart() {
  saveCart([]);
  notify();
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
  const list = loadProducts() || [];
  const qtyBy = {};
  for (const i of cart) qtyBy[i.productId] = (qtyBy[i.productId] || 0) + i.cantidad;
  for (const [pid, qty] of Object.entries(qtyBy)) {
    const p = list.find((x) => x.id === pid);
    if (!p) throw new Error('Un producto de la venta ya no existe');
    if ((p.stockActual || 0) < qty) throw new Error(`Stock insuficiente de "${p.producto}"`);
  }

  const saleId = uid();
  const fecha = new Date().toISOString();

  saveProducts(
    list.map((p) => (qtyBy[p.id] ? recompute({ ...p, salidas: (p.salidas || 0) + qtyBy[p.id] }) : p))
  );

  const newTx = cart.map((i) => ({
    id: uid(),
    fecha,
    productId: i.productId,
    productoNombre: i.productoNombre,
    marca: i.marca,
    tipo: 'salida',
    cantidad: i.cantidad,
    precio: i.precioUnit,
    saleId,
    cliente: nombre,
  }));
  saveTransactions([...newTx, ...loadTransactions()]);

  const ev = (evento || '').trim();
  const sale = {
    id: saleId,
    fecha,
    cliente: nombre,
    telefono: (telefono || '').trim(),
    evento: ev,
    nota: (nota || '').trim(),
    items: cart,
    total,
    pagos: pago > 0 ? [{ id: uid(), fecha, monto: pago, metodo: metodo || '' }] : [],
  };
  saveSales([sale, ...loadSales()]);
  localStorage.setItem(LAST_EVENT_KEY, ev);
  saveCart([]);
  notify();
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
  const sales = loadSales();
  const idx = sales.findIndex((s) => s.id === saleId);
  if (idx === -1) throw new Error('Venta no encontrada');
  const m = r2(monto);
  if (!m || m <= 0) throw new Error('Monto inválido');
  const { saldo } = saleStatus(sales[idx]);
  if (m > saldo + 0.005) throw new Error(`El saldo pendiente es ${money(saldo)}`);
  const next = [...sales];
  next[idx] = {
    ...sales[idx],
    pagos: [...(sales[idx].pagos || []), { id: uid(), fecha: new Date().toISOString(), monto: m, metodo: metodo || '' }],
  };
  saveSales(next);
  notify();
}

export function deletePayment(saleId, paymentId) {
  saveSales(
    loadSales().map((s) =>
      s.id === saleId ? { ...s, pagos: (s.pagos || []).filter((p) => p.id !== paymentId) } : s
    )
  );
  notify();
}

/** Anula una venta: devuelve el stock y borra sus movimientos. */
export function deleteSale(saleId) {
  const sales = loadSales();
  const sale = sales.find((s) => s.id === saleId);
  if (!sale) return;
  const qtyBy = {};
  for (const i of sale.items) qtyBy[i.productId] = (qtyBy[i.productId] || 0) + i.cantidad;
  saveProducts(
    (loadProducts() || []).map((p) =>
      qtyBy[p.id] ? recompute({ ...p, salidas: Math.max(0, (p.salidas || 0) - qtyBy[p.id]) }) : p
    )
  );
  saveTransactions(loadTransactions().filter((t) => t.saleId !== saleId));
  saveSales(sales.filter((s) => s.id !== saleId));
  notify();
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

export function exportTransactionsCSV() {
  const rows = loadTransactions().map((r) => [
    r.fecha, r.productId, r.productoNombre, r.marca, r.tipo, r.cantidad,
    r.precio == null ? '' : r.precio, r.cliente || '',
  ]);
  return toCSV(['fecha', 'id_producto', 'producto', 'marca', 'tipo', 'cantidad', 'precio', 'cliente'], rows);
}

export function downloadCSV() {
  downloadFile(exportTransactionsCSV(), `movimientos-ajvc-${today()}.csv`);
}

/** Una fila por producto vendido. */
export function downloadSalesCSV(sales = loadSales()) {
  const rows = [];
  for (const s of sales) {
    const st = saleStatus(s);
    for (const i of s.items) {
      rows.push([
        s.fecha.slice(0, 10), s.id, s.cliente, s.telefono, s.evento,
        i.codigo || i.productId, i.productoNombre, i.marca, i.cantidad,
        i.precioLista, i.descuentoPct, i.precioUnit, r2(i.precioUnit * i.cantidad),
        s.total, st.pagado, st.saldo, ESTADO_LABEL[st.estado], s.nota,
      ]);
    }
  }
  const header = [
    'fecha', 'venta_id', 'cliente', 'telefono', 'evento', 'codigo', 'producto', 'marca', 'cantidad',
    'precio_lista', 'descuento_pct', 'precio_unit', 'subtotal', 'total_venta', 'pagado_venta',
    'saldo_venta', 'estado', 'nota',
  ];
  downloadFile(toCSV(header, rows), `ventas-ajvc-${today()}.csv`);
}

export function downloadDebtCSV(sales = loadSales()) {
  const rows = sales
    .map((s) => ({ s, st: saleStatus(s) }))
    .filter(({ st }) => st.saldo > 0)
    .map(({ s, st }) => [
      s.fecha.slice(0, 10), s.cliente, s.telefono, s.evento,
      s.items.map((i) => `${i.cantidad}x ${i.productoNombre}`).join(' | '),
      s.total, st.pagado, st.saldo, ESTADO_LABEL[st.estado],
    ]);
  const header = ['fecha', 'cliente', 'telefono', 'evento', 'productos', 'total', 'pagado', 'saldo', 'estado'];
  downloadFile(toCSV(header, rows), `por-cobrar-ajvc-${today()}.csv`);
}

export function useReset() {
  return useCallback(() => {
    if (!confirm('¿Restaurar datos iniciales? Esto borra TODO: productos, movimientos y ventas.')) return;
    [PRODUCTS_KEY, TX_KEY, SALES_KEY, CART_KEY, SEED_FLAG].forEach((k) => localStorage.removeItem(k));
    ensureSeed();
    notify();
  }, []);
}
