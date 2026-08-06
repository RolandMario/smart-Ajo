import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { listGroups } from "@/lib/data/groups";
import { formatCurrency, formatDate } from "@/lib/format";
import { groupStatusLabel, groupStatusTone } from "@/lib/status-display";
import type { GroupStatus } from "@/lib/types/api";

const STATUS_FILTERS: { value: GroupStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "open_for_invites", label: "Open for invites" },
  { value: "order_locked", label: "Order locked" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

interface GroupsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const status = STATUS_FILTERS.some((f) => f.value === params.status)
    ? (params.status as GroupStatus | undefined)
    : undefined;

  const { groups, total, totalPages } = await listGroups({
    search: params.search,
    status,
    page,
    limit: 20,
  });

  function buildHref(targetPage: number) {
    const next = new URLSearchParams();
    if (params.search) next.set("search", params.search);
    if (params.status) next.set("status", params.status);
    next.set("page", String(targetPage));
    return `/groups?${next.toString()}`;
  }

  function buildStatusHref(statusValue: string) {
    const next = new URLSearchParams();
    if (params.search) next.set("search", params.search);
    if (statusValue) next.set("status", statusValue);
    return `/groups?${next.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="Groups"
        description="Every Ajo group, its rotation, and its cycle history."
        actions={<SearchInput placeholder="Search by group name" />}
      />

      <div className="p-8 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((filter) => {
            const isActive = (params.status ?? "") === filter.value;
            return (
              <Link
                key={filter.value || "all"}
                href={buildStatusHref(filter.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-ink text-white"
                    : "bg-surface text-ink-soft border border-line hover:bg-canvas"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {groups.length === 0 ? (
          <EmptyState
            title={params.search ? "No matching groups" : "No groups yet"}
            description={
              params.search
                ? `Nothing matches "${params.search}". Try a different group name.`
                : "Once members create Ajo groups on the mobile app, they'll show up here."
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Contribution</th>
                  <th className="px-5 py-3 font-medium">Frequency</th>
                  <th className="px-5 py-3 font-medium">Slots</th>
                  <th className="px-5 py-3 font-medium">Current cycle</th>
                  <th className="px-5 py-3 font-medium">Auto-collect</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr
                    key={group.id}
                    className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/groups/${group.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {group.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={groupStatusTone(group.status)}>
                        {groupStatusLabel(group.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-mono text-ink-soft">
                      {formatCurrency(group.contributionAmount)}
                    </td>
                    <td className="px-5 py-3 text-ink-soft capitalize">{group.frequency}</td>
                    <td className="px-5 py-3 text-ink-soft">{group.totalSlots}</td>
                    <td className="px-5 py-3 text-ink-soft">
                      {group.currentCycleNumber ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {group.autoCollectEnabled ? (
                        <Badge tone="success">On</Badge>
                      ) : (
                        <Badge tone="neutral">Off</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">{formatDate(group.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {groups.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
        )}
      </div>
    </>
  );
}
