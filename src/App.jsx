import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeftRight, LoaderCircle, Package, QrCode, RotateCcw, ScanLine, Wallet } from 'lucide-react';
import Inventory from './views/Inventory.jsx';
import Scanner from './views/Scanner.jsx';
import Transactions from './views/Transactions.jsx';
import QRGenerator from './views/QRGenerator.jsx';
import Sales from './views/Sales.jsx';
import Import from './views/Import.jsx';
import CartBar from './components/Cart.jsx';
import { AccountModal, LoginScreen, SyncPill } from './components/Account.jsx';
import { Button } from './components/ui/button.jsx';
import { logout, startSync, useReset, useStatus } from './store.js';
import { cn } from './lib/utils.js';
import { Logo } from './components/Logo.jsx';

const NAV = [
  { to: '/inventario', label: 'Inventario', title: 'Inventario', icon: Package },
  { to: '/escaner', label: 'Escáner', title: 'Escáner', icon: ScanLine },
  { to: '/ventas', label: 'Ventas', title: 'Ventas y cobranza', icon: Wallet },
  { to: '/transacciones', label: 'Movimientos', title: 'Movimientos', icon: ArrowLeftRight },
  { to: '/qr', label: 'QR', title: 'Códigos QR', icon: QrCode },
];

export default function App() {
  const location = useLocation();
  const reset = useReset();
  const status = useStatus();
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    startSync();
  }, []);

  if (status.mode === 'cloud') {
    if (!status.authReady) return <Splash text="Cargando…" loading />;
    if (!status.user) return <LoginScreen />;
    if (status.error) {
      return (
        <Splash text={status.error}>
          <Button variant="outline" className="w-full" onClick={logout}>Cerrar sesión</Button>
        </Splash>
      );
    }
    if (!status.loaded) return <Splash text="Sincronizando datos…" loading />;
  }


  return (
    <div className="flex min-h-dvh flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] has-[[data-cart-bar]]:pb-[calc(9rem+env(safe-area-inset-bottom))] print:p-0">
      <header className="pt-safe sticky top-0 z-30 border-b bg-background/80 backdrop-blur-lg print:hidden">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <div className="min-w-0 leading-tight">
              <div className="font-semibold tracking-tight">AJVC</div>
              <div className="text-xs text-muted-foreground">K-beauty</div>
            </div>
          </div>
          {status.mode === 'local' ? (
            <Button variant="ghost" size="sm" onClick={reset} title="Borrar datos de este celular">
              <RotateCcw /> Reset
            </Button>
          ) : (
            <SyncPill onClick={() => setAccountOpen(true)} />
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 print:max-w-none print:p-0">
        <Routes>
          <Route path="/" element={<Navigate to="/inventario" replace />} />
          <Route path="/inventario" element={<Inventory />} />
          <Route path="/escaner" element={<Scanner />} />
          <Route path="/ventas" element={<Sales />} />
          <Route path="/importar" element={<Import />} />
          <Route path="/transacciones" element={<Transactions />} />
          <Route path="/qr" element={<QRGenerator />} />
          <Route path="*" element={<Navigate to="/inventario" replace />} />
        </Routes>
      </main>

      <CartBar />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 backdrop-blur-lg print:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'group flex flex-col items-center gap-1 pt-2 pb-2 text-[11px] font-medium text-muted-foreground transition-colors',
                  isActive && 'text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-brand/40 dark:bg-brand/20')}>
                    <Icon className="size-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Splash({ text, loading, children }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <Logo className="size-14 rounded-2xl text-xl" />
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {loading && <LoaderCircle className="size-4 animate-spin" />}
          {text}
        </p>
        {children}
      </div>
    </div>
  );
}
