export function Logo({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.58) }}
      className="inline-grid shrink-0 place-items-center rounded-[28%] bg-gradient-to-b from-[#7b85e8] to-accent font-semibold leading-none text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
    >
      ?
    </span>
  );
}
