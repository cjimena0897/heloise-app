import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, MapPin, Package, Pencil, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { useProducts, addProduct, updateProduct, deleteProduct, suggestNextId, registerMovement, getProduct, money } from '../store.js';
import Modal from '../components/Modal.jsx';
import SellPanel from '../components/SellPanel.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Field, Input, NativeSelect } from '../components/ui/input.jsx';
import { PageHeader, EmptyState } from '../components/Page.jsx';

export function StockBadge({ n, className }) {
  const variant = n <= 0 ? 'destructive' : n <= 2 ? 'warning' : 'success';
  return <Badge variant={variant} className={className} data-stock={n}>{n <= 0 ? 'Agotado' : `${n} u.`}</Badge>;
}

export function ProductHeading({ p }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="font-mono">{p.codigo || `#${p.id}`}</span>
        <span>·</span>
        <span className="truncate uppercase tracking-wide">{p.marca}</span>
      </div>
      <div className="mt-0.5 font-semibold leading-snug" data-testid="producto-nombre">{p.producto}</div>
    </div>
  );
}

export default function Inventory() {
  const products = useProducts();
  const [q, setQ] = useState('');
  const [filterMarca, setFilterMarca] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [movement, setMovement] = useState(null); // { product, tipo }
  const [selling, setSelling] = useState(null); // product
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
        (p.codigo || '').toLowerCase().includes(t) ||
        p.id.toLowerCase().includes(t)
      );
    });
  }, [products, q, filterMarca, filterCategoria]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventario"
        description={`${filtered.length} de ${products.length} productos`}
        action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus /> Nuevo</Button>}
      />

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar producto, marca, código…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NativeSelect value={filterMarca} onChange={(e) => setFilterMarca(e.target.value)}>
            <option value="">Todas las marcas</option>
            {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
          </NativeSelect>
          <NativeSelect value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </div>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={Package} title={products.length ? 'Sin coincidencias' : 'Aún no hay productos'}>
          {products.length ? 'Prueba con otra búsqueda o filtro.' : <>Toca <b>Nuevo</b> o escanea una etiqueta para agregar.</>}
        </EmptyState>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((p) => (
          <Card key={p.id} className="p-4" data-product={p.id}>
            <div className="flex items-start justify-between gap-3">
              <ProductHeading p={p} />
              <StockBadge n={p.stockActual} className="mt-0.5" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{p.ubicacion || '—'}</span>
              <span>{p.categoria}</span>
              <span className="font-medium text-foreground tabular-nums">{money(p.pVentaPEN)}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="brand" size="sm" onClick={() => setSelling(p)} disabled={p.stockActual <= 0}>
                <ShoppingBag /> Vender
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMovement({ product: p, tipo: 'entrada' })}>
                <ArrowDownToLine /> Entrada
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMovement({ product: p, tipo: 'salida' })}>
                <ArrowUpFromLine /> Salida
              </Button>
              <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setEditing(p)} aria-label="Editar">
                <Pencil />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!selling} onClose={() => setSelling(null)} title={selling?.producto || 'Vender'}
        description={selling ? `${selling.codigo || `#${selling.id}`} · ${selling.marca} · ${selling.stockActual} en stock` : undefined}>
        {selling && (
          <SellPanel
            product={getProduct(selling.id) || selling}
            onAdded={() => { toast('Agregado a la venta'); setSelling(null); }}
          />
        )}
      </Modal>
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
          try {
            updateProduct(editing.id, input);
            toast('Producto actualizado');
            setEditing(null);
          } catch (e) {
            alert(e.message);
          }
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

export { AddOrEditModal as ProductFormModal };

function AddOrEditModal({ open, product, initial, onClose, onSave, onDelete }) {
  const isEdit = !!product;
  const [form, setForm] = useState(() => emptyForm());

  // Reset form when opening
  const openKey = open ? (product?.id || 'new') : null;
  useMemoReset(openKey, () => setForm(product ? { codigo: '', ...product } : { ...emptyForm(), id: suggestNextId(), ...initial }));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar producto' : 'Nuevo producto'}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <Field label="ID">
            <Input value={form.id} onChange={set('id')} disabled={isEdit} />
          </Field>
          <Field label="Código de etiqueta">
            <Input className="font-mono uppercase placeholder:normal-case placeholder:font-sans" value={form.codigo} onChange={set('codigo')} placeholder="Ej. AJ0012" autoCapitalize="characters" autoComplete="off" />
          </Field>
        </div>
        <Field label="Producto">
          <Input value={form.producto} onChange={set('producto')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marca">
            <Input value={form.marca} onChange={set('marca')} />
          </Field>
          <Field label="Categoría">
            <Input value={form.categoria} onChange={set('categoria')} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ubicación">
            <Input value={form.ubicacion} onChange={set('ubicacion')} />
          </Field>
          <Field label="Cant. inicial">
            <Input type="number" inputMode="numeric" value={form.cantInicial} onChange={set('cantInicial')} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Costo S/">
            <Input type="number" inputMode="decimal" step="0.01" value={form.costoPEN} onChange={set('costoPEN')} />
          </Field>
          <Field label="Venta S/">
            <Input type="number" inputMode="decimal" step="0.01" value={form.pVentaPEN} onChange={set('pVentaPEN')} />
          </Field>
          <Field label="Oferta S/">
            <Input type="number" inputMode="decimal" step="0.01" value={form.pOfertaPEN} onChange={set('pOfertaPEN')} />
          </Field>
        </div>

        <div className="mt-2 flex gap-2">
          {isEdit && onDelete && (
            <Button variant="outline" size="icon" className="text-destructive" onClick={onDelete} aria-label="Eliminar">
              <Trash2 />
            </Button>
          )}
          <Button size="lg" className="flex-1" onClick={() => onSave(form)}>
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
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
    if (movement.tipo === 'salida') setPrecio(String(p.pOfertaPEN || p.pVentaPEN || ''));
    else setPrecio(String(p.costoPEN ?? ''));
  });

  const product = movement?.product;
  const tipo = movement?.tipo;

  return (
    <Modal open={!!movement} onClose={onClose} title={tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida'}
      description={product ? `${product.producto} · stock ${product.stockActual}` : undefined}>
      {product && (
        <div className="flex flex-col gap-3">
          {tipo === 'salida' && (
            <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              Para ventas usa <b className="text-foreground">Vender</b> (registra cliente y pago). Esto es para mermas, regalos o muestras.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad">
              <Input type="number" inputMode="numeric" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </Field>
            <Field label={tipo === 'entrada' ? 'Precio de compra S/' : 'Precio S/'}>
              <Input type="number" inputMode="decimal" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Opcional" />
            </Field>
          </div>
          <Button size="lg" className="mt-2" onClick={() => onConfirm({ cantidad, precio })}>
            Confirmar {tipo}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function emptyForm() {
  return {
    id: '',
    codigo: '',
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
