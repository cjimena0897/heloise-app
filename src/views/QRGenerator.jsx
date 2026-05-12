import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useProducts } from '../store.js';

export default function QRGenerator() {
  const products = useProducts();
  const [selected, setSelected] = useState(() => new Set());
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return products;
    return products.filter((p) =>
      p.producto.toLowerCase().includes(t) ||
      p.marca.toLowerCase().includes(t) ||
      p.id.includes(t)
    );
  }, [products, q]);

  const toPrint = selected.size > 0
    ? products.filter((p) => selected.has(p.id))
    : filtered;

  function toggle(id) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((p) => p.id)));
  }
  function clearSel() {
    setSelected(new Set());
  }

  return (
    <div className="page">
      <div className="row between no-print" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Códigos QR</h2>
        <button className="btn accent small" onClick={() => window.print()}>🖨 Imprimir</button>
      </div>

      <div className="no-print">
        <input
          className="input"
          placeholder="Buscar para imprimir…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <div className="row" style={{ marginBottom: 12, gap: 8 }}>
          <button className="btn small ghost" onClick={selectAll}>Marcar todos</button>
          <button className="btn small ghost" onClick={clearSel}>Limpiar</button>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
            {selected.size > 0 ? `${selected.size} seleccionados` : `${filtered.length} en vista`}
          </div>
        </div>

        <div className="section-title">Selecciona los productos a imprimir</div>
        <div className="card" style={{ padding: 0 }}>
          {filtered.map((p) => {
            const checked = selected.has(p.id);
            return (
              <label
                key={p.id}
                className="row"
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border)',
                  gap: 12,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                  style={{ width: 20, height: 20 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>#{p.id} · {p.marca}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.producto}</div>
                </div>
              </label>
            );
          })}
          {filtered.length === 0 && <div className="empty">Sin coincidencias.</div>}
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '14px 0 8px' }}>
          {selected.size > 0
            ? `Se imprimirán los ${selected.size} productos seleccionados.`
            : 'Se imprimirán todos los productos visibles.'}
        </div>
      </div>

      <div className="qr-grid">
        {toPrint.map((p) => (
          <div key={p.id} className="qr-card">
            <div className="qr-id">#{p.id}</div>
            <QRCodeSVG
              value={p.id}
              size={128}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#0a1f44"
            />
            <div className="qr-brand">{p.marca}</div>
            <div className="qr-name">{p.producto}</div>
          </div>
        ))}
      </div>

      {toPrint.length === 0 && (
        <div className="empty">No hay productos para mostrar.</div>
      )}
    </div>
  );
}
