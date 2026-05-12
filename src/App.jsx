import { useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import Inventory from './views/Inventory.jsx';
import Scanner from './views/Scanner.jsx';
import Transactions from './views/Transactions.jsx';
import QRGenerator from './views/QRGenerator.jsx';
import { ensureSeed, useReset } from './store.js';

export default function App() {
  const location = useLocation();
  const reset = useReset();

  useEffect(() => {
    ensureSeed();
  }, []);

  const titles = {
    '/inventario': 'Inventario',
    '/escaner': 'Escáner QR',
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
          <button onClick={reset} title="Restaurar datos">Reset</button>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/inventario" replace />} />
          <Route path="/inventario" element={<Inventory />} />
          <Route path="/escaner" element={<Scanner />} />
          <Route path="/transacciones" element={<Transactions />} />
          <Route path="/qr" element={<QRGenerator />} />
          <Route path="*" element={<Navigate to="/inventario" replace />} />
        </Routes>
      </main>

      <nav className="bottom-nav no-print">
        <NavLink to="/inventario" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ico">📦</span>
          <span>Inventario</span>
        </NavLink>
        <NavLink to="/escaner" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="ico">📷</span>
          <span>Escáner</span>
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
