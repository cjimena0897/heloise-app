import { useMemo, useState } from 'react';
import { useTransactions, downloadCSV } from '../store.js';

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function Transactions() {
  const tx = useTransactions();
  const [filter, setFilter] = useState('todos'); // todos | entrada | salida

  const filtered = useMemo(() => {
    if (filter === 'todos') return tx;
    return tx.filter((t) => t.tipo === filter);
  }, [tx, filter]);

  const totals = useMemo(() => {
    let entradas = 0, salidas = 0, ingreso = 0, costo = 0;
    for (const t of tx) {
      if (t.tipo === 'entrada') {
        entradas += t.cantidad;
        if (t.precio != null) costo += t.precio * t.cantidad;
      } else {
        salidas += t.cantidad;
        if (t.precio != null) ingreso += t.precio * t.cantidad;
      }
    }
    return { entradas, salidas, ingreso, costo };
  }, [tx]);

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Movimientos</h2>
        <button className="btn accent small" onClick={downloadCSV} disabled={tx.length === 0}>
          ⬇ CSV
        </button>
      </div>

      <div className="card">
        <div className="row wrap" style={{ gap: 14 }}>
          <Stat label="Entradas" value={totals.entradas} color="var(--green)" />
          <Stat label="Salidas" value={totals.salidas} color="var(--red)" />
          <Stat label="Ingreso S/" value={totals.ingreso.toFixed(2)} color="var(--navy-800)" />
          <Stat label="Costo S/" value={totals.costo.toFixed(2)} color="var(--navy-800)" />
        </div>
      </div>

      <div className="filters" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <FilterBtn active={filter === 'todos'} onClick={() => setFilter('todos')}>Todos</FilterBtn>
        <FilterBtn active={filter === 'entrada'} onClick={() => setFilter('entrada')}>Entradas</FilterBtn>
        <FilterBtn active={filter === 'salida'} onClick={() => setFilter('salida')}>Salidas</FilterBtn>
      </div>

      {filtered.length === 0 && (
        <div className="empty">Aún no hay movimientos registrados.</div>
      )}

      {filtered.length > 0 && (
        <div className="card">
          {filtered.map((t) => (
            <div key={t.id} className="tx-item">
              <div>
                <div className="ttl">
                  #{t.productId} · {t.productoNombre}
                </div>
                <div className="sub">
                  {fmtDate(t.fecha)} · {t.marca}
                  {t.precio != null && <> · S/ {Number(t.precio).toFixed(2)}</>}
                </div>
              </div>
              <div className={`qty ${t.tipo}`}>
                {t.tipo === 'entrada' ? '+' : '−'}{t.cantidad}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ minWidth: 80 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="btn small"
      style={{
        background: active ? 'var(--navy-800)' : '#fff',
        color: active ? '#fff' : 'var(--navy-800)',
        border: active ? '1px solid var(--navy-800)' : '1px solid var(--border)',
      }}
    >
      {children}
    </button>
  );
}
