# Super Admin bootstrap: approval and recovery

## Status

The bootstrap implementation and safeguards are prepared on `phase6/monetization`.
The follow-up SQL migration
`supabase/migrations/20261116000000_super_admin_bootstrap_safeguards.sql`
is **not applied**. Do not run the CLI until that migration has been separately
reviewed and approved, and the environment is confirmed to use it.

No account has been promoted by this change. It makes no live Supabase requests.

## Before approval

1. The owner confirms the intended Ctrl Studios account out of band in the
   Supabase Auth dashboard. Record its exact Auth UUID and email privately.
2. Confirm that the account email is verified and that it has a verified TOTP
   factor. The CLI checks all three identity details: returned Auth UUID,
   normalized expected email, and `email_confirmed_at`; it also requires
   `factor_type = totp` and `status = verified`.
3. Use a separate read-only check to confirm whether a Super Admin already
   exists. The bootstrap itself preserves the single-Super-Admin constraint.
4. Obtain explicit owner approval for the exact UUID immediately before the
   operation. The CLI requires the same UUID in both target and confirmation
   inputs, a private expected-owner email, and the explicit approval flag.
   The database RPC independently rejects a mismatched UUID confirmation.
5. Do not put the owner's email, UUID, or Supabase secret in source code, chat,
   logs, or screenshots.

## Read-only migration readiness preflight

After the migration is separately approved and applied, run this preflight from
the trusted API-server environment:

```sh
pnpm --filter @workspace/api-server run bootstrap:super-admin:check
```

This command requires only the trusted server Supabase URL and secret key. It
does not require owner UUID/email/approval inputs, does not call Supabase Auth,
and never calls the bootstrap RPC. It invokes only the service-role-protected
`check_super_admin_bootstrap_readiness()` helper, which returns status booleans
without exposing credentials or user data.

The helper fails closed unless it confirms:

- The exact three-argument bootstrap RPC exists, has the expected argument
  names, is `SECURITY DEFINER` with an empty search path, and has the expected
  target-confirmation, idempotency, single-owner, and audit behavior.
- The old two-argument RPC is absent, and execute access is restricted to the
  trusted server role.
- The single-Super-Admin unique index exists and is valid.
- The effective table-level `service_role` privileges on `admin_audit_logs`
  are exactly `SELECT` and `INSERT`, with no other table privileges.
- No effective column-level `UPDATE` or `REFERENCES` privilege exists for
  `service_role`, including privileges inherited through role memberships or
  granted to `PUBLIC`.

If the helper is missing, the signature is incompatible, or any check fails,
the CLI stops before looking up the owner account. It does not call the
bootstrap RPC. The regular bootstrap command repeats this check immediately
before owner identity lookup, so an earlier successful preflight is not treated
as permanent authorization.

The index check verifies the index relation, uniqueness/readiness/validity,
single `role` key column, and an exact normalized `role = 'SUPER_ADMIN'`
predicate. It does not accept a predicate merely because the text
`SUPER_ADMIN` appears in it.

## Approved bootstrap procedure

Only after the migration, a successful read-only preflight, and this procedure
are separately approved:

1. Supply these values through the trusted API-server environment using the
   workspace secrets flow; do not commit them:
   - `BOOTSTRAP_SUPER_ADMIN_USER_ID`: the privately verified target UUID.
   - `BOOTSTRAP_SUPER_ADMIN_CONFIRM_USER_ID`: the exact same UUID, entered as
     the target-bound confirmation.
   - `BOOTSTRAP_SUPER_ADMIN_EXPECTED_EMAIL`: the official owner email to match
     against the verified Supabase Auth user.
   - `BOOTSTRAP_SUPER_ADMIN_APPROVED`: `YES`, as an additional explicit
     acknowledgement, not the sole approval control.
2. Run once from the trusted API-server workspace:

   ```sh
   pnpm --filter @workspace/api-server run bootstrap:super-admin
   ```

3. The command repeats the read-only readiness check, then confirms the exact
   target UUID, normalized expected email, verified email status, and verified
   TOTP factor before calling the bootstrap RPC. On success, expect
   `Super Admin bootstrap completed.` The database inserts the `SUPER_ADMIN`
   role and a success audit row in one transaction. The audit row leaves
   `actor_user_id` and `granted_by` null because the CLI has no authenticated
   human actor; it records the service-role RPC source, target-bound approval
   mode, approved target UUID, and operation ID. It does not claim the target
   promoted itself.
4. Remove all one-time bootstrap inputs from the environment after the run.
5. Separately verify the role and audit row with approved read-only checks.
   `/api/account/access` should report `isPro: true`,
   `proSource: "super_admin"`, and `paidPurchasesAvailable: false`. Admin
   requests must still require a verified email, an authorized role, and AAL2.

## Repeat and failure behavior

- A sequential repeat for the same target returns
  `Super Admin is already configured`; it does not add another audit row.
- A different target is rejected once the single Super Admin already exists.
- Missing approval, mismatched UUIDs, an unexpected email, an unverified email,
  or a missing verified TOTP factor stops the CLI before the RPC.
- A database error during role or audit insertion rolls back both inserts.
  Failure output is generic and does not print the target email, UUID, or keys.
- The migration preserves existing audit rows and sets `service_role` table
  privileges to exactly `SELECT` and `INSERT`. This supports existing admin
  audit reads, ordinary and denied-access audit inserts, and the bootstrap
  audit insert. It does not make rows immutable against the database owner or
  other privileged administrative connections.
- Direct column-level `UPDATE` and `REFERENCES` grants are revoked from
  `service_role`. Grants inherited from another role or `PUBLIC` are not
  revoked, because that could affect unrelated users; the readiness check
  rejects them instead.

## Readiness-check limits

The readiness helper verifies the RPC signature, security-definer settings,
permissions, audit privilege boundary, and unique-index definition through
PostgreSQL catalog metadata. Checks of the bootstrap function's behavioral
guards also inspect normalized function-definition text for expected fragments.
That text check detects some drift but is not a semantic proof of function
security. Keep the function under source review and run the permanent
regression tests; do not treat a green preflight as a replacement for review.

## Recovery if the wrong account is promoted

There is no rollback CLI. Stop using administrative features and do not delete
the Supabase Auth account or the original audit row. After separate owner
approval, an authorized database operator should:

1. Read the exact target role and corresponding `bootstrap_super_admin` audit
   event without changing data.
2. In one reviewed transaction, remove only the erroneous `SUPER_ADMIN` row
   for that exact UUID and append a corrective audit entry. Keep any existing
   `USER` role and preserve the original promotion audit event.
3. Verify that no unintended Super Admin remains and that the affected
   account's access is recalculated from any independent promotional grant.
4. Do not retry bootstrap until the intended UUID and approval inputs are
   re-confirmed.

Any such recovery transaction requires separate explicit approval and is not
part of routine bootstrap verification.
