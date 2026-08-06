import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import type { AdminUser } from "@/lib/types/api";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/users", label: "Users" },
  { href: "/groups", label: "Groups" },
  { href: "/finance", label: "Finance" },
  { href: "/admins", label: "Admins" },
];

export function Sidebar({ user }: { user: AdminUser }) {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col bg-ink text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 27px, currentColor 27px, currentColor 28px)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col h-full">
        <div className="px-6 py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
            Platform Console
          </p>
          <h1 className="font-display text-2xl font-semibold mt-1">Ajo</h1>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium truncate">
              {user.name ?? user.email ?? user.phone}
            </p>
            <p className="text-xs text-white/50 truncate">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full text-left rounded-md px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
