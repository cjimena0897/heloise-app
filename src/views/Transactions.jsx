import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Download } from 'lucide-react';
import { useTransactions, downloadCSV, money } from '../store.js';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { SegmentedTabs } from '../components/ui/tabs.jsx';
import { PageHeader, EmptyState } from '../components/Page.jsx';
import { cn } from '../lib/utils.js';

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('es-PE', {
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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Movimientos"
        description="Entradas y salidas de stock"
        action={<Button size="sm" variant="outline" onClick={downloadCSV} disabled={tx.length === 0}><Download /> CSV</Button>}
      />

      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-4">
        <Stat label="Entradas" value={totals.entradas} className="text-success" />
        <Stat label="Salidas" value={totals.salidas} className="text-destructive" />
        <Stat label="Ingreso" value={money(totals.ingreso)} />
        <Stat label="Costo" value={money(totals.costo)} />
      </Card>

      <SegmentedTabs
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'entrada', label: 'Entradas' },
          { value: 'salida', label: 'Salidas' },
        ]}
      />

      {filtered.length === 0 && (
        <EmptyState icon={ArrowLeftRight} title="Aún no hay movimientos">
          Las ventas, entradas y salidas aparecerán aquí.
        </EmptyState>
      )}

      {filtered.length > 0 && (
        <Card className="overflow-hidden">
          {filtered.map((t) => {
            const entrada = t.tipo === 'entrada';
            const Icon = entrada ? ArrowDownLeft : ArrowUpRight;
            return (
              <div key={t.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <div className={cn('grid size-9 shrink-0 place-items-center rounded-full', entrada ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive')}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.productoNombre}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {fmtDate(t.fecha)} · {t.marca}
                    {t.cliente && <> · {t.cliente}</>}
                    {t.precio != null && <> · {money(t.precio)}</>}
                  </div>
                </div>
                <div className={cn('font-semibold tabular-nums', entrada ? 'text-success' : 'text-destructive')}>
                  {entrada ? '+' : '−'}{t.cantidad}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, className }) {
  return (
    <div className="flex flex-col gap-0.5 bg-card p-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-semibold tracking-tight tabular-nums', className)}>{value}</div>
    </div>
  );
}
