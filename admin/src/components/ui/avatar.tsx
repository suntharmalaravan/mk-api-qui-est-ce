import { cn } from '@/lib/cn';

function hue(seed: string) {
  let value = 0;
  for (let index = 0; index < seed.length; index++) value = (value * 31 + seed.charCodeAt(index)) % 360;
  return value;
}

export function Avatar({
  name,
  src,
  size = 20,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        style={box}
        className={cn('shrink-0 rounded-full bg-elevated object-cover', className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ ...box, fontSize: Math.round(size * 0.46), backgroundColor: `oklch(0.42 0.07 ${hue(name)})` }}
      className={cn('inline-grid shrink-0 select-none place-items-center rounded-full font-medium text-white/90', className)}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
