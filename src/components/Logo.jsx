import { cn } from '../lib/utils.js';

export function Logo({ className }) {
  return (
    <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg bg-[oklch(0.27_0.08_262)] text-[13px] font-bold tracking-tight text-brand shadow-sm ring-1 ring-white/10', className)}>
      AJ
    </div>
  );
}
