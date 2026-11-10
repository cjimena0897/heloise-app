import { useEffect, useState } from 'react';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { DESCUENTOS, addToCart, money, precioConDescuento, precioLista, r2 } from '../store.js';
import { Button } from './ui/button.jsx';
import { Field, Input } from './ui/input.jsx';
import { Badge } from './ui/badge.jsx';
import { cn } from '../lib/utils.js';

/**
 * Muestra el precio con los descuentos rápidos (0–30 %), precio de oferta,
 * % personalizado o precio final manual, y agrega el producto a la venta.
 */
export default function SellPanel({ product, onAdded }) {
  const lista = precioLista(product);
  const oferta = r2(product.pOfertaPEN || 0);
  const hasOferta = oferta > 0 && oferta < lista;

  const [mode, setMode] = useState(0); // número = %, 'oferta', 'otro'
  const [otroPct, setOtroPct] = useState('');
  const [precioManual, setPrecioManual] = useState('');
  const [cantidad, setCantidad] = useState(1);

  useEffect(() => {
    setMode(0);
    setOtroPct('');
    setPrecioManual('');
    setCantidad(1);
  }, [product.id]);

  let unit;
  if (precioManual !== '') unit = r2(precioManual);
  else if (mode === 'oferta') unit = oferta;
  else if (mode === 'otro') unit = precioConDescuento(lista, otroPct);
  else unit = precioConDescuento(lista, mode);

  const pct = lista > 0 ? r2((1 - unit / lista) * 100) : 0;
  const ahorro = r2(lista - unit);
  const total = r2(unit * cantidad);
  const stock = product.stockActual || 0;

  function pick(m) {
    setMode(m);
    setPrecioManual('');
  }

  function add() {
    try {
      addToCart({ productId: product.id, cantidad, precioUnit: unit });
      onAdded?.();
    } catch (e) {
      alert(e.message);
    }
  }

  const options = [
    ...DESCUENTOS.map((d) => ({ key: d, label: d === 0 ? 'Sin dscto' : `${d}%`, price: precioConDescuento(lista, d) })),
    ...(hasOferta ? [{ key: 'oferta', label: 'Oferta', price: oferta }] : []),
    { key: 'otro', label: 'Otro %', price: mode === 'otro' && otroPct ? unit : null },
  ];

  return (
    <div className="flex flex-col gap-4">
      {lista <= 0 && (
        <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
          Este producto no tiene precio de venta. Escribe el precio final abajo o edítalo en Inventario.
        </p>
      )}
      <div className="rounded-xl bg-muted/60 py-4 text-center">
        <div className={cn('text-sm text-muted-foreground line-through', pct <= 0 && 'invisible')}>{money(lista)}</div>
        <div className="text-4xl font-semibold tracking-tight tabular-nums" data-testid="precio-final">{money(unit)}</div>
        <div className="mt-2 flex h-6 justify-center">
          {pct > 0 && <Badge variant="success">−{pct}% · ahorra {money(ahorro)}</Badge>}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">Descuento</div>
        <div className="grid grid-cols-4 gap-2">
          {options.map((o) => {
            const on = precioManual === '' && mode === o.key;
            return (
              <button
                key={o.key}
                type="button"
                data-chip={o.key}
                onClick={() => pick(o.key)}
                className={cn(
                  'flex h-14 flex-col items-center justify-center rounded-lg border bg-card text-sm font-semibold shadow-xs transition-all active:scale-[0.97]',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                {o.label}
                <span className={cn('text-[11px] font-medium tabular-nums', on ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                  {o.price != null ? money(o.price) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'otro' && precioManual === '' && (
        <Field label="Descuento personalizado (%)">
          <Input type="number" inputMode="decimal" min="0" max="100" value={otroPct} onChange={(e) => setOtroPct(e.target.value)} autoFocus />
        </Field>
      )}

      <div className="flex items-end gap-3">
        <Field label="Precio final (S/)" className="flex-1">
          <Input type="number" inputMode="decimal" step="0.01" placeholder={unit.toFixed(2)} value={precioManual} onChange={(e) => setPrecioManual(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Cantidad</span>
          <div className="flex h-10 items-center rounded-lg border border-input bg-card shadow-xs">
            <Button type="button" variant="ghost" size="icon" className="rounded-r-none" onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Menos">
              <Minus />
            </Button>
            <div className="w-8 text-center font-semibold tabular-nums">{cantidad}</div>
            <Button type="button" variant="ghost" size="icon" className="rounded-l-none" onClick={() => setCantidad((c) => Math.min(stock, c + 1))} aria-label="Más">
              <Plus />
            </Button>
          </div>
        </div>
      </div>

      <Button variant="brand" size="lg" onClick={add} disabled={stock <= 0}>
        <ShoppingBag />
        {stock <= 0 ? 'Sin stock' : <>Agregar a la venta · <span className="tabular-nums">{money(total)}</span></>}
      </Button>
    </div>
  );
}
