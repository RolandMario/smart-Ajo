export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-24">
      <h2 className="font-display text-xl font-semibold text-ink mb-2">{title}</h2>
      <p className="text-sm text-ink-soft max-w-md">{description}</p>
    </div>
  );
}
