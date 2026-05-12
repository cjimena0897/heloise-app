import { useEffect, useState, useCallback } from 'react';

const PRODUCTS_KEY = 'ajvc.products.v1';
const TX_KEY = 'ajvc.transactions.v1';
const SEED_FLAG = 'ajvc.seeded.v1';

export const SEED_PRODUCTS = [
  {
    id: '01', categoria: 'Skincare', marca: 'APLB',
    producto: 'Retinol Vitamina C Crema',
    cantInicial: 1, entradas: 0, salidas: 0, stockActual: 1,
    ubicacion: 'Trujillo', costoPEN: 59, pVentaPEN: 85.51, pOfertaPEN: 69.41,
  },
  {
    id: '02', categoria: 'Skincare', marca: 'Biodance',
    producto: 'Collagen Rosa Mask',
    cantInicial: 4, entradas: 0, salidas: 0, stockActual: 4,
    ubicacion: 'Bélgica', costoPEN: 15.96, pVentaPEN: 29, pOfertaPEN: 18.78,
  },
  {
    id: '03', categoria: 'Skincare', marca: 'Biodance',
    producto: 'Mascarillas Niacinamida Amarilla',
    cantInicial: 1, entradas: 0, salidas: 0, stockActual: 1,
    ubicacion: 'Bélgica', costoPEN: 15.96, pVentaPEN: 29, pOfertaPEN: 18.78,
  },
];

function loadProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveProducts(list) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(list));
}

function saveTransactions(list) {
  localStorage.setItem(TX_KEY, JSON.stringify(list));
}

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

export function useProducts() {
  const [products, setProducts] = useState(() => loadProducts() || []);
  useEffect(() => {
    const handler = () => setProducts(loadProducts() || []);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);
  return products;
}

export function useTransactions() {
  const [tx, setTx] = useState(() => loadTransactions());
  useEffect(() => {
    const handler = () => setTx(loadTransactions());
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);
  return tx;
}

export function getProduct(id) {
  return (loadProducts() || []).find((p) => p.id === id);
}

export function addProduct(input) {
  const list = loadProducts() || [];
  const id = (input.id && input.id.trim()) || nextId(list);
  if (list.some((p) => p.id === id)) {
    throw new Error(`Ya existe un producto con id ${id}`);
  }
  const product = recompute({
    id,
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
  const next = list.map((p) => (p.id === id ? recompute({ ...p, ...patch }) : p));
  saveProducts(next);
  notify();
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
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export function exportTransactionsCSV() {
  const rows = loadTransactions();
  const header = ['fecha', 'id_producto', 'producto', 'marca', 'tipo', 'cantidad', 'precio'];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      r.fecha,
      r.productId,
      r.productoNombre,
      r.marca,
      r.tipo,
      r.cantidad,
      r.precio == null ? '' : r.precio,
    ].map(escape).join(','));
  }
  return lines.join('\n');
}

export function downloadCSV() {
  const csv = exportTransactionsCSV();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transacciones-ajvc-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useReset() {
  return useCallback(() => {
    if (!confirm('¿Restaurar datos iniciales? Esto borra todo.')) return;
    localStorage.removeItem(PRODUCTS_KEY);
    localStorage.removeItem(TX_KEY);
    localStorage.removeItem(SEED_FLAG);
    ensureSeed();
    notify();
  }, []);
}
