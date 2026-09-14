import { cn } from '@/lib/cn';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-grid h-[18px] min-w-[18px] place-items-center rounded-[4px] border border-line-strong bg-white/[0.03] px-1 font-sans text-2xs leading-none text-subtle',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
