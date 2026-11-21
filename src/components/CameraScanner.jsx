import { useEffect, useRef, useState } from 'react';
import { CameraOff, Flashlight, FlashlightOff, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { beep, getDetector } from '../lib/barcode.js';
import { Button } from './ui/button.jsx';
import { cn } from '../lib/utils.js';

// Recuadro de lectura, relativo al área visible de la cámara.
const BOX_W = 0.8; // 80 % del ancho
const BOX_RATIO = 0.72; // alto = 72 % del ancho (entra un QR o un código de barras)
const MARGIN = 0.12; // se analiza un poco más de lo que se ve, por si el código queda al borde
const MAX_ROI = 1400; // px: más grande no mejora y cuesta más

function cameraError(e) {
  const n = e?.name || '';
  if (!window.isSecureContext) return 'La cámara solo funciona con https.';
  if (n === 'NotAllowedError' || n === 'SecurityError')
    return 'No hay permiso para usar la cámara. En iPhone: Ajustes → Safari → Cámara → Permitir. En Android: toca el candado junto a la dirección → Permisos → Cámara.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No se encontró una cámara en este dispositivo.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'La cámara está ocupada por otra app. Ciérrala e intenta de nuevo.';
  return e?.message || 'No se pudo iniciar la cámara.';
}

/**
 * Cámara a pantalla con recuadro guía. Llama onDetected(texto) al leer un código y se detiene.
 */
export default function CameraScanner({ onDetected, onClose }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const runRef = useRef(0); // id de la sesión de lectura actual (para cortar bucles viejos)
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | running | paused | error
  const [error, setError] = useState('');
  const [engine, setEngine] = useState('');
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [zoom, setZoom] = useState(null); // { min, max, value, levels }
  const [hint, setHint] = useState(false);

  function stopStream() {
    runRef.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function start() {
    stopStream();
    const run = runRef.current;
    setStatus('starting');
    setError('');
    setHint(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara.');
      const [stream, detector] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
        }),
        getDetector(),
      ]);
      if (run !== runRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      setEngine(detector.engine);
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      if (caps.focusMode?.includes('continuous')) {
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      }
      setTorch({ supported: !!caps.torch, on: false });
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        const levels = [1, 2, 3].filter((z) => z >= caps.zoom.min && z <= caps.zoom.max);
        const current = track.getSettings?.().zoom || caps.zoom.min;
        setZoom(levels.length > 1 ? { min: caps.zoom.min, max: caps.zoom.max, value: current, levels } : null);
      } else setZoom(null);

      setStatus('running');
      loop(run, detector);
    } catch (e) {
      if (run !== runRef.current) return;
      stopStream();
      setStatus('error');
      setError(cameraError(e));
    }
  }

  function roi(video) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const cw = wrapRef.current?.clientWidth || vw, ch = wrapRef.current?.clientHeight || vh;
    // El video se muestra "cover": se calcula qué parte del cuadro original es visible.
    const scale = Math.max(cw / vw, ch / vh);
    const visW = cw / scale, visH = ch / scale;
    let w = visW * BOX_W * (1 + MARGIN);
    let h = Math.min(visH, visW * BOX_W * BOX_RATIO * (1 + MARGIN * 2));
    w = Math.min(w, vw); h = Math.min(h, vh);
    return { sx: (vw - w) / 2, sy: (vh - h) / 2, sw: w, sh: h };
  }

  function loop(run, detector) {
    const video = videoRef.current;
    const canvas = (canvasRef.current ||= document.createElement('canvas'));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const startedAt = performance.now();
    let busy = false;

    const schedule = () => {
      if (run !== runRef.current) return;
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => tick());
      else setTimeout(tick, 50);
    };

    const tick = async () => {
      if (run !== runRef.current) return;
      if (!busy && video.readyState >= 2 && video.videoWidth) {
        busy = true;
        try {
          const { sx, sy, sw, sh } = roi(video);
          const k = Math.min(1, MAX_ROI / Math.max(sw, sh));
          canvas.width = Math.round(sw * k);
          canvas.height = Math.round(sh * k);
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
          const text = (await detector.detect(canvas))?.trim();
          if (text && run === runRef.current) {
            navigator.vibrate?.(60);
            beep();
            stopStream();
            onDetected(text);
            return;
          }
        } catch {}
        busy = false;
        if (performance.now() - startedAt > 5000) setHint(true);
      }
      schedule();
    };
    schedule();
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
      setTorch((t) => ({ ...t, on }));
    } catch {}
  }

  async function setZoomLevel(z) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ zoom: z }] });
      setZoom((s) => ({ ...s, value: z }));
    } catch {}
  }

  useEffect(() => {
    start();
    const onVis = () => {
      if (document.hidden) { if (streamRef.current) { stopStream(); setStatus('paused'); } }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stopStream();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-3" data-scanner={status} data-engine={engine}>
      <div ref={wrapRef} className="relative aspect-[3/4] max-h-[62dvh] w-full overflow-hidden rounded-2xl bg-black shadow-lg sm:aspect-video">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" />

        {status === 'running' && <Viewfinder />}

        {status === 'starting' && (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
            <span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" /> Abriendo cámara…</span>
          </div>
        )}
        {(status === 'paused' || status === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white">
            <CameraOff className="size-8 opacity-80" />
            <p className="max-w-xs">{status === 'paused' ? 'Cámara en pausa.' : error}</p>
            <Button variant="brand" onClick={start}><RotateCcw /> {status === 'paused' ? 'Reanudar' : 'Intentar de nuevo'}</Button>
          </div>
        )}

        <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
          <button onClick={onClose} aria-label="Cerrar cámara" className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
            <X className="size-5" />
          </button>
          {torch.supported && status === 'running' && (
            <button onClick={toggleTorch} aria-label={torch.on ? 'Apagar linterna' : 'Encender linterna'} aria-pressed={torch.on}
              className={cn('grid size-10 place-items-center rounded-full backdrop-blur', torch.on ? 'bg-brand text-brand-foreground' : 'bg-black/45 text-white')}>
              {torch.on ? <Flashlight className="size-5" /> : <FlashlightOff className="size-5" />}
            </button>
          )}
        </div>

        {status === 'running' && (
          <div className="absolute right-3 bottom-3 left-3 flex flex-col items-center gap-2">
            {zoom && (
              <div className="flex gap-1 rounded-full bg-black/45 p-1 backdrop-blur" role="radiogroup" aria-label="Zoom">
                {zoom.levels.map((z) => (
                  <button key={z} role="radio" aria-checked={Math.abs(zoom.value - z) < 0.05} onClick={() => setZoomLevel(z)}
                    className={cn('h-8 min-w-10 rounded-full px-2 text-xs font-semibold text-white tabular-nums',
                      Math.abs(zoom.value - z) < 0.05 && 'bg-white text-black')}>
                    {z}×
                  </button>
                ))}
              </div>
            )}
            <p className="rounded-full bg-black/45 px-3 py-1.5 text-center text-xs text-white backdrop-blur">
              {hint
                ? (zoom ? '¿No lee? Aleja un poco el celular y usa 2×' : '¿No lee? Aleja un poco el celular: de muy cerca no enfoca')
                : 'Centra el código dentro del recuadro'}
            </p>
          </div>
        )}
      </div>
      {hint && status === 'running' && (
        <p className="text-center text-xs text-muted-foreground">
          Códigos de barras: ponlos <b className="text-foreground">horizontales</b>. Con poca luz, enciende la linterna.
        </p>
      )}
    </div>
  );
}

/** Oscurece fuera del recuadro, esquinas y línea de escaneo. */
function Viewfinder() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        className="relative rounded-2xl shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]"
        style={{ width: `${BOX_W * 100}%`, aspectRatio: `1 / ${BOX_RATIO}` }}
      >
        {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
          'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
          <span key={c} className={cn('absolute size-7 border-brand', c)} />
        ))}
        <span className="absolute inset-x-4 h-0.5 animate-[scanline_2.2s_ease-in-out_infinite] rounded-full bg-brand/90 shadow-[0_0_12px_2px] shadow-brand/60" />
      </div>
    </div>
  );
}
