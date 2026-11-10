import { useEffect, useMemo, useState } from 'react';
import {
  METODOS_PAGO, cartTotal, checkout, clearCart, getLastEvent, money, r2, removeFromCart,
  useCart, useSales,
} from '../store.js';
import Modal from './Modal.jsx';
import { useToast } from './Toast.jsx';

/** Barra flotante con la venta en curso. Se muestra en todas las vistas cuando hay productos. */
export default function CartBar() {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const total = cartTotal(cart);
  const unidades = cart.reduce((s, i) => s + i.cantidad, 0);

  useEffect(() => {
    if (cart.length === 0) setOpen(false);
  }, [cart.length]);

  if (cart.length === 0) return null;

  return (
    <>
      <button className="cart-bar no-print" onClick={() => setOpen(true)}>
        <span>🛒 {unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
        <b>{money(total)} · Cobrar →</b>
      </button>
      <CheckoutModal open={open} onClose={() => setOpen(false)} cart={cart} total={total} />
    </>
  );
}

const PAGO_OPCIONES = [
  { key: 'completo', label: 'Pago completo' },
  { key: 'mitad', label: 'Mitad' },
  { key: 'credito', label: 'Crédito' },
  { key: 'otro', label: 'Otro monto' },
];

function CheckoutModal({ open, onClose, cart, total }) {
  const sales = useSales();
  const toast = useToast();
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [evento, setEvento] = useState('');
  const [tipoPago, setTipoPago] = useState('completo');
  const [otroMonto, setOtroMonto] = useState('');
  const [metodo, setMetodo] = useState(METODOS_PAGO[0]);
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (open) {
      setEvento(getLastEvent());
      setTipoPago('completo');
      setOtroMonto('');
      setNota('');
    }
  }, [open]);

  const clientes = useMemo(() => {
    const map = new Map();
    for (const s of sales) if (!map.has(s.cliente.toLowerCase())) map.set(s.cliente.toLowerCase(), s);
    return Array.from(map.values());
  }, [sales]);
  const eventos = useMemo(() => Array.from(new Set(sales.map((s) => s.evento).filter(Boolean))), [sales]);

  function onCliente(v) {
    setCliente(v);
    const prev = clientes.find((s) => s.cliente.toLowerCase() === v.trim().toLowerCase());
    if (prev?.telefono && !telefono) setTelefono(prev.telefono);
  }

  const pago =
    tipoPago === 'completo' ? total
    : tipoPago === 'mitad' ? r2(total / 2)
    : tipoPago === 'credito' ? 0
    : r2(otroMonto);
  const saldo = r2(total - pago);

  function confirmar() {
    try {
      checkout({ cliente, telefono, evento, pagoInicial: pago, metodo, nota });
      toast(saldo > 0 ? `Venta registrada · debe ${money(saldo)}` : 'Venta registrada · pagada');
      setCliente('');
      setTelefono('');
      onClose();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cobrar venta">
      <div className="card" style={{ padding: '4px 14px' }}>
        {cart.map((i) => (
          <div key={i.key} className="tx-item">
            <div>
              <div className="ttl">{i.cantidad}× {i.productoNombre}</div>
              <div className="sub">
                {i.marca} · {money(i.precioUnit)} c/u
                {i.descuentoPct > 0 && <> · −{i.descuentoPct}% (lista {money(i.precioLista)})</>}
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <b style={{ fontSize: 14 }}>{money(i.precioUnit * i.cantidad)}</b>
              <button className="icon-btn" onClick={() => removeFromCart(i.key)} aria-label="Quitar">✕</button>
            </div>
          </div>
        ))}
        <div className="row between" style={{ padding: '12px 0', fontSize: 16 }}>
          <b>Total</b>
          <b>{money(total)}</b>
        </div>
      </div>

      <label className="field">
        <span>Cliente</span>
        <input className="input" list="clientes-list" value={cliente} onChange={(e) => onCliente(e.target.value)} placeholder="Nombre" />
        <datalist id="clientes-list">
          {clientes.map((s) => <option key={s.cliente} value={s.cliente} />)}
        </datalist>
      </label>
      <div className="row">
        <label className="field" style={{ flex: 1 }}>
          <span>Celular (opcional)</span>
          <input className="input" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span>Evento / showroom</span>
          <input className="input" list="eventos-list" value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Opcional" />
          <datalist id="eventos-list">
            {eventos.map((e) => <option key={e} value={e} />)}
          </datalist>
        </label>
      </div>

      <div className="section-title">Pago</div>
      <div className="segmented">
        {PAGO_OPCIONES.map((o) => (
          <button key={o.key} type="button" className={tipoPago === o.key ? 'on' : ''} onClick={() => setTipoPago(o.key)}>
            {o.label}
          </button>
        ))}
      </div>

      {tipoPago === 'otro' && (
        <label className="field" style={{ marginTop: 10 }}>
          <span>Monto que paga ahora (S/)</span>
          <input className="input" type="number" inputMode="decimal" step="0.01" value={otroMonto} onChange={(e) => setOtroMonto(e.target.value)} autoFocus />
        </label>
      )}

      {pago > 0 && (
        <label className="field" style={{ marginTop: 10 }}>
          <span>Método de pago</span>
          <select className="select" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
      )}

      <div className="pay-summary">
        <div><span>Paga ahora</span><b>{money(pago)}</b></div>
        <div className={saldo > 0 ? 'debe' : ''}><span>Queda debiendo</span><b>{money(saldo)}</b></div>
      </div>

      <label className="field">
        <span>Nota (opcional)</span>
        <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. paga el resto el viernes" />
      </label>

      <button className="btn full" onClick={confirmar}>Confirmar venta</button>
      <button
        className="btn full ghost small"
        style={{ marginTop: 8 }}
        onClick={() => { if (confirm('¿Vaciar la venta en curso?')) clearCart(); }}
      >
        Vaciar venta
      </button>
    </Modal>
  );
}
