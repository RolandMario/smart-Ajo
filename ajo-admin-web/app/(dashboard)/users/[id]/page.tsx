import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { getUserDetail } from "@/lib/data/users";
import { ApiError } from "@/lib/api/api-error";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  groupStatusLabel,
  groupStatusTone,
  inviteStatusTone,
  payoutStatusTone,
} from "@/lib/status-display";

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params;

  let user;
  try {
    user = await getUserDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      notFound();
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title={user.name ?? user.phone}
        description={
          <Link href="/users" className="text-accent hover:underline">
            ← Back to Users
          </Link>
        }
        actions={
          user.role === "platform_admin" ? (
            <Badge tone="accent">Platform admin</Badge>
          ) : (
            <Badge tone="neutral">Member</Badge>
          )
        }
      />

      <div className="p-8 space-y-6 max-w-4xl">
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">Profile</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat label="Phone" value={<span className="font-mono">{user.phone}</span>} />
            <Stat label="Email" value={user.email ?? "—"} />
            <Stat
              label="Phone verified"
              value={
                user.isPhoneVerified ? (
                  <Badge tone="success">Verified</Badge>
                ) : (
                  <Badge tone="warning">Unverified</Badge>
                )
              }
            />
            <Stat
              label="Account status"
              value={
                user.isActive ? (
                  <Badge tone="success">Active</Badge>
                ) : (
                  <Badge tone="danger">Deactivated</Badge>
                )
              }
            />
            <Stat label="Joined" value={formatDate(user.createdAt)} />
            <Stat label="Last updated" value={formatDate(user.updatedAt)} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">Wallet & payout</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat
              label="Wallet balance"
              value={
                <span className="font-mono text-base">
                  {formatCurrency(user.wallet.balance, user.wallet.currency)}
                </span>
              }
            />
            <Stat
              label="Bank account"
              value={
                user.bankAccount ? (
                  <span>
                    {user.bankAccount.bankName} · {user.bankAccount.accountNumber}
                  </span>
                ) : (
                  <Badge tone="neutral">Not set</Badge>
                )
              }
            />
            {user.bankAccount && (
              <Stat label="Account name" value={user.bankAccount.accountName} />
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-ink mb-4">
            Groups ({user.groups.length})
          </h2>

          {user.groups.length === 0 ? (
            <p className="text-sm text-ink-soft">Not a member of any group yet.</p>
          ) : (
            <div className="-mx-6 -mb-6 overflow-hidden border-t border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-6 py-3 font-medium">Group</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Invite</th>
                    <th className="px-6 py-3 font-medium">Position</th>
                    <th className="px-6 py-3 font-medium">Payout</th>
                    <th className="px-6 py-3 font-medium">Defaults</th>
                  </tr>
                </thead>
                <tbody>
                  {user.groups.map((g) => (
                    <tr key={g.groupId} className="border-b border-line last:border-0">
                      <td className="px-6 py-3">
                        <Link
                          href={`/groups/${g.groupId}`}
                          className="font-medium text-ink hover:text-accent"
                        >
                          {g.groupName}
                        </Link>
                      </td>
                      <td className="px-6 py-3">
                        <Badge tone={groupStatusTone(g.groupStatus)}>
                          {groupStatusLabel(g.groupStatus)}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-ink-soft">
                        {g.isGroupAdmin ? "Admin" : "Member"}
                      </td>
                      <td className="px-6 py-3">
                        <Badge tone={inviteStatusTone(g.inviteStatus)}>{g.inviteStatus}</Badge>
                      </td>
                      <td className="px-6 py-3 text-ink-soft">{g.position ?? "—"}</td>
                      <td className="px-6 py-3">
                        <Badge tone={payoutStatusTone(g.payoutStatus)}>{g.payoutStatus}</Badge>
                      </td>
                      <td className="px-6 py-3 text-ink-soft">
                        {g.defaultCount > 0 ? (
                          <span className="text-danger font-medium">{g.defaultCount}</span>
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
      </div>
    </>
  );
}
