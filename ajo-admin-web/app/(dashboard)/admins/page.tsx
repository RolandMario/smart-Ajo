import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listAdmins } from "@/lib/data/admins";
import { getSessionUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { CreateAdminForm } from "./create-admin-form";
import { AdminActiveToggle } from "./admin-active-toggle";

export default async function AdminsPage() {
  const [admins, currentUser] = await Promise.all([listAdmins(), getSessionUser()]);

  return (
    <>
      <PageHeader
        title="Admin Management"
        description="Platform admins who can sign in to this console. There's no super-admin tier — any admin can create or deactivate another."
      />

      <div className="p-8 space-y-6 max-w-4xl">
        <CreateAdminForm />

        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="font-display text-lg font-semibold text-ink">
              All admins ({admins.length})
            </h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-line last:border-0">
                  <td className="px-6 py-3 font-medium text-ink">{admin.name ?? "—"}</td>
                  <td className="px-6 py-3 text-ink-soft">{admin.email}</td>
                  <td className="px-6 py-3 font-mono text-ink-soft">{admin.phone}</td>
                  <td className="px-6 py-3">
                    {admin.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="danger">Deactivated</Badge>
                    )}
                  </td>
                  <td className="px-6 py-3 text-ink-soft">{formatDate(admin.createdAt)}</td>
                  <td className="px-6 py-3">
                    <AdminActiveToggle
                      adminId={admin.id}
                      isActive={admin.isActive}
                      isSelf={admin.id === currentUser?.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
