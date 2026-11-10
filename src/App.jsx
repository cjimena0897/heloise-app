import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import Inventory from './views/Inventory.jsx';
import Scanner from './views/Scanner.jsx';
import Transactions from './views/Transactions.jsx';
import QRGenerator from './views/QRGenerator.jsx';
import Sales from './views/Sales.jsx';
import CartBar from './components/Cart.jsx';
import { AccountModal, LoginScreen, SyncPill } from './components/Account.jsx';
import { logout, startSync, useReset, useStatus } from './store.js';

export default function App() {
  const location = useLocation();
  const reset = useReset();
  const status = useStatus();
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    startSync();
  }, []);

  if (status.mode === 'cloud') {
    if (!status.authReady) return <Splash text="Cargando…" />;
    if (!status.user) return <LoginScreen />;
    if (status.error) return <Splash text={status.error} action={<button className="btn full secondary" onClick={logout}>Cerrar sesión</button>} />;
    if (!status.loaded) return <Splash text="Sincronizando datos…" />;
  }

  const titles = {
    '/inventario': 'Inventario',
    '/escaner': 'Escáner',
    '/ventas': 'Ventas y cobranza',
    '/transacciones': 'Transacciones',
    '/qr': 'Códigos QR',
  };
  const title = titles[location.pathname] || 'AJVC';

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="brand">
          <div className="logo">AJ</div>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 500 }}>AJVC · K-beauty</div>
            <div>{title}</div>
          </div>
        </div>
        <div className="actions">
          {status.mode === 'local'
            ? <button onClick={reset} title="Borrar datos de este celular">Reset</button>
            : <SyncPill onClick={() => setAccountOpen(true)} />}
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/inventario" replace />} />
          <Route path="/inventario" element={<Inventory />} />
          <Route path="/escaner" element={<Scanner />} />
          <Route path="/ventas" element={<Sales />} />
          <Route path="/transacciones" element={<Transactions />} />
          <Route path="/qr" element={<QRGenerator />} />
          <Route path="*" element={<Navigate to="/inventario" replace />} />
        </Routes>
      </main>

      <CartBar />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />

      <nav className="bottom-nav no-print">
        <NavLink to="/inventario" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ico">📦</span>
          <span>Inventario</span>
        </NavLink>
        <NavLink to="/escaner" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ico">📷</span>
          <span>Escáner</span>
        </NavLink>
        <NavLink to="/ventas" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ico">💰</span>
          <span>Ventas</span>
        </NavLink>
        <NavLink to="/transacciones" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ico">🧾</span>
          <span>Movimientos</span>
        </NavLink>
        <NavLink to="/qr" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ico">🔳</span>
          <span>QR</span>
        </NavLink>
      </nav>
    </div>
  );
}

function Splash({ text, action }) {
  return (
    <div className="login">
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="logo big">AJ</div>
        <p>{text}</p>
        {action}
      </div>
    </div>
  );
}
