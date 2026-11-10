import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, QrCode, Search } from 'lucide-react';
import { useProducts } from '../store.js';
import { Button } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import { Input } from '../components/ui/input.jsx';
import { PageHeader, EmptyState } from '../components/Page.jsx';
import { cn } from '../lib/utils.js';

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
      p.id.toLowerCase().includes(t) ||
      (p.codigo || '').toLowerCase().includes(t)
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Códigos QR"
        description="Para productos sin etiqueta de la impresora"
        action={<Button size="sm" onClick={() => window.print()} disabled={toPrint.length === 0}><Printer /> Imprimir</Button>}
      />

      <div className="flex flex-col gap-3 print:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar para imprimir…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set(filtered.map((p) => p.id)))}>Marcar todos</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpiar</Button>
          <div className="ml-auto text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} seleccionados` : `${filtered.length} en vista`}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={QrCode} title="Sin coincidencias" />
        ) : (
          <Card className="max-h-80 overflow-y-auto">
            {filtered.map((p) => {
              const checked = selected.has(p.id);
              return (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b px-4 py-2.5 last:border-b-0 hover:bg-accent/60">
                  <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="size-4 accent-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.producto}</div>
                    <div className="text-xs text-muted-foreground"><span className="font-mono">{p.codigo || `#${p.id}`}</span> · {p.marca}</div>
                  </div>
                </label>
              );
            })}
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          {selected.size > 0
            ? `Se imprimirán los ${selected.size} productos seleccionados.`
            : 'Se imprimirán todos los productos visibles.'}
        </p>
      </div>

      <div className="qr-grid grid grid-cols-2 gap-3 sm:grid-cols-3">
        {toPrint.map((p) => (
          <div key={p.id} className={cn('flex break-inside-avoid flex-col items-center gap-2 rounded-xl border bg-white p-3 text-center text-zinc-900 print:border-zinc-400')}>
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">{p.codigo || `#${p.id}`}</span>
            <QRCodeSVG value={p.codigo || p.id} size={120} level="M" bgColor="#ffffff" fgColor="#0a1f44" />
            <div className="text-[10px] tracking-wide text-zinc-500 uppercase">{p.marca}</div>
            <div className="text-xs leading-tight font-semibold">{p.producto}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
