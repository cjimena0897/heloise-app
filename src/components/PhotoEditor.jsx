import { useRef, useState } from 'react';
import { Camera, ImagePlus, Link2, LoaderCircle, Search, Trash2 } from 'lucide-react';
import { fileToThumb, imageSearchUrl } from '../lib/image.js';
import { ProductPhoto } from './ProductPhoto.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { cn } from '../lib/utils.js';

/**
 * Foto de referencia del producto: cámara, galería, link de internet o búsqueda en Google.
 * value: data URL o https://… ; onChange(nuevoValor)
 */
export function PhotoEditor({ product, value, onChange, className, size = 'size-24' }) {
  const camRef = useRef(null);
  const galRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [link, setLink] = useState('');

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      onChange(await fileToThumb(f));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  function saveLink() {
    const u = link.trim();
    if (!/^https?:\/\/\S+$/i.test(u)) { alert('Pega un link que empiece con https://'); return; }
    onChange(u);
    setLink('');
    setLinkMode(false);
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-3">
        <div className={cn('relative', size)}>
          <ProductPhoto p={{ ...product, foto: value }} className={cn('size-full rounded-xl border text-base', !value && 'border-dashed')} />
          {busy && <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/40"><LoaderCircle className="size-5 animate-spin text-white" /></div>}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => camRef.current?.click()}><Camera /> Cámara</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => galRef.current?.click()}><ImagePlus /> Galería</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLinkMode((v) => !v)}><Link2 /> Link</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.open(imageSearchUrl(product || {}), '_blank', 'noopener')}><Search /> Google</Button>
        </div>
      </div>
      {linkMode && (
        <div className="flex gap-2">
          <Input type="url" inputMode="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} autoFocus />
          <Button type="button" onClick={saveLink}>Usar</Button>
        </div>
      )}
      {linkMode && (
        <p className="text-xs text-muted-foreground">
          En Google Imágenes, mantén presionada la foto → <b>Copiar dirección de la imagen</b> (o abre la imagen y copia el link) y pégalo aquí.
        </p>
      )}
      {value && (
        <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => onChange('')}>
          <Trash2 /> Quitar foto
        </Button>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </div>
  );
}
