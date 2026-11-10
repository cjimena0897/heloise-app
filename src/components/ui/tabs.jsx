import { cn } from '@/lib/utils';

/** Control segmentado al estilo de Tabs de shadcn. options: [{ value, label }] */
export function SegmentedTabs({ value, onChange, options, className }) {
  return (
    <div role="tablist" className={cn('grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-muted-foreground transition-all',
            value === o.value && 'bg-card text-foreground shadow-sm'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
