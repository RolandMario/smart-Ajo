import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { listUsers } from "@/lib/data/users";
import { formatDate } from "@/lib/format";

interface UsersPageProps {
  searchParams: Promise<{
    search?: string;
    role?: string;
    page?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const role = params.role === "platform_admin" ? "platform_admin" : undefined;

  const { users, total, totalPages } = await listUsers({
    search: params.search,
    role,
    page,
    limit: 20,
  });

  function buildHref(targetPage: number) {
    const next = new URLSearchParams();
    if (params.search) next.set("search", params.search);
    if (params.role) next.set("role", params.role);
    next.set("page", String(targetPage));
    return `/users?${next.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Every registered member across the platform."
        actions={<SearchInput placeholder="Search name, phone, or email" />}
      />

      <div className="p-8 space-y-4">
        {users.length === 0 ? (
          <EmptyState
            title={params.search ? "No matching users" : "No users yet"}
            description={
              params.search
                ? `Nothing matches "${params.search}". Try a different name, phone number, or email.`
                : "Once members register on the mobile app, they'll show up here."
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Verified</th>
                  <th className="px-5 py-3 font-medium">Bank account</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/users/${user.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {user.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-ink-soft">{user.phone}</td>
                    <td className="px-5 py-3 text-ink-soft">{user.email ?? "—"}</td>
                    <td className="px-5 py-3">
                      {user.role === "platform_admin" ? (
                        <Badge tone="accent">Platform admin</Badge>
                      ) : (
                        <Badge tone="neutral">Member</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {user.isPhoneVerified ? (
                        <Badge tone="success">Phone</Badge>
                      ) : (
                        <Badge tone="warning">Unverified</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {user.hasBankAccount ? (
                        <Badge tone="success">On file</Badge>
                      ) : (
                        <Badge tone="neutral">Not set</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {users.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
        )}
      </div>
    </>
  );
}
