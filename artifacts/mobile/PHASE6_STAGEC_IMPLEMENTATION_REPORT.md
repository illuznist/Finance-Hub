# Finance Hub Phase 6 — Stage C Preparation

**Status:** Implementation prepared; not complete. A configured Supabase project is required for the live-backend, RLS, account-flow, and MFA acceptance checks.

## Preserved boundaries

- The device-local account, PIN, and biometric authentication remain separate from Supabase Auth.
- Online sign-in/out changes only the online Supabase session. It does not sign in/out of the local app, change the local finance profile, or move finance records.
- Finance records, backups, ledger calculations, and local entitlements remain device-local.
- No Supabase project was created or connected. No credentials were requested or set.
- No official Ctrl Studios email is embedded or assumed.
- No Super Admin has been assigned. The bootstrap procedure has not been run.
- RevenueCat purchases and the Admin Portal remain reserved for Stages D and E.
- App version remains 1.1.3; `main` remains unchanged.

## Prepared implementation

- Optional Supabase email/password registration and sign-in from Settings.
- Native sessions use Expo SecureStore with bounded, atomic chunks; web preview sessions are tab-scoped.
- Email verification and password recovery use an Expo Router callback route.
- Settings separates the optional online account from the existing local app account and shows verified identity and server-reported online access.
- Express validates bearer tokens with Supabase Auth, reads roles server-side, requires a verified email and `aal2` MFA for administrator routes, and records admin access checks.
- The server exposes account access, administrator access-check, and recent audit-read routes. It does not expose public role promotion or finance data.
- Versioned SQL prepares default `USER` role assignment, role constraints, promotional grants, RevenueCat identity-link placeholders, administrative audit logs, webhook event deduplication metadata, and RLS policies. No finance-record tables are created.
- Super Admin bootstrap is an explicit, idempotent server-side command that verifies the requested Supabase account and an enrolled MFA factor. Role assignment and its audit entry are transactional. The command requires a user ID and explicit approval flag; it has not been run.
- API schema and generated client now describe the protected account and admin routes.

## Offline and account-switching behavior

Online identity is device-session metadata only. A user can continue with the local app without connecting a Supabase account. Switching or signing out of an online identity does not switch the local profile, alter local finance data, or perform an account merge. No cloud sync or financial-record upload is implemented.

If the account endpoint is unavailable, the app reports online entitlement status as unavailable instead of inferring a grant. Stage C reports only Free, Promotional Pro, or Super Admin Pro. Paid Pro remains unavailable until Stage D verifies a store purchase.

## Verification status

The local regression suite, TypeScript checks, migration review, and Expo checks are to be recorded after the implementation batch. Supabase registration, recovery emails, session restoration against a real project, RLS isolation, MFA authorization, audit persistence, and iPhone account flows are **not yet tested**.

Stage C must not be marked complete until a project is configured, the migration is applied, and the required backend/device checks pass.

## Supabase setup required before live verification

1. Create a Supabase project owned by Ctrl Studios and choose a region appropriate for the product's users and obligations.
2. Enable email/password Auth and email confirmation. Configure an approved sender after the official Ctrl Studios email is ready.
3. Configure the `mobile://auth/callback` redirect for installed app builds and the exact Expo Go callback URL used during testing.
4. Enable TOTP MFA; enroll and verify the owner account before any administrative access.
5. Apply `supabase/migrations/20261115000000_optional_accounts_security.sql` in the project's SQL Editor after reviewing the SQL. Do not expose the service-role key to the mobile app.
6. Add the mobile public URL/key, server URL/service-role key, approved CORS origins, API origin, and redirect URL through Replit environment/secrets tools. Never paste values into chat or commit them.
7. Register a test user and run the account, RLS-isolation, MFA, admin-denial, and recovery-flow checks described in the delivery notes.
8. Only after a verified owner account and separate approval, run the one-time Super Admin bootstrap command with that user's UUID. No email address is compiled into the app or script.

No production credentials, paid services, project creation, migrations, or account bootstrap have been performed.
