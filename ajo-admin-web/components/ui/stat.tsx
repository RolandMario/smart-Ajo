export function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">{label}</p>
      <div className="text-sm text-ink">{value}</div>
    </div>
  );
}
