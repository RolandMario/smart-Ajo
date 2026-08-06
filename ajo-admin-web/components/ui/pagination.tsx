import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  total,
  buildHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-sm text-ink-soft px-1">
        {total} {total === 1 ? "result" : "results"}
      </p>
    );
  }

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-sm text-ink-soft">
        Page {page} of {totalPages} · {total} {total === 1 ? "result" : "results"}
      </p>
      <div className="flex gap-2">
        <Link
          href={buildHref(page - 1)}
          aria-disabled={prevDisabled}
          tabIndex={prevDisabled ? -1 : undefined}
          className={`rounded-md border border-line px-3 py-1.5 text-sm transition-colors ${
            prevDisabled
              ? "pointer-events-none text-ink-soft/40"
              : "text-ink hover:bg-canvas"
          }`}
        >
          Previous
        </Link>
        <Link
          href={buildHref(page + 1)}
          aria-disabled={nextDisabled}
          tabIndex={nextDisabled ? -1 : undefined}
          className={`rounded-md border border-line px-3 py-1.5 text-sm transition-colors ${
            nextDisabled
              ? "pointer-events-none text-ink-soft/40"
              : "text-ink hover:bg-canvas"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
