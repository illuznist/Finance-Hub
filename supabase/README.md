# Supabase preparation

This directory contains the versioned database migration for optional online identity, authorization, entitlement metadata, and audit bookkeeping. Finance Hub financial records remain device-local and are intentionally absent from this schema.

The owner created a new Frankfurt Supabase project in the Ctrl Studios organization and connected its four required variables through Replit Secrets. The values are not stored in this repository. The owner confirmed that the Email provider, email confirmation, and both auth redirect URLs are configured. The migration has **not** been applied, and no test users or Super Admin have been created.

## Tables and access

- `user_roles`: server-controlled role labels; users can read only their own role rows. No client write policy exists. Direct table privileges are revoked from `PUBLIC`, `anon`, and `authenticated` before the narrow self-read grant.
- `promotional_grants`: grant metadata with revocation/expiry; server-role only.
- `revenuecat_identity_links`: reserved verified identity-link metadata; server-role only.
- `admin_audit_logs`: access and administrative audit events; server-role only.
- `webhook_inbox`: deduplication ID and processing state only; provider payloads are not stored; server-role only.

RLS is enabled on every table. The auth trigger grants only the ordinary `USER` role and cannot promote an account. A partial unique index prevents multiple Super Admin owners. The bootstrap RPC can be executed only by `service_role`; it atomically inserts the role and audit entry. Supabase's modern `sb_secret_...` key maps to the privileged `service_role` and bypasses RLS, so the API must authorize each caller before using its server client.

## Checks after separately approved migration execution

1. Apply the migration in the Supabase Dashboard SQL Editor.
2. Confirm every table has `relrowsecurity = true` in `pg_class`.
3. Register two verified test users. With each user's JWT, select from `user_roles`; only the caller's own role row should be visible.
4. Attempt client-side inserts/updates/deletes against each table using the public key and authenticated JWT; each must be denied.
5. Call `/api/account/access` without a token and with a malformed/expired token; both must return 401.
6. Call `/api/admin/access-check` as a `USER`, then as an `ADMIN` with `aal1`; both must return 403. A verified `ADMIN`/`SUPER_ADMIN` with `aal2` may pass.
7. Verify each denied and allowed admin access check writes an audit entry. If audit persistence fails, admin access fails closed.
8. Run the bootstrap only after explicit owner approval, email verification, and a verified MFA factor. Confirm repeating it for the same user is a no-op and another user cannot be promoted.

These checks have not been run against the live schema. The project is configured, but migration execution and test-account creation remain pending separate approval.

## Configuration checklist for the owner

Do not send credentials in chat. Use only newly issued keys from the new Ctrl Studios project; do not use the retired Tokyo project's exposed credentials.

1. The four required values are present in Replit Secrets. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are used by the mobile app; the publishable key is not proof of user identity and is not a substitute for RLS.
2. `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are used only by the API Server. The `sb_secret_...` value bypasses RLS. Never add it to an `EXPO_PUBLIC_*` variable, the mobile project, browser bundles, logs, or Git. Legacy `SUPABASE_SERVICE_ROLE_KEY` is not read.
3. Set `CORS_ALLOWED_ORIGINS` to the exact approved app origins, comma-separated, for any browser clients. Native requests without an Origin header remain supported. Do not use `*`.
4. Both `mobile://auth/callback` and the current Expo Go callback have been added to Supabase Redirect URLs, as confirmed by the owner. Set `EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL` only if the project later uses a fixed redirect.
5. Confirm the API origin used by mobile bundles is configured as `EXPO_PUBLIC_DOMAIN` for that environment.
6. Configure email confirmation and the approved sender address in Supabase Auth after the official Ctrl Studios email is ready. Enable TOTP MFA and verify the owner's factor.
7. Do not run the Super Admin bootstrap as part of this setup. It remains a separate action requiring explicit owner approval, a verified email, and verified MFA.

The required secrets' values have not been read or recorded by the agent. Do not apply the migration or execute the bootstrap until the owner separately approves those actions.
