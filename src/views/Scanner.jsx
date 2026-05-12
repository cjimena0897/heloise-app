import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { getProduct, registerMovement } from '../store.js';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';

const READER_ID = 'qr-reader';

function stockClass(n) {
  if (n <= 0) return 'red';
  if (n <= 2) return 'yellow';
  return 'green';
}

export default function Scanner() {
  const [scanned, setScanned] = useState(null); // product
  const [unknownId, setUnknownId] = useState(null);
  const [movement, setMovement] = useState(null); // { tipo }
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [manualId, setManualId] = useState('');
  const scannerRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    try {
      const html5 = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = html5;
      await html5.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (decoded) => onDecoded(decoded),
        () => {}
      );
      setRunning(true);
    } catch (e) {
      setError(e?.message || 'No se pudo iniciar la cámara. Concede permisos e intenta otra vez.');
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

  async function onDecoded(text) {
    const id = (text || '').trim();
    if (!id) return;
    await stop();
    const product = getProduct(id);
    if (product) setScanned(product);
    else setUnknownId(id);
  }

  function tryManual(e) {
    e.preventDefault();
    const id = manualId.trim();
    if (!id) return;
    const product = getProduct(id);
    if (product) setScanned(product);
    else setUnknownId(id);
    setManualId('');
  }

  return (
    <div className="page">
      <h2>Escáner QR</h2>

      {!running && !scanned && !unknownId && (
        <div className="card">
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Escanea el código QR del producto con la cámara del teléfono. Si no hay cámara, ingresa el ID manualmente.
          </p>
          <button className="btn full" onClick={start}>📷 Iniciar cámara</button>
          {error && <div style={{ color: 'var(--danger)', marginTop: 10, fontSize: 13 }}>{error}</div>}

          <form onSubmit={tryManual} style={{ marginTop: 14 }}>
            <label className="field">
              <span>O ingresa el ID</span>
              <input
                className="input"
                placeholder="Ej. 01"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <button className="btn full secondary" type="submit">Buscar producto</button>
          </form>
        </div>
      )}

      <div className="scanner-box" style={{ display: running ? 'block' : 'none' }}>
        <div id={READER_ID} />
      </div>
      {running && (
        <button className="btn full secondary" onClick={stop} style={{ marginTop: 8 }}>
          Detener cámara
        </button>
      )}

      {scanned && !movement && (
        <div className="card product">
          <div className="marca">#{scanned.id} · {scanned.marca}</div>
          <div className="nombre">{scanned.producto}</div>
          <div className="meta">
            <span>📍 {scanned.ubicacion || '—'}</span>
            <span className="dot">{scanned.categoria}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <span className={`stock ${stockClass(scanned.stockActual)}`}>
              Stock actual: {scanned.stockActual}
            </span>
          </div>
          <div className="row" style={{ marginTop: 14, gap: 8 }}>
            <button className="btn full" onClick={() => setMovement({ tipo: 'entrada' })}>＋ Registrar Entrada</button>
            <button className="btn full secondary" onClick={() => setMovement({ tipo: 'salida' })}>− Registrar Salida</button>
          </div>
          <button
            className="btn ghost small"
            style={{ marginTop: 10 }}
            onClick={() => { setScanned(null); start(); }}
          >
            Escanear otro
          </button>
        </div>
      )}

      {unknownId && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Producto no encontrado</h3>
          <p>No existe un producto con ID <b>{unknownId}</b>.</p>
          <button className="btn full" onClick={() => { setUnknownId(null); start(); }}>Escanear de nuevo</button>
        </div>
      )}

      <MovementSheet
        open={!!movement}
        product={scanned}
        tipo={movement?.tipo}
        onClose={() => setMovement(null)}
        onConfirm={({ cantidad, precio }) => {
          try {
            registerMovement({
              productId: scanned.id,
              tipo: movement.tipo,
              cantidad,
              precio,
            });
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

function MovementSheet({ open, product, tipo, onClose, onConfirm }) {
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('');

  useEffect(() => {
    if (!open || !product) return;
    setCantidad('1');
    if (tipo === 'salida') setPrecio(String(product.pOfertaPEN ?? product.pVentaPEN ?? ''));
    else setPrecio(String(product.costoPEN ?? ''));
  }, [open, product, tipo]);

  if (!open || !product) return null;

  return (
    <Modal open={open} onClose={onClose} title={tipo === 'entrada' ? 'Registrar Entrada' : 'Registrar Salida'}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="marca">#{product.id} · {product.marca}</div>
        <div className="nombre">{product.producto}</div>
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
        Confirmar
      </button>
    </Modal>
  );
}
