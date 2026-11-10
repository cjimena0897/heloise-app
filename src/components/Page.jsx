import { cn } from '../lib/utils.js';

export function PageHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex items-end justify-between gap-3 print:hidden', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
      {Icon && (
        <div className="mb-1 grid size-11 place-items-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-xs text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
