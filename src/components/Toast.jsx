import { createContext, useCallback, useContext, useState } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const show = useCallback((m) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx) || (() => {});
}
