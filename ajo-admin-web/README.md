# ajo-admin-web

Next.js (App Router) platform admin console for Ajo — restricted to
`role: platform_admin` accounts on `ajo-server`. This is an internal ops
tool for monitoring users, groups, and money movement across the whole
platform; it is separate from the member-facing `ajo-mobile` app.

## Sub-phase A — Project scaffold & auth

Implements:
- Next.js 16 (App Router) + Tailwind v4, with a hand-built design token
  system (see `app/globals.css`) rather than default shadcn/Tailwind
  grays — a warm canvas background, ink-navy chrome, and a single muted
  gold accent.
- A typed server-side API client (`lib/api/client.ts`) for calling
  `ajo-server`, plus an authenticated variant (`lib/api/authed-client.ts`)
  that attaches the session token automatically and redirects to
  `/login` on 401.
- Login flow: `POST /auth/admin/login` via a Server Action
  (`lib/auth/actions.ts`), session stored as an httpOnly cookie
  (`lib/auth/session.ts`) — the JWT never reaches client-side JS.
- Route protection via `proxy.ts` (Next 16's renamed middleware
  convention): unauthenticated visitors are redirected to `/login`;
  authenticated visitors hitting `/login` are redirected to `/`.
- Dashboard shell: sidebar nav + page header, with stub pages for
  **Users** and **Groups** (sub-phases B and C) showing what's coming and
  why they're not built yet.

## Setup

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_API_BASE_URL (defaults to http://localhost:3000,
# i.e. a local ajo-server)

npm install
npm run dev
```

You'll need a `platform_admin` account on `ajo-server` to sign in — see
that repo's `npm run seed:platform-admin` script.

## Architecture notes

- **The JWT never reaches the browser.** Every authenticated request is
  made from a Server Component, Server Action, or Route Handler, which
  reads the token from an httpOnly cookie and attaches it as a Bearer
  header. There is currently no client-side data fetching — this keeps
  the token fully off the client and matches the read-heavy,
  navigation-driven nature of an admin console (no need for optimistic
  UI or client-side cache invalidation yet).
- **Two layers of auth checking.** `proxy.ts` does a fast,
  presence-only cookie check (no JWT verification — that's not worth the
  complexity on the Edge runtime, and wouldn't change the outcome
  anyway) purely to avoid flashing a dashboard shell before a redirect.
  The actual authority is `ajo-server`: `authedFetch` redirects to
  `/login` the moment the backend returns 401 for any reason (expired,
  revoked, or never valid).
- **Fonts are system stacks, not next/font/google.** This avoids a
  network dependency at build time (this sandbox's egress allowlist
  blocks `fonts.googleapis.com`, and a build-time external fetch is also
  just not ideal for an internal tool's CI). The display/UI/mono role
  split is preserved with system serif/sans/mono stacks — swap in
  `next/font/google` in `app/layout.tsx` if you'd like real Source
  Serif 4 / Inter in your deployment; it's a small, isolated change.
- **`ApiError`** (`lib/api/api-error.ts`) carries the backend's actual
  validation message (joining NestJS's array-of-messages format) so
  forms can show real, specific errors — except for the login form,
  which deliberately shows a generic "Incorrect email or password" for
  any `ApiError`, mirroring `ajo-server`'s intentionally vague 401 (it
  doesn't distinguish "no such admin" from "wrong password", and neither
  should we).

## Sub-phase B — Users

Implements the Users directory and detail screens against
`ajo-server`'s new `/admin/users` endpoints:
- `app/(dashboard)/users/page.tsx` — paginated, searchable table of every
  registered user (name, phone, email, role, phone-verification status,
  bank-account-on-file status, join date). Search and pagination state
  live in the URL (`?search=&page=`) via a debounced client search box
  (`components/ui/search-input.tsx`) and plain `<Link>`-based pagination
  (`components/ui/pagination.tsx`) — the page itself stays a Server
  Component that re-fetches on navigation, so results are
  shareable/bookmarkable.
- `app/(dashboard)/users/[id]/page.tsx` — full detail view: profile,
  wallet balance, masked bank account, and every group membership with
  standing (role, invite status, rotation position, payout status,
  historical default count). Calls Next's `notFound()` when
  `ajo-server` returns 404, rendering the framework's standard not-found
  page rather than a generic error.
- `lib/data/users.ts` — typed data-access functions (`listUsers`,
  `getUserDetail`) wrapping `authedFetch`, kept separate from the page
  components so the fetch logic is independently testable/reusable.

## Sub-phase C — Groups

Implements the Groups directory and detail screens against
`ajo-server`'s new `/admin/groups` endpoints, following the same pattern
as Sub-phase B:
- `app/(dashboard)/groups/page.tsx` — paginated, searchable table of
  every group (name, status, contribution amount, frequency, slots,
  current cycle, auto-collect toggle state, created date), plus a row of
  status-filter pills (`open_for_invites` / `order_locked` / `active` /
  `completed`) that write to the `status` URL param.
- `app/(dashboard)/groups/[id]/page.tsx` — full detail view: settings,
  central wallet (`GroupWallet`) balance, the group admin (linking to
  their `/users/:id` page), every member's standing, the full cycle
  history with a paid/defaulted/pending breakdown per cycle, and the
  complete payout history — including failed and reversed transfers with
  their `failureReason`, not just successful ones, matching the backend's
  deliberate "show the failures too" design. The **Auto-collect** setting
  is an interactive switch (`components/auto-collect-toggle.tsx`) so
  platform staff can override the flag the group admin controls from the
  mobile app.
- `lib/data/groups.ts` — typed data-access functions (`listGroups`,
  `getGroupDetail`, `updateServiceFee`, `updateGroupAutoCollect`), same
  shape as `lib/data/users.ts`.
- `lib/status-display.ts` gained `cycleStatusTone` and
  `transferStatusTone` alongside the existing group/invite/payout
  helpers.

This closes the loop from Sub-phase B: the Users detail page's group
membership rows now link to a real `/groups/:id` page, and the new
Groups detail page's member rows and payout recipients link back to
`/users/:id` — both directions work.

## Sub-phase D — Financial oversight

Implements the Financial Oversight screen against `ajo-server`'s new
`/admin/finance/*` endpoints:
- `app/(dashboard)/finance/page.tsx` — a single page with three tabs
  (`components/ui/tabs.tsx`, server-rendered via Link + a `?tab=` URL
  param, same URL-state philosophy as search/pagination/status filters
  elsewhere in the app):
  - **Wallet Fundings** — every member's wallet top-up, with status
    (success/failed/pending), amount, balance after, and the Paystack
    reference, linking to the member's `/users/:id` page.
  - **Payouts** — every payout attempt across every group, including
    failed and reversed transfers with their failure reason — matching
    the same "show what went wrong, not just what worked" principle as
    the Sub-phase C group detail page. Links to both the group and the
    recipient.
  - **Group Wallet Ledger** — every group's central account movement
    (contribution credits, payout debits, reversal credits), linking
    back to the group.
- `lib/data/finance.ts` — typed data-access functions
  (`listWalletTransactions`, `listPayouts`, `listGroupWalletTransactions`),
  same shape as the Sub-phase B/C data-access files.
- `lib/status-display.ts` gained `walletTxStatusTone`,
  `walletTxTypeLabel`, `groupWalletTxTypeLabel`, and `groupWalletTxTone`.
- The Overview page's "Coming up next" placeholder (which referenced
  Users/Groups as not-yet-built) was replaced with real quick-link cards
  to Users, Groups, and Finance — it had gone stale once those screens
  actually shipped.
- Sidebar gained a **Finance** nav item.

## Sub-phase E — Admin management

Implements the Admin Management screen against `ajo-server`'s new
`/admin/admins` endpoints — closing the loop the original seed script
(`npm run seed:platform-admin`) explicitly deferred to. That script
should now only ever be needed once per environment.

- `app/(dashboard)/admins/page.tsx` — a create-admin form above a table
  of every existing `platform_admin` account.
- `create-admin-form.tsx` — a client component using `useActionState`
  (same pattern as the login form), surfacing `ajo-server`'s actual
  validation/conflict messages (e.g. "A user with this email already
  exists") rather than a generic failure.
- `admin-active-toggle.tsx` — a per-row Deactivate/Reactivate button
  using `useTransition` with a native `window.confirm()` guard (this is
  an internal ops tool — a confirm dialog is sufficient friction for a
  destructive-ish action, no need for a full modal). The row matching
  the **currently signed-in** admin shows "This is you" instead of a
  button — mirroring `ajo-server`'s own refusal to let an admin
  deactivate themselves, so the frontend doesn't even offer the action
  the backend would reject.
- `lib/data/admin-actions.ts` — two Server Actions: `createAdminAction`
  (form-bound, returns `{ error? }` for `useActionState`) and
  `setAdminActiveAction` (called directly from the toggle's
  `useTransition`, no form involved). Both call `revalidatePath("/admins")`
  on success so the table reflects the change without a manual refresh.
- Sidebar gained an **Admins** nav item; Overview's quick-links gained a
  fourth card.

This completes the originally scoped `ajo-admin-web` sub-phase plan
(A through E).

## Testing notes

There's no live `ajo-server` + MongoDB available in the environment this
was built in, so every sub-phase (B through E) was verified against a
small hand-written mock HTTP server matching the real `/admin/*`
response shapes exactly, with a forged JWT cookie standing in for a real
login session. This confirmed real data renders correctly,
search/pagination/status-filter/tab query params reach the backend, a
404 from the backend produces a real Next.js not-found page rather than
a 500, and — for Sub-phase E specifically — that mutations (create,
deactivate) actually persist and that the backend's authorization rules
(duplicate email → 409, self-deactivation → 403) are both enforced
server-side and correctly reflected in what the UI offers.

One genuine gotcha hit along the way, worth knowing: **`.env.local`
changes require restarting `next dev`** — editing it while the dev
server is running (or having a stale copy from an earlier step) silently
keeps the old values in effect. If `apiFetch` ever throws
`Unexpected token '<' ... is not valid JSON`, the most likely cause is
`NEXT_PUBLIC_API_BASE_URL` still pointing at the Next.js app itself
(or otherwise being stale) rather than at `ajo-server` — the JSON parse
is failing because it received Next's own HTML error page back, not a
real API response. When testing locally with a throwaway env file,
write it with `printf`/heredoc and verify its contents with `cat` before
starting `next dev`, in the same shell invocation — don't assume an
earlier edit persisted.

## What's next

All five originally scoped sub-phases (A–E) are complete. Possible
future work, not currently scoped:
- Editing an existing admin's name/email/phone (currently create +
  deactivate only — there's no update path).
- Audit logging for admin actions (who deactivated whom, and when) —
  currently `User.updatedAt` changes but there's no dedicated trail.
- Pagination on `/admins` if the admin list grows large enough to
  matter (currently unpaginated, matching `ajo-server`'s
  `GET /admin/admins` which returns the full list).
