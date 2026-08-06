# ajo-mobile

Expo (React Native) member-facing app for **Ajo** — a digital thrift-collection
(esusu/ajo) platform. Users create or join savings groups, contribute in
rotating cycles, track payouts, fund their wallet, and receive notifications —
all from their phone. This is separate from `ajo-admin-web`, which is the
internal platform-staff console.

Built with Expo SDK 56 (React Native 0.85, React 19.2.3), React Navigation v7
(native-stack + bottom-tabs), and TypeScript.

## Features

### Auth
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
  admin controls (lock rotation, activate, auto-collect toggle).
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
- **Wallet summary** — View balance and recent transactions.
- **Fund wallet** — Top up via a Paystack payment link (redirects to
  authorization URL).
- **Bank account management** — Set and update a payout bank account
  (bank code, account number). Validated via Paystack's resolve account
  API before saving.

### Notifications (Sub-phase E)
- Full notification list with unread count badge.
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

- **4-tab bottom navigator:**
  - **My Groups** — Groups stack (list, create, detail, members, invite,
    lock rotation, activate, cycles, current cycle)
  - **Wallet** — Wallet home, fund wallet, bank account
  - **Alerts** — Notification list
  - **Profile** — Profile stack (view profile, edit, wallet, notifications,
    bank account, fund wallet)

- **Design tokens** (`src/theme/`) — A warm cream canvas and
  clay/terracotta primary palette distinct from `ajo-admin-web`'s
  ink-navy/gold ops-console aesthetic. No custom fonts loaded — uses
  system font stacks to keep dependencies light; swapping in a custom
  display face later is a contained change to `theme.ts` plus an
  `expo-font` load call in `App.tsx`.

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

- **The tab bar is text-only for now.** No icon library is installed
  yet — `@expo/vector-icons` ships bundled with Expo at zero extra
  install cost and is the natural choice when there's value in visually
  distinguishing tabs.

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
│   │   ├── Button.tsx
│   │   ├── ErrorBanner.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── Screen.tsx
│   │   └── TextField.tsx
│   ├── navigation/                  # React Navigation setup
│   │   ├── AuthNavigator.tsx        # Auth stack (phone entry, OTP)
│   │   ├── MainNavigator.tsx        # Main 4-tab navigator
│   │   ├── RootNavigator.tsx        # Switches auth/main based on session
│   │   └── types.ts                 # Navigation type definitions
│   ├── screens/                     # Screen components
│   │   ├── auth/
│   │   │   ├── OtpVerificationScreen.tsx
│   │   │   └── PhoneEntryScreen.tsx
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
2. `npm run lint` (ESLint via `eslint-config-expo`'s flat config) — clean.
3. `npx expo export --platform web` — a full Metro bundle, which surfaces
   import/wiring errors that type-checking alone won't catch.

What this **doesn't** verify: actual on-device behaviour (SecureStore's
real Keychain/Keystore integration, OTP autofill from
`textContentType="oneTimeCode"`, keyboard-avoiding behaviour, safe-area
insets on a notched device) — those need a real device or simulator
test pass before shipping.

## License

This project is proprietary and part of the Ajo platform.