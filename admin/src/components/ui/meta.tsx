export function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}
