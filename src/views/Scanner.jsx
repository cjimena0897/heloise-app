import { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats as F } from 'html5-qrcode';
import {
  addProduct, assignCode, findByCode, getProduct, money, normCode, precioLista, registerMovement,
  useProducts,
} from '../store.js';
import Modal from '../components/Modal.jsx';
import SellPanel from '../components/SellPanel.jsx';
import { ProductFormModal } from './Inventory.jsx';
import { useToast } from '../components/Toast.jsx';

const READER_ID = 'qr-reader';

// QR + códigos de barras habituales de impresoras de etiquetas.
const FORMATS = [
  F.QR_CODE, F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8,
  F.UPC_A, F.UPC_E, F.ITF, F.CODABAR, F.DATA_MATRIX,
];

function stockClass(n) {
  if (n <= 0) return 'red';
  if (n <= 2) return 'yellow';
  return 'green';
}

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
    <div className="page">
      <h2>Escáner</h2>

      {idle && (
        <div className="card">
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Escanea la etiqueta (código de barras o QR) del producto. También puedes escribir el código.
          </p>
          <button className="btn full" onClick={start}>📷 Iniciar cámara</button>
          {error && <div style={{ color: 'var(--danger)', marginTop: 10, fontSize: 13 }}>{error}</div>}

          <form onSubmit={tryManual} style={{ marginTop: 14 }}>
            <label className="field">
              <span>O ingresa el código</span>
              <input
                className="input"
                placeholder="Ej. AJ0012"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
              />
            </label>
            <button className="btn full secondary" type="submit">Buscar producto</button>
          </form>
        </div>
      )}

      <div className="scanner-box" style={{ display: running || starting ? 'block' : 'none' }}>
        <div id={READER_ID} />
      </div>
      {running && (
        <button className="btn full secondary" onClick={stop} style={{ marginTop: 8 }}>
          Detener cámara
        </button>
      )}

      {scanned && (
        <div className="card product">
          <div className="top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="marca">
                {scanned.codigo ? scanned.codigo : `#${scanned.id}`} · {scanned.marca}
              </div>
              <div className="nombre">{scanned.producto}</div>
              <div className="meta">
                <span>📍 {scanned.ubicacion || '—'}</span>
                <span className="dot">{scanned.categoria}</span>
                <span className="dot">Lista {money(precioLista(scanned))}</span>
              </div>
            </div>
            <span className={`stock ${stockClass(scanned.stockActual)}`}>{scanned.stockActual} u.</span>
          </div>

          <SellPanel
            product={scanned}
            onAdded={() => {
              toast('Agregado a la venta');
              start();
            }}
          />

          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn small ghost" style={{ flex: 1 }} onClick={start}>📷 Escanear otro</button>
            <button className="btn small ghost" onClick={() => setMovement({ tipo: 'entrada' })}>＋ Entrada</button>
            <button className="btn small ghost" onClick={() => setMovement({ tipo: 'salida' })}>− Salida</button>
          </div>
        </div>
      )}

      {unknownCode && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Código no registrado</h3>
          <p>
            El código <b className="mono">{unknownCode}</b> no está asignado a ningún producto.
          </p>
          <button className="btn full" onClick={() => setAssignOpen(true)}>Asignar a un producto existente</button>
          <button className="btn full secondary" style={{ marginTop: 8 }} onClick={() => setCreateOpen(true)}>
            ＋ Crear producto con este código
          </button>
          <button className="btn full ghost small" style={{ marginTop: 8 }} onClick={start}>Escanear de nuevo</button>
        </div>
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

  if (!open) return null;

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
    <Modal open={open} onClose={onClose} title={`Asignar ${code}`}>
      <input className="input" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="card" style={{ padding: 0 }}>
        {list.map((p) => (
          <button key={p.id} className="list-btn" onClick={() => pick(p)}>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>
              #{p.id} · {p.marca} {p.codigo ? `· ${p.codigo}` : '· sin código'}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{p.producto}</div>
          </button>
        ))}
        {list.length === 0 && <div className="empty">Sin coincidencias.</div>}
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

  if (!open || !product) return null;

  return (
    <Modal open={open} onClose={onClose} title={tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="marca">#{product.id} · {product.marca}</div>
        <div className="nombre">{product.producto}</div>
      </div>
      {tipo === 'salida' && (
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
          Para ventas usa <b>Agregar a la venta</b> (registra cliente y pago). Esto es para mermas, regalos, muestras, etc.
        </p>
      )}
      <label className="field">
        <span>Cantidad</span>
        <input className="input" type="number" inputMode="numeric" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      </label>
      <label className="field">
        <span>Precio {tipo === 'entrada' ? 'de compra' : ''} (S/) — opcional</span>
        <input className="input" type="number" inputMode="decimal" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
      </label>
      <button className="btn full" onClick={() => onConfirm({ cantidad, precio })}>
        Confirmar
      </button>
    </Modal>
  );
}
