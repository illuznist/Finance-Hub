import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

import { createRequireOnlineUser } from "./requireOnlineUser";

function mockResponse() {
  const response: { statusCode: number; body?: unknown } = { statusCode: 200 };
  const api = {
    status(code: number) {
      response.statusCode = code;
      return api;
    },
    json(body: unknown) {
      response.body = body;
      return api;
    },
  };
  return { response, api: api as unknown as Response };
}

test("online API rejects missing and invalid sessions without revealing details", async () => {
  let verifyCalls = 0;
  const middleware = createRequireOnlineUser(async () => {
    verifyCalls++;
    return { status: "invalid" };
  });

  const missing = { header: () => undefined } as unknown as Request;
  const missingResult = mockResponse();
  await middleware(missing, missingResult.api, (() => {}) as never);
  assert.equal(missingResult.response.statusCode, 401);
  assert.equal(verifyCalls, 0);

  const invalid = { header: () => "Bearer forged.token.value" } as unknown as Request;
  const invalidResult = mockResponse();
  await middleware(invalid, invalidResult.api, (() => {}) as never);
  assert.equal(invalidResult.response.statusCode, 401);
  assert.deepEqual(invalidResult.response.body, { error: "Authentication required." });
  assert.equal(verifyCalls, 1);
});

test("online API fails closed when Supabase verification is unavailable", async () => {
  const middleware = createRequireOnlineUser(async () => ({ status: "unavailable" }));
  const request = { header: () => "Bearer valid-looking.token.value" } as unknown as Request;
  const result = mockResponse();
  await middleware(request, result.api, (() => {}) as never);
  assert.equal(result.response.statusCode, 503);
});

test("only verified Supabase identities are attached to API requests", async () => {
  const middleware = createRequireOnlineUser(async () => ({
    status: "valid",
    identity: { userId: "user-1", email: "owner@example.invalid", emailVerified: true, aal: "aal1" },
  }));
  const request = { header: () => "Bearer signed.token.value" } as unknown as Request;
  const result = mockResponse();
  let nextCalled = false;
  await middleware(request, result.api, (() => { nextCalled = true; }) as never);
  assert.equal(nextCalled, true);
  assert.equal(request.onlineIdentity?.userId, "user-1");
});
