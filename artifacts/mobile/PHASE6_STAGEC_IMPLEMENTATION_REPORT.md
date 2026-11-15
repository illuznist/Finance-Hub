# Finance Hub Phase 6 — Stage C Preparation

**Status:** Implementation prepared; not complete. A configured Supabase project is required for the live-backend, RLS, account-flow, and MFA acceptance checks.

## Preserved boundaries

- The device-local account, PIN, and biometric authentication remain separate from Supabase Auth.
- Online sign-in/out changes only the online Supabase session. It does not sign in/out of the local app, change the local finance profile, or move finance records.
- Finance records, backups, ledger calculations, and local entitlements remain device-local.
- The owner created a new Frankfurt Supabase project in the Ctrl Studios organization and connected its four required variables through Replit Secrets. The values were not read or recorded by this work.
- The retired Tokyo project's exposed credentials were not used.
- The owner confirmed both authentication redirect URLs and email confirmation are configured in Supabase Auth.
- No official Ctrl Studios email is embedded or assumed.
- No Super Admin has been assigned. The bootstrap procedure has not been run.
- RevenueCat purchases and the Admin Portal remain reserved for Stages D and E.
- App version remains 1.1.3; `main` remains unchanged.

## Prepared implementation

- Optional Supabase email/password registration and sign-in from Settings.
- Native sessions use Expo SecureStore with bounded, atomic chunks; web preview sessions are tab-scoped.
- Email verification and password recovery use an Expo Router callback route.
- Settings separates the optional online account from the existing local app account and shows verified identity and server-reported online access.
- Express verifies user JWTs through Supabase Auth independently of the API key, reads roles server-side, requires a verified email and `aal2` MFA for administrator routes, and records admin access checks.
- Mobile configuration accepts only `sb_publishable_...` keys. The API server accepts only `sb_secret_...` keys; the secret key remains server-only and maps to the RLS-bypassing `service_role`.
- The server exposes account access, administrator access-check, and recent audit-read routes. It does not expose public role promotion or finance data.
- Versioned SQL prepares default `USER` role assignment, role constraints, promotional grants, RevenueCat identity-link placeholders, administrative audit logs, webhook event deduplication metadata, and RLS policies. No finance-record tables are created.
- Super Admin bootstrap is an explicit, idempotent server-side command that verifies the requested Supabase account and an enrolled MFA factor. Role assignment and its audit entry are transactional. The command requires a user ID and explicit approval flag; it has not been run.
- API schema and generated client now describe the protected account and admin routes.

## Offline and account-switching behavior

Online identity is device-session metadata only. A user can continue with the local app without connecting a Supabase account. Switching or signing out of an online identity does not switch the local profile, alter local finance data, or perform an account merge. No cloud sync or financial-record upload is implemented.

If the account endpoint is unavailable, the app reports online entitlement status as unavailable instead of inferring a grant. Stage C reports only Free, Promotional Pro, or Super Admin Pro. Paid Pro remains unavailable until Stage D verifies a store purchase.

## Verification status

The following local checks passed:

- Mobile regression suite: 240 tests passed, including financial-ledger, migration/recovery, localization, entitlement, and secure-session-storage coverage.
- API authorization, JWT-verification, modern-key-format, migration-safety, and bootstrap suite: 18 tests passed.
- Mobile and API TypeScript checks passed.
- API production bundle built successfully.
- Expo dependency alignment check passed; no dependency changes were made.
- Expo Doctor passed all 20 checks.
- iOS and Android JavaScript exports completed with the updated key configuration.
- Frozen pnpm installation and `git diff --check` passed.
- The running API health route returned 200; account and admin routes returned generic 401 responses without a session.
- The browser preview loaded the existing local-account gate. The protected Settings/account UI was not visually checked because the preview is not signed in.

These are source-level and local checks only. Supabase registration, recovery emails, session restoration against a real project, live RLS isolation, MFA authorization, audit persistence, and iPhone online-account flows are **not yet tested**.

Stage C must not be marked complete until a project is configured, the migration is applied, and the required backend/device checks pass.

## Remaining Supabase setup and approval gates

1. Use only the Frankfurt project and its newly issued keys; do not use the retired Tokyo project's exposed credentials.
2. The four required Replit Secrets are present. Source and active iOS/web bundles use the publishable key only; the server secret is not included in those bundles.
3. The owner confirmed both `mobile://auth/callback` and the current Expo Go callback are allowlisted, and email confirmation is enabled. Sender delivery and actual confirmation/recovery flows still need a test account and real-device verification.
4. Review `supabase/STAGE_C_MIGRATION_REVIEW.md` for the static security review, read-only preflight SQL, and post-migration checks. Migration execution remains pending explicit approval.
5. TOTP MFA must be enrolled and verified on the owner account before any administrative access. Super Admin bootstrap remains a separate, explicitly approved action requiring verified email and MFA.

No secret values have been read or recorded. No migration has been applied, no test user has been created, and no account bootstrap has been performed.
