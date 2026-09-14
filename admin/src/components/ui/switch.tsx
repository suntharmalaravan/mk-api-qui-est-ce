'use client';

import { cn } from '@/lib/cn';

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-[18px] w-[30px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-white/[0.14] hover:bg-white/20',
      )}
    >
      <span
        className={cn(
          'size-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out',
          checked ? 'translate-x-[14px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  );
}
