import Link from "next/link";

const SECTIONS = [
  { href: "/bills", label: "Providers" },
  { href: "/bills/plans", label: "Plans" },
  { href: "/bills/transactions", label: "Transactions" },
] as const;

/** Sub-navigation shared by the three Bills console screens. */
export function BillsNav({ active }: { active: "providers" | "plans" | "transactions" }) {
  return (
    <nav className="flex items-center gap-1 border-b border-line bg-surface px-8">
      {SECTIONS.map((section) => {
        const activeHere =
          section.href === "/bills"
            ? active === "providers"
            : section.href === `/bills/${active}`;
        return (
          <Link
            key={section.href}
            href={section.href}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeHere
                ? "border-accent text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}