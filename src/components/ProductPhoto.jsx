import { useState } from 'react';
import { cn } from '../lib/utils.js';

function initials(marca) {
  const w = String(marca || '?').trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}

/** Foto del producto, o iniciales de la marca si no tiene (o si el link falla). */
export function ProductPhoto({ p, className, dim }) {
  const [brokenSrc, setBrokenSrc] = useState(null);
  const has = p?.foto && brokenSrc !== p.foto;
  return (
    <div className={cn('relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-xs font-semibold text-muted-foreground', has && 'bg-white', dim && 'opacity-50', className)}>
      {has ? (
        <img src={p.foto} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-contain" onError={() => setBrokenSrc(p.foto)} />
      ) : (
        initials(p?.marca)
      )}
    </div>
  );
}
