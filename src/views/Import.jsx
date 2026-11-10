import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardPaste, Copy, FileSpreadsheet, LoaderCircle, TriangleAlert, Upload } from 'lucide-react';
import { findByCode, importInventory, money, useProducts } from '../store.js';
import { FIELDS, buildPreview, detectColumns, parseText } from '../lib/importer.js';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Field, Input } from '../components/ui/input.jsx';
import { Chip, ChipRow, ChipSelect } from '../components/ui/chips.jsx';
import { SegmentedTabs } from '../components/ui/tabs.jsx';
import { PageHeader } from '../components/Page.jsx';
import { ProductPhoto } from '../components/ProductPhoto.jsx';
import { useToast } from '../components/Toast.jsx';
import { cn } from '../lib/utils.js';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-input transition-colors peer-checked:bg-primary" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

const ESTADO = {
  nuevo: { label: 'Nuevo', variant: 'success' },
  existe: { label: 'Ya existe', variant: 'secondary' },
  error: { label: 'Revisar', variant: 'destructive' },
};

export default function Import() {
  const navigate = useNavigate();
  const toast = useToast();
  const products = useProducts();
  const fileRef = useRef(null);

  const [source, setSource] = useState('archivo'); // archivo | pegar
  const [sheets, setSheets] = useState(null); // [{ sheet, data }]
  const [sheetIdx, setSheetIdx] = useState(0);
  const [fileName, setFileName] = useState('');
  const [pasted, setPasted] = useState('');
  const [loading, setLoading] = useState(false);
  const [mappingOverride, setMappingOverride] = useState({});
  const [categoriaDefault, setCategoriaDefault] = useState('');
  const [generarCodigos, setGenerarCodigos] = useState(true);
  const [prefijo, setPrefijo] = useState('');
  const [lote, setLote] = useState('');
  const [actualizarPrecios, setActualizarPrecios] = useState(false);
  const [filtro, setFiltro] = useState('todos');
  const [done, setDone] = useState(null);

  const rows = useMemo(() => {
    if (source === 'pegar') return parseText(pasted);
    return sheets?.[sheetIdx]?.data || [];
  }, [source, pasted, sheets, sheetIdx]);

  const detected = useMemo(() => detectColumns(rows), [rows]);
  const mapping = useMemo(() => {
    const m = { ...detected.mapping };
    for (const [k, v] of Object.entries(mappingOverride)) {
      if (v === '') delete m[k];
      else m[k] = Number(v);
    }
    return m;
  }, [detected, mappingOverride]);

  const existingCodes = useMemo(() => new Set(products.flatMap((p) => [p.codigo, p.id].filter(Boolean).map((c) => String(c).toUpperCase()))), [products]);
  const preview = useMemo(() => {
    if (!rows.length) return { items: [], warnings: [] };
    return buildPreview(
      rows, detected.headerIdx, mapping,
      { categoriaDefault: categoriaDefault.trim(), generarCodigos, prefijo: prefijo || defaultPrefix(categoriaDefault) },
      (c) => findByCode(c), existingCodes
    );
  }, [rows, detected.headerIdx, mapping, categoriaDefault, generarCodigos, prefijo, existingCodes]);

  const counts = useMemo(() => {
    const c = { nuevo: 0, existe: 0, error: 0, unidades: 0 };
    for (const it of preview.items) { c[it.estado]++; if (it.estado !== 'error') c.unidades += it.cantidad || 0; }
    return c;
  }, [preview]);

  const shown = filtro === 'todos' ? preview.items : preview.items.filter((i) => i.estado === filtro);

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setLoading(true);
    setMappingOverride({});
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const all = await readXlsxFile(f);
        setSheets(all.map((s) => ({ sheet: s.sheet, data: s.data })));
        // Elegir la hoja que más parece un pedido.
        let best = 0, score = -1;
        all.forEach((s, i) => { const d = detectColumns(s.data); const sc = Object.keys(d.mapping).length * 1000 + s.data.length; if (sc > score) { score = sc; best = i; } });
        setSheetIdx(best);
      } else if (/\.(csv|tsv|txt)$/i.test(f.name)) {
        setSheets([{ sheet: f.name, data: parseText(await f.text()) }]);
        setSheetIdx(0);
      } else {
        throw new Error('Usa un archivo .xlsx o .csv (en Google Sheets: Archivo → Descargar).');
      }
      setFileName(f.name);
    } catch (err) {
      alert(err.message || 'No se pudo leer el archivo');
    } finally {
      setLoading(false);
    }
  }

  function confirmar() {
    const validos = preview.items.filter((i) => i.estado !== 'error');
    if (!validos.length) return;
    const msg = `¿Importar ${counts.nuevo} productos nuevos y sumar unidades a ${counts.existe} existentes (${counts.unidades} unidades en total)?`;
    if (!confirm(msg)) return;
    try {
      const r = importInventory(validos, { lote, actualizarPrecios });
      setDone({ ...r, generados: validos.filter((i) => i.generado).map((i) => ({ codigo: i.codigo, producto: i.producto, marca: i.marca, cantidad: i.cantidad })) });
      toast('Pedido importado');
      window.scrollTo(0, 0);
    } catch (e) {
      alert(e.message);
    }
  }

  if (done) return <Done done={done} onBack={() => navigate('/inventario')} onAgain={() => { setDone(null); setSheets(null); setPasted(''); setFileName(''); setLote(''); setCategoriaDefault(''); setPrefijo(''); setMappingOverride({}); setActualizarPrecios(false); setFiltro('todos'); }} />;

  const colOptions = detected.columns.map((c) => ({ value: String(c.index), label: c.header ? `${c.letter} · ${c.header}` : `Columna ${c.letter}` }));

  return (
    <div className="flex flex-col gap-4">
      <div className="-mb-2">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate('/inventario')}><ArrowLeft /> Inventario</Button>
      </div>
      <PageHeader title="Importar pedido" description="Desde Google Sheets o Excel: crea los productos nuevos y suma unidades a los que ya tienes." />

      <SegmentedTabs
        value={source}
        onChange={(v) => { setSource(v); setMappingOverride({}); }}
        options={[
          { value: 'archivo', label: <><FileSpreadsheet className="size-4" /> Subir archivo</> },
          { value: 'pegar', label: <><ClipboardPaste className="size-4" /> Pegar celdas</> },
        ]}
      />

      {source === 'archivo' ? (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              En Google Sheets: <b className="text-foreground">Archivo → Descargar → Microsoft Excel (.xlsx)</b> o <b className="text-foreground">CSV</b>, y súbelo aquí.
            </p>
            <Button variant="outline" size="lg" onClick={() => fileRef.current?.click()} disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <Upload />}
              {fileName || 'Elegir archivo'}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={onFile} />
            {sheets && sheets.length > 1 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Hoja</span>
                <ChipRow>
                  {sheets.map((s, i) => (
                    <Chip key={s.sheet} active={i === sheetIdx} onClick={() => { setSheetIdx(i); setMappingOverride({}); }}>{s.sheet}</Chip>
                  ))}
                </ChipRow>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              En Google Sheets selecciona las filas <b className="text-foreground">incluyendo los encabezados</b>, cópialas y pégalas aquí.
            </p>
            <textarea
              value={pasted}
              onChange={(e) => { setPasted(e.target.value); setMappingOverride({}); }}
              rows={6}
              placeholder={'Código\tMarca\tProducto\tCantidad\tCosto\tP. Venta\n…'}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <div>
                <div className="font-semibold">Columnas</div>
                <p className="text-xs text-muted-foreground">
                  {detected.headerIdx >= 0 ? `Encabezados en la fila ${detected.headerIdx + 1}. ` : 'No se encontraron encabezados: elige cada columna. '}
                  Toca una para cambiarla.
                </p>
              </div>
              <div className="flex flex-col divide-y">
                {FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm">{f.label}</span>
                    <ChipSelect
                      value={mapping[f.key] != null ? String(mapping[f.key]) : ''}
                      onChange={(v) => setMappingOverride((m) => ({ ...m, [f.key]: v }))}
                      options={colOptions}
                      allLabel="No usar"
                      title={f.label}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="font-semibold">Opciones</div>
              <Field label="Nombre del pedido" hint="Para encontrarlo en Movimientos. Ej. Bolsos noviembre">
                <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Opcional" />
              </Field>
              {mapping.categoria == null && (
                <Field label="Categoría para estos productos" hint="El archivo no tiene columna de categoría">
                  <Input value={categoriaDefault} onChange={(e) => setCategoriaDefault(e.target.value)} placeholder="Ej. Bolsos" />
                </Field>
              )}
              <Toggle
                checked={generarCodigos}
                onChange={setGenerarCodigos}
                label="Crear códigos para los que no tienen"
                hint="Después imprimes la etiqueta con ese código"
              />
              {generarCodigos && (
                <Field label="Prefijo del código">
                  <Input className="font-mono uppercase" value={prefijo} onChange={(e) => setPrefijo(e.target.value.toUpperCase())} placeholder={defaultPrefix(categoriaDefault)} maxLength={6} />
                </Field>
              )}
              {counts.existe > 0 && (
                <Toggle
                  checked={actualizarPrecios}
                  onChange={setActualizarPrecios}
                  label="Actualizar precios de los que ya existen"
                  hint="Si no, solo se suman las unidades"
                />
              )}
            </CardContent>
          </Card>

          {preview.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
            </p>
          ))}

          <div className="flex flex-col gap-3">
            <div className="font-semibold">Vista previa</div>
            <ChipRow>
              <Chip active={filtro === 'todos'} onClick={() => setFiltro('todos')} count={preview.items.length}>Todos</Chip>
              <Chip active={filtro === 'nuevo'} onClick={() => setFiltro('nuevo')} count={counts.nuevo}>Nuevos</Chip>
              <Chip active={filtro === 'existe'} onClick={() => setFiltro('existe')} count={counts.existe}>Ya existen</Chip>
              {counts.error > 0 && <Chip active={filtro === 'error'} onClick={() => setFiltro('error')} count={counts.error}>Revisar</Chip>}
            </ChipRow>
            <Card className="overflow-hidden">
              {shown.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nada aquí.</div>}
              {shown.map((it) => (
                <div key={it.filas.join('-') + it.codigo} data-import-row={it.estado} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
                  <ProductPhoto p={{ marca: it.marca || it.existente?.marca, foto: it.foto || it.existente?.foto }} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.producto || it.existente?.producto || '—'}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      <span className={cn('font-mono', it.generado && 'text-success')}>{it.codigo || 'sin código'}</span>
                      {it.marca && <> · {it.marca}</>}
                      {it.venta != null && <> · {money(it.venta)}</>}
                      {it.costo != null && <> · costo {money(it.costo)}</>}
                    </div>
                    {it.errores.length > 0 && <div className="text-xs text-destructive">Fila {it.fila}: {it.errores.join(', ')}</div>}
                    {it.estado === 'existe' && (
                      <div className="text-xs text-muted-foreground">Stock {it.existente.stockActual} → {it.existente.stockActual + (it.cantidad || 0)}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">+{it.cantidad ?? '?'}</span>
                    <Badge variant={ESTADO[it.estado].variant}>{ESTADO[it.estado].label}</Badge>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20">
            <Button size="lg" className="w-full shadow-lg" onClick={confirmar} disabled={counts.nuevo + counts.existe === 0}>
              <Check /> Importar {counts.nuevo + counts.existe} productos · {counts.unidades} u.
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function defaultPrefix(cat) {
  const c = String(cat || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/gi, '').toUpperCase();
  return c ? c.slice(0, 3) : 'AJ';
}

function Done({ done, onBack, onAgain }) {
  const toast = useToast();
  const lista = done.generados.map((g) => `${g.codigo}\t${g.marca}\t${g.producto}\t${g.cantidad}`).join('\n');
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-success-soft"><Check className="size-6 text-success" /></div>
          <div className="text-lg font-semibold">Pedido importado</div>
          <p className="text-sm text-muted-foreground">
            {done.nuevos} productos nuevos · {done.existentes} actualizados · {done.unidades} unidades
          </p>
        </CardContent>
      </Card>
      {done.generados.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <div className="font-semibold">Códigos creados</div>
              <p className="text-xs text-muted-foreground">Imprime una etiqueta con cada código en tu impresora.</p>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              {done.generados.map((g) => (
                <div key={g.codigo} className="flex items-center justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                  <span className="font-mono font-semibold">{g.codigo}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{g.producto}</span>
                  <span className="tabular-nums">×{g.cantidad}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(lista); toast('Lista copiada'); } catch { alert(lista); } }}>
              <Copy /> Copiar lista
            </Button>
          </CardContent>
        </Card>
      )}
      <Button size="lg" onClick={onBack}>Ver inventario</Button>
      <Button variant="ghost" onClick={onAgain}>Importar otro pedido</Button>
    </div>
  );
}
