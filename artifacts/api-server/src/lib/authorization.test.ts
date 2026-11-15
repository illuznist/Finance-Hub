import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeVerifiedAal,
  extractBearerToken,
  isAdminAuthorized,
  resolveProAccess,
} from "./authorization";

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.signature`;
}

test("Bearer token extraction accepts only a single bearer token", () => {
  assert.equal(extractBearerToken("Bearer abc.def-123"), "abc.def-123");
  assert.equal(extractBearerToken("Basic abc"), null);
  assert.equal(extractBearerToken("Bearer abc extra"), null);
  assert.equal(extractBearerToken(undefined), null);
});

test("MFA claim is used only when it matches the verified identity", () => {
  assert.equal(decodeVerifiedAal(jwt({ sub: "user-1", aal: "aal2" }), "user-1"), "aal2");
  assert.equal(decodeVerifiedAal(jwt({ sub: "other", aal: "aal2" }), "user-1"), null);
  assert.equal(decodeVerifiedAal("not-a-jwt", "user-1"), null);
});

test("administrator access requires a server role and aal2", () => {
  assert.equal(isAdminAuthorized(["USER"], "aal2", true), false);
  assert.equal(isAdminAuthorized(["ADMIN"], "aal1", true), false);
  assert.equal(isAdminAuthorized(["ADMIN"], "aal2", false), false);
  assert.equal(isAdminAuthorized(["ADMIN"], "aal2", true), true);
  assert.equal(isAdminAuthorized(["SUPER_ADMIN"], "aal2", true), true);
});

test("Pro access keeps paid, promotional, and Super Admin sources distinct", () => {
  assert.deepEqual(resolveProAccess(["USER"], false), { isPro: false, source: "free" });
  assert.deepEqual(resolveProAccess(["USER"], true), { isPro: true, source: "promotional" });
  assert.deepEqual(resolveProAccess(["SUPER_ADMIN"], true), { isPro: true, source: "super_admin" });
});
