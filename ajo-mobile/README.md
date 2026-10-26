# ajo-mobile

Expo (React Native) member-facing app for **Ajo** — a digital thrift-collection
(esusu/ajo) platform. Users create or join savings groups, contribute in
rotating cycles, track payouts, fund their wallet, and receive notifications —
all from their phone. This is separate from `ajo-admin-web`, which is the
internal platform-staff console.

Built with Expo SDK 57 (React Native 0.86, React 19.2.3), React Navigation v7
(native-stack + bottom-tabs), and TypeScript.

## Features

### Auth
- **Welcome screen** — the app's first branded surface: full-bleed forest
  green, transitional-serif headline, the "ajo pot" mark (`PotMark`,
  drawn with `react-native-svg`), and a gold primary CTA. Shown right
  after the splash and the source of the shared `forest*` / `gold*`
  theme tokens later screens will use.
- **Sign-in screen** — `PhoneEntryScreen`, the light counterpart to the
  welcome surface: pale forest canvas, serif "Welcome back." headline,
  tall rounded fields, a filled forest-green CTA, an `or` divider and a
  fingerprint affordance. Fields use `TextField variant="light"`, which
  swaps the eye glyph for a "Show"/"Hide" text toggle, and `Button`'s
  new `forest` / `outlineLight` variants carry the CTAs. Powered by the
  `forestLight*` / `forestAction` tokens.
  - **"Use fingerprint" is designed but not wired.** The app ships no
    biometric module, and signing in from the keychain-stored
    "Remember me" credentials with no biometric gate would let anyone
    holding the unlocked phone straight in — so the button explains
    itself instead of silently doing nothing. Wiring it up means
    `expo-local-authentication` (`hasHardwareAsync` → `isEnrolledAsync`
    → `authenticateAsync`) gating that stored credential.
  - Two deliberate deviations from the source design: the footer reads
    "New to Ajo?" (the mock's "Kolo" is the template's placeholder
    brand), and "Remember me" is kept — sharing the "Forgot password?"
    row — because it's where the existing credential prefill lives.
- **Create-account screen** — `RegisterScreen`, built on the same light
  surface as sign-in: a circular back button beside a centred serif
  "Create account" title, `TextField variant="light"` fields (Full name,
  Phone number, Email, Password with the "Show" toggle), an "I agree
  to…" terms checkbox, a filled forest-green `Continue` and a "Sign in"
  footer.
  - **No step indicator.** The source design carried a "Step 1 of 3"
    progress bar, but registration is a single step in this app — there
    is no PIN/KYC wizard to continue into — so the step chrome was
    dropped rather than faked.
  - **Email stays required, despite the mock labelling it
    "(optional)".** ajo-server's `RegisterDto.email` is a required,
    validated address, so the field keeps its real label and validation
    instead of promising something the API rejects.
  - **No "Confirm password" field** (the mock has none), so that typo
    guard is gone; the server's password rule (≥6 characters, at least
    one letter and one number) is now also enforced client-side, so a
    weak password no longer survives until the round-trip.
  - **Full name is written after verification.** `POST /auth/register`
    accepts only `{ phone, email, password }`, so the name rides along in
    `OtpVerification`'s params and is saved with `PATCH /auth/me` once the
    code has produced a token. Best-effort — a failure there never blocks
    sign-in, and Profile → Edit Profile can set it later.
  - The Terms/Privacy phrases are plain text: the app has no hosted legal
    URLs yet, so they aren't tappable.
- Phone + OTP authentication (`POST /auth/otp/request`, `POST /auth/otp/verify`)
- Phone number normalisation — accepts common Nigerian local formats
  (`0801...`, `8012345678`) and converts to E.164 client-side before reaching
  the API.
- Session persisted via `expo-secure-store` (Keychain/Keystore), with an
  in-memory cache for synchronous token reads on every request.
- Token validation on launch — `GET /auth/me` confirms the stored token is
  still valid before routing to the authenticated shell. Expired/revoked
  tokens automatically route back to sign-in.
- Profile editing (name, email).

### Groups (Sub-phase B)
- **List** — Shows all groups the user belongs to, with status badges,
  contribution amount/frequency, the user's role (admin/member), and
  pending invite count banner.
- **Create** — Set name, contribution amount, frequency (daily/weekly/monthly),
  number of slots, and rotation method (manual/random).
- **Detail** — View group info, member roster, current cycle, and
  admin controls (lock rotation, activate).
- **Invite members** — Invite by phone number; invites create a pending
  membership that the invitee can accept or decline.
- **Lock rotation** — For manual-order groups, arrange the payout order
  and lock it before the group can be activated.
- **Activate group** — Start the first cycle once members and rotation
  are ready.
- **Auto-collect** — Toggle automatic contribution debiting from the
  member's wallet.

### Cycles & Contributions (Sub-phase C)
- **Current cycle** — Shows the active cycle with recipient info, due date,
  contribution amount, and a per-member contribution status table
  (pending/paid/defaulted).
- **Cycle list** — Browse all past and present cycles for a group.
- **Cycle detail** — Drill into a specific cycle's contributions.

### Wallet & Payments (Sub-phase D)
- **Wallet home** — redesigned to the fintech home-screen mock: a light
  forest canvas with a time-of-day greeting + avatar, a dark green
  "Wallet balance" card showing the live wallet balance (alone) plus a
  white-on-translucent "Fund wallet" button, whose footer counts
  *active circles* and *savings goals* from live data, "Your circles"
  rows with a next-collector pill ("You collect · 2d") computed per active
  group from its current cycle, and "Personal savings" rows with a
  "₦saved of ₦target · percent" read-out (its "See all" and each row
  jump to the Savings tab). Two deliberate deviations
  from the mock: the template's Send/Request affordances don't exist
  in ajo-server, so the card's only control is the "Fund wallet" button;
  and the mock's Home/Circles/Save/Wallet tab bar is replaced by the
  app's own tabs (this screen is the Wallet tab's home).
- **Wallet summary** — View balance and recent transactions (the
  "Wallet activity" link at the bottom of the home screen).
- **Fund wallet** — Top up via a Paystack payment link (redirects to
  authorization URL).
- **Bank account management** — Set and update a payout bank account
  (bank code, account number). Validated via Paystack's resolve account
  API before saving.

### Notifications (Sub-phase E)
- Full notification list with unread count badge.
- The inbox is paged **10 per page** (the flat list fetches
  `GET /notifications?limit=10&skip=…`), with a `Page x of y` pager and a
  "`1–10 of 23`" range caption under the list. Marking read refreshes the
  current page in place.
- Notification types: group invites, activation, rotation locked,
  contribution due reminders, contribution debited/failed/defaulted,
  payout initiated/success/failed/reversed, wallet funded.
- Mark notifications as read.

## Architecture

- **No Expo Router.** This project uses React Navigation directly
  (`@react-navigation/native` + `native-stack` + `bottom-tabs`), per an
  explicit product decision. Don't add `expo-router` — SDK 56's
  `expo-doctor` explicitly flags having both installed as a likely
  mistake, and the navigation structure (`src/navigation/`) isn't
  file-based.

- **5-tab bottom navigator** — the bar carries only the money screens;
  Profile and Alerts open from the avatar chip instead:
  - **Wallet** — Wallet home, fund wallet, bank account, transactions
  - **Savings** — Personal savings stack (plan list, create plan, plan
    detail). Plans are funded **by the member**: each interval is paid
    from the Ajo wallet with the "Pay" button on the plan — nothing is
    debited automatically. The plan's "Recent activity" ledger is paged
    **10 entries per page** (`GET /savings/plans/:id?page=…&limit=10`)
    using the shared `Pagination` component.
  - **My Groups** — Groups stack (list, create, detail, members, invite,
    lock rotation, activate, cycles, current cycle)
  - **Pools** — Pool collections stack (list + dashboard stats, create
    pool, join by Group ID, pool detail with the donate action, paginated
    donor history, and an admin-only payout screen where the destination
    account can be changed). Donations are debited from the Ajo wallet;
    the admin pays the pool's escrow out to a bank account.
  - **Bills** — Airtime, data, cable and electricity purchases

- **Account menu instead of Profile/Alerts tabs** —
  `src/components/AccountMenu.tsx` renders the member's initials as an
  avatar chip pinned to the top-right corner of every tab root (Wallet
  home's greeting, My Groups, Personal Savings, Pay Bills). Tapping it
  drops a card with **Alerts** (shows a red dot plus the unread count,
  refreshed when the screen gains focus) and **Profile**
  (name + phone). Both routes live in the Root stack's `Account`
  navigator (`src/navigation/AccountNavigator.tsx`), so they slide in
  **over** the tab bar and carry their own back chip
  (`SubpageHeader`) — Alerts also pages **10 rows at a time**. Profile's
  "Wallet" / "Bank account" rows hop back to the Wallet tab rather than
  mounting a second copy of that stack.

- **Design tokens** (`src/theme/`) — one forest brand on two grounds. A
  deep forest-green surface with a gold action colour (`forest`,
  `onForest*`, `forestLine`, `gold*`) powers the hero surfaces (welcome,
  cycle banners); the same brand on a *light* ground
  (`forestLightCanvas`, `forestLightField`, `forestLightLine`,
  `forestLightInk*`, `forestAction`) is the app-wide canvas carrying
  white cards, dark-green ink and green CTAs. The original
  warm-cream/clay palette was deleted with the final screen migration.
  No custom fonts loaded — the serif display face is
  a platform system serif (`typography.fontFamilies.serif`, Georgia on
  iOS) so headlines read as designed without dependencies;
  swapping in a bundled face (e.g. Fraunces/Playfair) later is a
  two-line change in `theme.ts` plus an `expo-font` load call in
  `App.tsx`.

- **Typed API client** (`src/api/`) — Mirrors `ajo-server`'s endpoints
  with hand-written TypeScript types. Each domain (auth, groups, cycles,
  wallet, notifications) has its own module. 401 handling is managed by
  `AuthContext` reacting to thrown `ApiError`s rather than redirecting
  directly.

- **Token validation, not just presence, gates "signed in."**
  `AuthContext`'s bootstrap effect calls `GET /auth/me` and only flips
  to `signedIn` on success. A 401 during bootstrap clears the stored
  token and routes to sign-in.

- **Phone number normalisation happens client-side, before the API
  call.** `ajo-server` requires strict E.164 (`/^\+[1-9]\d{7,14}$/`).
  The client accepts local Nigerian formats and converts them before
  validation.

- **The OTP code length isn't hardcoded to 6 digits** in the UI, even
  though that's `ajo-server`'s configured default. The verification
  screen uses a generic numeric input rather than a rigid 6-box widget.

- **The tab bar uses `@expo/vector-icons` (Ionicons)** — each tab has a
  filled/outline icon pair tied to its focus state.

## Setup

```bash
cp .env.example .env
# fill in EXPO_PUBLIC_API_BASE_URL — see the comments in .env.example
# for the right value depending on iOS Simulator / Android Emulator /
# physical device + Expo Go

npm install
npm start
```

You'll need a registered user on `ajo-server` to sign in — any phone
number works via the OTP flow (no pre-registration step; `ajo-server`
creates the user record on first successful OTP verification). In
development, `ajo-server` logs the generated OTP code to its own
console instead of requiring a live Termii SMS account — see that
repo's README for details.

## Project Structure

```
ajo-mobile/
├── App.tsx                          # Root component
├── index.ts                         # Entry point
├── src/
│   ├── api/                         # API client modules
│   │   ├── api-error.ts             # ApiError class
│   │   ├── auth.ts                  # Auth endpoints
│   │   ├── authed-client.ts         # Authenticated fetch wrapper
│   │   ├── client.ts                # Base API client
│   │   ├── cycles.ts                # Cycle endpoints
│   │   ├── groups.ts                # Group endpoints
│   │   ├── notifications.ts         # Notification endpoints
│   │   └── wallet.ts                # Wallet endpoints
│   ├── auth/                        # Auth context & token storage
│   │   ├── AuthContext.tsx           # Session state management
│   │   └── token-storage.ts         # SecureStore + in-memory cache
│   ├── components/                  # Reusable UI components
│   │   ├── AccountMenu.tsx          # Top-right avatar chip → Alerts / Profile
│   │   ├── Button.tsx
│   │   ├── ErrorBanner.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── Pagination.tsx           # Prev / "Page x of y" / Next pager
│   │   ├── PotMark.tsx
│   │   ├── Screen.tsx
│   │   ├── SubpageHeader.tsx        # Back chip + serif title
│   │   └── TextField.tsx
│   ├── navigation/                  # React Navigation setup
│   │   ├── AccountNavigator.tsx     # Profile + Alerts stack (above the tabs)
│   │   ├── AuthNavigator.tsx        # Auth stack (phone entry, OTP)
│   │   ├── MainNavigator.tsx        # Main 5-tab navigator
│   │   ├── RootNavigator.tsx        # Switches auth/main based on session
│   │   └── types.ts                 # Navigation type definitions
│   ├── screens/                     # Screen components
│   │   ├── auth/
│   │   │   ├── OtpVerificationScreen.tsx
│   │   │   ├── PhoneEntryScreen.tsx
│   │   │   └── WelcomeScreen.tsx
│   │   └── home/
│   │       ├── ActivateGroupScreen.tsx
│   │       ├── BankAccountScreen.tsx
│   │       ├── CreateGroupScreen.tsx
│   │       ├── CurrentCycleScreen.tsx
│   │       ├── CycleDetailScreen.tsx
│   │       ├── CyclesListScreen.tsx
│   │       ├── EditProfileScreen.tsx
│   │       ├── FundWalletScreen.tsx
│   │       ├── GroupDetailScreen.tsx
│   │       ├── GroupMembersScreen.tsx
│   │       ├── GroupsListScreen.tsx
│   │       ├── GroupsScreen.tsx
│   │       ├── InviteMemberScreen.tsx
│   │       ├── LockRotationScreen.tsx
│   │       ├── NotificationsScreen.tsx
│   │       ├── ProfileScreen.tsx
│   │       └── WalletHomeScreen.tsx
│   ├── theme/                       # Design tokens
│   │   ├── index.ts
│   │   └── theme.ts
│   ├── types/                       # TypeScript type definitions
│   │   └── api.ts                   # API response/request types
│   └── utils/                       # Utilities
│       ├── format.ts                # Currency, date, status formatting
│       └── phone.ts                 # Nigerian phone number normalisation
└── assets/                          # App icons (favicon, splash, etc.)
```

## Verification

The project passes:
1. `npx tsc --noEmit` — clean, no type errors.
2. `npm run lint` (ESLint via `eslint-config-expo`'s flat config) — clean
   for every screen that's been redesigned. Two pre-existing
   error-level findings remain in screens nobody has touched yet
   (`CableSubscriptionScreen`'s setState-in-effect,
   `ContinueGroupScreen`'s unescaped quotes); the rest are
   `exhaustive-deps` / unused-import warnings in older screens.
3. `npx expo export --platform web` — a full Metro bundle, which surfaces
   import/wiring errors that type-checking alone won't catch.

What this **doesn't** verify: actual on-device behaviour (SecureStore's
real Keychain/Keystore integration, OTP autofill from
`textContentType="oneTimeCode"`, keyboard-avoiding behaviour, safe-area
insets on a notched device) — those need a real device or simulator
test pass before shipping.

## License

This project is proprietary and part of the Ajo platform.