import { Toaster, toast } from 'sonner';

export function ToastProvider({ children }) {
  return (
    <>
      {children}
      <Toaster theme="system" position="top-center" richColors closeButton={false} toastOptions={{ className: 'font-sans' }} />
    </>
  );
}

export function useToast() {
  return (msg) => toast.success(msg);
}
