import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Aperçu empilé des premières cartes d'un deck ou d'une catégorie. */
export function ThumbStack({
  urls,
  size = 24,
  ringClassName = 'ring-bg',
}: {
  urls: readonly string[];
  size?: number;
  ringClassName?: string;
}) {
  if (urls.length === 0) {
    return (
      <span
        style={{ width: size, height: size }}
        className="grid shrink-0 place-items-center rounded-[5px] border border-dashed border-line-strong text-subtle"
      >
        <ImageOff className="size-3" aria-hidden />
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {urls.slice(0, 4).map((url, index) => (
        <img
          key={`${index}:${url}`}
          src={url}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          style={{ width: size, height: size }}
          className={cn('rounded-[5px] bg-elevated object-cover ring-2', ringClassName, index > 0 && '-ml-2')}
        />
      ))}
    </span>
  );
}
