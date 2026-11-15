import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { bootstrapSuperAdmin } from "./bootstrapSuperAdmin";

const userId = "550e8400-e29b-41d4-a716-446655440000";

function fakeClient(user: Partial<User>, rpcResult: string = "created") {
  const calls: string[] = [];
  const client = {
    auth: {
      admin: {
        getUserById: async () => {
          calls.push("verified-user");
          return { data: { user: user as User }, error: null };
        },
      },
    },
    rpc: async () => {
      calls.push("bootstrap-rpc");
      return { data: rpcResult, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

test("Super Admin bootstrap requires explicit approval before querying Supabase", async () => {
  const { client, calls } = fakeClient({ id: userId, email_confirmed_at: "now", factors: [] });
  await assert.rejects(() => bootstrapSuperAdmin(client, userId, false), /Explicit owner approval/);
  assert.deepEqual(calls, []);
});

test("bootstrap requires a verified account and a verified MFA factor", async () => {
  const noVerifiedEmail = fakeClient({ id: userId, factors: [{ status: "verified" }] as User["factors"] });
  await assert.rejects(() => bootstrapSuperAdmin(noVerifiedEmail.client, userId, true), /email must be verified/);
  assert.deepEqual(noVerifiedEmail.calls, ["verified-user"]);

  const noMfa = fakeClient({ id: userId, email_confirmed_at: "now", factors: [] });
  await assert.rejects(() => bootstrapSuperAdmin(noMfa.client, userId, true), /verified MFA factor/);
  assert.deepEqual(noMfa.calls, ["verified-user"]);
});

test("bootstrap handles successful creation and a repeated idempotent run", async () => {
  const verified = { id: userId, email_confirmed_at: "now", factors: [{ status: "verified" }] as User["factors"] };
  const created = fakeClient(verified, "created");
  assert.equal(await bootstrapSuperAdmin(created.client, userId, true), "created");
  assert.deepEqual(created.calls, ["verified-user", "bootstrap-rpc"]);

  const repeated = fakeClient(verified, "already-configured");
  assert.equal(await bootstrapSuperAdmin(repeated.client, userId, true), "already-configured");
  assert.deepEqual(repeated.calls, ["verified-user", "bootstrap-rpc"]);
});
