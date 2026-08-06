import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — Ajo Admin",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left: brand panel. The ledger-line texture is the one
          decorative flourish in this app — everything else stays
          quiet and functional. */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between bg-ink text-white p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent, transparent 27px, currentColor 27px, currentColor 28px)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/50">
            Platform Console
          </p>
          <h1 className="font-display text-4xl font-semibold mt-3 leading-tight">
            Ajo
          </h1>
        </div>
        <div className="relative z-10 max-w-sm">
          <p className="text-white/70 text-sm leading-relaxed">
            Every contribution, payout, and group recorded in one ledger —
            this console is where you watch it all stay in balance.
          </p>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-canvas">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-soft">
              Platform Console
            </p>
            <h1 className="font-display text-3xl font-semibold text-ink mt-2">
              Ajo
            </h1>
          </div>

          <h2 className="font-display text-2xl font-semibold text-ink mb-1">
            Sign in
          </h2>
          <p className="text-sm text-ink-soft mb-8">
            Platform admin access only.
          </p>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
