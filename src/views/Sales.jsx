import { useEffect, useMemo, useState } from 'react';
import {
  ESTADO_LABEL, METODOS_PAGO, addPayment, deletePayment, deleteSale, downloadDebtCSV,
  downloadSalesCSV, money, r2, saleStatus, useSales,
} from '../store.js';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';

const PERIODOS = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'todo', label: 'Todo' },
];

function desde(periodo) {
  const d = new Date();
  if (periodo === 'hoy') { d.setHours(0, 0, 0, 0); return d; }
  if (periodo === '7d') { d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d; }
  if (periodo === 'mes') { return new Date(d.getFullYear(), d.getMonth(), 1); }
  return null;
}

function fmtDate(iso, withTime = true) {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  } catch {
    return iso;
  }
}

const quien = (email) => (email ? ` · por ${email.split('@')[0]}` : '');

function waLink(telefono, texto) {
  let d = String(telefono || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 9) d = `51${d}`; // celular peruano
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export default function Sales() {
  const sales = useSales();
  const [tab, setTab] = useState('ventas'); // ventas | cobrar | productos
  const [periodo, setPeriodo] = useState('todo');
  const [evento, setEvento] = useState('');
  const [q, setQ] = useState('');
  const [detailId, setDetailId] = useState(null);

  const eventos = useMemo(() => Array.from(new Set(sales.map((s) => s.evento).filter(Boolean))).sort(), [sales]);

  const filtered = useMemo(() => {
    const from = desde(periodo);
    const t = q.trim().toLowerCase();
    return sales.filter((s) => {
      if (from && new Date(s.fecha) < from) return false;
      if (evento && s.evento !== evento) return false;
      if (t && !s.cliente.toLowerCase().includes(t) && !s.items.some((i) => i.productoNombre.toLowerCase().includes(t))) return false;
      return true;
    });
  }, [sales, periodo, evento, q]);

  const resumen = useMemo(() => {
    let vendido = 0, cobrado = 0, costo = 0, unidades = 0, descuentos = 0;
    for (const s of filtered) {
      const st = saleStatus(s);
      vendido += s.total;
      cobrado += st.pagado;
      for (const i of s.items) {
        unidades += i.cantidad;
        costo += (i.costoUnit || 0) * i.cantidad;
        descuentos += (i.precioLista - i.precioUnit) * i.cantidad;
      }
    }
    return {
      vendido: r2(vendido), cobrado: r2(cobrado), porCobrar: r2(vendido - cobrado),
      ganancia: r2(vendido - costo), unidades, descuentos: r2(descuentos), ventas: filtered.length,
    };
  }, [filtered]);

  const detail = sales.find((s) => s.id === detailId) || null;

  return (
    <div className="page">
      <div className="row between no-print" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Ventas</h2>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost small" onClick={() => window.print()}>🖨</button>
          <button
            className="btn accent small"
            disabled={filtered.length === 0}
            onClick={() => (tab === 'cobrar' ? downloadDebtCSV(filtered) : downloadSalesCSV(filtered))}
          >
            ⬇ Excel
          </button>
        </div>
      </div>

      <div className="print-only">
        <h2>Informe de ventas AJVC</h2>
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          {PERIODOS.find((p) => p.key === periodo).label}{evento ? ` · ${evento}` : ''} · generado {fmtDate(new Date().toISOString())}
        </div>
      </div>

      <div className="filters no-print">
        <select className="select" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select className="select" value={evento} onChange={(e) => setEvento(e.target.value)}>
          <option value="">Todos los eventos</option>
          {eventos.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <input className="input search" placeholder="Buscar cliente o producto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="stats">
        <Stat label="Vendido" value={money(resumen.vendido)} />
        <Stat label="Cobrado" value={money(resumen.cobrado)} color="var(--green)" />
        <Stat label="Por cobrar" value={money(resumen.porCobrar)} color="var(--red)" />
        <Stat label="Ganancia aprox." value={money(resumen.ganancia)} />
        <Stat label="Ventas / unidades" value={`${resumen.ventas} / ${resumen.unidades}`} />
        <Stat label="Descuentos dados" value={money(resumen.descuentos)} color="var(--yellow)" />
      </div>

      <div className="segmented no-print" style={{ marginBottom: 12 }}>
        <button className={tab === 'ventas' ? 'on' : ''} onClick={() => setTab('ventas')}>Ventas</button>
        <button className={tab === 'cobrar' ? 'on' : ''} onClick={() => setTab('cobrar')}>Por cobrar</button>
        <button className={tab === 'productos' ? 'on' : ''} onClick={() => setTab('productos')}>Por producto</button>
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          No hay ventas{sales.length > 0 ? ' con estos filtros' : ' todavía'}. Escanea un producto y toca <b>Agregar a la venta</b>.
        </div>
      )}

      {tab === 'ventas' && filtered.length > 0 && <SalesList sales={filtered} onOpen={setDetailId} />}
      {tab === 'cobrar' && filtered.length > 0 && <DebtList sales={filtered} onOpen={setDetailId} />}
      {tab === 'productos' && filtered.length > 0 && <ByProduct sales={filtered} />}

      <SaleDetail sale={detail} onClose={() => setDetailId(null)} />
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="stat">
      <div className="lbl">{label}</div>
      <div className="val" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function Badge({ estado }) {
  return <span className={`badge ${estado}`}>{ESTADO_LABEL[estado]}</span>;
}

function SalesList({ sales, onOpen }) {
  return (
    <div className="card" style={{ padding: '0 14px' }}>
      {sales.map((s) => {
        const st = saleStatus(s);
        return (
          <button key={s.id} className="sale-row" onClick={() => onOpen(s.id)}>
            <div style={{ minWidth: 0 }}>
              <div className="ttl">{s.cliente} <Badge estado={st.estado} /></div>
              <div className="sub">
                {fmtDate(s.fecha)}{s.evento ? ` · ${s.evento}` : ''}{quien(s.vendedor)}
              </div>
              <div className="sub items">
                {s.items.map((i) => `${i.cantidad}× ${i.productoNombre}${i.descuentoPct > 0 ? ` (−${i.descuentoPct}%)` : ''}`).join(', ')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="ttl">{money(s.total)}</div>
              {st.saldo > 0 && <div className="sub" style={{ color: 'var(--red)', fontWeight: 700 }}>debe {money(st.saldo)}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DebtList({ sales, onOpen }) {
  const grupos = useMemo(() => {
    const map = new Map();
    for (const s of sales) {
      const st = saleStatus(s);
      if (st.saldo <= 0) continue;
      const key = s.cliente.trim().toLowerCase();
      const g = map.get(key) || { cliente: s.cliente, telefono: '', saldo: 0, ventas: [] };
      g.saldo = r2(g.saldo + st.saldo);
      g.telefono = g.telefono || s.telefono;
      g.ventas.push({ s, st });
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.saldo - a.saldo);
  }, [sales]);

  if (grupos.length === 0) return <div className="empty">🎉 Nadie debe nada.</div>;

  return grupos.map((g) => {
    const wa = waLink(
      g.telefono,
      `Hola ${g.cliente}, te escribimos de AJVC 💙. Tienes un saldo pendiente de ${money(g.saldo)}. ¡Gracias!`
    );
    return (
      <div key={g.cliente} className="card">
        <div className="row between">
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{g.cliente}</div>
            {g.telefono && <div className="sub" style={{ fontSize: 12, color: 'var(--muted)' }}>📱 {g.telefono}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>DEBE</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--red)' }}>{money(g.saldo)}</div>
          </div>
        </div>
        {g.ventas.map(({ s, st }) => (
          <button key={s.id} className="sale-row" onClick={() => onOpen(s.id)}>
            <div style={{ minWidth: 0 }}>
              <div className="sub">{fmtDate(s.fecha, false)}{s.evento ? ` · ${s.evento}` : ''} · <Badge estado={st.estado} /></div>
              <div className="sub items">{s.items.map((i) => `${i.cantidad}× ${i.productoNombre}`).join(', ')}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <div>{money(s.total)}</div>
              <div style={{ color: 'var(--red)', fontWeight: 700 }}>{money(st.saldo)}</div>
            </div>
          </button>
        ))}
        {wa && (
          <a className="btn small ghost full no-print" style={{ marginTop: 8, textDecoration: 'none' }} href={wa} target="_blank" rel="noreferrer">
            💬 Recordar por WhatsApp
          </a>
        )}
      </div>
    );
  });
}

function ByProduct({ sales }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const s of sales) {
      for (const i of s.items) {
        const g = map.get(i.productId) || { nombre: i.productoNombre, marca: i.marca, cantidad: 0, total: 0, costo: 0 };
        g.cantidad += i.cantidad;
        g.total = r2(g.total + i.precioUnit * i.cantidad);
        g.costo = r2(g.costo + (i.costoUnit || 0) * i.cantidad);
        map.set(i.productId, g);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [sales]);

  return (
    <div className="card" style={{ padding: '0 14px' }}>
      {rows.map((r) => (
        <div key={r.nombre + r.marca} className="tx-item">
          <div>
            <div className="ttl">{r.nombre}</div>
            <div className="sub">{r.marca} · {r.cantidad} u. · ganancia {money(r.total - r.costo)}</div>
          </div>
          <div className="ttl">{money(r.total)}</div>
        </div>
      ))}
    </div>
  );
}

function SaleDetail({ sale, onClose }) {
  const toast = useToast();
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState(METODOS_PAGO[0]);
  const st = sale ? saleStatus(sale) : null;

  useEffect(() => {
    setMonto(st && st.saldo > 0 ? st.saldo.toFixed(2) : '');
  }, [sale?.id, st?.saldo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!sale) return null;

  function abonar() {
    try {
      addPayment(sale.id, { monto, metodo });
      toast('Pago registrado');
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Modal open={!!sale} onClose={onClose} title={sale.cliente}>
      <div className="sub" style={{ fontSize: 13, color: 'var(--muted)', marginTop: -6, marginBottom: 10 }}>
        {fmtDate(sale.fecha)}{sale.evento ? ` · ${sale.evento}` : ''}{sale.telefono ? ` · 📱 ${sale.telefono}` : ''}{quien(sale.vendedor)}
      </div>

      <div className="card" style={{ padding: '0 14px' }}>
        {sale.items.map((i) => (
          <div key={i.key} className="tx-item">
            <div>
              <div className="ttl">{i.cantidad}× {i.productoNombre}</div>
              <div className="sub">
                {i.codigo || `#${i.productId}`} · {money(i.precioUnit)} c/u
                {i.descuentoPct > 0 && <> · −{i.descuentoPct}% de {money(i.precioLista)}</>}
              </div>
            </div>
            <b style={{ fontSize: 14 }}>{money(i.precioUnit * i.cantidad)}</b>
          </div>
        ))}
      </div>

      <div className="pay-summary">
        <div><span>Total</span><b>{money(sale.total)}</b></div>
        <div><span>Pagado</span><b style={{ color: 'var(--green)' }}>{money(st.pagado)}</b></div>
        <div className={st.saldo > 0 ? 'debe' : ''}><span>Saldo</span><b>{money(st.saldo)}</b></div>
      </div>

      {sale.nota && <p style={{ fontSize: 13 }}>📝 {sale.nota}</p>}

      <div className="section-title">Pagos</div>
      {(sale.pagos || []).length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Sin pagos (crédito).</div>}
      {(sale.pagos || []).map((p) => (
        <div key={p.id} className="row between" style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
          <span>{fmtDate(p.fecha)} · {p.metodo || '—'}{quien(p.vendedor)}</span>
          <span className="row" style={{ gap: 6 }}>
            <b>{money(p.monto)}</b>
            <button
              className="icon-btn"
              aria-label="Borrar pago"
              onClick={() => { if (confirm('¿Borrar este pago?')) deletePayment(sale.id, p.id); }}
            >✕</button>
          </span>
        </div>
      ))}

      {st.saldo > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>Registrar abono</div>
          <div className="row" style={{ gap: 6, marginBottom: 8 }}>
            <button className="btn small ghost" onClick={() => setMonto(st.saldo.toFixed(2))}>Todo</button>
            <button className="btn small ghost" onClick={() => setMonto(r2(st.saldo / 2).toFixed(2))}>Mitad</button>
          </div>
          <div className="row">
            <input className="input" type="number" inputMode="decimal" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
            <select className="select" value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button className="btn full" style={{ marginTop: 10 }} onClick={abonar}>Registrar pago</button>
        </>
      )}

      <button
        className="btn full ghost small"
        style={{ marginTop: 14, color: 'var(--danger)' }}
        onClick={() => {
          if (confirm('¿Anular esta venta? Los productos vuelven al stock.')) {
            deleteSale(sale.id);
            toast('Venta anulada');
            onClose();
          }
        }}
      >
        Anular venta
      </button>
    </Modal>
  );
}
