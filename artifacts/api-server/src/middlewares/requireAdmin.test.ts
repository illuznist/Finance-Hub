import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

import { createRequireAdmin } from "./requireAdmin";

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

function request(identity?: Request["onlineIdentity"]) {
  return { onlineIdentity: identity } as Request;
}

test("admin routes require a verified admin role and MFA level 2", async () => {
  const audited: unknown[][] = [];
  const middleware = createRequireAdmin(
    async () => ["USER"],
    async (...args) => { audited.push(args); return true; },
  );
  const unprivileged = request({ userId: "user-1", emailVerified: true, aal: "aal2" });
  const deniedResult = mockResponse();
  let nextCalled = false;
  await middleware(unprivileged, deniedResult.api, (() => { nextCalled = true; }) as never);
  assert.equal(deniedResult.response.statusCode, 403);
  assert.equal(nextCalled, false);
  assert.equal(audited[0][2], "denied");

  const adminMiddleware = createRequireAdmin(
    async () => ["ADMIN"],
    async () => true,
  );
  const noMfa = request({ userId: "admin-1", emailVerified: true, aal: "aal1" });
  const mfaDenied = mockResponse();
  await adminMiddleware(noMfa, mfaDenied.api, (() => { nextCalled = true; }) as never);
  assert.equal(mfaDenied.response.statusCode, 403);

  const unverified = request({ userId: "admin-1", emailVerified: false, aal: "aal2" });
  const unverifiedDenied = mockResponse();
  await adminMiddleware(unverified, unverifiedDenied.api, (() => { nextCalled = true; }) as never);
  assert.equal(unverifiedDenied.response.statusCode, 403);
});

test("admin access fails closed if the required audit record cannot be written", async () => {
  const middleware = createRequireAdmin(async () => ["SUPER_ADMIN"], async () => false);
  const req = request({ userId: "owner-1", emailVerified: true, aal: "aal2" });
  const result = mockResponse();
  let nextCalled = false;
  await middleware(req, result.api, (() => { nextCalled = true; }) as never);
  assert.equal(result.response.statusCode, 503);
  assert.equal(nextCalled, false);
});

test("verified Super Admin with aal2 reaches the protected route", async () => {
  const middleware = createRequireAdmin(async () => ["SUPER_ADMIN"], async () => true);
  const req = request({ userId: "owner-1", emailVerified: true, aal: "aal2" });
  const result = mockResponse();
  let nextCalled = false;
  await middleware(req, result.api, (() => { nextCalled = true; }) as never);
  assert.equal(result.response.statusCode, 200);
  assert.equal(nextCalled, true);
});
