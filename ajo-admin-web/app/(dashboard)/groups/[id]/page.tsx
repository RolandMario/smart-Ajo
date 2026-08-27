import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { ServiceFeeEditor } from "@/components/service-fee-editor";
import { AutoCollectToggle } from "@/components/auto-collect-toggle";
import { getGroupDetail, updateGroupAutoCollect, updateServiceFee } from "@/lib/data/groups";
import type { PlatformGroupDetail } from "@/lib/types/api";
import { ApiError } from "@/lib/api/api-error";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  cycleStatusTone,
  groupStatusLabel,
  groupStatusTone,
  inviteStatusTone,
  payoutStatusTone,
  transferStatusTone,
} from "@/lib/status-display";

interface GroupDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id } = await params;

  let group: PlatformGroupDetail;
  try {
    group = await getGroupDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      notFound();
    }
    throw error;
  }

  async function handleToggleAutoCollect(enabled: boolean) {
    "use server";
    await updateGroupAutoCollect(group.id, enabled);
  }

  async function handleUpdateServiceFee(updateGroupId: string, fee: number) {
    "use server";
    await updateServiceFee(updateGroupId, fee);
  }

  return (
    <>
      <PageHeader
        title={group.name}
        description={
          <Link href="/groups" className="text-accent hover:underline">
            ← Back to Groups
          </Link>
        }
        actions={
          <Badge tone={groupStatusTone(group.status)}>{groupStatusLabel(group.status)}</Badge>
        }
      />

      <div className="p-8 space-y-6 max-w-5xl">
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">Settings</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat
              label="Contribution amount"
              value={
                <span className="font-mono">{formatCurrency(group.contributionAmount)}</span>
              }
            />
            <Stat label="Frequency" value={<span className="capitalize">{group.frequency}</span>} />
            <Stat label="Total slots" value={group.totalSlots} />
            <Stat
              label="Rotation method"
              value={<span className="capitalize">{group.rotationMethod}</span>}
            />
            <Stat
              label="Auto-collect"
              value={
                <AutoCollectToggle
                  enabled={group.autoCollectEnabled}
                  onToggle={handleToggleAutoCollect}
                />
              }
            />
            <Stat label="Current cycle" value={group.currentCycleNumber ?? "—"} />
            <Stat
              label="Group admin"
              value={
                group.admin ? (
                  <Link
                    href={`/users/${group.admin.id}`}
                    className="text-ink hover:text-accent font-medium"
                  >
                    {group.admin.name ?? group.admin.phone}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Stat label="Created" value={formatDate(group.createdAt)} />
            <Stat
              label="Service fee"
              value={
                <ServiceFeeEditor
                  groupId={group.id}
                  currentFee={group.serviceFee}
                  onUpdate={handleUpdateServiceFee}
                />
              }
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">Central wallet</h2>
          <Stat
            label="Pooled balance"
            value={
              <span className="font-mono text-base">
                {formatCurrency(group.centralWalletBalance)}
              </span>
            }
          />
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">
            Members ({group.members.length})
          </h2>

          {group.members.length === 0 ? (
            <p className="text-sm text-ink-soft">No members yet.</p>
          ) : (
            <div className="-mx-6 -mb-6 overflow-hidden border-t border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Invite</th>
                    <th className="px-6 py-3 font-medium">Position</th>
                    <th className="px-6 py-3 font-medium">Payout</th>
                    <th className="px-6 py-3 font-medium">Defaults</th>
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((m) => (
                    <tr key={m.groupMemberId} className="border-b border-line last:border-0">
                      <td className="px-6 py-3">
                        <Link
                          href={`/users/${m.user.id}`}
                          className="font-medium text-ink hover:text-accent"
                        >
                          {m.user.name ?? m.user.phone}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-ink-soft">
                        {m.isGroupAdmin ? "Admin" : "Member"}
                      </td>
                      <td className="px-6 py-3">
                        <Badge tone={inviteStatusTone(m.inviteStatus)}>{m.inviteStatus}</Badge>
                      </td>
                      <td className="px-6 py-3 text-ink-soft">{m.position ?? "—"}</td>
                      <td className="px-6 py-3">
                        <Badge tone={payoutStatusTone(m.payoutStatus)}>{m.payoutStatus}</Badge>
                      </td>
                      <td className="px-6 py-3 text-ink-soft">
                        {m.defaultCount > 0 ? (
                          <span className="text-danger font-medium">{m.defaultCount}</span>
                        ) : (
                          "0"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">
            Cycle history ({group.cycles.length})
          </h2>

          {group.cycles.length === 0 ? (
            <p className="text-sm text-ink-soft">
              This group hasn't been activated yet — no cycles exist.
            </p>
          ) : (
            <div className="-mx-6 -mb-6 overflow-hidden border-t border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-6 py-3 font-medium">Cycle</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Due date</th>
                    <th className="px-6 py-3 font-medium">Paid</th>
                    <th className="px-6 py-3 font-medium">Defaulted</th>
                    <th className="px-6 py-3 font-medium">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {group.cycles.map((c) => (
                    <tr key={c.cycleId} className="border-b border-line last:border-0">
                      <td className="px-6 py-3 font-medium text-ink">#{c.cycleNumber}</td>
                      <td className="px-6 py-3">
                        <Badge tone={cycleStatusTone(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="px-6 py-3 text-ink-soft">{formatDate(c.dueDate)}</td>
                      <td className="px-6 py-3 text-success font-medium">
                        {c.paidCount}/{c.totalSlots}
                      </td>
                      <td className="px-6 py-3">
                        {c.defaultedCount > 0 ? (
                          <span className="text-danger font-medium">{c.defaultedCount}</span>
                        ) : (
                          <span className="text-ink-soft">0</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-ink-soft">{c.pendingCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">
            Payout history ({group.payouts.length})
          </h2>

          {group.payouts.length === 0 ? (
            <p className="text-sm text-ink-soft">No payouts attempted yet.</p>
          ) : (
            <div className="-mx-6 -mb-6 overflow-hidden border-t border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-6 py-3 font-medium">Cycle</th>
                    <th className="px-6 py-3 font-medium">Recipient</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Failure reason</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {group.payouts.map((p) => (
                    <tr key={p.payoutId} className="border-b border-line last:border-0">
                      <td className="px-6 py-3 font-medium text-ink">#{p.cycleNumber}</td>
                      <td className="px-6 py-3">
                        <Link
                          href={`/users/${p.recipient.id}`}
                          className="text-ink hover:text-accent"
                        >
                          {p.recipient.name ?? p.recipient.phone}
                        </Link>
                      </td>
                      <td className="px-6 py-3 font-mono text-ink-soft">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-6 py-3">
                        <Badge tone={transferStatusTone(p.status)}>{p.status}</Badge>
                      </td>
                      <td className="px-6 py-3 text-ink-soft text-xs max-w-xs truncate">
                        {p.failureReason ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-ink-soft">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
