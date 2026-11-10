import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Sheet } from './sheet.jsx';
import { cn } from '@/lib/utils';

/** Fila de píldoras que se desliza de lado (filtros rápidos). */
export function ChipRow({ className, children }) {
  return (
    <div className={cn('-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children, className, count, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors active:scale-[0.97]',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent',
        className
      )}
      {...props}
    >
      {children}
      {count != null && (
        <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-primary-foreground/15' : 'bg-muted text-muted-foreground')}>
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Píldora que abre una hoja con opciones (reemplaza al <select> nativo).
 * options: [{ value, label, hint? }]; value '' = todas.
 */
export function ChipSelect({ value, onChange, options, allLabel, title, className }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Chip active={!!value} onClick={() => setOpen(true)} className={className}>
        <span className="max-w-40 truncate">{current ? current.label : allLabel}</span>
        <ChevronDown className="size-4 opacity-70" />
      </Chip>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="-mx-2 flex flex-col">
          {[{ value: '', label: allLabel }, ...options].map((o) => (
            <button
              key={o.value || '__all'}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent"
            >
              <span className={cn('truncate', o.value === value && 'font-semibold')}>{o.label}</span>
              <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                {o.hint}
                {o.value === value && <Check className="size-4 text-foreground" />}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/** Opciones mutuamente excluyentes como píldoras que envuelven (p. ej. método de pago). */
export function ChoiceChips({ value, onChange, options, className }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="radiogroup">
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => onChange(o)} role="radio" aria-checked={value === o}>
          {o}
        </Chip>
      ))}
    </div>
  );
}
