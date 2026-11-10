import { useEffect, useState } from 'react';
import { DESCUENTOS, addToCart, money, precioConDescuento, precioLista, r2 } from '../store.js';

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

  return (
    <div className="sell">
      <div className="price-hero">
        {pct > 0 && <div className="was">{money(lista)}</div>}
        <div className="now">{money(unit)}</div>
        {pct > 0 && (
          <div className="save">−{pct}% · ahorra {money(ahorro)}</div>
        )}
      </div>

      <div className="section-title">Descuento</div>
      <div className="chips">
        {DESCUENTOS.map((d) => (
          <button
            key={d}
            type="button"
            className={`chip ${precioManual === '' && mode === d ? 'on' : ''}`}
            onClick={() => pick(d)}
          >
            <b>{d === 0 ? 'Sin dscto' : `${d}%`}</b>
            <small>{money(precioConDescuento(lista, d))}</small>
          </button>
        ))}
        {hasOferta && (
          <button
            type="button"
            className={`chip ${precioManual === '' && mode === 'oferta' ? 'on' : ''}`}
            onClick={() => pick('oferta')}
          >
            <b>Oferta</b>
            <small>{money(oferta)}</small>
          </button>
        )}
        <button
          type="button"
          className={`chip ${precioManual === '' && mode === 'otro' ? 'on' : ''}`}
          onClick={() => pick('otro')}
        >
          <b>Otro %</b>
          <small>{mode === 'otro' && otroPct ? money(unit) : '—'}</small>
        </button>
      </div>

      {mode === 'otro' && precioManual === '' && (
        <label className="field" style={{ marginTop: 10 }}>
          <span>Descuento personalizado (%)</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            value={otroPct}
            onChange={(e) => setOtroPct(e.target.value)}
            autoFocus
          />
        </label>
      )}

      <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: 1, marginBottom: 0 }}>
          <span>Precio final (S/)</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder={unit.toFixed(2)}
            value={precioManual}
            onChange={(e) => setPrecioManual(e.target.value)}
          />
        </label>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="lbl">Cantidad</span>
          <div className="stepper">
            <button type="button" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>−</button>
            <div>{cantidad}</div>
            <button type="button" onClick={() => setCantidad((c) => Math.min(stock, c + 1))}>＋</button>
          </div>
        </div>
      </div>

      <button className="btn full accent" style={{ marginTop: 12 }} onClick={add} disabled={stock <= 0}>
        {stock <= 0 ? 'Sin stock' : `🛒 Agregar a la venta · ${money(total)}`}
      </button>
    </div>
  );
}
