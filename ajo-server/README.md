# ajo-server

NestJS + MongoDB (Mongoose) backend for the Ajo app.

## Phase 1 — Foundation & Auth

Implements:
- Project scaffold (NestJS, TypeScript, ESLint/Prettier configured and passing)
- `User` schema (phone-based identity, optional email, role: `user` | `platform_admin`)
- `Otp` schema (hashed codes, auto-expiry via Mongo TTL index, attempt limiting)
- Termii SMS integration (delivery channel only — OTP generation/verification is handled in-app)
- JWT auth shared by mobile and admin web, issued via two different login flows
- Guards: `JwtAuthGuard` (any authenticated user) and `PlatformAdminGuard` (role=platform_admin only)
- Seed script to create the first platform_admin account

## Setup

```bash
cp .env.example .env
# fill in MONGODB_URI, JWT_ACCESS_SECRET, TERMII_API_KEY, TERMII_SENDER_ID,
# PAYSTACK_SECRET_KEY, and SEED_PLATFORM_ADMIN_* values.
# FIREBASE_* values are optional — omit them to skip push notifications
# during local development (SMS/in-app notifications still work).

npm install
npm run start:dev
```

In development, generated OTP codes are also written to the server logs
(`[DEV ONLY] OTP for +234...: 123456`) so you can test the flow without a
live Termii account/credit.

### Paystack webhook (required for Phase 4 to fully work)

Wallet funding confirmation and payout finalization both rely on
`POST /webhooks/paystack`. In the Paystack dashboard, enable Transfers and
set the webhook URL to `https://<your-domain>/webhooks/paystack`. For
local development, expose your dev server with a tool like
[ngrok](https://ngrok.com) and use the generated HTTPS URL. Without this,
funding/payouts that don't resolve synchronously will stay `pending`
indefinitely — use `GET /wallet/fund/verify/:reference` as a manual
fallback for funding while testing.

### Creating the first platform_admin

```bash
npm run seed:platform-admin
```

This reads `SEED_PLATFORM_ADMIN_EMAIL`, `SEED_PLATFORM_ADMIN_PASSWORD` and
`SEED_PLATFORM_ADMIN_PHONE` from `.env` and creates a `role: platform_admin`
user that can log in to `ajo-admin-web`. Safe to re-run — it's a no-op if
a user with that email already exists.

## Phase 2 — Group Creation & Membership

Implements:
- `Group` schema (name, contributionAmount, frequency, totalSlots, rotationMethod, status)
- `GroupMember` schema (per-group `isGroupAdmin`, `inviteStatus`, `position`, `payoutStatus`)
- Admin-sends-invite flow: admin invites a member by phone, invitee accepts/declines from `/invites`
- Rotation order locking, supporting both `manual` (admin-supplied order) and
  `random` (server-side CSPRNG shuffle) — chosen per group at creation time

**Invites are in-app only.** The invited phone number must already belong
to a registered (phone-verified) Ajo user — there's no "invite by phone,
they sign up later" path. If the person hasn't downloaded and registered on
the app yet, `POST /groups/:id/invites` returns 404 until they do.

### Groups

| Method | Path                        | Auth                    | Body | Notes |
|--------|-----------------------------|-------------------------|------|-------|
| POST   | `/groups`                   | Bearer JWT              | `{ name, contributionAmount, frequency?, totalSlots, rotationMethod }` | Creates the group; creator becomes an ACCEPTED, `isGroupAdmin: true` member. `totalSlots` includes the creator. `frequency` defaults to `monthly`. |
| GET    | `/groups`                   | Bearer JWT              | — | Groups the current user is an ACCEPTED member of, with their membership info |
| GET    | `/groups/:id`               | Bearer JWT              | — | Full group detail + member roster (ACCEPTED members only) |
| GET    | `/groups/:id/members`       | Bearer JWT              | — | Member roster only (ACCEPTED members only) |
| POST   | `/groups/:id/invites`       | Bearer JWT, group admin | `{ phone }` | Sends an invite. Fails (404) if the phone isn't a registered Ajo user; also fails if the group is full, not open for invites, or the phone is already invited/a member |
| POST   | `/groups/:id/rotation/lock` | Bearer JWT, group admin | `{ order?: string[] }` | Locks the payout order. `order` (array of GroupMember ids) is required if `rotationMethod` is `manual`; ignored if `random`. Requires all `totalSlots` to be ACCEPTED first. |

### Invites

| Method | Path                   | Auth       | Body | Notes |
|--------|------------------------|------------|------|-------|
| GET    | `/invites/me`          | Bearer JWT | — | Pending invites for the current user, with group context |
| PATCH  | `/invites/:id/respond` | Bearer JWT | `{ "action": "accept" \| "decline" }` | `:id` is the GroupMember id from `/invites/me` |

### Group lifecycle (`Group.status`)

`open_for_invites` -> `order_locked` -> `active` -> `completed`

- **open_for_invites**: admin can send invites; members accept/decline.
- **order_locked**: set once all `totalSlots` are ACCEPTED and the admin
  locks the rotation order via `/groups/:id/rotation/lock`.
- **active**: set by `POST /groups/:id/activate` (Phase 3) — cycle 1 has
  been created and contributions are being collected.
- **completed**: set automatically once the final cycle's payout has been
  initiated — every member has now collected.

## Phase 3 — Cycle Engine

Implements:
- `Cycle` schema — one rotation/contribution period per payout recipient
  (`cycleNumber` matches the recipient's `position`)
- `Contribution` schema — one record per (cycle, member), tracking
  `pending`/`paid` status
- Activation: `POST /groups/:id/activate` creates Cycle 1 + a PENDING
  Contribution for every member, and flips the group to `active`
- Payout + rotation advancement: once every contribution in the current
  cycle is `paid`, the admin initiates payout, which marks the recipient's
  `payoutStatus` as `collected`, completes the cycle, and either creates the
  next cycle (next position in the rotation) or marks the group `completed`
  if that was the last one

> Contribution collection in this phase was originally a manual
> admin "mark-paid" action. **Phase 4 replaced this** with automatic
> wallet debits — see below. The cycle/payout lifecycle described here is
> otherwise unchanged.

## Phase 4 — Payments Integration (Paystack)

Implements the full money flow: members fund a personal `Wallet` via
Paystack, contributions are **automatically debited from each member's
wallet** into the group's central account (`GroupWallet`), and the admin
initiates a real bank transfer (`Payout`) from the central account to the
current cycle's recipient.

- `Wallet` / `WalletTransaction` — a member's personal balance and ledger
  (funding, contribution debits, refunds)
- `GroupWallet` / `GroupWalletTransaction` — the group's pooled central
  account and its ledger (contribution credits, payout debits, reversal
  credits)
- `Payout` — one per cycle, tracks a Paystack transfer attempt
  (`pending` → `success` / `failed` / `reversed`)
- `User.bankAccount` — a member's verified payout destination (resolved
  via Paystack, with a saved transfer recipient code)
- `PaystackService` — wraps Paystack's transaction (funding), bank
  resolution, transfer recipient, and transfer (payout) APIs, plus
  constant-time webhook signature verification
- `POST /webhooks/paystack` — handles `charge.success` (credits the
  wallet), `transfer.success` (finalizes the payout + advances the
  rotation), `transfer.failed` / `transfer.reversed` (refunds the group
  wallet so the admin can retry)

### Wallet

| Method | Path                        | Auth       | Body | Notes |
|--------|-----------------------------|------------|------|-------|
| GET    | `/wallet/me`                | Bearer JWT | — | Current balance + last 20 ledger entries |
| POST   | `/wallet/fund/initialize`   | Bearer JWT | `{ amount }` (naira) | Starts a Paystack funding transaction; returns `{ authorizationUrl, reference }`. Requires the user to have an email set (`PATCH /auth/me`) |
| GET    | `/wallet/fund/verify/:reference` | Bearer JWT | — | Manually confirms a funding transaction (fallback to the webhook) |
| GET    | `/wallet/banks`             | Bearer JWT | — | Lists Nigerian banks (name + Paystack bank code) |
| GET    | `/wallet/bank-account`      | Bearer JWT | — | The member's saved payout bank account, or `null` |
| POST   | `/wallet/bank-account`      | Bearer JWT | `{ accountNumber, bankCode, bankName }` | Resolves the account via Paystack, creates a transfer recipient, and saves it as the payout destination |

### Cycles, contributions & payouts

| Method | Path                                                | Auth                    | Body | Notes |
|--------|-----------------------------------------------------|-------------------------|------|-------|
| POST   | `/groups/:id/activate`                              | Bearer JWT, group admin | — | Requires `Group.status === order_locked`. Creates Cycle 1, a `GroupWallet`, and a personal `Wallet` for every member who doesn't have one. Sets `status: active`. |
| GET    | `/groups/:id/cycles`                                | Bearer JWT              | — | All cycles, oldest first, each with a `paidCount` |
| GET    | `/groups/:id/cycles/current`                        | Bearer JWT              | — | Current open cycle + every member's contribution status |
| POST   | `/groups/:id/cycles/:cycleId/collect-contributions` | Bearer JWT, group admin | — | Attempts to debit every member's wallet with a PENDING contribution, crediting the `GroupWallet` for each success. Members with insufficient balance are skipped (stay `pending`) — safe to call again after they top up. |
| POST   | `/groups/:id/cycles/:cycleId/payout`                | Bearer JWT, group admin | — | Requires ALL contributions `paid`. Debits the `GroupWallet`, creates a `Payout`, and calls Paystack's Transfer API. If Paystack confirms synchronously, the rotation advances immediately; otherwise the webhook finalizes it. |

### Webhook

| Method | Path                 | Auth | Notes |
|--------|----------------------|------|-------|
| POST   | `/webhooks/paystack` | Paystack HMAC signature (`x-paystack-signature`) | Must be registered in the Paystack dashboard. Processes events asynchronously and always returns `{ received: true }` immediately. |

## Phase 5 — Notifications & Reminders

Implements push notifications (Firebase Cloud Messaging) with an SMS
fallback (Termii) for high-importance events, plus an in-app notification
inbox and a daily cron job for contribution due-date reminders.

- `Notification` schema — a record of every notification sent (or
  attempted), per user per channel. Doubles as the in-app inbox (with
  `isRead`/`readAt`) and a delivery audit log.
- `DeviceToken` schema — FCM tokens registered by the mobile app. Stale
  tokens (uninstalled app) are automatically detected and removed when
  FCM reports `registration-token-not-registered`.
- `FirebaseService` — thin wrapper around `firebase-admin`'s modular API
  (v14+) for sending push notifications. If Firebase credentials aren't
  configured, push sends are skipped gracefully (logged once at startup)
  rather than throwing — useful for local development without a Firebase
  project set up yet.
- `NotificationsService` — the single entry point the rest of the app
  calls to send a notification. Always attempts push; SMS is opt-in per
  event (`smsEnabled: true`) for things like invites and payouts where a
  missed push notification would be costly.
- `NotificationEvents` — one factory function per event type, centralising
  all notification copy in a single file (`notification-events.ts`).
- `ReminderScheduler` — a daily cron job (`EVERY_DAY_AT_9AM`) that finds
  every `OPEN` cycle due in 3 days (gentle reminder) or due tomorrow/today
  (urgent reminder + SMS) and notifies every member with a `PENDING`
  contribution.

### Notification events wired in

| Event | Triggered by | Channel |
|-------|--------------|---------|
| `group_invite_received` | `POST /groups/:id/invites` | push + SMS |
| `group_invite_accepted` / `group_invite_declined` | `PATCH /invites/:id/respond` | push (to the group admin) |
| `rotation_order_locked` | `POST /groups/:id/rotation/lock` | push (to every member, with their position) |
| `group_activated` | `POST /groups/:id/activate` | push + SMS (to every member) |
| `contribution_due_reminder` | `ReminderScheduler`, T-3 days | push |
| `contribution_due_urgent` | `ReminderScheduler`, T-1/T-0 | push + SMS |
| `contribution_debited` | `POST .../collect-contributions` (success) | push |
| `contribution_failed_insufficient` | `POST .../collect-contributions` (insufficient balance) | push + SMS |
| `payout_initiated` | `POST .../payout` (transfer call made) | push + SMS |
| `payout_success` | Transfer confirmed (sync or via webhook) | push + SMS |
| `payout_failed` | Transfer failed (sync or via webhook) | push + SMS (to the group admin) |
| `payout_reversed` | `transfer.reversed` webhook | push + SMS (to the group admin) |
| `wallet_funded` | `charge.success` confirmed (manual verify or webhook) | push |

### Endpoints

| Method | Path                              | Auth       | Body | Notes |
|--------|-----------------------------------|------------|------|-------|
| GET    | `/notifications`                  | Bearer JWT | Query: `limit?`, `skip?` | In-app inbox: `{ notifications, unreadCount }`, newest first |
| PATCH  | `/notifications/read`             | Bearer JWT | `{ notificationIds: string[] }` | Marks specific notifications as read |
| PATCH  | `/notifications/read-all`         | Bearer JWT | — | Marks all of the user's notifications as read |
| POST   | `/notifications/device-token`     | Bearer JWT | `{ token, platform? }` | Registers/refreshes an FCM token. Call on app launch and whenever FCM issues a new token |
| DELETE | `/notifications/device-token/:token` | Bearer JWT | — | Deactivates a token (e.g. explicit logout) |

## Phase 6 — Defaulter Handling & Group Admin Tools

Policy for this phase (confirmed before building): missed contributions
are **tracked only** — no automatic late fee, no suspension, no
guarantor system. The goal is visibility for the group admin, not
automatic penalties.

- `ContributionStatus.DEFAULTED` — a new status alongside `pending`/`paid`.
  A contribution becomes `defaulted` if it's still `pending` after its
  cycle's `dueDate` has passed. It can still become `paid` later (e.g. the
  member tops up and the admin re-runs collection) — `defaulted` is a
  flag, not a dead end.
- `GroupMember.defaultCount` — a running historical tally of how many
  times a member has been flagged, incremented by the defaulter sweep and
  never decremented (even if the contribution is later paid) — it's a
  "track record" number for admin visibility, not a current-standing
  block.
- `DefaulterScheduler` — daily cron job (10 AM, an hour after the
  reminder job) that flags any still-`pending` contribution on an overdue
  `OPEN` cycle as `defaulted`, increments the member's `defaultCount`, and
  notifies both the member (a heads-up, not a penalty notice) and the
  group admin (a summary count).
- `Group.autoCollectEnabled` — a **per-group toggle**, off by default.
  When on, `AutoCollectScheduler` runs daily at 8 AM (before the reminder
  and defaulter jobs) and automatically debits every member's wallet for
  any cycle whose `dueDate` has arrived — the same logic as the admin's
  manual `collect-contributions` button, just system-triggered. When off,
  collection stays a manual admin action, exactly as it was in Phase 4.
- `GroupDashboardService` / `GroupDashboardController` — read-only
  endpoints for a group's own admin: current defaulters, full member
  standings (position, payout status, default count, current-cycle
  contribution status), and a per-cycle paid/pending/defaulted breakdown
  across the group's whole history.

### Auto-collect toggle

| Method | Path                        | Auth                    | Body | Notes |
|--------|-----------------------------|--------------------------|------|-------|
| PATCH  | `/groups/:id/auto-collect`  | Bearer JWT, group admin | `{ enabled: boolean }` | Turns automatic daily contribution collection on/off for this group |

### Group admin dashboard

| Method | Path                                            | Auth                    | Notes |
|--------|--------------------------------------------------|--------------------------|-------|
| GET    | `/groups/:groupId/dashboard/defaulters`           | Bearer JWT, group admin | Every contribution currently flagged `defaulted`, with the member's historical `defaultCount`, sorted worst-first |
| GET    | `/groups/:groupId/dashboard/standings`            | Bearer JWT, group admin | Full member roster: position, payout status, `defaultCount`, and their contribution status for the current cycle |
| GET    | `/groups/:groupId/dashboard/contribution-summary` | Bearer JWT, group admin | Per-cycle paid/pending/defaulted counts across the group's entire history |

> Note: these are **group-admin** dashboard endpoints (any group's own
> admin, viewed from the mobile app) — distinct from the platform_admin
> web dashboard endpoints below, which monitor all users/groups across
> the whole platform.

## ajo-admin-web support — Platform Users Directory (Sub-phase B)

Implements the first platform-admin-scoped read endpoints, added to
support `ajo-admin-web`'s Users directory screen. `UsersService`
continues to only ever resolve a single user the caller already knows
(by id/phone/email) — these are deliberately separate, under
`PlatformAdminUsersService`/`PlatformAdminUsersController`, since "browse
every user on the platform" is a meaningfully different (and more
sensitive) capability than anything `role: user` should ever reach.

| Method | Path                | Auth                        | Query / Params | Notes |
|--------|---------------------|------------------------------|----------------|-------|
| GET    | `/admin/users`      | Bearer JWT, `platform_admin` | `search?`, `role?`, `page?` (default 1), `limit?` (default 20, max 100) | Paginated user list. `search` matches name, phone, or email (case-insensitive substring). Each row includes `hasBankAccount` but not the account details themselves. |
| GET    | `/admin/users/:id`  | Bearer JWT, `platform_admin` | — | Full profile, wallet balance, every group membership with standing (position, payout status, `defaultCount`), and a masked bank account (`****1234`) if one is set. |

Both routes are guarded by `JwtAuthGuard` + `PlatformAdminGuard` — a
valid `role: user` JWT is rejected with 403, not just "would return
nothing."

## ajo-admin-web support — Platform Groups Directory (Sub-phase C)

Implements the second platform-admin-scoped read endpoints, added to
support `ajo-admin-web`'s Groups directory screen. Same shape as
Sub-phase B: deliberately separate from `GroupDashboardService` (Phase
6), which is the same kind of data (member standings, cycle/contribution
breakdown) but scoped to a single group's OWN admin via
`GroupAccessService.assertGroupAdmin`. `PlatformAdminGroupsService` has
no such restriction — it exists specifically so platform staff can
browse every group.

| Method | Path                 | Auth                        | Query / Params | Notes |
|--------|----------------------|------------------------------|----------------|-------|
| GET    | `/admin/groups`      | Bearer JWT, `platform_admin` | `search?` (name substring), `status?`, `page?` (default 1), `limit?` (default 20, max 100) | Paginated group list with settings and current cycle number, no member/cycle detail. |
| GET    | `/admin/groups/:id`  | Bearer JWT, `platform_admin` | — | Full detail: settings, central wallet (`GroupWallet`) balance, the group admin, every member's standing, the full cycle history with a paid/defaulted/pending breakdown per cycle, and every payout attempt (including failed/reversed, with `failureReason`) — not just the current one. |

Both routes are guarded the same way as the Sub-phase B endpoints.

## ajo-admin-web support — Financial Oversight (Sub-phase D)

Implements platform-wide read access to every financial ledger in the
system, for `ajo-admin-web`'s Financial Oversight screen. Three
distinct ledgers, each backed by an existing schema (none of this is
new data — these are the first endpoints that expose it platform-wide
rather than scoped to "your own" wallet or "your own" group):

- **Wallet fundings** — `WalletTransaction` entries, a member's personal
  wallet top-ups. Defaults to `type: funding` (the support-relevant
  slice — "did my top-up go through") but accepts an explicit `type` to
  widen the view to debits/refunds too.
- **Payouts** — `Payout` documents, transfers out of a group's central
  account to a cycle's recipient. Every status included, not just
  successes — same transparency principle as Sub-phase C's group detail
  payout history.
- **Group wallet ledger** — `GroupWalletTransaction` entries, a group's
  central account movements (contribution credits, payout debits,
  reversal credits). The platform-wide version of what Sub-phase C's
  group detail page already showed scoped to one group.

| Method | Path                                  | Auth                        | Query / Params | Notes |
|--------|----------------------------------------|------------------------------|----------------|-------|
| GET    | `/admin/finance/wallet-transactions`   | Bearer JWT, `platform_admin` | `type?` (default `funding`), `status?`, `userId?`, `page?`, `limit?` | Each entry includes the user and, if set, the related group. |
| GET    | `/admin/finance/payouts`               | Bearer JWT, `platform_admin` | `status?`, `groupId?`, `page?`, `limit?` | Each entry includes the group, recipient, the admin who initiated it, and `failureReason` if applicable. |
| GET    | `/admin/finance/group-wallet-transactions` | Bearer JWT, `platform_admin` | `type?`, `groupId?`, `page?`, `limit?` | Each entry includes the group. |

All three accept `groupId`/`userId` filters specifically so a future
"view this user/group's transactions" link can reuse the same endpoint
rather than needing a separate scoped route.

## ajo-admin-web support — Admin Management (Sub-phase E)

Implements the screen the original seed script
(`npm run seed:platform-admin`) explicitly deferred to: creating
additional `platform_admin` accounts without needing shell/database
access. That script should now only ever be needed once, for disaster
recovery, or to bootstrap a brand-new environment.

| Method | Path                      | Auth                        | Body | Notes |
|--------|---------------------------|------------------------------|------|-------|
| GET    | `/admin/admins`           | Bearer JWT, `platform_admin` | — | Every `platform_admin` account, newest first. |
| POST   | `/admin/admins`           | Bearer JWT, `platform_admin` | `{ email, phone, password, name? }` | Creates a new `platform_admin`. Rejects duplicate email or phone with 409. `phone` must be E.164 (e.g. `+2348012345678`) — every `User` document requires one, admin or not. |
| PATCH  | `/admin/admins/:id/active` | Bearer JWT, `platform_admin` | `{ isActive: boolean }` | Deactivates or reactivates an admin account. An admin cannot deactivate their own account (403) — there's no recovery path if the only active admin locks themselves out. |

There's no "super admin" tier — every `platform_admin` is a peer and can
create or deactivate any other, including ones created before them.
Deactivation (not deletion) is used to revoke access, and takes effect
**immediately**: `JwtStrategy` re-fetches the user and checks `isActive`
on every authenticated request, so a deactivated admin's existing,
unexpired JWT stops working on their very next request rather than only
once it naturally expires.

## API Endpoints (Phase 1)

### Mobile: phone + OTP

| Method | Path                | Auth       | Body                                    | Notes |
|--------|---------------------|------------|------------------------------------------|-------|
| POST   | `/auth/otp/request` | none       | `{ "phone": "+2348012345678" }`           | Sends a 6-digit OTP via SMS (logged in dev) |
| POST   | `/auth/otp/verify`  | none       | `{ "phone": "...", "code": "123456" }`    | Verifies OTP, creates the user if new, returns `{ accessToken, user }` |
| GET    | `/auth/me`          | Bearer JWT | —                                          | Returns the current user's profile |
| PATCH  | `/auth/me`          | Bearer JWT | `{ "name"?: "...", "email"?: "..." }`     | Optional profile completion (name/email) |

### Admin web: email + password

| Method | Path                 | Auth | Body                                       | Notes |
|--------|----------------------|------|---------------------------------------------|-------|
| POST   | `/auth/admin/login`  | none | `{ "email": "...", "password": "..." }`     | Only succeeds for `role: platform_admin` users; returns `{ accessToken, user }` |

### Misc

| Method | Path      | Notes |
|--------|-----------|-------|
| GET    | `/health` | Basic liveness check |

## Design notes

- **Roles are minimal by design.** `User.role` only distinguishes
  `platform_admin` (admin web access) from everyone else (`user`). Per-group
  permissions (e.g. "is this user the admin of group X?") live on the
  `GroupMember` document as a per-group `isGroupAdmin` flag — not here.
- **OTP codes are never stored in plaintext** — only bcrypt hashes, with a
  TTL index on `expiresAt` so expired codes are automatically purged by
  MongoDB.
- **JWT payload** (`sub`, `role`, `phone`, `email`) is intentionally small;
  the `JwtStrategy` re-fetches the user on every request so role changes or
  deactivation take effect immediately without waiting for token expiry.
- **CORS is currently open** (`app.enableCors()` with no options). Before
  production, restrict this to the admin web origin and any mobile app
  origins that need it.
- **Group invites and slots.** A "slot" is occupied by any GroupMember
  whose `inviteStatus` is `accepted` or `pending` — declined invites free
  up the slot. Re-inviting a previously-declined phone number resets that
  same GroupMember document to `pending` rather than creating a duplicate
  (enforced by a unique index on `(group, user)`).
- **Invites require an existing registered user.** There's no "stub"
  account creation. `POST /groups/:id/invites` looks up the phone number
  via `UsersService.findByPhone` and requires `isPhoneVerified: true`,
  returning 404 otherwise.
- **Rotation locking is all-or-nothing.** `/groups/:id/rotation/lock`
  requires every slot to be `accepted` first — there's no partial lock.
  This keeps the "who's in the group" question settled before payout order
  (and contribution cycles) are decided.
- **GroupAccessService** centralizes "does this group exist / is this user
  its admin / is this user an accepted member" checks, shared by
  `GroupsService` and `CyclesService` so authorization logic doesn't drift
  between modules.
- **Due dates are schedule-based, not completion-based.** Cycle N+1's
  `dueDate` is computed as Cycle N's `dueDate` plus one interval — not
  "now plus one interval" at the time payout is initiated. This keeps the
  group on a predictable cadence (e.g. always around the 1st of the month)
  even if a payout is confirmed a few days late. Cycle 1's `dueDate` is the
  one exception: it's `activatedAt + one interval`, since there's no prior
  due date to anchor to.
- **Contributions are automatically debited from member wallets.**
  `POST .../collect-contributions` attempts a wallet debit for every
  `pending` contribution; members with insufficient balance are simply
  skipped (no error) and remain `pending` until they top up and the admin
  re-runs the endpoint. There's currently no auto-retry/auto-debit on a
  schedule — the admin (or, later, a cron job) must trigger collection.
- **Payout requires full contribution.** `POST .../payout` checks that
  every Contribution for the current cycle is `paid` before allowing the
  recipient to be marked `collected` and the rotation to advance — there's
  no partial/early payout.
- **Paystack calls happen outside Mongo transactions.** Debiting the
  `GroupWallet` and creating the `Payout` record happen inside a
  transaction; the actual `paystack.initiateTransfer()` network call
  happens afterward. Mixing an external API call into a DB transaction
  would hold the transaction open across network latency, which risks
  long-lived locks — so a transfer failure is instead handled by a
  separate compensating action (`handleFailedPayout` refunds the group
  wallet) rather than a DB rollback.
- **The webhook always returns 200 immediately** and processes the event
  in the background via `setImmediate`, so Paystack doesn't retry-storm
  the endpoint while we do async DB work. Webhook signature verification
  happens synchronously before that, using a constant-time comparison
  (`crypto.timingSafeEqual`) on the raw request body — `main.ts` is
  configured to capture `req.rawBody` for exactly this reason.
- **NotificationsService never throws.** Every notification send is
  wrapped so that a Firebase/Termii failure never breaks the underlying
  business operation (an invite still gets created even if the push
  notification fails to deliver). Delivery failures are recorded on the
  `Notification` document (`status: failed`, `failureReason`) for
  later inspection rather than surfaced to the caller.
- **Module wiring uses `forwardRef`.** `NotificationsService` is called
  from `GroupsService`, `CyclesService`, and `WalletService`, but
  `NotificationsModule` also needs the `Group`/`GroupMember`/`Cycle`/
  `Contribution` Mongoose models (re-exported by `GroupsModule` and
  `CyclesModule`). This creates a circular module graph, resolved with
  `forwardRef()` on both the `@Module({ imports: [...] })` array and the
  corresponding constructor `@Inject(forwardRef(() => X))` in each
  service. If you add a new cross-cutting service like this, expect to
  need the same pattern.
- **Defaulting is intentionally inert.** `DEFAULTED` is set purely for
  visibility — no fee is charged, no suspension occurs, and the rotation
  isn't affected. The product decision behind this (confirmed before
  building Phase 6) was to keep the MVP's consequence model simple;
  fees/suspension/guarantors are an explicit non-goal for now and would
  need new schema (e.g. a `Penalty` collection) if revisited later.
- **`collectContributions` was split into a public admin-checked method
  and a private `collectContributionsCore`.** The core logic (debit loop,
  notifications) is shared between the admin's manual button
  (`POST .../collect-contributions`) and `AutoCollectScheduler`'s
  unattended daily run (`collectContributionsSystem`) — the only
  difference is whether `GroupAccessService.assertGroupAdmin` runs first.
  This avoids duplicating the debit/notify logic across both call paths.
- **Scheduler run order matters.** Auto-collect (8 AM) runs before the
  reminder job (9 AM) and the defaulter sweep (10 AM) so that a group
  with `autoCollectEnabled: true` gets a chance to actually collect
  before its members are reminded about a contribution that may already
  be paid, or flagged as a defaulter for one that was just collected.
- **`defaultCount` is cumulative, not "current."** It only ever
  increments — a member who defaulted twice in the past but is current
  today still shows `defaultCount: 2`. This is deliberate: it's a track
  record for the admin to use in judgment calls (e.g. deciding whether to
  remove someone from future groups), not a live "are they in good
  standing right now" flag — use `currentCycleStatus` from
  `GET .../dashboard/standings` for that instead.
- **Bank account numbers are masked even for platform admins.**
  `GET /admin/users/:id` only ever returns `****1234`, never the full
  account number — a monitoring console doesn't need the full number to
  do its job, and minimizing who can see full account numbers (full
  numbers only ever flow between the user, `PaystackService`, and
  Paystack itself) is a deliberate reduction of blast radius if an admin
  account is ever compromised.
- **Search is intentionally simple.** `GET /admin/users` does a
  case-insensitive regex substring match across name/phone/email rather
  than a dedicated text index — fine at this scale, but worth revisiting
  (e.g. a compound text index, or moving to a real search service) if
  the user base grows large enough that this becomes a slow query.
- **`/admin/groups/:id` returns the full payout history, not just
  successes.** Failed and reversed transfers (with `failureReason`) are
  included deliberately — a platform-admin console is exactly where
  someone investigating "why didn't this payout go through" needs to
  land, so hiding non-success payouts would defeat the point of the
  screen.
- **`/admin/finance/wallet-transactions` defaults to `type: funding`,
  not "everything."** `WalletTransaction` also records
  `contribution_debit` and `contribution_refund` entries — those are
  already visible per-cycle via the existing cycle/contribution
  endpoints, so defaulting the platform-wide finance screen to fundings
  avoids duplicating that view under a confusing "everything" umbrella.
  The `type` query param still allows widening it if needed.
- **An admin can't deactivate themselves.** This is checked in
  `PlatformAdminManagementService.setActive` before anything else — not
  because self-deactivation is inherently dangerous (any other admin
  could reactivate them), but because if they're the *only* active
  admin, there'd be no one left who could. Rather than reason about "are
  you the last one" at request time, the simpler and equally safe rule
  is just: never deactivate yourself, full stop.
