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

> **`.env` is optional for local dev** — every variable in
> `src/config/env.validation.ts` has a working development default (port
> **5010**, the MongoDB URI, JWT secret, OTP length...) **except
> `PAYSTACK_SECRET_KEY`**, which deliberately has none. The test key that
> used to be committed here has been revoked by Paystack, so relying on it
> only produced `Paystack error: Invalid key` on every payout/withdrawal.
> Without a key the server still boots, but payment endpoints (wallet
> funding, virtual accounts, savings withdrawals, group payouts) answer
> **503** with *"Payments are not configured on this server:
> PAYSTACK_SECRET_KEY is missing or invalid…"*. Paste a valid key
> (Paystack Dashboard → Settings → **API Keys & Webhooks**) into `.env` and
> restart the server. If you *do* copy `.env.example`, note that it ships
> **placeholder** `JWT_ACCESS_SECRET` / `PAYSTACK_SECRET_KEY` values which
> would override those defaults — put real ones in before starting, or the
> app will authenticate differently and Paystack calls will 401.
>
> The API must be listening on **5010**: `ajo-mobile/.env` points at
> `http://localhost:5010`. If it isn't running, every mobile request fails
> immediately with a "can't reach the server" error (`ApiError` status 0).

In development, generated OTP codes are also written to the server logs
(`[DEV ONLY] OTP for +234...: 123456`) so you can test the flow without a
live Termii account/credit.

### Scheduled jobs & Vercel Cron

Two jobs run on a schedule (contribution reminders, defaulter flagging).
Savings are no longer auto-collected — members pay each interval from their
wallet themselves (see *Personal savings plans* below). On an always-on host
the jobs run
in-process via `@nestjs/schedule`. If you deploy the API to Vercel and drive
the jobs with [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) instead,
the crons in `vercel.json` hit the guarded `GET /cron/*` endpoints.

1. Generate the shared secret: `openssl rand -hex 32`
2. Set that value as `CRON_SECRET` in **both** places:
   - the Vercel project's env vars (Vercel attaches it as
     `Authorization: Bearer <CRON_SECRET>` to every cron request), and
   - this server's environment (so the `/cron/*` endpoints can verify it).
3. Where the server runs on Vercel, set `DISABLE_IN_PROCESS_CRONS=true` so the
   in-process `@nestjs/schedule` jobs don't also fire (duplicate jobs!).
   Keep it `false` on an always-on host where the in-process scheduler is the
   only trigger.
4. Deploy and confirm the jobs under Vercel → project → Settings → Cron Jobs.

Mapped endpoints — `GET /cron/reminders` (`0 9 * * *`),
`GET /cron/defaulters` (`0 10 * * *`). Requests without a matching
`Authorization: Bearer <CRON_SECRET>` header get `401`.

Local smoke test:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:5010/cron/reminders
```

### Paystack webhook (required for Phase 4 to fully work)

Wallet funding confirmation and payout finalization both rely on
`POST /webhooks/paystack`. In the Paystack dashboard:
- **Dedicated Virtual Accounts** must be enabled under Settings →
  Payment channels for members to receive a personal account number
  (bank-transfer funding). Set `PAYSTACK_DVA_PREFERRED_BANK` (wema /
  providus / sterling) to pick the first-choice issuing bank. Wema is
  live-only — in **test mode** Paystack only accepts providus/sterling, so
  the server automatically retries with a supported bank when the preferred
  one is rejected (`... is not available in test mode`).
- Enable **Transfers** and set the webhook URL to
  `https://<your-domain>/webhooks/paystack`. For local development, expose
  your dev server with a tool like [ngrok](https://ngrok.com) and use the
  generated HTTPS URL. Without this, funding/payouts that don't resolve
  synchronously will stay `pending` indefinitely — use
  `GET /wallet/fund/verify/:reference` as a manual fallback for funding
  while testing.

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
| POST   | `/groups/:id/terminate`     | Bearer JWT, group admin | — | Permanently ends a COMPLETED group: deletes the group and every group-scoped record (memberships, cycles, contributions, group wallet + its ledger, escrow deposits, payouts) in one Mongo transaction. Refuses while the group account still holds money. Members' personal `WalletTransaction` history is kept. |

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
- **terminated**: legacy only. Terminating a group now deletes it (see
  `POST /groups/:id/terminate`) rather than marking it, so this value only
  survives on rows written by older versions of the API. Those rows are
  invisible to the app (filtered out of `GET /groups`, Group-ID search and
  invites) and are purged with `npm run seed:purge-terminated-groups` — a dry
  run by default, `--confirm` to actually delete. A legacy group whose central
  account still holds money is skipped and reported so it can be paid out
  first.

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
- `User.dedicatedAccount` — a member's Paystack **Dedicated Virtual
  Account** (DVA): a personal bank account number they can transfer money
  into to fund their wallet. Created lazily, stored on the user, and
  reconciled by the `charge.success` webhook via the customer's phone.
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
| GET    | `/wallet/me`                | Bearer JWT | — | Current balance + last 20 ledger entries + the member's dedicated virtual account (when active) |
| POST   | `/wallet/fund/initialize`   | Bearer JWT | `{ amount }` (naira) | Starts a Paystack funding transaction; returns `{ authorizationUrl, reference }`. Requires the user to have an email set (`PATCH /auth/me`) |
| GET    | `/wallet/fund/verify/:reference` | Bearer JWT | — | Manually confirms a funding transaction (fallback to the webhook) |
| GET    | `/wallet/dedicated-account` | Bearer JWT | — | Returns the member's Paystack Dedicated Virtual Account, creating it lazily on first use (`{ accountNumber, accountName, bankName, ... }`). Requires DVA to be enabled on the Paystack business |
| POST   | `/wallet/dedicated-account/refresh` | Bearer JWT | — | Best-effort request for a new virtual account number (deactivates the old assignment when possible) |
| GET    | `/wallet/banks`             | Bearer JWT | — | Lists Nigerian banks (name + Paystack bank code) |
| GET    | `/wallet/bank-account`      | Bearer JWT | — | The member's saved payout bank account, or `null` |
| POST   | `/wallet/bank-account`      | Bearer JWT | `{ accountNumber, bankCode, bankName }` | Resolves the account via Paystack, creates a transfer recipient, and saves it as the payout destination |

### Cycles, contributions & payouts

| Method | Path                                                | Auth                    | Body | Notes |
|--------|-----------------------------------------------------|-------------------------|------|-------|
| POST   | `/groups/:id/activate`                              | Bearer JWT, group admin | — | Requires `Group.status === order_locked`. Creates Cycle 1, a `GroupWallet`, and a personal `Wallet` for every member who doesn't have one. Sets `status: active`. |
| GET    | `/groups/:id/cycles`                                | Bearer JWT              | — | All cycles, oldest first, each with a `paidCount` |
| GET    | `/groups/:id/cycles/current`                        | Bearer JWT              | — | Current open cycle + every member's contribution status |
| POST   | `/groups/:id/contributions/:contributionId/pay`            | Bearer JWT, member | — | Member pays their own contribution from their wallet: debits `amount` + the group's service fee, credits the `GroupWallet`, marks the contribution `paid` (`paymentMethod: wallet`). |
| POST   | `/groups/:id/contributions/:contributionId/notify-transfer` | Bearer JWT, member | `{ claimedReference?: string }` | Member reports a bank transfer into the group's escrow DVA. Debits the service fee and moves the contribution to `awaiting_confirmation`; the group admin is notified. |
| POST   | `/groups/:id/contributions/:contributionId/confirm`         | Bearer JWT, group admin | — | Verifies a claimed bank transfer: allocates the matching escrow deposit (or credits the `GroupWallet` if the money arrived out-of-band), credits the platform fee, marks the contribution `paid`. |
| POST   | `/groups/:id/contributions/:contributionId/reject`          | Bearer JWT, group admin | `{ reason?: string }` | Rejects a claimed bank transfer: contribution returns to `pending`, the service fee is refunded to the member, and any pre-linked escrow deposit is released back to the reconciliation queue. |
| GET    | `/groups/:id/escrow-account`                                | Bearer JWT, member | — | The group's escrow DVA (bank, account name/number, currency). `null` until provisioned. |
| POST   | `/groups/:id/escrow-account/refresh`                        | Bearer JWT, group admin | — | Deactivates and re-provisions the group's escrow DVA (e.g. if Paystack invalidated the number). |
| GET    | `/groups/:id/escrow-deposits`                               | Bearer JWT, group admin | — | The group's inbound escrow deposits (newest first) for reconciliation — sender, narration, amount, allocation state. |
| POST   | `/groups/:id/cycles/:cycleId/payout`                | Bearer JWT, group admin | — | Requires ALL contributions `paid` (claimed transfers must be confirmed or rejected first). Debits the `GroupWallet`, creates a `Payout`, and calls Paystack's Transfer API. If Paystack confirms synchronously, the rotation advances immediately; otherwise the webhook finalizes it. |

### Personal savings plans

Each member can run their own savings plans alongside the group circles.
A plan is defined by an amount, a frequency (daily / weekly / monthly) and a
cycle length (`durationUnit` + `durationValue`, e.g. 20 days or 6 months);
the number of intervals in a cycle is derived from those at creation.

**Saving is member-initiated — there is no auto-debit.** After creating a
plan the member presses "Pay" on the plan (mobile: Savings tab → plan) and
one interval's `amount` moves from their wallet into the plan's
`savingsBalance`:

- The payment runs in one Mongo transaction: the plan-ledger entry
  (`SavingTransaction`, unique `reference` =
  `saving_<planId>_<cycle>_<interval>`) is written first, then the wallet is
  debited (`WalletService.debitForSavings`, ledger type `savings_debit`), then
  the plan advances (`collectedCount`, `savingsBalance`, `lifetimeSaved`,
  `nextDueAt`).
- The unique reference makes the endpoint idempotent: a double tap / retried
  request hits the duplicate key, aborts the transaction, and returns the
  current plan instead of charging twice.
- An insufficient wallet balance rolls the whole transaction back and returns
  `400` with a top-up message — nothing is recorded.
- Paying the last interval flips the plan to `completed`, which unlocks the
  withdrawal to the member's saved bank account (Paystack transfer). After a
  successful withdrawal the member can continue (new cycle) or delete the
  plan.

`nextDueAt` is only a schedule label ("next payment due") — it never triggers
a debit. The old `*/10 * * * *` savings auto-collect cron
(`GET /cron/savings`) has been removed from both `vercel.json` and the
in-process scheduler.

| Method | Path                          | Auth       | Body | Notes |
|--------|-------------------------------|------------|------|-------|
| POST   | `/savings/plans`              | Bearer JWT | `{ name, amount, frequency, durationUnit, durationValue }` | Creates the plan. No money moves here — the first interval is due immediately. |
| GET    | `/savings/plans`              | Bearer JWT | — | The member's plans (deleted ones excluded), newest first |
| GET    | `/savings/plans/:id`          | Bearer JWT | Query: `page?`, `limit?` (default 10, max 50) | `{ plan, transactions, page, limit, total }` — the plan plus one page of its ledger, newest first. Out-of-range pages clamp to the last page. |
| POST   | `/savings/plans/:id/pay`      | Bearer JWT | — | Pays one interval from the wallet. `400` when the plan isn't `active`, every interval is already paid, or the wallet balance is too low. Idempotent per interval. |
| POST   | `/savings/plans/:id/withdraw` | Bearer JWT | — | Only when the plan is `completed`; pays `savingsBalance` to the member's bank account via Paystack |
| POST   | `/savings/plans/:id/continue` | Bearer JWT | — | Starts a new cycle on a withdrawn plan (`collectedCount`/`savingsBalance` reset) |
| DELETE | `/savings/plans/:id`          | Bearer JWT | — | Allowed after a withdrawal, or before any payment was made |

### Pool collections (pool donations)

A **pool collection** is a non-rotating donation pool: one member creates it,
shares its short **Group ID**, and other members join and donate from their
Ajo wallet. Donations accumulate in the pool's escrow and the pool admin pays
the escrow out to a bank account whenever they like. Nothing is
auto-debited — donors tap "Donate" themselves.

A pool is defined by:

- `amountType` — `fixed` (everyone gives `amount`) or `free_will` (the donor
  chooses, minimum ₦100).
- `schedule` — `one_time` (each member may donate once, ever) or `interval`
  with a `frequency` of `daily` / `weekly` / `monthly` / `yearly`.

**One donation per member per period** is enforced twice: a unique
`{group, user, period}` index on `Donation`, and a deterministic wallet
reference `don_<groupId>_<userId>_<period>`. Period keys are calendar-based
(`2026-10-25`, `2026-W43` ISO week, `2026-10`, `2026`) or the literal `once`
for one-time pools — see `src/donations/utils/donation-period.ts` and its
spec.

A donation runs in one Mongo transaction:

1. the `Donation` row is written first (its unique index is the idempotency
   guard, so a double tap aborts before money moves);
2. the wallet is debited (`WalletService.debitForDonation`, ledger type
   `donation_debit`);
3. the member's totals advance (and the pool's `donorCount` on their first
   donation);
4. `escrowBalance` / `totalCollected` are incremented and a
   `DonationEscrowTransaction` (`donation_credit`) records the movement.

A duplicate request is treated as success and returns the current pool state.
An insufficient wallet balance rolls everything back with a `400`.

**Payouts** mirror the cycle payout flow: the amount is reserved inside a
transaction (`escrowBalance` decremented with a `$gte` guard, PENDING
`DonationPayout` + `payout_debit` ledger row), the Paystack transfer is
initiated outside the transaction, test-mode OTPs are auto-resolved, and the
`transfer.success` webhook finalizes the row when Paystack answers
asynchronously. `totalPaidOut` only increases on success; a failed or reversed
transfer credits escrow back (`payout_reversal_credit`) and rolls
`totalPaidOut` back for a reversal. The destination defaults to the admin's
own saved `User.bankAccount`; the admin may instead store a pool-level
override (`payoutAccount`) resolved through Paystack.

**Ending a pool** is a two-key operation. Members who have paid 100% of their
contribution vote (`PUT /donations/groups/:id/termination-vote`); 2/3 of them
must vote yes, and every naira donated must already have been paid out. Only
the pool admin can press terminate (`POST /donations/groups/:id/terminate`),
and the service re-checks both gates so a stale screen cannot end a pool early.
Terminating **deletes** the pool and every record scoped to it — donations,
memberships, payouts, escrow movements — in one Mongo transaction; donors'
personal `WalletTransaction` history is kept. Nothing is left behind to show up
in a list, so `DonationGroupStatus.TERMINATED` only survives on legacy rows,
purged with `npm run seed:purge-terminated-pools` (dry run unless `--confirm`;
a pool whose escrow still holds money is skipped and reported).

| Method | Path                                    | Auth                    | Body | Notes |
|--------|-----------------------------------------|-------------------------|------|-------|
| POST   | `/donations/groups`                     | Bearer JWT              | `{ name, purpose, amountType, amount?, schedule, frequency? }` | Creates the pool + the admin's membership. `amount` is required for `fixed`; `frequency` for `interval`. |
| GET    | `/donations/groups`                     | Bearer JWT              | — | `{ groups, stats }` — every pool the caller belongs to (with their own giving and current-window state) plus dashboard totals. |
| POST   | `/donations/groups/join`                | Bearer JWT              | `{ groupId }` | Joins by the shareable Group ID (case/dashes normalised). Idempotent. |
| GET    | `/donations/groups/:id`                 | Bearer JWT, member      | — | Pool detail: escrow totals, caller's giving, whether they can donate now and when the window reopens, recent donations, admin payout destination. |
| GET    | `/donations/groups/:id/donations`       | Bearer JWT, member      | Query: `page?`, `limit?` (default 10, max 50) | Paginated donor history, newest first. Pages clamp to the last page. |
| POST   | `/donations/groups/:id/donate`          | Bearer JWT, member      | `{ amount? }` | Donates for the current period. Fixed pools ignore/validate `amount`; free-will pools require it. One per period, idempotent. |
| GET    | `/donations/groups/:id/payouts`         | Bearer JWT, pool admin  | Query: `page?`, `limit?` | Payout history + escrow balance + resolved destination. |
| POST   | `/donations/groups/:id/payouts`         | Bearer JWT, pool admin  | `{ amount? }` | Pays escrow out; omit `amount` to withdraw it all. |
| GET    | `/donations/groups/:id/payout-account`  | Bearer JWT, pool admin  | — | `{ poolAccount, adminAccount, destination }` |
| PUT    | `/donations/groups/:id/payout-account`  | Bearer JWT, pool admin  | `{ bankName, bankCode, accountNumber }` or `{ useAdminAccount: true }` | Stores a pool-level override (NUBAN resolved + transfer recipient created) or clears it. |
| PUT    | `/donations/groups/:id/termination-vote`| Bearer JWT, member      | `{ vote }` | Casts/withdraws the caller's vote to end the pool. Only members who paid 100% of their contribution may vote. |
| POST   | `/donations/groups/:id/terminate`       | Bearer JWT, pool admin  | — | Deletes the pool once 2/3 of the fully paid members voted yes AND everything donated has been paid out. Removes donations, memberships, payouts and escrow movements in one transaction; answers `{ groupId, status: 'terminated' }`. |

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
| `contribution_paid` | `POST .../contributions/:id/pay` | push + SMS (to the member) |
| `contribution_awaiting_confirmation` | `POST .../contributions/:id/notify-transfer` | push + SMS (to the group admin) |
| `contribution_confirmed` | `POST .../contributions/:id/confirm` | push + SMS (to the member) |
| `contribution_rejected` | `POST .../contributions/:id/reject` | push + SMS (to the member) |
| `escrow_deposit_received` | `charge.success` into a group's escrow DVA | push (to the group admin) |
| `payout_initiated` | `POST .../payout` (transfer call made) | push + SMS |
| `payout_success` | Transfer confirmed (sync or via webhook) | push + SMS |
| `payout_failed` | Transfer failed (sync or via webhook) | push + SMS (to the group admin) |
| `payout_reversed` | `transfer.reversed` webhook | push + SMS (to the group admin) |
| `wallet_funded` | `charge.success` confirmed (manual verify or webhook) | push |

### Endpoints

| Method | Path                              | Auth       | Body | Notes |
|--------|-----------------------------------|------------|------|-------|
| GET    | `/notifications`                  | Bearer JWT | Query: `limit?`, `skip?` | In-app inbox: `{ notifications, unreadCount, total }`, newest first (`total` powers the `Page x of y` pager) |
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
- `Group.autoCollectEnabled` — **deprecated**. Contributions are
  member-initiated (wallet debit, or a bank transfer into the group's
  escrow DVA which the group admin confirms), so nothing is bulk-debited
  any more and the old 8 AM auto-collect job has been removed. The field
  and its toggle endpoints are kept only for backwards compatibility.
- `GroupDashboardService` / `GroupDashboardController` — read-only
  endpoints for a group's own admin: current defaulters, full member
  standings (position, payout status, default count, current-cycle
  contribution status), and a per-cycle paid/pending/defaulted breakdown
  across the group's whole history.

### Auto-collect toggle

| Method | Path                        | Auth                    | Body | Notes |
|--------|-----------------------------|--------------------------|------|-------|
| PATCH  | `/groups/:id/auto-collect`  | Bearer JWT, group admin | `{ enabled: boolean }` | **Deprecated** — sets the legacy `autoCollectEnabled` flag. Contributions are member-initiated now, so this has no effect. |

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
| PATCH  | `/admin/groups/:id/auto-collect` | Bearer JWT, `platform_admin` | Body `{ enabled: boolean }` | **Deprecated** — platform-admin override of the legacy `autoCollectEnabled` flag. Nothing is auto-collected any more; kept for backwards compatibility. |

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
| GET    | `/admin/finance/service-charge-totals` | Bearer JWT, `platform_admin` | — | Service-charge balance: `totalCollected`, `totalReversed`, `netCollected`, `chargeCount`. Summed from the platform admin's `service_fee_credit` / `service_fee_debit` wallet entries; admin withdrawals are not netted off. |

The three list endpoints accept `groupId`/`userId` filters specifically so
a future "view this user/group's transactions" link can reuse the same
endpoint rather than needing a separate scoped route.

`service-charge-totals` backs the admin console's **Service Charges**
tab: every escrow-transfer fee and bank-payout fee is credited to the
platform admin's wallet as a `service_fee_credit` WalletTransaction, and
reversals (rejected bank-transfer contributions, reversed payouts) are
written back as `service_fee_debit` — so credits minus debits is what the
platform has actually collected.

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
- **Contributions are member-initiated.** A member pays from their own
  wallet (`POST .../contributions/:id/pay`, debits the wallet plus the
  service fee) or transfers into the group's escrow DVA and taps
  `POST .../contributions/:id/notify-transfer`. Nothing is bulk-debited:
  the old admin-triggered collection endpoint and the auto-collect cron
  were removed.
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
- **Payment reconciliation lives in two services.** `EscrowService` owns
  the group's DVA and inbound deposits (webhook → `EscrowDeposit` → group
  wallet credit, plus narration-based pre-matching), while `CyclesService`
  owns every contribution state transition (pay / notify / confirm /
  reject) so the contribution lifecycle has a single owner.
- **Scheduler run order matters.** The reminder job (9 AM) runs before the
  defaulter sweep (10 AM) so members are nudged before being flagged. The
  auto-collect job that used to run at 8 AM has been removed along with
  bulk collection.
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
