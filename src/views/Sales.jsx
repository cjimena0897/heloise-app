import { useEffect, useMemo, useState } from 'react';
import {
  ESTADO_LABEL, METODOS_PAGO, addPayment, deletePayment, deleteSale, downloadDebtCSV,
  downloadSalesCSV, money, r2, saleStatus, useSales,
} from '../store.js';
import { Ban, Download, MessageCircle, Phone, Printer, Receipt, Search, StickyNote, Trash2, Wallet } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { useToast } from '../components/Toast.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Input, NativeSelect } from '../components/ui/input.jsx';
import { SegmentedTabs } from '../components/ui/tabs.jsx';
import { PageHeader, EmptyState } from '../components/Page.jsx';
import { SummaryBox } from '../components/Cart.jsx';
import { cn } from '../lib/utils.js';

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

const quien = (email) => (email ? ` · ${email.split('@')[0]}` : '');

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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ventas"
        description="Lo vendido, cobrado y por cobrar"
        action={
          <>
            <Button variant="outline" size="icon-sm" onClick={() => window.print()} aria-label="Imprimir"><Printer /></Button>
            <Button
              size="sm"
              disabled={filtered.length === 0}
              onClick={() => (tab === 'cobrar' ? downloadDebtCSV(filtered) : downloadSalesCSV(filtered))}
            >
              <Download /> Excel
            </Button>
          </>
        }
      />

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Informe de ventas AJVC</h1>
        <p className="text-sm">
          {PERIODOS.find((p) => p.key === periodo).label}{evento ? ` · ${evento}` : ''} · generado {fmtDate(new Date().toISOString())}
        </p>
      </div>

      <div className="flex flex-col gap-2 print:hidden">
        <div className="grid grid-cols-2 gap-2">
          <NativeSelect value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Periodo">
            {PERIODOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </NativeSelect>
          <NativeSelect value={evento} onChange={(e) => setEvento(e.target.value)} aria-label="Evento">
            <option value="">Todos los eventos</option>
            {eventos.map((e) => <option key={e} value={e}>{e}</option>)}
          </NativeSelect>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cliente o producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-3">
        <Stat label="Vendido" value={money(resumen.vendido)} big />
        <Stat label="Por cobrar" value={money(resumen.porCobrar)} tone="destructive" big />
        <Stat label="Cobrado" value={money(resumen.cobrado)} tone="success" />
        <Stat label="Ganancia aprox." value={money(resumen.ganancia)} />
        <Stat label="Ventas · unidades" value={`${resumen.ventas} · ${resumen.unidades}`} />
        <Stat label="Descuentos dados" value={money(resumen.descuentos)} tone="warning" />
      </Card>

      <SegmentedTabs
        className="print:hidden"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'ventas', label: 'Ventas' },
          { value: 'cobrar', label: 'Por cobrar' },
          { value: 'productos', label: 'Por producto' },
        ]}
      />

      {filtered.length === 0 && (
        <EmptyState icon={Receipt} title={sales.length > 0 ? 'Sin ventas con estos filtros' : 'Aún no hay ventas'}>
          Escanea un producto y toca <b>Agregar a la venta</b>.
        </EmptyState>
      )}

      {tab === 'ventas' && filtered.length > 0 && <SalesList sales={filtered} onOpen={setDetailId} />}
      {tab === 'cobrar' && filtered.length > 0 && <DebtList sales={filtered} onOpen={setDetailId} />}
      {tab === 'productos' && filtered.length > 0 && <ByProduct sales={filtered} />}

      <SaleDetail sale={detail} onClose={() => setDetailId(null)} />
    </div>
  );
}

const TONE = { success: 'text-success', destructive: 'text-destructive', warning: 'text-warning' };

function Stat({ label, value, tone, big }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card p-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('font-semibold tracking-tight tabular-nums', big ? 'text-xl' : 'text-base', TONE[tone])}>{value}</div>
    </div>
  );
}

const ESTADO_VARIANT = { pagado: 'success', parcial: 'warning', credito: 'destructive' };

function EstadoBadge({ estado }) {
  return <Badge variant={ESTADO_VARIANT[estado]}>{ESTADO_LABEL[estado]}</Badge>;
}

function SaleRow({ s, st, onOpen, showClient = true }) {
  return (
    <button data-sale={s.id} className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/60" onClick={() => onOpen(s.id)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {showClient && <span className="truncate font-medium">{s.cliente}</span>}
          <EstadoBadge estado={st.estado} />
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {fmtDate(s.fecha)}{s.evento ? ` · ${s.evento}` : ''}{quien(s.vendedor)}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {s.items.map((i) => `${i.cantidad}× ${i.productoNombre}${i.descuentoPct > 0 ? ` (−${i.descuentoPct}%)` : ''}`).join(', ')}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold tabular-nums">{money(s.total)}</div>
        {st.saldo > 0 && <div className="text-xs font-medium text-destructive tabular-nums">debe {money(st.saldo)}</div>}
      </div>
    </button>
  );
}

function SalesList({ sales, onOpen }) {
  return (
    <Card className="overflow-hidden">
      {sales.map((s) => <SaleRow key={s.id} s={s} st={saleStatus(s)} onOpen={onOpen} />)}
    </Card>
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

  if (grupos.length === 0) {
    return <EmptyState icon={Wallet} title="Nadie debe nada 🎉">Todas las ventas de este periodo están pagadas.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-3">
      {grupos.map((g) => {
        const wa = waLink(
          g.telefono,
          `Hola ${g.cliente}, te escribimos de AJVC 💙. Tienes un saldo pendiente de ${money(g.saldo)}. ¡Gracias!`
        );
        return (
          <Card key={g.cliente} className="overflow-hidden" data-debtor={g.cliente}>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-semibold uppercase">
                  {g.cliente.trim()[0]}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{g.cliente}</div>
                  {g.telefono && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3" />{g.telefono}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Debe</div>
                <div className="text-lg font-semibold text-destructive tabular-nums">{money(g.saldo)}</div>
              </div>
            </div>
            <div className="border-t">
              {g.ventas.map(({ s, st }) => <SaleRow key={s.id} s={s} st={st} onOpen={onOpen} showClient={false} />)}
            </div>
            {wa && (
              <div className="border-t p-3 print:hidden">
                <Button variant="outline" className="w-full" onClick={() => window.open(wa, '_blank', 'noopener')}>
                  <MessageCircle /> Recordar por WhatsApp
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
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
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card className="overflow-hidden">
      {rows.map((r) => (
        <div key={r.nombre + r.marca} className="border-b px-4 py-3 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{r.nombre}</div>
              <div className="text-xs text-muted-foreground">
                {r.marca} · {r.cantidad} u. · ganancia {money(r.total - r.costo)}
              </div>
            </div>
            <div className="font-semibold tabular-nums">{money(r.total)}</div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </Card>
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

  function abonar() {
    try {
      addPayment(sale.id, { monto, metodo });
      toast('Pago registrado');
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Modal
      open={!!sale}
      onClose={onClose}
      title={sale?.cliente || ''}
      description={sale ? `${fmtDate(sale.fecha)}${sale.evento ? ` · ${sale.evento}` : ''}${sale.telefono ? ` · ${sale.telefono}` : ''}${quien(sale.vendedor)}` : undefined}
    >
      {sale && (
        <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-xl border">
            {sale.items.map((i) => (
              <div key={i.key} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.cantidad}× {i.productoNombre}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono">{i.codigo || `#${i.productId}`}</span> · {money(i.precioUnit)} c/u
                    {i.descuentoPct > 0 && <> · <span className="text-success">−{i.descuentoPct}%</span> de {money(i.precioLista)}</>}
                  </div>
                </div>
                <div className="text-sm font-semibold tabular-nums">{money(i.precioUnit * i.cantidad)}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SummaryBox label="Total" value={money(sale.total)} />
            <SummaryBox label="Pagado" value={money(st.pagado)} tone="success" />
            <SummaryBox label="Saldo" value={money(st.saldo)} tone={st.saldo > 0 ? 'destructive' : undefined} />
          </div>

          {sale.nota && (
            <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {sale.nota}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Pagos</div>
            {(sale.pagos || []).length === 0 && <div className="text-sm text-muted-foreground">Sin pagos (crédito).</div>}
            {(sale.pagos || []).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-b-0">
                <span className="text-muted-foreground">{fmtDate(p.fecha)} · {p.metodo || '—'}{quien(p.vendedor)}</span>
                <span className="flex items-center gap-1">
                  <b className="tabular-nums">{money(p.monto)}</b>
                  <Button variant="ghost" size="icon-sm" aria-label="Borrar pago"
                    onClick={() => { if (confirm('¿Borrar este pago?')) deletePayment(sale.id, p.id); }}>
                    <Trash2 />
                  </Button>
                </span>
              </div>
            ))}
          </div>

          {st.saldo > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Registrar abono</div>
                <div className="flex gap-1">
                  <Button variant="secondary" size="sm" onClick={() => setMonto(st.saldo.toFixed(2))}>Todo</Button>
                  <Button variant="secondary" size="sm" onClick={() => setMonto(r2(st.saldo / 2).toFixed(2))}>Mitad</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" inputMode="decimal" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} aria-label="Monto" />
                <NativeSelect value={metodo} onChange={(e) => setMetodo(e.target.value)} aria-label="Método">
                  {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
                </NativeSelect>
              </div>
              <Button onClick={abonar}>Registrar pago</Button>
            </div>
          )}

          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
            onClick={() => {
              if (confirm('¿Anular esta venta? Los productos vuelven al stock.')) {
                deleteSale(sale.id);
                toast('Venta anulada');
                onClose();
              }
            }}
          >
            <Ban /> Anular venta
          </Button>
        </div>
      )}
    </Modal>
  );
}
