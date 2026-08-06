import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

const QUICK_LINKS = [
  {
    href: "/users",
    label: "Users",
    description: "Search every registered member, their groups, and wallet status.",
  },
  {
    href: "/groups",
    label: "Groups",
    description: "Every Ajo group, its rotation order, cycle history, and health.",
  },
  {
    href: "/finance",
    label: "Finance",
    description: "Wallet fundings, payouts, and group wallet movements platform-wide.",
  },
  {
    href: "/admins",
    label: "Admins",
    description: "Create and manage other platform admin accounts.",
  },
];

export default async function OverviewPage() {
  const user = await getSessionUser();

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Signed in as ${user?.name ?? user?.email ?? user?.phone}`}
      />

      <div className="p-8 space-y-6">
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-2">
            Welcome to the Ajo platform console
          </h2>
          <p className="text-sm text-ink-soft leading-relaxed max-w-2xl">
            This console gives platform staff visibility into every group,
            user, and money movement across Ajo.
          </p>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="p-5 h-full hover:border-accent transition-colors">
                <h3 className="font-display text-base font-semibold text-ink mb-1.5">
                  {link.label}
                </h3>
                <p className="text-sm text-ink-soft leading-relaxed">{link.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
