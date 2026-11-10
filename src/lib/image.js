/** Achica una imagen (archivo o link) a JPEG cuadrado-recortado de `size` px → data URL liviano (~10–20 KB). */
export async function fileToThumb(file, size = 320, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return drawThumb(img, size, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

function drawThumb(img, size, quality) {
  // Ajusta dentro del cuadrado sin recortar (fondo blanco), como foto de catálogo.
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight, 1);
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const side = Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = side; c.height = side;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, side, side);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
  return c.toDataURL('image/jpeg', quality);
}

export function imageSearchUrl(p) {
  return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${p.marca || ''} ${p.producto || ''}`.trim())}`;
}
