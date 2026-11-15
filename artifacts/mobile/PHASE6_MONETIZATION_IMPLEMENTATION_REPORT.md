# Finance Hub Phase 6 — Stage A Architecture and Stage B Implementation

**Status:** Stage A approved; Stage B implemented and user-verified on iPhone; Stage C is in progress. Stages D–F have not started.
**Prepared:** 2026-11-15
**Protected baseline:** `finance-hub-v1.1.3-verified` at `980ba97d03f0041d05901e15878cb9bc0be5d35c`
**Development branch:** `phase6/monetization`

## 1. Current-state review

- The verified v1.1.3 baseline is on `main`; this Phase 6 branch starts from that tag. The main branch and tagged build are unchanged by this review.
- Finance records are local-first. The mobile app's existing account, PIN, and biometric flows are device-local; they are not remote account authentication.
- The current legal/support copy says Finance Hub does not upload finance records and has no hosted account service. Adding optional online accounts and purchase metadata will require clear privacy disclosures before release.
- `artifacts/api-server` is an Express service with a health route, but no account, purchase, or admin endpoints yet.
- `lib/db` is a PostgreSQL/Drizzle scaffold with an empty schema. It is not currently the app's finance-record store.
- RevenueCat is available as an integration but is not connected. No Supabase integration or project is currently connected.
- The app currently has no admin portal. The final app name, icon, bundle identifiers, and splash artwork remain out of scope for this phase.

## 2. Recommended architecture

Use **Supabase Auth + PostgreSQL with row-level security** for optional remote identities, role assignments, and minimal operational/audit records. Reuse the existing Express API server as the trusted server boundary for privileged operations and RevenueCat webhooks. Do not move the local finance ledger to Supabase or Replit.

Use **RevenueCat with `react-native-purchases`** for StoreKit product metadata, Apple non-consumable purchase handling, restore, and store-backed Pro entitlements. RevenueCat is the authority for paid store purchases and refund/revocation state. Keep the store price in App Store Connect and render the localized price returned by the store SDK; do not hardcode `99.99 SAR` in the UI. The future `249.99 SAR` price remains inactive.

**Why RevenueCat over direct StoreKit:** RevenueCat provides a maintained cross-platform purchase/restore and entitlement layer, reducing the amount of receipt verification, transaction deduplication, refund/revocation handling, and account-transfer behavior Finance Hub would otherwise have to build and maintain. Direct StoreKit plus App Store Server APIs avoids RevenueCat's usage fee, but makes those verification and lifecycle responsibilities Finance Hub's ongoing operational burden. Revisit direct integration only if RevenueCat's cost becomes material and there is capacity to own that infrastructure.

**Why Supabase over the existing database scaffold:** the current `lib/db` schema is empty and has no active account/admin logic. Supabase provides managed Auth and Postgres RLS needed for optional accounts and roles. Replit Postgres remains a possible alternative, but would require building and operating more of the authentication/MFA and authorization layer ourselves. Supabase adds an external service and a production baseline cost; this is an explicit tradeoff, not a migration of finance storage.

Build the **Ctrl Studios Admin Portal as a separate React/TypeScript web app**. Host it as a private, invite-only Replit deployment if the account and plan support that access mode. Protect it again with Supabase authentication, MFA, and server-side role checks; Replit's deployment privacy is an additional gate, not a substitute for application authorization. `admin.ctrlstudios.com` remains provisional until domain ownership and DNS are confirmed.

### Authority boundaries

| Concern | Authority |
|---|---|
| Local financial records | Existing on-device Finance Hub database |
| Local PIN / Face ID | Existing native device security |
| Optional online identity | Supabase Auth |
| User role and admin authorization | Server-controlled Supabase data and API checks |
| Apple purchase and paid entitlement | RevenueCat backed by App Store transactions |
| Promotional grant | Server-authorized RevenueCat grant, with a separate internal audit record |
| Super Admin override | Server-managed role/entitlement response; never a client-editable preference |

Keep account role separate from feature entitlements. A `SUPER_ADMIN` role may receive Pro access, but it does not turn a local flag into proof of a paid purchase.

## 3. Free and Pro policy proposal

Apply creation limits in one shared entitlement/policy service and call it from every route that creates the limited resource:

- **Free:** one active wallet/bank account total, one active loan, and three active EMI agreements.
- **Unlimited:** ordinary income and expense entries.
- **Pro:** unlimited wallets/accounts, loans, and EMIs; advanced analytics and cash-flow forecasting.
- Do not limit dashboard, transaction history, PIN/Face ID, language/calendar preferences, encrypted backup/restore, or export.
- Count only active, non-archived wallets/bank accounts, loans, and EMI agreements. Completed loans and EMIs do not consume active slots. Archived wallets do not consume the active-wallet slot, but remain in the app with their original balance, linked transactions, and history.
- If a user already has more than the Free limit, preserve every record. Block only creation of additional limited resources. Continue to allow viewing, editing, payment recording, export, backup, restore, and ordinary transaction entry.
- If Pro expires or a paid purchase is refunded, preserve all data and allow existing records to be managed; only new limited-resource creation is restricted until the account is within Free limits.
- `Deleted` means the user deliberately removed that record using the existing deletion flow. The paywall must never recommend deletion as a way to obtain access.

### Wallet archival and replacement policy

- One active-wallet slot is shared across every supported account type and currency.
- Archiving is a reversible status change on the wallet record only. It must not delete, detach, rewrite, or recalculate any transaction, payment, opening balance, or historical balance.
- Archived wallets remain visible in a separate history section, remain included in recorded balance/net-worth calculations, and are excluded from selectors for new transactions. Existing transactions and their account identity remain accessible.
- A Free user may create one active replacement after archiving the current active wallet. The cap is concurrent active capacity, not a lifetime creation quota: users may replace a wallet when their banking relationship changes, but cannot have more than one active wallet at a time. This is intentional; the archived history is not deleted and does not grant simultaneous multi-wallet access.
- Reactivating an archived wallet checks the same active-wallet limit. If a Free user already has an active wallet, reactivation is blocked with a clear upgrade/archive choice. Pro users may reactivate without that cap.
- If imported or pre-existing data has multiple active wallets, keep every wallet and all history manageable. Block additional Free wallet creation and block reactivation only when it would further exceed the active limit; do not auto-archive or delete anything.

## 4. Guest purchases, linking, and offline behavior

- Free use remains available without registering an online account. Guest finance data remains entirely local.
- A guest can purchase Pro using RevenueCat's anonymous customer identity; do not require an account before checkout.
- Restore uses the same Apple App Store account and RevenueCat restore flow. After reinstall, the user can restore the non-consumable purchase without transferring finance records.
- If the user later opts into an online account, link the RevenueCat identity to the authenticated Supabase user only through an explicit, verified account-linking flow. Never link by an unverified email address. Do not upload or merge finance data.
- Use RevenueCat's cached customer information for offline entitlement display. A refund or revocation made while offline cannot be known until the device reconnects; reconcile with RevenueCat on reconnect and make the status timestamp/connection state clear. An offline cache is not a new purchase receipt.
- Expo Go may use an isolated development/testing adapter only. Actual Apple purchase testing requires a native development build or TestFlight with App Store sandbox configuration. The testing adapter must never report a successful production purchase.

## 5. Minimal backend data and security

Proposed Supabase data is limited to:

- Auth-managed user identity; a minimal profile only if the portal needs display fields.
- Server-controlled role assignments (`USER`, `ADMIN`, `SUPER_ADMIN`).
- RevenueCat/Supabase identity-link metadata needed for verified account linking.
- Promotional-grant operation/audit records.
- Administrative audit records and failed authorization events.
- A minimal webhook inbox/deduplication key and processing result, not a second purchase database.

Do **not** create financial-record tables, customer transaction/balance data, product catalogs, or a competing purchase/entitlement source of truth. For purchase status, query RevenueCat's verified state rather than maintaining duplicate purchase records.

Security controls required before production:

1. Supabase RLS on every user-accessible table. Clients cannot assign roles, grant Pro, edit audit records, or call privileged operations directly.
2. Keep Supabase service-role/database secrets and RevenueCat secret API/webhook credentials on the server only. Public Supabase/RevenueCat SDK keys are not authorization.
3. Validate Supabase identity and server-side role on every admin/API request. Require MFA for administrators, with recent-authentication checks for role and grant changes.
4. Authenticate RevenueCat webhooks, validate event shape, process idempotently, and reject replays/invalid requests.
5. Bootstrap the owner as Super Admin with an explicit, authorized, idempotent server-side procedure after identity verification and MFA. Never auto-promote the first user or hardcode an email, password, or personal identity.
6. Log actor, action, target, timestamp, and result for role/grant changes and failed admin authorization. Do not log secrets or finance records.
7. Treat a private deployment as defense in depth only. The app's API must still reject unauthenticated and unauthorized users.
8. Restrict the existing API's permissive default CORS policy to known portal/app origins before adding privileged routes. CORS is not authentication; also add request limits and rate limiting to admin and webhook routes.
9. Update privacy/legal text to describe optional account data, RevenueCat purchase processing, and the fact that finance records stay on-device.

### Account and purchase metadata shown to admins

Registered-account counts come from Supabase Auth. Anonymous local users are not registered accounts and must not be estimated or displayed as such. Paid purchase status and refunds come from RevenueCat. Promotional grants and admin activity come from the server audit log. If a metric cannot be verified from those systems, show it as unavailable rather than infer it.

The portal must label **Paid Pro**, **Promotional Pro**, and **Super Admin Pro access** separately. Count a purchase as a paid sale only when RevenueCat reports a verified store transaction. Show refunds/revocations separately and exclude them from current paid-entitlement counts; promotional grants and Super Admin access are never paid sales or paid revenue. Revenue reporting comes from verified RevenueCat data, not from plan labels or local client flags. Do not store or display finance records, balances, savings, loan amounts, or notes in the admin backend.

## 6. Accounts, credentials, and cost estimate

No account or credential is needed for this architecture review. Do not send credentials in chat.

| Provider | Needed for later stages | Planning cost / notes |
|---|---|---|
| Apple Developer / App Store Connect | Organization account, current app/bundle identity, non-consumable product, sandbox tester; App Store Connect API key if needed for provider setup/automation | Annual developer membership is required for distribution; confirm current regional fee in the Apple account. Apple Small Business Program currently lists 15% commission for eligible members under its program rules; at 99.99 SAR that is about 15 SAR, leaving about 85 SAR before taxes/adjustments. Otherwise the applicable standard terms apply. |
| RevenueCat | Account/project, App Store Connect integration, iOS public SDK key, server secret key, webhook authorization | Current published pricing: $0 up to $2,500 monthly tracked revenue (MTR), then 1% of tracked revenue. No subscription product is planned. |
| Supabase | Project, Auth configuration, PostgreSQL/RLS policies, MFA setup | Current listed Pro starting price is $25 USD/month. The pricing page lists $10/month of compute credits; additional usage can cost more. Free is suitable for prototyping, not assumed as the production target. |
| Replit | Separate admin web artifact and private deployment | Replit docs describe Autoscale as usage-based and Reserved VM as fixed monthly by machine size. Exact cost depends on plan, access mode, machine, and traffic; estimate after sizing, before deployment. |
| Domain (optional) | `admin.ctrlstudios.com` only if owned and configured | Ownership/availability not verified; no domain purchase is assumed. |

These are planning figures, not a purchase or deployment authorization. Recheck each provider's live terms before enabling a paid plan. No services have been created or paid for.

## 7. Required credentials and safe handling

Provision only after approval, using provider dashboards and Replit Secrets:

- **Mobile public configuration:** Supabase project URL/public anon key and platform-specific RevenueCat public SDK key. Public keys still require RLS and server-side authorization.
- **Server-only secrets:** Supabase service-role key and/or database credential; RevenueCat secret API key and webhook authorization value; any App Store Connect private key material. Never bundle these in the app or commit them.
- **Apple testing:** App Store Connect product configuration and sandbox tester. Live product availability and production purchases remain disabled until explicitly approved.
- **Admin identity:** an owner-controlled Supabase account with MFA. The personal email/identity is supplied privately during the authorized bootstrap step, not stored in source code.

Use the workspace secret-management flow for any secret entry; do not ask the user to paste keys into chat.

## 8. Admin portal and expected code surface

Keep the portal separate from mobile code and deployment:

- New web artifact: `artifacts/admin-portal/` (React/TypeScript, responsive desktop-first, Ctrl Studios styling, authenticated routes).
- Existing API service: `artifacts/api-server/src/routes/` for the RevenueCat webhook and protected admin operations, plus server middleware and tests.
- Supabase migrations/policies: a new `supabase/` directory for schema migrations and RLS policies, or an equivalently versioned migration location chosen before Stage C.
- Mobile changes, only in approved stages: a centralized entitlement/policy module; localized plan/paywall/settings UI; purchase/restore adapter; explicit account-linking UI; branding attribution component; English/Arabic strings and tests.
- Automated coverage: policy/over-limit preservation, store adapter, restore/refund/offline paths, account linking, RLS/authorization, audit logging, guest behavior, RTL/accessibility, app restart, and finance-record preservation.
- `artifacts/mobile/PHASE6_MONETIZATION_IMPLEMENTATION_REPORT.md` is updated as approved stages are implemented and verified. Stage B changes are mobile-only.

The existing Express service and database package are currently scaffolds. Do not assume the current empty `lib/db` schema contains customer or finance data.

## 9. Proposed stage sequence and acceptance gates

- **Stage A — Architecture (this stage):** inspect baseline, record providers, boundaries, costs, counting policy, risks, and code surface. Stop for approval.
- **Stage B — Local entitlement policy and UI:** implement Free/Pro gating, localized paywall and clear limits, with a development-only purchase adapter. Verify all entry points and preserve over-limit data. No live payment.
- **Stage C — Optional accounts/backend:** configure Supabase, RLS, server authorization, audit, and secure Super Admin bootstrap. Keep local PIN/Face ID and finance records separate. No public admin deployment.
- **Stage D — Apple IAP:** configure RevenueCat and non-consumable sandbox flow; test purchase, restore, refund/revocation, account linking, and offline cache in native builds/TestFlight. Do not enable live purchase without separate approval.
- **Stage E — Admin portal:** implement role-gated management, MFA, verified account/purchase views, promotional grant controls, and audit trail; keep deployment private. Do not publish publicly.
- **Stage F — Integration/security/release preparation:** regression tests, RLS and authorization review, iPhone verification, restore and finance-data preservation, release checklist. No production release, public deployment, or live payment without explicit approval.

Each stage must be reviewed and approved before the next one or a merge to `main`.

## 10. Stage A decision and current boundary

The user approved the overall technical direction and clarified the wallet counting and admin reporting rules above. Stage A is approved. Only Stage B is authorized now.

Continue on `phase6/monetization` and preserve the verified v1.1.3 `main` baseline. Stage B is implemented on this branch: local Free/Pro policies and enforcement, localized plan/upgrade screens and Settings usage, reversible wallet archival, Pro feature gates for analytics and forecasting, and reusable Ctrl Studios attribution.

The development purchase adapter is in-memory, visibly test-only, and incapable of granting Pro in production. No app or finance data is uploaded for entitlements. The iOS purchase control remains unavailable until Apple purchase infrastructure is configured and separately approved.

Stage C was separately approved on 2026-11-15. Proceed only with safe code and migration preparation until a Supabase project and configuration are explicitly approved. Do not bootstrap an owner/admin account before explicit approval. Stage D/E, paid external services, Admin Portal deployment, app publishing, and live purchases remain outside the current authorization.

## 11. Stage B implementation and verification

- Free caps are centralized at one active wallet/account, one unsettled loan, and three active EMI agreements. Completed loans and fully completed EMIs do not consume slots; an EMI with a remaining balloon payment remains active.
- Creation is blocked in both the UI and FinanceContext. Existing over-limit data remains viewable and manageable; no records are automatically deleted, archived, or rewritten.
- Wallet archive/reactivation only changes the wallet's optional archive marker. The ledger, opening balance, existing transactions, recorded balances, and historical totals remain unchanged. Archived wallets stay visible and are excluded from selectors for new entries; reactivation observes the same active cap.
- Analytics and cash-flow forecasting are Pro-gated. Settings shows plan and active-resource usage; the localized plan page does not advertise a live price or accept a production payment.
- Localization audit: all discovered UI translation candidates are covered in English and Arabic, including the brand attribution and Arabic-Indic counts.
- `pnpm --filter @workspace/mobile test`: 237 passing tests; localization audit reports 100% direct key coverage and no missing/duplicate translations.
- `pnpm --filter @workspace/mobile typecheck`: passed. Release-metadata validation confirms FinanceApp 1.1.3.
- iOS Expo export completed successfully. The restarted Expo preview serves cleanly; its browser view remains at the sign-in screen, so the signed-in plan screens were not visually verified there. No physical-device Stage B purchase/UI test was performed.
- The optional `archivedAt` field is retained by the existing migration, so the finance schema version is unchanged.

## Sources

- [RevenueCat pricing](https://www.revenuecat.com/pricing/)
- [Supabase pricing](https://supabase.com/pricing)
- [Apple App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [Replit private deployments](https://docs.replit.com/features/publishing/private-deployments)
- [Replit deployment pricing](https://docs.replit.com/billing/deployment-pricing)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [RevenueCat Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat customer identification](https://www.revenuecat.com/docs/customers/identifying-customers)
- [RevenueCat restoring purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases)
