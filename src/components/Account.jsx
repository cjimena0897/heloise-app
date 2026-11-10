import { useState } from 'react';
import { CircleCheck, CloudOff, LoaderCircle, LogOut, RefreshCw, Upload } from 'lucide-react';
import { localDataSummary, login, logout, resetPassword, uploadLocalData, useStatus } from '../store.js';
import Modal from './Modal.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent } from './ui/card.jsx';
import { Field, Input } from './ui/input.jsx';
import { Logo } from './Logo.jsx';
import { cn } from '../lib/utils.js';

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Ese correo no tiene cuenta. Pide que te la creen.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
  'auth/network-request-failed': 'Sin conexión a internet.',
};

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await login(email, password);
    } catch (err) {
      setMsg({ error: true, text: AUTH_ERRORS[err?.code] || err?.message || 'No se pudo ingresar' });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) { setMsg({ error: true, text: 'Escribe tu correo primero.' }); return; }
    try {
      await resetPassword(email);
      setMsg({ text: 'Te enviamos un correo para crear una nueva contraseña.' });
    } catch (err) {
      setMsg({ error: true, text: AUTH_ERRORS[err?.code] || err?.message });
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="size-14 rounded-2xl text-xl" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AJVC Inventario</h1>
            <p className="text-sm text-muted-foreground">Ingresa con tu cuenta del equipo</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-5">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field label="Correo">
                <Input type="email" autoComplete="username" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Contraseña">
                <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {msg && (
                <p className={cn('text-sm', msg.error ? 'text-destructive' : 'text-success')}>{msg.text}</p>
              )}
              <Button size="lg" disabled={busy}>
                {busy && <LoaderCircle className="animate-spin" />}
                {busy ? 'Ingresando…' : 'Ingresar'}
              </Button>
              <Button type="button" variant="link" size="sm" onClick={forgot}>
                Olvidé mi contraseña
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function syncState(st) {
  if (!st.online) return { key: 'off', text: 'Sin conexión', dot: 'bg-destructive' };
  if (st.pending) return { key: 'busy', text: 'Sincronizando', dot: 'bg-warning animate-pulse' };
  return { key: 'ok', text: 'En línea', dot: 'bg-success' };
}

export function SyncPill({ onClick }) {
  const st = useStatus();
  if (st.mode === 'local') return null;
  const s = syncState(st);
  return (
    <Button variant="outline" size="sm" onClick={onClick} title="Cuenta y sincronización" className="rounded-full" data-sync={s.key}>
      <span className={cn('size-2 rounded-full', s.dot)} />
      {s.text}
    </Button>
  );
}

export function AccountModal({ open, onClose }) {
  const st = useStatus();
  const local = localDataSummary();

  function subir() {
    if (!confirm('¿Subir a la nube los datos guardados en este celular? Lo que ya exista en la nube no se reemplaza.')) return;
    const r = uploadLocalData();
    alert(`Listo: ${r.subidos} registros subidos${r.omitidos ? `, ${r.omitidos} ya existían` : ''}.`);
  }

  const estado = !st.online
    ? { icon: CloudOff, cls: 'text-destructive', text: 'Sin conexión. Puedes seguir vendiendo: los cambios se suben solos al volver el internet.' }
    : st.pending
      ? { icon: RefreshCw, cls: 'text-warning animate-spin', text: 'Subiendo cambios…' }
      : { icon: CircleCheck, cls: 'text-success', text: 'Todo sincronizado con tu equipo.' };

  return (
    <Modal open={open} onClose={onClose} title="Cuenta">
      <div className="flex flex-col gap-3">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Conectada como</div>
              <div className="font-medium">{st.user?.email}</div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <estado.icon className={cn('mt-0.5 size-4 shrink-0', estado.cls)} />
              <span>{estado.text}</span>
            </div>
          </CardContent>
        </Card>
        {local && (
          <Card className="border-warning/30 bg-warning-soft">
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm">
                Este celular tiene datos de antes de conectar la nube: <b>{local.productos}</b> productos,{' '}
                <b>{local.ventas}</b> ventas y <b>{local.movimientos}</b> movimientos.
              </p>
              <Button onClick={subir}><Upload /> Subir a la nube</Button>
            </CardContent>
          </Card>
        )}
        <Button variant="outline" onClick={() => { logout(); onClose(); }}>
          <LogOut /> Cerrar sesión
        </Button>
      </div>
    </Modal>
  );
}
