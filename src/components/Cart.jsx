import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ShoppingBag, Trash2, X } from 'lucide-react';
import {
  METODOS_PAGO, cartTotal, checkout, clearCart, getLastEvent, getProduct, money, r2, removeFromCart,
  useCart, useSales,
} from '../store.js';
import Modal from './Modal.jsx';
import { ProductPhoto } from './ProductPhoto.jsx';
import { useToast } from './Toast.jsx';
import { Button } from './ui/button.jsx';
import { Field, Input } from './ui/input.jsx';
import { ChoiceChips } from './ui/chips.jsx';
import { SegmentedTabs } from './ui/tabs.jsx';
import { Separator } from './ui/separator.jsx';
import { cn } from '../lib/utils.js';

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
      <div data-cart-bar className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-3 print:hidden">
        <button
          onClick={() => setOpen(true)}
          className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-xl bg-primary py-2.5 pr-3 pl-2.5 text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]"
        >
          <span className="relative grid size-9 place-items-center rounded-lg bg-primary-foreground/10">
            <ShoppingBag className="size-5" />
            <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
              {unidades}
            </span>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-xs opacity-70">Venta en curso</span>
            <span className="block font-semibold tabular-nums">{money(total)}</span>
          </span>
          <span className="ml-auto flex items-center gap-1 text-sm font-medium">
            Cobrar <ChevronRight className="size-4" />
          </span>
        </button>
      </div>
      <CheckoutModal open={open} onClose={() => setOpen(false)} cart={cart} total={total} />
    </>
  );
}

const PAGO_OPCIONES = [
  { value: 'completo', label: 'Completo' },
  { value: 'mitad', label: 'Mitad' },
  { value: 'credito', label: 'Crédito' },
  { value: 'otro', label: 'Otro' },
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
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border">
          {cart.map((i) => (
            <div key={i.key} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              <ProductPhoto p={getProduct(i.productId) || { marca: i.marca }} className="size-10" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{i.cantidad}× {i.productoNombre}</div>
                <div className="text-xs text-muted-foreground">
                  {money(i.precioUnit)} c/u
                  {i.descuentoPct > 0 && <> · <span className="text-success">−{i.descuentoPct}%</span> de {money(i.precioLista)}</>}
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums">{money(i.precioUnit * i.cantidad)}</div>
              <Button variant="ghost" size="icon-sm" onClick={() => removeFromCart(i.key)} aria-label="Quitar">
                <X />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-b-xl bg-muted/60 px-3 py-3">
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold tabular-nums">{money(total)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Field label="Cliente">
            <Input list="clientes-list" value={cliente} onChange={(e) => onCliente(e.target.value)} placeholder="Nombre" />
            <datalist id="clientes-list">
              {clientes.map((s) => <option key={s.cliente} value={s.cliente} />)}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Celular">
              <Input type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Evento / showroom">
              <Input list="eventos-list" value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Opcional" />
              <datalist id="eventos-list">
                {eventos.map((e) => <option key={e} value={e} />)}
              </datalist>
            </Field>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium">Pago</div>
          <SegmentedTabs value={tipoPago} onChange={setTipoPago} options={PAGO_OPCIONES} />
          {tipoPago === 'otro' && (
            <Field label="Monto que paga ahora (S/)">
              <Input type="number" inputMode="decimal" step="0.01" value={otroMonto} onChange={(e) => setOtroMonto(e.target.value)} autoFocus />
            </Field>
          )}
          {pago > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Método de pago</span>
              <ChoiceChips value={metodo} onChange={setMetodo} options={METODOS_PAGO} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <SummaryBox label="Paga ahora" value={money(pago)} />
            <SummaryBox label="Queda debiendo" value={money(saldo)} tone={saldo > 0 ? 'destructive' : undefined} />
          </div>
          <Field label="Nota">
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. paga el resto el viernes" />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={confirmar}>Confirmar venta</Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={() => { if (confirm('¿Vaciar la venta en curso?')) clearCart(); }}>
            <Trash2 /> Vaciar venta
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function SummaryBox({ label, value, tone }) {
  return (
    <div className={cn('rounded-lg bg-muted/60 px-3 py-2.5', tone === 'destructive' && 'bg-destructive-soft', tone === 'success' && 'bg-success-soft')}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-base font-semibold tabular-nums', tone === 'destructive' && 'text-destructive', tone === 'success' && 'text-success')}>
        {value}
      </div>
    </div>
  );
}
