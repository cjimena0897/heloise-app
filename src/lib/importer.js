// Lectura de pedidos desde Google Sheets / Excel / CSV y armado de la vista previa.

export const FIELDS = [
  { key: 'codigo', label: 'Código' },
  { key: 'producto', label: 'Producto' },
  { key: 'variante', label: 'Color / tono' },
  { key: 'marca', label: 'Marca' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'cantidad', label: 'Cantidad' },
  { key: 'costo', label: 'Costo (c/u)' },
  { key: 'venta', label: 'Precio venta' },
  { key: 'oferta', label: 'Precio oferta' },
  { key: 'ubicacion', label: 'Ubicación' },
  { key: 'foto', label: 'Foto (link)' },
];

// Encabezados reconocidos (sin tildes, minúsculas, sin puntuación), en orden de preferencia.
const SYNONYMS = {
  codigo: ['codigo', 'cod', 'code', 'sku', 'etiqueta', 'codigo etiqueta', 'id'],
  producto: ['producto', 'nombre', 'descripcion', 'nombre producto', 'articulo', 'modelo'],
  marca: ['marca', 'brand'],
  variante: ['color', 'tono', 'shade', 'variante', 'talla', 'tamano', 'acabado'],
  categoria: ['categoria', 'category', 'tipo', 'linea'],
  cantidad: ['cantidad', 'cant', 'qty', 'unidades', 'stock', 'und', 'uds'],
  costo: ['costo', 'costo pen', 'costo unitario', 'p unitario', 'precio unitario', 'precio compra', 'p compra', 'costo soles', 'precio costo'],
  venta: ['p venta', 'precio venta', 'precio de venta', 'pvp', 'p sugerido', 'precio sugerido', 'precio'],
  oferta: ['p oferta', 'precio oferta', 'precio de oferta', 'oferta'],
  ubicacion: ['ubicacion', 'location', 'lugar', 'almacen'],
  foto: ['foto', 'imagen', 'image', 'link de la foto', 'link foto', 'url foto', 'url imagen', 'link imagen', 'foto url'],
};

export function norm(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
}

/** Texto pegado desde Sheets (tabulado) o CSV (coma / punto y coma) → matriz. */
export function parseText(text) {
  const t = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!t.trim()) return [];
  const first = t.split('\n', 1)[0];
  const sep = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}

/** "S/ 1,234.50" · "45,90" · 120 → número (o null). */
export function parseNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[^\d,.-]/g, '');
  if (!s || !/\d/.test(s)) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const isBlankRow = (r) => !r || r.every((c) => String(c ?? '').trim() === '');

/** Busca la fila de encabezados y propone qué columna corresponde a cada campo. */
export function detectColumns(rows) {
  let headerIdx = -1, best = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const hits = (rows[i] || []).filter((c) => Object.values(SYNONYMS).some((syn) => syn.includes(norm(c)))).length;
    if (hits > best) { best = hits; headerIdx = i; }
  }
  if (best < 2) headerIdx = -1;
  const headers = headerIdx >= 0 ? rows[headerIdx].map((h) => String(h ?? '').trim()) : [];
  const width = Math.max(0, ...rows.map((r) => (r ? r.length : 0)));
  const mapping = {};
  if (headerIdx >= 0) {
    const used = new Set();
    for (const f of FIELDS) {
      for (const syn of SYNONYMS[f.key]) {
        const col = headers.findIndex((h, i) => !used.has(i) && norm(h) === syn);
        if (col >= 0) { mapping[f.key] = col; used.add(col); break; }
      }
    }
    // "Item": en unas hojas es el código y en otras el nombre del producto.
    const itemCol = headers.findIndex((h, i) => !used.has(i) && norm(h) === 'item');
    if (itemCol >= 0) {
      if (mapping.producto == null) mapping.producto = itemCol;
      else if (mapping.codigo == null) mapping.codigo = itemCol;
    }
  }
  const columns = Array.from({ length: width }, (_, i) => ({
    index: i,
    letter: colLetter(i),
    header: headers[i] || '',
  }));
  return { headerIdx, columns, mapping };
}

export function colLetter(i) {
  let s = '';
  i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

const r2 = (n) => Math.round(n * 100) / 100;
const cleanCode = (s) => String(s ?? '').trim().toUpperCase().replace(/\//g, '-').replace(/\s+/g, '');

/**
 * Arma la vista previa.
 * opts: { categoriaDefault, generarCodigos, prefijo }
 * findExisting(code) → producto existente o null; existingCodes: Set de códigos ya usados.
 */
export function buildPreview(rows, headerIdx, mapping, opts, findExisting, existingCodes) {
  const get = (r, k) => (mapping[k] != null ? r[mapping[k]] : undefined);
  const items = [];
  const byCode = new Map();
  const warnings = [];
  if (mapping.cantidad == null) warnings.push('No hay columna de cantidad: se cuenta 1 unidad por fila.');

  rows.forEach((r, i) => {
    if (i <= headerIdx || isBlankRow(r)) return;
    const base = String(get(r, 'producto') ?? '').trim();
    const variante = String(get(r, 'variante') ?? '').trim();
    const producto = base && variante && !norm(base).includes(norm(variante)) ? `${base} · ${variante}` : base;
    const codigo = cleanCode(get(r, 'codigo'));
    if (!producto && !codigo) return;
    // Filas de totales ("Subtotal", "Total") no son productos.
    if (!codigo && /^(sub ?total|total)\b/i.test(producto)) return;
    const cant = mapping.cantidad != null ? parseNumber(get(r, 'cantidad')) : 1;
    const it = {
      fila: i + 1,
      codigo,
      producto,
      marca: String(get(r, 'marca') ?? '').trim(),
      categoria: String(get(r, 'categoria') ?? '').trim() || opts.categoriaDefault || '',
      cantidad: cant == null ? null : Math.round(cant),
      costo: parseNumber(get(r, 'costo')),
      venta: parseNumber(get(r, 'venta')),
      oferta: parseNumber(get(r, 'oferta')),
      ubicacion: String(get(r, 'ubicacion') ?? '').trim(),
      foto: /^https?:\/\//i.test(String(get(r, 'foto') ?? '').trim()) ? String(get(r, 'foto')).trim() : '',
      errores: [],
      generado: false,
    };
    for (const k of ['costo', 'venta', 'oferta']) if (it[k] != null) it[k] = r2(it[k]);
    // Mismo código (o misma marca + producto sin código) repetido: se suman las cantidades.
    const key = it.codigo ? `c:${it.codigo}` : `p:${norm(it.marca)}|${norm(it.producto)}`;
    if (byCode.has(key)) {
      const prev = byCode.get(key);
      prev.cantidad = (prev.cantidad || 0) + (it.cantidad || 0);
      prev.filas.push(it.fila);
      return;
    }
    it.filas = [it.fila];
    byCode.set(key, it);
    items.push(it);
  });

  // Códigos automáticos para los que no tienen.
  const used = new Set([...existingCodes, ...items.map((i) => i.codigo).filter(Boolean)]);
  const prefijo = cleanCode(opts.prefijo) || 'AJ';
  let n = 0;
  for (const c of used) {
    const m = c.match(new RegExp(`^${prefijo.replace(/[^A-Z0-9-]/g, '')}(\\d+)$`));
    if (m) n = Math.max(n, Number(m[1]));
  }

  for (const it of items) {
    const existing = it.codigo ? findExisting(it.codigo) : null;
    if (existing) {
      it.estado = 'existe';
      it.existente = existing;
    } else {
      it.estado = 'nuevo';
      if (!it.codigo) {
        if (opts.generarCodigos) {
          do { n += 1; it.codigo = `${prefijo}${String(n).padStart(3, '0')}`; } while (used.has(it.codigo));
          used.add(it.codigo);
          it.generado = true;
        } else it.errores.push('Sin código');
      }
      if (!it.producto) it.errores.push('Sin nombre de producto');
    }
    if (it.cantidad == null || it.cantidad < 0) it.errores.push('Cantidad inválida');
    if (it.errores.length) it.estado = 'error';
  }
  return { items, warnings };
}
