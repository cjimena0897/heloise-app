import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, FileUp, ImagePlus, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ProductPhoto } from '../components/ProductPhoto.jsx';
import { PhotoEditor } from '../components/PhotoEditor.jsx';
import { useProducts, addProduct, updateProduct, deleteProduct, suggestNextId, registerMovement, getProduct, money } from '../store.js';
import Modal from '../components/Modal.jsx';
import SellPanel from '../components/SellPanel.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Field, Input } from '../components/ui/input.jsx';
import { PageHeader, EmptyState } from '../components/Page.jsx';
import { SegmentedTabs } from '../components/ui/tabs.jsx';
import { Chip, ChipRow, ChipSelect } from '../components/ui/chips.jsx';
import { cn } from '../lib/utils.js';

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

const STOCK_TABS = [
  { value: 'disponibles', label: 'Disponibles' },
  { value: 'agotados', label: 'Agotados' },
  { value: 'todos', label: 'Todos' },
];

const byMarcaNombre = (a, b) =>
  a.marca.localeCompare(b.marca, 'es', { sensitivity: 'base' }) ||
  a.producto.localeCompare(b.producto, 'es', { sensitivity: 'base' });

export default function Inventory() {
  const products = useProducts();
  const [q, setQ] = useState('');
  const [stockTab, setStockTab] = useState('disponibles');
  const [filterMarca, setFilterMarca] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [movement, setMovement] = useState(null); // { product, tipo }
  const [openId, setOpenId] = useState(null);
  const toast = useToast();
  const navigate = useNavigate();

  const marcas = useMemo(() => {
    const c = {};
    for (const p of products) c[p.marca] = (c[p.marca] || 0) + 1;
    return Object.keys(c).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })).map((m) => ({ value: m, label: m, hint: c[m] }));
  }, [products]);
  const categorias = useMemo(() => Array.from(new Set(products.map((p) => p.categoria).filter(Boolean))).sort(), [products]);

  // Filtros de búsqueda/marca/categoría (sin el de stock), para poder contar por pestaña.
  const base = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => {
      if (filterMarca && p.marca !== filterMarca) return false;
      if (filterCategoria && p.categoria !== filterCategoria) return false;
      if (!t) return true;
      return (
        p.producto.toLowerCase().includes(t) ||
        p.marca.toLowerCase().includes(t) ||
        (p.categoria || '').toLowerCase().includes(t) ||
        (p.codigo || '').toLowerCase().includes(t) ||
        p.id.toLowerCase().includes(t)
      );
    });
  }, [products, q, filterMarca, filterCategoria]);

  const counts = useMemo(() => {
    const disponibles = base.filter((p) => p.stockActual > 0).length;
    return { disponibles, agotados: base.length - disponibles, todos: base.length };
  }, [base]);

  const filtered = useMemo(() => {
    const list = stockTab === 'todos' ? base : base.filter((p) => (stockTab === 'agotados' ? p.stockActual <= 0 : p.stockActual > 0));
    return [...list].sort(byMarcaNombre);
  }, [base, stockTab]);

  const unidades = useMemo(() => products.reduce((s, p) => s + Math.max(0, p.stockActual), 0), [products]);
  const open = openId ? getProduct(openId) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventario"
        description={`${unidades} unidades disponibles · ${products.length} productos`}
        action={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate('/importar')}><FileUp /> Importar</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus /> Nuevo</Button>
          </>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" type="search" placeholder="Buscar producto, marca o código" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <SegmentedTabs
        value={stockTab}
        onChange={setStockTab}
        options={STOCK_TABS.map((t) => ({ value: t.value, label: <>{t.label} <span className="text-xs tabular-nums opacity-60">{counts[t.value]}</span></> }))}
      />

      <ChipRow>
        <ChipSelect value={filterMarca} onChange={setFilterMarca} options={marcas} allLabel="Marca" title="Marca" />
        <Chip active={!filterCategoria} onClick={() => setFilterCategoria('')}>Todas</Chip>
        {categorias.map((c) => (
          <Chip key={c} active={filterCategoria === c} onClick={() => setFilterCategoria(filterCategoria === c ? '' : c)}>{c}</Chip>
        ))}
      </ChipRow>

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title={products.length ? (stockTab === 'agotados' && !q ? 'No hay agotados' : 'Sin coincidencias') : 'Aún no hay productos'}>
          {products.length ? 'Prueba con otra búsqueda o filtro.' : <>Toca <b>Nuevo</b> o escanea una etiqueta para agregar.</>}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden">
          {filtered.map((p) => (
            <ProductRow key={p.id} p={p} onClick={() => setOpenId(p.id)} />
          ))}
        </Card>
      )}

      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.producto || ''}
        description={open ? `${open.codigo || `#${open.id}`} · ${open.marca}${open.ubicacion ? ` · ${open.ubicacion}` : ''}` : undefined}>
        {open && (
          <div className="flex flex-col gap-4">
            <ProductHero p={open} />
            {open.stockActual > 0 ? (
              <SellPanel product={open} onAdded={() => { toast('Agregado a la venta'); setOpenId(null); }} />
            ) : (
              <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                Sin stock. Registra una <b className="text-foreground">entrada</b> cuando llegue mercadería.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => { setMovement({ product: open, tipo: 'entrada' }); setOpenId(null); }}>
                <ArrowDownToLine /> Entrada
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setMovement({ product: open, tipo: 'salida' }); setOpenId(null); }} disabled={open.stockActual <= 0}>
                <ArrowUpFromLine /> Salida
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setEditing(open); setOpenId(null); }}>
                <Pencil /> Editar
              </Button>
            </div>
          </div>
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

function ProductRow({ p, onClick }) {
  const agotado = p.stockActual <= 0;
  return (
    <button data-product={p.id} onClick={onClick}
      className="flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/60 active:bg-accent">
      <ProductPhoto p={p} className="size-12" dim={agotado} />
      <div className={cn('min-w-0 flex-1', agotado && 'opacity-60')}>
        <div className="line-clamp-2 text-sm leading-snug font-medium" data-testid="producto-nombre">{p.producto}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="font-mono">{p.codigo || `#${p.id}`}</span> · {p.marca}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {p.pVentaPEN > 0
          ? <span className="text-sm font-semibold tabular-nums">{money(p.pVentaPEN)}</span>
          : <span className="text-xs font-medium text-warning">Sin precio</span>}
        <StockBadge n={p.stockActual} />
      </div>
    </button>
  );
}

/** Foto grande + estado; si no hay foto, invita a agregarla en un toque. */
function ProductHero({ p }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const save = (foto) => {
    try { updateProduct(p.id, { foto }); toast(foto ? 'Foto guardada' : 'Foto quitada'); setEditing(false); }
    catch (e) { alert(e.message); }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => setEditing((v) => !v)} className="shrink-0" aria-label={p.foto ? 'Cambiar foto' : 'Agregar foto'}>
          {p.foto ? (
            <ProductPhoto p={p} className="size-24 rounded-xl border" />
          ) : (
            <div className="grid size-24 place-items-center rounded-xl border border-dashed text-muted-foreground">
              <div className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-5" />Agregar foto</div>
            </div>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <StockBadge n={p.stockActual} />
          <Badge variant="outline">{p.categoria}</Badge>
        </div>
      </div>
      {editing && <PhotoEditor product={p} value={p.foto} onChange={save} size="hidden" />}
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
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Foto de referencia</span>
          <PhotoEditor product={form} value={form.foto || ''} onChange={(foto) => setForm((f) => ({ ...f, foto }))} />
        </div>
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
    foto: '',
  };
}

// Re-run fn whenever key changes (including first time).
function useMemoReset(key, fn) {
  useEffect(() => { fn(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
