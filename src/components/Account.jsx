import { useState } from 'react';
import { localDataSummary, login, logout, resetPassword, uploadLocalData, useStatus } from '../store.js';
import Modal from './Modal.jsx';

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
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="logo big">AJ</div>
        <h2 style={{ textAlign: 'center' }}>AJVC Inventario</h2>
        <label className="field">
          <span>Correo</span>
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {msg && <div style={{ color: msg.error ? 'var(--danger)' : 'var(--green)', fontSize: 13, marginBottom: 10 }}>{msg.text}</div>}
        <button className="btn full" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <button type="button" className="btn full ghost small" style={{ marginTop: 8 }} onClick={forgot}>
          Olvidé mi contraseña
        </button>
      </form>
    </div>
  );
}

export function SyncPill({ onClick }) {
  const st = useStatus();
  if (st.mode === 'local') return null;
  let cls = 'ok', text = 'En línea';
  if (!st.online) { cls = 'off'; text = 'Sin conexión'; }
  else if (st.pending) { cls = 'busy'; text = 'Sincronizando'; }
  return (
    <button className={`sync-pill ${cls}`} onClick={onClick} title="Cuenta y sincronización">
      <i /> {text}
    </button>
  );
}

export function AccountModal({ open, onClose }) {
  const st = useStatus();
  const local = localDataSummary();
  if (!open) return null;

  function subir() {
    if (!confirm('¿Subir a la nube los datos guardados en este celular? Lo que ya exista en la nube no se reemplaza.')) return;
    const r = uploadLocalData();
    alert(`Listo: ${r.subidos} registros subidos${r.omitidos ? `, ${r.omitidos} ya existían` : ''}.`);
  }

  return (
    <Modal open={open} onClose={onClose} title="Cuenta">
      <div className="card">
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>CONECTADA COMO</div>
        <div style={{ fontWeight: 700 }}>{st.user?.email}</div>
        <div style={{ fontSize: 13, marginTop: 8 }}>
          {!st.online
            ? '📴 Sin conexión. Puedes seguir vendiendo: los cambios se suben solos al volver el internet.'
            : st.pending
              ? '⏳ Subiendo cambios…'
              : '✅ Todo sincronizado con tu equipo.'}
        </div>
      </div>
      {local && (
        <div className="card" style={{ background: 'var(--yellow-bg)', borderColor: 'transparent' }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            Este celular tiene datos de antes de conectar la nube: {local.productos} productos,{' '}
            {local.ventas} ventas y {local.movimientos} movimientos.
          </div>
          <button className="btn full small" onClick={subir}>⬆ Subir a la nube</button>
        </div>
      )}
      <button className="btn full secondary" onClick={() => { logout(); onClose(); }}>Cerrar sesión</button>
    </Modal>
  );
}
