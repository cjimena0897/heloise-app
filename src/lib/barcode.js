// Lectura de QR y códigos de barras.
// - Android (Chrome): usa el lector nativo del sistema (BarcodeDetector), que es rápido y muy bueno.
// - iPhone y el resto: ZXing C++ compilado a WebAssembly, empaquetado con la app (funciona sin internet).

const NATIVE_FORMATS = ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix'];
const ZXING_FORMATS = ['QRCode', 'Code128', 'Code39', 'EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'ITF', 'DataMatrix'];

let detectorPromise = null;

async function nativeDetector() {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    if (!supported.includes('qr_code')) return null;
    const det = new window.BarcodeDetector({ formats: NATIVE_FORMATS.filter((f) => supported.includes(f)) });
    return {
      engine: 'nativo',
      async detect(canvas) {
        const r = await det.detect(canvas);
        return r[0]?.rawValue || null;
      },
    };
  } catch {
    return null;
  }
}

async function zxingDetector() {
  const [{ prepareZXingModule, readBarcodes }, { default: wasmUrl }] = await Promise.all([
    import('zxing-wasm/reader'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  await prepareZXingModule({
    overrides: { locateFile: (p, prefix) => (p.endsWith('.wasm') ? wasmUrl : prefix + p) },
    fireImmediately: true,
  });
  const opts = { formats: ZXING_FORMATS, tryHarder: true, tryRotate: true, tryInvert: false, tryDownscale: true, maxNumberOfSymbols: 1 };
  return {
    engine: 'zxing',
    async detect(canvas) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const r = await readBarcodes(img, opts);
      return r.find((x) => x.isValid)?.text || null;
    },
  };
}

/** Devuelve (una sola vez) el mejor lector disponible en este celular. */
export function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => (await nativeDetector()) || (await zxingDetector()))();
    detectorPromise.catch(() => { detectorPromise = null; });
  }
  return detectorPromise;
}

/** Sonido corto de confirmación (sin archivos de audio). */
let audioCtx = null;
export function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 1320;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.13);
  } catch {}
}
