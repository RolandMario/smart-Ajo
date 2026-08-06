import Link from "next/link";

export function Tabs({
  tabs,
  activeValue,
  buildHref,
}: {
  tabs: { value: string; label: string }[];
  activeValue: string;
  buildHref: (value: string) => string;
}) {
  return (
    <div className="flex gap-1 border-b border-line px-8">
      {tabs.map((tab) => {
        const isActive = tab.value === activeValue;
        return (
          <Link
            key={tab.value}
            href={buildHref(tab.value)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-accent text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
