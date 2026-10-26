# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a monorepo (no workspace tooling — each subproject is an independent npm project) containing four siblings:

| Directory | Stack | Role |
|-----------|-------|------|
| `ajo-server/` | NestJS 11 + Mongoose/MongoDB | Backend API |
| `ajo-mobile/` | Expo SDK 56 (React Native) | Member-facing iOS/Android app |
| `ajo-admin-web/` | Next.js 16 (App Router) | Internal `platform_admin` console |
| `digitalHoldings/` | Next.js 16 (App Router) | Marketing/landing site (Ajo's public-facing web presence, Tailwind v4 with custom `ajo-*` palette) |

Each subproject has its own `package.json`, `.env(.example)`, and lockfile — `cd` into one before running its scripts. Root `.gitignore` excludes every `node_modules`, `.next`, `dist`, `.env*`, etc. across the tree.

The platform product is **Ajo** (digital thrift/savings group / esusu). `ajo-server` is the source of truth; `ajo-mobile` and `ajo-admin-web` are read/write clients against it; `digitalHoldings` is a separate static-ish marketing site.

## Common commands

### `ajo-server/`
```bash
npm install
cp .env.example .env             # fill in MONGODB_URI, JWT_ACCESS_SECRET,
                                 # TERMII_API_KEY, PAYSTACK_SECRET_KEY,
                                 # FIREBASE_* (optional), VTPASS_*,
                                 # SEED_PLATFORM_ADMIN_*
npm run start:dev                # nest start --watch (default port 5010)

npm run build                    # nest build → dist/
npm run start:prod               # node dist/main
npm run lint                     # eslint --fix
npm run test                     # jest (unit tests under src/**/*.spec.ts)
npm run test:e2e                 # jest --config ./test/jest-e2e.json
npm run test:cov                 # jest --coverage
npm run test:watch               # jest --watch

# Seeds (one-shot scripts, run with ts-node)
npm run seed:platform-admin              # creates the first platform_admin user
npm run seed:fix-wallet-balances         # backfill helper
npm run seed:resolve-pending-payouts     # finalize PENDING cycle / savings / pool payouts in test mode
npm run seed:fix-savings-plan-durations  # backfill legacy savings plans missing durationUnit/durationValue
npm run seed:fix-savings-withdrawal-lock  # clear stale savings withdrawal locks left by a crash
npm run seed:purge-terminated-groups     # purge groups left behind by old terminate (dry run; -- --confirm deletes)
npm run seed:purge-terminated-pools      # purge pools left behind by old terminate (dry run; -- --confirm deletes)
```
`PAYSTACK_SECRET_KEY` and `POST /webhooks/paystack` are required for funding/payouts to resolve outside the manual `GET /wallet/fund/verify/:reference` fallback. Use [ngrok](https://ngrok.com) during local dev to receive webhooks. Dedicated Virtual Accounts (`GET /wallet/dedicated-account`, `PAYSTACK_DVA_PREFERRED_BANK`) must be enabled on the Paystack business — bank transfers into a member's virtual account arrive as `charge.success` webhooks and are matched to the user by the Paystack customer's phone.

### `ajo-mobile/`
```bash
npm install
cp .env.example .env             # set EXPO_PUBLIC_API_BASE_URL
npm start                        # expo start (Metro)
npm run android | npm run ios | npm run web
npm run lint                     # eslint (eslint-config-expo flat config)

# Verification beyond `npm run lint`:
npx tsc --noEmit                 # TypeScript clean
npx expo export --platform web   # full Metro bundle — surfaces import/wiring errors
```
In dev, OTP codes are logged by `ajo-server` to its console (`[DEV ONLY] OTP for +234...: 123456`) — no live Termii account needed.

### `ajo-admin-web/`
```bash
npm install
cp .env.example .env.local       # NEXT_PUBLIC_API_BASE_URL, SESSION_COOKIE_NAME
npm run dev                      # next dev
npm run build
npm run start
npm run lint                     # next eslint
```
Requires a `platform_admin` account on `ajo-server` (seeded via `npm run seed:platform-admin` there). `.env.local` changes require restarting `next dev` to take effect.

### `digitalHoldings/`
```bash
npm install
npm run dev                      # next dev (marketing site, no backend dependency)
npm run build
npm run start
npm run lint
```

## Architecture

### Backend (`ajo-server`) — NestJS + Mongoose

The app is a NestJS 11 monolith with `MongooseModule`, JWT auth (`@nestjs/jwt` + `passport-jwt`), class-validator DTOs, a global `ValidationPipe` (`whitelist`, `transform`, `forbidNonWhitelisted`), and two cron schedulers driven by `@nestjs/schedule` (contribution reminders + defaulter flagging). Savings plans and pool donations are **not** auto-debited — members pay each savings interval via `POST /savings/plans/:id/pay` and each pool donation via `POST /donations/groups/:id/donate`, surfaced in the mobile app's Savings and Pools tabs.

**Modules** (registered in `src/app.module.ts`):

- `auth/` — phone+OTP (mobile) and email+password (admin web) login flows; `JwtStrategy` re-fetches the user on every request so role/`isActive` changes take effect immediately. Guards: `JwtAuthGuard`, `PlatformAdminGuard` (under `src/common/guards/`).
- `users/` — `User` schema (phone-based identity, optional email, `role: user | platform_admin`, `isActive`, `bankAccount`).
- `otp/` — bcrypt-hashed codes with a Mongo TTL index on `expiresAt` and `attempt` limiting; SMS delivery via `TermiiService`.
- `groups/` + `invites` controller — `Group`, `GroupMember` schemas. Rotation order locking (`manual` or CSPRNG `random`). `GroupAccessService` centralizes "is this user the admin / an accepted member" checks shared with `cycles/`. `POST /groups/:id/terminate` (admin, COMPLETED only, group wallet balance must be ₦0) **deletes** the group and every group-scoped record — memberships, cycles, contributions, group wallet + its ledger, escrow deposits, payouts — in one Mongo transaction; members' personal `WalletTransaction` history is kept. `GroupStatus.TERMINATED` therefore only survives on legacy rows — `npm run seed:purge-terminated-groups` purges those (`GroupsService.purgeTerminatedGroups`, dry run unless `--confirm`; groups whose account still holds money are skipped and reported).
- `cycles/` — `Cycle`, `Contribution`, `EscrowDeposit` schemas (one contribution per (cycle, member)). Activation creates Cycle 1 + per-member `Wallet` + a `GroupWallet`, and best-effort provisions the group's escrow DVA. Contributions are member-initiated: `payContributionFromWallet` (wallet debit + fee) or `notifyBankTransferPayment` → admin `confirmContributionPaid`/`rejectContributionPayment`. Nothing is bulk-debited. `EscrowService` owns the group DVA + inbound deposit reconciliation (narration ref `AJO-<joinCode>-<position>` pre-matches a deposit to a contribution).
- `wallet/` — `Wallet`, `WalletTransaction`, `GroupWallet`, `GroupWalletTransaction`. Personal wallet funding via Paystack; central account debited on contribution collection and credited on reversal.
- `payments/` — `PaystackService` (transaction init, resolve bank, transfer recipient, transfer, constant-time HMAC verify via `crypto.timingSafeEqual` on `req.rawBody`) and `VTPassService` (bill payments — airtime/data/etc. via VTPass, with a single retry+requery for pending transactions).
- `webhooks/` — `POST /webhooks/paystack` (`charge.success`, `transfer.success`, `transfer.failed`, `transfer.reversed`). Returns `{ received: true }` immediately and processes asynchronously via `setImmediate`. Transfer events finalize cycle payouts, savings withdrawals, and pool donation payouts (in that lookup order).
- `notifications/` — `NotificationsService` (the single entry point; **never throws** — delivery failures are recorded on the `Notification` doc), `FirebaseService` (firebase-admin v14 modular API; skipped gracefully if not configured), `DeviceToken` schema (stale tokens auto-pruned on `registration-token-not-registered`), `NotificationEvents` factory. Two schedulers:
  - `ReminderScheduler` — 9 AM, T-3 (gentle push) / T-1/T-0 (urgent push + SMS).
  - `DefaulterScheduler` — 10 AM, flags overdue `pending` contributions as `defaulted`, increments `GroupMember.defaultCount` (cumulative, never decremented). Contributions `awaiting_confirmation` are never flagged.
- `admin/` — platform-admin-scoped read/write endpoints, deliberately separate from per-user services (so "browse every user on the platform" stays distinct from `UsersService` finding a known id). Includes `platform-admin-users`, `platform-admin-groups`, `platform-admin-finance` (wallet transactions / payouts / group wallet ledger), `platform-admin-management` (create/deactivate `platform_admin` accounts), `platform-admin-settings` (`GET`/`PATCH /admin/settings/service-charges`), and `group-dashboard` (per-group admin read endpoints).
- `platform-settings/` — `PlatformSetting` singleton (key `platform`) holding the two configurable platform charges: `escrowTransferFeePercent` (default **1%**, charged on top of every wallet → escrow transfer: contributions and pool donations) and `payoutFeePercent` (default **2.5%**, deducted from every escrow → bank payout: cycle payouts and pool payouts). `PlatformSettingsService` reads the row uncached at transfer time (no stale rate can ever price a payout), rounds to whole naira via `calculateFee`, and caps the fee at the amount. Fee credits land on the platform admin's `Wallet` (`SERVICE_FEE_CREDIT`, reference `sf_*` / `payout_fee_*`) and are clawed back with `reverseServiceFeeCredit` when a payout is reversed.
- `bills/` — VTPass-powered bill payments (airtime/data etc.); debits the user's `Wallet`, records `BillTransaction` documents.
- `donations/` — pool collections (non-rotating donation pools). `DonationGroup` (escrow + totals + shareable `joinCode` + optional `payoutAccount`), `DonationMember`, `Donation` (unique `{group,user,period}` + deterministic `don_<group>_<user>_<period>` reference), `DonationPayout`, `DonationEscrowTransaction`. Donations debit the wallet (`WalletService.debitForDonation`, type `donation_debit`) into escrow; payouts mirror `CyclesService.initiatePayout` (reserve → Paystack → webhook finalize) and fall back to the admin's saved bank account when no pool override is set. Period keys live in `src/donations/utils/donation-period.ts` (`2026-10-25` / `2026-W43` / `2026-10` / `2026` / `once`). Ending a pool is a member vote (only members paid 100% count, 2/3 needed) plus a full-payout gate, and `POST /donations/groups/:id/terminate` **deletes** the pool and every pool-scoped record — donations, memberships, payouts, escrow movements — in one Mongo transaction, so no `terminated` row is left to list; `DonationGroupStatus.TERMINATED` therefore only survives on legacy rows, purged with `npm run seed:purge-terminated-pools` (`DonationsService.purgeTerminatedPools`, dry run unless `--confirm`; a pool whose escrow still holds money is skipped and reported).

**Cross-cutting wiring to know about:**

- `rawBody: true` is set on the Nest factory (`src/main.ts`) so the Paystack HMAC signature can be verified against the exact request bytes.
- `NotificationsModule` creates a circular module graph with `GroupsModule`/`CyclesModule`/`WalletModule` — resolved with `forwardRef()` on both the `@Module({ imports })` array and the constructor `@Inject(forwardRef(() => X))`. New cross-cutting services will need the same pattern.
- `Otp` TTL index on `expiresAt` purges codes automatically; codes are never stored in plaintext.
- Bank account numbers are masked to `****1234` even for `platform_admin` detail responses — full numbers only ever flow between the user, `PaystackService`, and Paystack itself.
- `CORS is currently open` (`app.enableCors()` with no options) — restrict before production.
- Seed/admin bootstrap: `npm run seed:platform-admin` (creates first `platform_admin` from `SEED_PLATFORM_ADMIN_*` env vars; safe to re-run). Once `platform-admin-management` endpoints are in use, that script is only needed for disaster recovery or new environments.

### Mobile (`ajo-mobile`) — Expo SDK 56, React Navigation v7

React Native 0.85, React 19.2.3, hand-written TypeScript. **No Expo Router** — React Navigation directly (`@react-navigation/native` + `native-stack` + `bottom-tabs`); SDK 56's `expo-doctor` flags having both installed as a mistake, so don't add it.

**5-tab bottom navigator** (see `src/navigation/`) — the bar carries only the money surfaces:
- **Wallet** — home, fund wallet, bank account, transactions.
- **Savings** — personal plans list, create, plan detail (pay an interval / withdraw).
- **My Groups** — list, create, detail, members, invite, lock rotation, activate, cycles, current cycle.
- **Pools** — pool collections: pool list + dashboard totals, create pool, join by Group ID, pool detail (donate from the wallet, copy Group ID, recent donations), paginated donor history, and an admin payout screen with a bank/account destination picker.
- **Bills** — airtime, data, cable, electricity.

Profile and Alerts are **not** tabs. Every tab root pins the member's initial as an avatar chip in its top-right corner (`src/components/AccountMenu.tsx`); tapping it opens a small card with **Alerts** (live unread dot + count, fetched on focus) and **Profile**. Both screens live in the Root stack's `Account` navigator (`src/navigation/AccountNavigator.tsx`), so they slide in over the tab bar and draw their own back chip via `SubpageHeader`. Profile's "Wallet" / "Bank account" rows hop back to the Wallet tab (`Main` → `Wallet`) rather than mounting a second copy of that stack.

**State / contexts** wired in `App.tsx`: `AuthProvider` → `CycleRefreshProvider` → `NotificationHandler` → `RootNavigator`. `AuthContext` bootstraps by calling `GET /auth/me` so a stored but expired/revoked token falls back to sign-in rather than flashing authenticated UI. Tokens persist via `expo-secure-store` (Keychain/Keystore) with an in-memory cache for synchronous reads.

**API client** (`src/api/`) is hand-typed, one module per domain. 401s surface as `ApiError`s and `AuthContext` reacts to them.

**Pagination** — long lists page **10 rows at a time** through the shared
`src/components/Pagination.tsx` (`Prev` · `Page x of y` · `Next`, plus a
`1–10 of 23` caption; it renders nothing on a single page). Both paginated
lists are server-paged: the Alerts inbox
(`GET /notifications?limit=10&skip=` → `{ notifications, unreadCount, total }`)
and a savings plan's "Recent activity"
(`GET /savings/plans/:id?page=&limit=` → `{ plan, transactions, page, limit, total }`,
where the server clamps `limit` to 50 and out-of-range pages to the last page).
Screens fall back to page 1 on focus/refresh, keep the current page after a
mark-read/action mutation, and re-clamp when a page empties out.

**Phone normalization** happens client-side (Nigerian local formats → E.164) before hitting the API — `ajo-server` enforces strict E.164 (`/^\+[1-9]\d{7,14}$/`).

**Design tokens** (`src/theme/`): warm cream canvas + clay/terracotta primary, system font stacks (no `expo-font` / `next/font` dependency). Distinct from `ajo-admin-web`'s ink-navy/gold ops aesthetic.

**Notification setup**: `expo-notifications.setNotificationHandler` shows heads-up banners in foreground; permissions requested on launch. FCM token registration is the mobile app's responsibility (and is the `POST /notifications/device-token` endpoint on the server).

### Admin web (`ajo-admin-web`) — Next.js 16 App Router

Read-heavy ops console. Strictly server-rendered: every authenticated request is a Server Component / Server Action / Route Handler that reads the JWT from an httpOnly cookie — the token never reaches the browser. There is no client-side data fetching.

**Two layers of auth checking:**
1. `proxy.ts` (Next 16's renamed middleware) — fast, presence-only cookie check on the Edge runtime; redirects unauthenticated visitors to `/login` and authenticated visitors at `/login` back to `/`. Does not verify the JWT.
2. `lib/api/authedFetch` — actual authority: any 401 from `ajo-server` (expired / invalid / revoked / deactivated) redirects to `/login`.

**Login flow**: `POST /auth/admin/login` via a Server Action (`lib/auth/actions.ts`); JWT stored as httpOnly cookie (`lib/auth/session.ts`).

**Pages** (under `app/(dashboard)/`, all Server Components): `users/`, `groups/`, `finance/`, `admins/`, plus an overview. Search, pagination, status filters, and finance tabs are all URL-state (`?search=&page=&status=&tab=`) so results are shareable/bookmarkable. Backend 404s route through Next's `notFound()` to render the framework's standard not-found page.

**Styling**: hand-built design tokens in `app/globals.css` (warm canvas, ink-navy chrome, muted gold accent) — no shadcn/Tailwind defaults, no `next/font/google` (system stacks; sandbox egress blocks `fonts.googleapis.com`).

**Mutations** (Sub-phase E): `lib/data/admin-actions.ts` exposes `createAdminAction` (form-bound via `useActionState`) and `setAdminActiveAction` (called from a `useTransition` toggle with a `window.confirm()` guard). The current admin's own row shows "This is you" instead of a button — mirroring the backend's self-deactivation refusal. Both call `revalidatePath("/admins")` on success.

**Debugging gotcha**: `apiFetch` throwing `Unexpected token '<' ... is not valid JSON` almost always means `NEXT_PUBLIC_API_BASE_URL` is stale (pointing at the Next app itself, or not picked up because `next dev` wasn't restarted) — Next's own HTML error page is being parsed as JSON.

### Marketing site (`digitalHoldings/`) — Next.js 16 App Router

Static-ish marketing/landing site for Ajo. Pages under `app/`: home (`page.tsx`), `contact/`, `privacy-policy/`, `terms-and-conditions/` (the latter two mirror `PRIVACY_POLICY.md` / `TERMS_AND_CONDITIONS.md` at the repo root). Tailwind v4 with a custom `ajo-*` color palette defined in `tailwind.config.js`. No backend dependency — runs independently.

## Conventions & notes

- Per-subproject `AGENTS.md` / `CLAUDE.md` files contain subproject-specific reminders (e.g. `ajo-mobile/AGENTS.md` notes Expo SDK 56 differs from earlier versions — read `https://docs.expo.dev/versions/v56.0.0/` before writing Expo code; `ajo-admin-web/AGENTS.md` flags Next.js 16 as breaking — check `node_modules/next/dist/docs/` before writing code). Honor them when working in those subprojects.
- Don't introduce a workspace tool (Turborepo/pnpm workspaces/npm workspaces) without explicit request — the repo currently works because each subproject is fully independent.
- The root `README.md` is a one-liner (`# smart-Ajo`); substantive documentation lives in each subproject's README. The root `PRIVACY_POLICY.md` and `TERMS_AND_CONDITIONS.md` are the canonical legal documents and are mirrored as pages under `digitalHoldings/app/`.
