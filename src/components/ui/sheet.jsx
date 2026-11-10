import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Hoja inferior en el celular, diálogo centrado en pantallas grandes.
 * Mantiene la API anterior de <Modal open title onClose>.
 */
export function Sheet({ open, onClose, title, description, children, className }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <DialogPrimitive.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-popover text-popover-foreground shadow-xl outline-none',
            'inset-x-0 bottom-0 rounded-t-2xl border-t data-[state=open]:animate-[sheet-up_220ms_cubic-bezier(0.32,0.72,0,1)]',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:data-[state=open]:animate-[fade-in_150ms_ease-out]',
            className
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" />
          <div className="flex items-start justify-between gap-4 px-5 pt-3 pb-2 sm:pt-5">
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-lg font-semibold leading-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="-mr-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-5 pt-1 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
