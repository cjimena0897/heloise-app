import { useEffect, useMemo, useState } from 'react';
import { useProducts, addProduct, updateProduct, deleteProduct, suggestNextId, registerMovement } from '../store.js';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';

function stockClass(n) {
  if (n <= 0) return 'red';
  if (n <= 2) return 'yellow';
  return 'green';
}

export default function Inventory() {
  const products = useProducts();
  const [q, setQ] = useState('');
  const [filterMarca, setFilterMarca] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [movement, setMovement] = useState(null); // { product, tipo }
  const toast = useToast();

  const marcas = useMemo(() => Array.from(new Set(products.map((p) => p.marca))).sort(), [products]);
  const categorias = useMemo(() => Array.from(new Set(products.map((p) => p.categoria))).sort(), [products]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => {
      if (filterMarca && p.marca !== filterMarca) return false;
      if (filterCategoria && p.categoria !== filterCategoria) return false;
      if (!t) return true;
      return (
        p.producto.toLowerCase().includes(t) ||
        p.marca.toLowerCase().includes(t) ||
        p.categoria.toLowerCase().includes(t) ||
        p.id.includes(t)
      );
    });
  }, [products, q, filterMarca, filterCategoria]);

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Inventario</h2>
        <button className="btn accent small" onClick={() => setAddOpen(true)}>＋ Nuevo</button>
      </div>

      <div className="filters">
        <input
          className="input search"
          placeholder="Buscar producto, marca, id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" value={filterMarca} onChange={(e) => setFilterMarca(e.target.value)}>
          <option value="">Todas las marcas</option>
          {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="select" value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        {filtered.length} de {products.length} productos
      </div>

      {filtered.length === 0 && (
        <div className="empty">No hay productos. Toca <b>＋ Nuevo</b> para agregar.</div>
      )}

      {filtered.map((p) => (
        <div key={p.id} className="card product">
          <div className="top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="marca">#{p.id} · {p.marca}</div>
              <div className="nombre">{p.producto}</div>
              <div className="meta">
                <span>📍 {p.ubicacion || '—'}</span>
                <span className="dot">{p.categoria}</span>
                <span className="dot">S/ {Number(p.pVentaPEN || 0).toFixed(2)}</span>
              </div>
            </div>
            <div className={`stock ${stockClass(p.stockActual)}`}>
              {p.stockActual} u.
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button className="btn small" onClick={() => setMovement({ product: p, tipo: 'entrada' })}>
              ＋ Entrada
            </button>
            <button className="btn small secondary" onClick={() => setMovement({ product: p, tipo: 'salida' })}>
              − Salida
            </button>
            <button className="btn small ghost" onClick={() => setEditing(p)} style={{ marginLeft: 'auto' }}>
              Editar
            </button>
          </div>
        </div>
      ))}

      <AddOrEditModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={(input) => {
          try {
            addProduct(input);
            toast('Producto agregado');
            setAddOpen(false);
          } catch (e) {
            alert(e.message);
          }
        }}
      />
      <AddOrEditModal
        open={!!editing}
        product={editing}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          updateProduct(editing.id, input);
          toast('Producto actualizado');
          setEditing(null);
        }}
        onDelete={() => {
          if (confirm(`¿Eliminar "${editing.producto}"?`)) {
            deleteProduct(editing.id);
            toast('Producto eliminado');
            setEditing(null);
          }
        }}
      />
      <MovementModal
        movement={movement}
        onClose={() => setMovement(null)}
        onConfirm={({ cantidad, precio }) => {
          try {
            registerMovement({
              productId: movement.product.id,
              tipo: movement.tipo,
              cantidad,
              precio,
            });
            toast(movement.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada');
            setMovement(null);
          } catch (e) {
            alert(e.message);
          }
        }}
      />
    </div>
  );
}

function AddOrEditModal({ open, product, onClose, onSave, onDelete }) {
  const isEdit = !!product;
  const [form, setForm] = useState(() => emptyForm());

  // Reset form when opening
  const openKey = open ? (product?.id || 'new') : null;
  useMemoReset(openKey, () => setForm(product ? { ...product } : { ...emptyForm(), id: suggestNextId() }));

  if (!open) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar producto' : 'Nuevo producto'}>
      <label className="field">
        <span>ID</span>
        <input className="input" value={form.id} onChange={set('id')} disabled={isEdit} />
      </label>
      <label className="field">
        <span>Producto</span>
        <input className="input" value={form.producto} onChange={set('producto')} />
      </label>
      <div className="row">
        <label className="field" style={{ flex: 1 }}>
          <span>Marca</span>
          <input className="input" value={form.marca} onChange={set('marca')} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Categoría</span>
          <input className="input" value={form.categoria} onChange={set('categoria')} />
        </label>
      </div>
      <label className="field">
        <span>Ubicación</span>
        <input className="input" value={form.ubicacion} onChange={set('ubicacion')} />
      </label>
      <div className="row">
        <label className="field" style={{ flex: 1 }}>
          <span>Cant. inicial</span>
          <input className="input" type="number" inputMode="numeric" value={form.cantInicial} onChange={set('cantInicial')} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Costo (S/)</span>
          <input className="input" type="number" inputMode="decimal" step="0.01" value={form.costoPEN} onChange={set('costoPEN')} />
        </label>
      </div>
      <div className="row">
        <label className="field" style={{ flex: 1 }}>
          <span>P. Venta (S/)</span>
          <input className="input" type="number" inputMode="decimal" step="0.01" value={form.pVentaPEN} onChange={set('pVentaPEN')} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>P. Oferta (S/)</span>
          <input className="input" type="number" inputMode="decimal" step="0.01" value={form.pOfertaPEN} onChange={set('pOfertaPEN')} />
        </label>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        {isEdit && onDelete && (
          <button className="btn danger small" onClick={onDelete}>Eliminar</button>
        )}
        <button className="btn full" onClick={() => onSave(form)} style={{ marginLeft: 'auto', flex: 1 }}>
          {isEdit ? 'Guardar' : 'Crear'}
        </button>
      </div>
    </Modal>
  );
}

function MovementModal({ movement, onClose, onConfirm }) {
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('');

  useMemoReset(movement?.product?.id + '-' + movement?.tipo, () => {
    setCantidad('1');
    const p = movement?.product;
    if (!p) { setPrecio(''); return; }
    if (movement.tipo === 'salida') setPrecio(String(p.pOfertaPEN ?? p.pVentaPEN ?? ''));
    else setPrecio(String(p.costoPEN ?? ''));
  });

  if (!movement) return null;
  const { product, tipo } = movement;
  const titulo = tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida';

  return (
    <Modal open={!!movement} onClose={onClose} title={titulo}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="marca">#{product.id} · {product.marca}</div>
        <div className="nombre" style={{ marginTop: 2 }}>{product.producto}</div>
        <div className="meta" style={{ marginTop: 6 }}>
          <span className={`stock ${stockClass(product.stockActual)}`}>Stock: {product.stockActual}</span>
        </div>
      </div>
      <label className="field">
        <span>Cantidad</span>
        <input className="input" type="number" inputMode="numeric" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      </label>
      <label className="field">
        <span>Precio {tipo === 'entrada' ? 'de compra' : 'de venta'} (S/) — opcional</span>
        <input className="input" type="number" inputMode="decimal" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
      </label>
      <button className="btn full" onClick={() => onConfirm({ cantidad, precio })}>
        Confirmar {tipo === 'entrada' ? 'entrada' : 'salida'}
      </button>
    </Modal>
  );
}

function emptyForm() {
  return {
    id: '',
    producto: '',
    marca: '',
    categoria: 'Skincare',
    ubicacion: '',
    cantInicial: 0,
    costoPEN: 0,
    pVentaPEN: 0,
    pOfertaPEN: 0,
  };
}

// Re-run fn whenever key changes (including first time).
function useMemoReset(key, fn) {
  useEffect(() => { fn(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
