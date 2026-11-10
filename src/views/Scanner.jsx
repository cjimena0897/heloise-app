import { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats as F } from 'html5-qrcode';
import {
  addProduct, assignCode, findByCode, getProduct, money, normCode, precioLista, registerMovement,
  useProducts,
} from '../store.js';
import { ArrowDownToLine, ArrowUpFromLine, Barcode, Camera, CameraOff, Link2, MapPin, Plus, ScanLine, Search, TriangleAlert } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import SellPanel from '../components/SellPanel.jsx';
import { ProductFormModal, ProductHeading, StockBadge } from './Inventory.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Field, Input } from '../components/ui/input.jsx';
import { PageHeader } from '../components/Page.jsx';

const READER_ID = 'qr-reader';

// QR + códigos de barras habituales de impresoras de etiquetas.
const FORMATS = [
  F.QR_CODE, F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8,
  F.UPC_A, F.UPC_E, F.ITF, F.CODABAR, F.DATA_MATRIX,
];

export default function Scanner() {
  const [scanned, setScanned] = useState(null); // product
  const [unknownCode, setUnknownCode] = useState(null);
  const [movement, setMovement] = useState(null); // { tipo }
  const [assignOpen, setAssignOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [manualId, setManualId] = useState('');
  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const toast = useToast();

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    setScanned(null);
    setUnknownCode(null);
    busyRef.current = false;
    await stop();
    // Mostrar el contenedor antes de iniciar para que la librería mida bien su ancho.
    setStarting(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const html5 = new Html5Qrcode(READER_ID, {
        verbose: false,
        formatsToSupport: FORMATS,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      scannerRef.current = html5;
      await html5.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          // Caja ancha para que entren códigos de barras horizontales.
          qrbox: (w, h) => {
            const width = Math.floor(Math.min(w * 0.9, 340));
            return { width, height: Math.floor(Math.min(h * 0.8, width * 0.6)) };
          },
        },
        (decoded) => onDecoded(decoded),
        () => {}
      );
      setRunning(true);
    } catch (e) {
      setError(e?.message || 'No se pudo iniciar la cámara. Concede permisos e intenta otra vez.');
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      await s.clear();
    } catch {}
    scannerRef.current = null;
    setRunning(false);
  }

  function lookup(code) {
    const product = findByCode(code);
    if (product) {
      setScanned(product);
      setUnknownCode(null);
    } else {
      setScanned(null);
      setUnknownCode(normCode(code));
    }
  }

  async function onDecoded(text) {
    const code = (text || '').trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    navigator.vibrate?.(60);
    await stop();
    lookup(code);
  }

  function tryManual(e) {
    e.preventDefault();
    if (!manualId.trim()) return;
    lookup(manualId);
    setManualId('');
  }

  const idle = !running && !starting && !scanned && !unknownCode;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Escáner" description="Código de barras o QR de la etiqueta" />

      {idle && (
        <Card>
          <CardContent className="flex flex-col gap-5 p-5">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="grid size-16 place-items-center rounded-2xl bg-brand/30 dark:bg-brand/15">
                <ScanLine className="size-8" />
              </div>
              <p className="max-w-xs text-sm text-muted-foreground">
                Apunta la cámara a la etiqueta del producto para ver su precio y aplicar descuentos.
              </p>
            </div>
            <Button size="lg" onClick={start}><Camera /> Iniciar cámara</Button>
            {error && (
              <p className="flex items-start gap-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> o escribe el código <div className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={tryManual} className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 font-mono uppercase placeholder:normal-case placeholder:font-sans"
                  placeholder="Ej. AJ0012"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-label="Código"
                />
              </div>
              <Button type="submit" variant="secondary"><Search /> Buscar</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className={running || starting ? 'flex flex-col gap-2' : 'hidden'}>
        <div className="relative overflow-hidden rounded-2xl bg-black shadow-lg">
          <div id={READER_ID} />
          {starting && <div className="grid h-64 place-items-center text-sm text-white/70">Abriendo cámara…</div>}
        </div>
        <Button variant="outline" onClick={stop}><CameraOff /> Detener cámara</Button>
      </div>

      {scanned && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <ProductHeading p={scanned} />
              <StockBadge n={scanned.stockActual} />
            </div>
            <div className="-mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{scanned.ubicacion || '—'}</span>
              <span>{scanned.categoria}</span>
              <span>Lista {money(precioLista(scanned))}</span>
            </div>

            <SellPanel
              product={scanned}
              onAdded={() => {
                toast('Agregado a la venta');
                start();
              }}
            />

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={start}><Camera /> Otro</Button>
              <Button variant="ghost" size="sm" onClick={() => setMovement({ tipo: 'entrada' })}><ArrowDownToLine /> Entrada</Button>
              <Button variant="ghost" size="sm" onClick={() => setMovement({ tipo: 'salida' })}><ArrowUpFromLine /> Salida</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {unknownCode && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-warning-soft">
                <TriangleAlert className="size-6 text-warning" />
              </div>
              <div className="font-semibold">Código no registrado</div>
              <p className="text-sm text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{unknownCode}</span> no está asignado a ningún producto.
              </p>
            </div>
            <Button size="lg" onClick={() => setAssignOpen(true)}><Link2 /> Asignar a un producto existente</Button>
            <Button variant="outline" size="lg" onClick={() => setCreateOpen(true)}><Plus /> Crear producto con este código</Button>
            <Button variant="ghost" onClick={start}><Camera /> Escanear de nuevo</Button>
          </CardContent>
        </Card>
      )}

      <AssignModal
        open={assignOpen}
        code={unknownCode}
        onClose={() => setAssignOpen(false)}
        onAssigned={(p) => {
          setAssignOpen(false);
          toast('Código asignado');
          lookup(p.codigo);
        }}
      />

      <ProductFormModal
        open={createOpen}
        initial={{ codigo: unknownCode || '' }}
        onClose={() => setCreateOpen(false)}
        onSave={(input) => {
          try {
            const p = addProduct(input);
            toast('Producto creado');
            setCreateOpen(false);
            setScanned(p);
            setUnknownCode(null);
          } catch (e) {
            alert(e.message);
          }
        }}
      />

      <MovementSheet
        open={!!movement}
        product={scanned}
        tipo={movement?.tipo}
        onClose={() => setMovement(null)}
        onConfirm={({ cantidad, precio }) => {
          try {
            registerMovement({ productId: scanned.id, tipo: movement.tipo, cantidad, precio });
            toast(movement.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada');
            setMovement(null);
            setScanned(getProduct(scanned.id));
          } catch (e) {
            alert(e.message);
          }
        }}
      />
    </div>
  );
}

function AssignModal({ open, code, onClose, onAssigned }) {
  const products = useProducts();
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products
      .filter((p) => !t || p.producto.toLowerCase().includes(t) || p.marca.toLowerCase().includes(t) || p.id.includes(t))
      .sort((a, b) => (a.codigo ? 1 : 0) - (b.codigo ? 1 : 0));
  }, [products, q]);

  function pick(p) {
    if (p.codigo && !confirm(`"${p.producto}" ya tiene el código ${p.codigo}. ¿Reemplazarlo por ${code}?`)) return;
    try {
      assignCode(p.id, code);
      onAssigned(getProduct(p.id));
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Asignar ${code || ''}`} description="Elige el producto que lleva esta etiqueta">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="overflow-hidden rounded-xl border">
          {list.map((p) => (
            <button key={p.id} data-assign={p.id} className="flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent" onClick={() => pick(p)}>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.producto}</div>
                <div className="text-xs text-muted-foreground">#{p.id} · {p.marca}</div>
              </div>
              {p.codigo
                ? <span className="font-mono text-xs text-muted-foreground">{p.codigo}</span>
                : <span className="text-xs text-warning">sin código</span>}
            </button>
          ))}
          {list.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sin coincidencias.</div>}
        </div>
      </div>
    </Modal>
  );
}

function MovementSheet({ open, product, tipo, onClose, onConfirm }) {
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('');

  useEffect(() => {
    if (!open || !product) return;
    setCantidad('1');
    if (tipo === 'salida') setPrecio(String(product.pOfertaPEN || product.pVentaPEN || ''));
    else setPrecio(String(product.costoPEN ?? ''));
  }, [open, product, tipo]);

  return (
    <Modal open={open && !!product} onClose={onClose} title={tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida'}
      description={product ? `${product.producto} · stock ${product.stockActual}` : undefined}>
      <div className="flex flex-col gap-3">
        {tipo === 'salida' && (
          <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            Para ventas usa <b className="text-foreground">Agregar a la venta</b> (registra cliente y pago). Esto es para mermas, regalos o muestras.
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
        <Button size="lg" className="mt-2" onClick={() => onConfirm({ cantidad, precio })}>Confirmar</Button>
      </div>
    </Modal>
  );
}
