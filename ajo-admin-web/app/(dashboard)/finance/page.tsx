import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { Stat } from "@/components/ui/stat";
import { Button } from "@/components/ui/button";
import { listWalletTransactions, listPayouts, listGroupWalletTransactions, listServiceFeeTransactions, getAdminWallet, listAdminBanks } from "@/lib/data/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  walletTxStatusTone,
  walletTxTypeLabel,
  transferStatusTone,
  groupWalletTxTypeLabel,
  groupWalletTxTone,
} from "@/lib/status-display";
import type { GroupWalletTransactionType } from "@/lib/types/api";
import { AdminWalletForms, BillCommissionCreditsTable } from "./admin-wallet-form";

const TABS = [
  { value: "fundings", label: "Wallet Fundings" },
  { value: "payouts", label: "Payouts" },
  { value: "ledger", label: "Group Wallet Ledger" },
  { value: "service-fees", label: "Service Fees" },
  { value: "admin-wallet", label: "Admin Wallet" },
];

interface FinancePageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
  }>;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const params = await searchParams;
  const tab = TABS.some((t) => t.value === params.tab) ? params.tab! : "fundings";
  const page = params.page ? parseInt(params.page, 10) : 1;

  function buildTabHref(value: string) {
    return `/finance?tab=${value}`;
  }

  function buildPageHref(targetPage: number) {
    return `/finance?tab=${tab}&page=${targetPage}`;
  }

  return (
    <>
      <PageHeader
        title="Financial Oversight"
        description="Wallet fundings, payouts, and group wallet movements across the platform."
      />

      <Tabs tabs={TABS} activeValue={tab} buildHref={buildTabHref} />

      <div className="p-8 space-y-4">
        {tab === "fundings" && (
          <FundingsTab page={page} buildHref={buildPageHref} />
        )}
        {tab === "payouts" && <PayoutsTab page={page} buildHref={buildPageHref} />}
        {tab === "ledger" && <LedgerTab page={page} buildHref={buildPageHref} />}
        {tab === "service-fees" && (
          <ServiceFeesTab page={page} buildHref={buildPageHref} />
        )}
        {tab === "admin-wallet" && <AdminWalletTab />}
      </div>
    </>
  );
}

async function FundingsTab({
  page,
  buildHref,
}: {
  page: number;
  buildHref: (page: number) => string;
}) {
  const { transactions, total, totalPages } = await listWalletTransactions({ page, limit: 20 });

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No wallet fundings yet"
        description="Once members top up their wallets via Paystack, those transactions will show up here."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Balance after</th>
              <th className="px-5 py-3 font-medium">Reference</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/users/${tx.user.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {tx.user.name ?? tx.user.phone}
                  </Link>
                </td>
                <td className="px-5 py-3 text-ink-soft">{walletTxTypeLabel(tx.type)}</td>
                <td className="px-5 py-3">
                  <Badge tone={walletTxStatusTone(tx.status)}>{tx.status}</Badge>
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.amount)}
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.balanceAfter)}
                </td>
                <td className="px-5 py-3 text-ink-soft text-xs font-mono">{tx.reference}</td>
                <td className="px-5 py-3 text-ink-soft">{formatDate(tx.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
    </>
  );
}

async function PayoutsTab({
  page,
  buildHref,
}: {
  page: number;
  buildHref: (page: number) => string;
}) {
  const { payouts, total, totalPages } = await listPayouts({ page, limit: 20 });

  if (payouts.length === 0) {
    return (
      <EmptyState
        title="No payouts yet"
        description="Once a group admin initiates a payout, every attempt (including failures) will show up here."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-medium">Group</th>
              <th className="px-5 py-3 font-medium">Cycle</th>
              <th className="px-5 py-3 font-medium">Recipient</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Failure reason</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr
                key={p.id}
                className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/groups/${p.group.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {p.group.name}
                  </Link>
                </td>
                <td className="px-5 py-3 text-ink-soft">#{p.cycleNumber}</td>
                <td className="px-5 py-3">
                  <Link
                    href={`/users/${p.recipient.id}`}
                    className="text-ink hover:text-accent"
                  >
                    {p.recipient.name ?? p.recipient.phone}
                  </Link>
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(p.amount)}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={transferStatusTone(p.status)}>{p.status}</Badge>
                </td>
                <td className="px-5 py-3 text-ink-soft text-xs max-w-xs truncate">
                  {p.failureReason ?? "—"}
                </td>
                <td className="px-5 py-3 text-ink-soft">{formatDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
    </>
  );
}

async function ServiceFeesTab({
  page,
  buildHref,
}: {
  page: number;
  buildHref: (page: number) => string;
}) {
  const { transactions, total, totalPages } = await listServiceFeeTransactions({
    page,
    limit: 20,
  });

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No service fee transactions yet"
        description="Service fees collected from contributions will show up here."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-medium">Group</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Balance after</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/groups/${tx.group.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {tx.group.name}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={groupWalletTxTone(tx.type)}>
                    {groupWalletTxTypeLabel(tx.type)}
                  </Badge>
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.amount)}
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.balanceAfter)}
                </td>
                <td className="px-5 py-3 text-ink-soft">{formatDate(tx.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
    </>
  );
}

async function LedgerTab({
  page,
  buildHref,
}: {
  page: number;
  buildHref: (page: number) => string;
}) {
  const { transactions, total, totalPages } = await listGroupWalletTransactions({
    page,
    limit: 20,
  });

  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No group wallet movements yet"
        description="Contribution credits, payout debits, and reversal credits across every group's central account will show up here."
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-medium">Group</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Balance after</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/groups/${tx.group.id}`}
                    className="font-medium text-ink hover:text-accent"
                  >
                    {tx.group.name}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={groupWalletTxTone(tx.type)}>
                    {groupWalletTxTypeLabel(tx.type)}
                  </Badge>
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.amount)}
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.balanceAfter)}
                </td>
                <td className="px-5 py-3 text-ink-soft">{formatDate(tx.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
    </>
  );
}

async function AdminWalletTab() {
  const [wallet, banks] = await Promise.all([
    getAdminWallet(),
    listAdminBanks(),
  ]);

  return (
    <div className="space-y-6">
      <AdminWalletForms wallet={wallet} banks={banks} />

      {/* Recent bill commission credits */}
      <BillCommissionCreditsTable credits={wallet.recentBillCommissionCredits} />

      {/* Recent service fee credits */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-line">
          <h3 className="text-sm font-medium text-ink">Recent Service Fee Credits</h3>
        </div>
        {wallet.recentServiceFeeCredits.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No service fee credits yet"
              description="Service fees collected from group contributions will appear here."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3 font-medium">Group</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Balance after</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {wallet.recentServiceFeeCredits.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
                >
                  <td className="px-5 py-3">
                    {tx.group ? (
                      <Link
                        href={`/groups/${tx.group.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {tx.group.name}
                      </Link>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-ink-soft">
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="px-5 py-3 font-mono text-ink-soft">
                    {formatCurrency(tx.balanceAfter)}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{formatDate(tx.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
