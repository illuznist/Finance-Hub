import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  bootstrapSuperAdmin,
  checkBootstrapReadiness,
} from "./bootstrapSuperAdmin";

const userId = "550e8400-e29b-41d4-a716-446655440000";
const otherUserId = "550e8400-e29b-41d4-a716-446655440001";
const expectedEmail = "owner@example.test";
const readyBootstrap = {
  ready: true,
  rpc_signature_ok: true,
  rpc_security_ok: true,
  single_super_admin_guard_ok: true,
  audit_privileges_ok: true,
  audit_column_privileges_ok: true,
};
const verifiedTotp = {
  id: "totp-factor-id",
  factor_type: "totp",
  status: "verified",
  created_at: "2026-11-16T00:00:00.000Z",
  updated_at: "2026-11-16T00:00:00.000Z",
} as NonNullable<User["factors"]>[number];

function approval(overrides: Partial<Parameters<typeof bootstrapSuperAdmin>[1]> = {}) {
  return {
    targetUserId: userId,
    confirmedTargetUserId: userId,
    expectedOwnerEmail: expectedEmail,
    explicitlyApproved: true,
    ...overrides,
  };
}

function fakeClient(
  user: Partial<User>,
  rpcResult: string = "created",
  rpcError: { message: string } | null = null,
  readinessResult: unknown = readyBootstrap,
  readinessError: { message: string } | null = null,
) {
  const calls: string[] = [];
  let rpcArgs: Record<string, unknown> | undefined;
  const client = {
    auth: {
      admin: {
        getUserById: async (requestedUserId: string) => {
          calls.push("verified-user");
          assert.equal(requestedUserId, userId);
          return { data: { user: user as User }, error: null };
        },
      },
    },
    rpc: async (_functionName: string, args: Record<string, unknown>) => {
      if (_functionName === "check_super_admin_bootstrap_readiness") {
        calls.push("readiness-check");
        return { data: readinessResult, error: readinessError };
      }
      calls.push("bootstrap-rpc");
      rpcArgs = args;
      return { data: rpcResult, error: rpcError };
    },
  };
  return { client: client as unknown as SupabaseClient, calls, get rpcArgs() { return rpcArgs; } };
}

test("Super Admin bootstrap requires explicit approval before querying Supabase", async () => {
  const { client, calls } = fakeClient({
    id: userId,
    email: expectedEmail,
    email_confirmed_at: "now",
    factors: [verifiedTotp],
  });
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval({ explicitlyApproved: false })),
    /Explicit target-bound owner approval/,
  );
  assert.deepEqual(calls, []);
});

test("readiness-only preflight checks safeguards without owner lookup or bootstrap RPC", async () => {
  const { client, calls } = fakeClient({});
  assert.deepEqual(await checkBootstrapReadiness(client), readyBootstrap);
  assert.deepEqual(calls, ["readiness-check"]);
});

test("bootstrap stops on a missing migration before looking up the owner", async () => {
  const { client, calls } = fakeClient(
    {
      id: userId,
      email: expectedEmail,
      email_confirmed_at: "now",
      factors: [verifiedTotp],
    },
    "created",
    null,
    null,
    { message: "readiness RPC is missing" },
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval()),
    /safeguards are not ready; no owner lookup or promotion was attempted/,
  );
  assert.deepEqual(calls, ["readiness-check"]);
});

test("bootstrap rejects an incompatible readiness RPC signature before owner lookup", async () => {
  const { client, calls } = fakeClient(
    {
      id: userId,
      email: expectedEmail,
      email_confirmed_at: "now",
      factors: [verifiedTotp],
    },
    "created",
    null,
    {
      ready: false,
      rpc_signature_ok: false,
      rpc_security_ok: false,
      single_super_admin_guard_ok: true,
      audit_privileges_ok: true,
      audit_column_privileges_ok: true,
    },
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval()),
    /safeguards are not ready/,
  );
  assert.deepEqual(calls, ["readiness-check"]);
});

test("bootstrap rejects incorrect audit privileges before owner lookup", async () => {
  const { client, calls } = fakeClient(
    {
      id: userId,
      email: expectedEmail,
      email_confirmed_at: "now",
      factors: [verifiedTotp],
    },
    "created",
    null,
    {
      ...readyBootstrap,
      ready: false,
      audit_privileges_ok: false,
    },
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval()),
    /safeguards are not ready/,
  );
  assert.deepEqual(calls, ["readiness-check"]);
});

test("bootstrap rejects effective PostgreSQL MAINTAIN privilege", async () => {
  const { client, calls } = fakeClient(
    {
      id: userId,
      email: expectedEmail,
      email_confirmed_at: "now",
      factors: [verifiedTotp],
    },
    "created",
    null,
    {
      ...readyBootstrap,
      ready: false,
      audit_privileges_ok: false,
    },
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval()),
    /safeguards are not ready/,
  );
  assert.deepEqual(calls, ["readiness-check"]);
});

test("bootstrap rejects effective column UPDATE or REFERENCES grants", async () => {
  for (const privilege of ["UPDATE", "REFERENCES"]) {
    const { client, calls } = fakeClient(
      {
        id: userId,
        email: expectedEmail,
        email_confirmed_at: "now",
        factors: [verifiedTotp],
      },
      "created",
      null,
      {
        ...readyBootstrap,
        ready: false,
        audit_column_privileges_ok: false,
      },
    );
    await assert.rejects(
      () => bootstrapSuperAdmin(client, approval()),
      /safeguards are not ready/,
      `${privilege} must block bootstrap readiness`,
    );
    assert.deepEqual(calls, ["readiness-check"]);
  }
});

test("bootstrap rejects PUBLIC or inherited audit write grants", async () => {
  const { client, calls } = fakeClient(
    {
      id: userId,
      email: expectedEmail,
      email_confirmed_at: "now",
      factors: [verifiedTotp],
    },
    "created",
    null,
    {
      ...readyBootstrap,
      ready: false,
      audit_privileges_ok: false,
    },
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval()),
    /safeguards are not ready/,
  );
  assert.deepEqual(calls, ["readiness-check"]);
});

test("bootstrap rejects a missing or invalid single-Super-Admin index", async () => {
  const { client, calls } = fakeClient(
    {
      id: userId,
      email: expectedEmail,
      email_confirmed_at: "now",
      factors: [verifiedTotp],
    },
    "created",
    null,
    {
      ...readyBootstrap,
      ready: false,
      single_super_admin_guard_ok: false,
    },
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval()),
    /safeguards are not ready/,
  );
  assert.deepEqual(calls, ["readiness-check"]);
});

test("bootstrap rejects privileged RPC execution grants to unauthorized roles", async () => {
  const { client, calls } = fakeClient(
    {
      id: userId,
      email: expectedEmail,
      email_confirmed_at: "now",
      factors: [verifiedTotp],
    },
    "created",
    null,
    {
      ...readyBootstrap,
      ready: false,
      rpc_security_ok: false,
    },
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval()),
    /safeguards are not ready/,
  );
  assert.deepEqual(calls, ["readiness-check"]);
});

test("bootstrap rejects an invalid or mismatched target confirmation before querying Supabase", async () => {
  const { client, calls } = fakeClient({
    id: userId,
    email: expectedEmail,
    email_confirmed_at: "now",
    factors: [verifiedTotp],
  });
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval({ targetUserId: "not-a-uuid" })),
    /valid Supabase target user ID/,
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(client, approval({ confirmedTargetUserId: otherUserId })),
    /confirmed target ID must exactly match/,
  );
  assert.deepEqual(calls, []);
});

test("bootstrap verifies the exact owner UUID, email, confirmation status, and verified TOTP", async () => {
  const mismatchedIdentity = fakeClient({
    id: otherUserId,
    email: expectedEmail,
    email_confirmed_at: "now",
    factors: [verifiedTotp],
  });
  await assert.rejects(
    () => bootstrapSuperAdmin(mismatchedIdentity.client, approval()),
    /identity could not be verified/,
  );
  assert.deepEqual(mismatchedIdentity.calls, ["readiness-check", "verified-user"]);

  const mismatchedEmail = fakeClient({
    id: userId,
    email: "different@example.test",
    email_confirmed_at: "now",
    factors: [verifiedTotp],
  });
  await assert.rejects(
    () => bootstrapSuperAdmin(mismatchedEmail.client, approval()),
    /does not match the privately approved owner identity/,
  );
  assert.deepEqual(mismatchedEmail.calls, ["readiness-check", "verified-user"]);

  const noVerifiedEmail = fakeClient({
    id: userId,
    email: expectedEmail,
    factors: [verifiedTotp],
  });
  await assert.rejects(
    () => bootstrapSuperAdmin(noVerifiedEmail.client, approval()),
    /email must be verified/,
  );
  assert.deepEqual(noVerifiedEmail.calls, ["readiness-check", "verified-user"]);

  const verifiedPhoneOnly = {
    ...verifiedTotp,
    factor_type: "phone",
  } as NonNullable<User["factors"]>[number];
  const noTotp = fakeClient({
    id: userId,
    email: expectedEmail,
    email_confirmed_at: "now",
    factors: [verifiedPhoneOnly],
  });
  await assert.rejects(
    () => bootstrapSuperAdmin(noTotp.client, approval()),
    /verified TOTP factor/,
  );
  assert.deepEqual(noTotp.calls, ["readiness-check", "verified-user"]);

  const unverifiedTotp = { ...verifiedTotp, status: "unverified" } as NonNullable<User["factors"]>[number];
  const unverifiedFactor = fakeClient({
    id: userId,
    email: expectedEmail,
    email_confirmed_at: "now",
    factors: [unverifiedTotp],
  });
  await assert.rejects(
    () => bootstrapSuperAdmin(unverifiedFactor.client, approval()),
    /verified TOTP factor/,
  );
  assert.deepEqual(unverifiedFactor.calls, ["readiness-check", "verified-user"]);
});

test("bootstrap passes readiness before owner lookup and supports same-target idempotency", async () => {
  const verified = {
    id: userId,
    email: expectedEmail.toUpperCase(),
    email_confirmed_at: "now",
    factors: [verifiedTotp],
  };
  const created = fakeClient(verified, "created");
  assert.equal(await bootstrapSuperAdmin(created.client, approval()), "created");
  assert.deepEqual(created.calls, ["readiness-check", "verified-user", "bootstrap-rpc"]);
  assert.equal(created.rpcArgs?.target_user_id, userId);
  assert.equal(created.rpcArgs?.confirmed_target_user_id, userId);
  assert.match(String(created.rpcArgs?.operation_id), /^[0-9a-f-]{36}$/i);
  assert.deepEqual(
    Object.keys(created.rpcArgs ?? {}).sort(),
    ["confirmed_target_user_id", "operation_id", "target_user_id"],
  );

  const repeated = fakeClient(verified, "already-configured");
  assert.equal(await bootstrapSuperAdmin(repeated.client, approval()), "already-configured");
  assert.deepEqual(repeated.calls, ["readiness-check", "verified-user", "bootstrap-rpc"]);
});

test("bootstrap RPC failures do not report success", async () => {
  const failed = fakeClient(
    {
      id: userId,
      email: expectedEmail,
      email_confirmed_at: "now",
      factors: [verifiedTotp],
    },
    "created",
    { message: "database failure" },
  );
  await assert.rejects(
    () => bootstrapSuperAdmin(failed.client, approval()),
    /Super Admin bootstrap did not complete/,
  );
  assert.deepEqual(failed.calls, ["readiness-check", "verified-user", "bootstrap-rpc"]);
});
