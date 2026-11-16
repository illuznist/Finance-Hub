import { randomUUID } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "../lib/supabase";
import { logger } from "../lib/logger";

export type BootstrapSuperAdminApproval = {
  targetUserId: string;
  confirmedTargetUserId: string;
  expectedOwnerEmail: string;
  explicitlyApproved: boolean;
};

type BootstrapReadiness = {
  ready: true;
  rpc_signature_ok: true;
  rpc_security_ok: true;
  single_super_admin_guard_ok: true;
  audit_privileges_ok: true;
  audit_column_privileges_ok: true;
};

const SUPABASE_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hasReadyBootstrapSafeguards(value: unknown): value is BootstrapReadiness {
  if (typeof value !== "object" || value === null) return false;
  const readiness = value as Record<string, unknown>;
  return readiness.ready === true
    && readiness.rpc_signature_ok === true
    && readiness.rpc_security_ok === true
    && readiness.single_super_admin_guard_ok === true
    && readiness.audit_privileges_ok === true
    && readiness.audit_column_privileges_ok === true;
}

export async function checkBootstrapReadiness(
  client: SupabaseClient,
): Promise<BootstrapReadiness> {
  const { data, error } = await client.rpc("check_super_admin_bootstrap_readiness");
  if (error || !hasReadyBootstrapSafeguards(data)) {
    logger.error(
      { event: "super_admin_bootstrap_readiness_failed" },
      "Super Admin bootstrap safeguards are not ready",
    );
    throw new Error(
      "Super Admin bootstrap safeguards are not ready; no owner lookup or promotion was attempted.",
    );
  }
  return data;
}

export async function bootstrapSuperAdmin(
  client: SupabaseClient,
  approval: BootstrapSuperAdminApproval,
): Promise<"created" | "already-configured"> {
  const {
    targetUserId,
    confirmedTargetUserId,
    expectedOwnerEmail,
    explicitlyApproved,
  } = approval;

  if (!explicitlyApproved) {
    throw new Error("Explicit target-bound owner approval is required.");
  }
  if (!SUPABASE_USER_ID_PATTERN.test(targetUserId)) {
    throw new Error("A valid Supabase target user ID is required.");
  }
  if (!SUPABASE_USER_ID_PATTERN.test(confirmedTargetUserId) ||
      confirmedTargetUserId.toLowerCase() !== targetUserId.toLowerCase()) {
    throw new Error("The confirmed target ID must exactly match the approved target.");
  }
  const normalizedExpectedEmail = normalizeEmail(expectedOwnerEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedExpectedEmail)) {
    throw new Error("The expected owner email must be configured privately.");
  }

  await checkBootstrapReadiness(client);

  const { data: userResult, error: userError } =
    await client.auth.admin.getUserById(targetUserId);
  const user: User | null = userResult.user;
  if (userError || !user || user.id.toLowerCase() !== targetUserId.toLowerCase()) {
    throw new Error("The requested online account identity could not be verified.");
  }
  if (!user.email || normalizeEmail(user.email) !== normalizedExpectedEmail) {
    throw new Error("The Supabase account does not match the privately approved owner identity.");
  }
  if (!user.email_confirmed_at) throw new Error("The online account email must be verified first.");
  if (!user.factors?.some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  )) {
    throw new Error("A verified TOTP factor is required before Super Admin setup.");
  }

  const operationId = randomUUID();
  const { data, error } = await client.rpc("bootstrap_super_admin", {
    target_user_id: targetUserId,
    confirmed_target_user_id: confirmedTargetUserId,
    operation_id: operationId,
  });
  if (error || (data !== "created" && data !== "already-configured")) {
    logger.error({ event: "super_admin_bootstrap_failed" }, "Bootstrap role assignment failed");
    throw new Error("Super Admin bootstrap did not complete.");
  }
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const readinessOnly = args.length === 1 && args[0] === "--check-readiness";
  if (args.length > 0 && !readinessOnly) {
    throw new Error("Unsupported bootstrap command option.");
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase server configuration is unavailable.");
  }

  if (readinessOnly) {
    await checkBootstrapReadiness(client);
    console.info("Super Admin bootstrap readiness passed.");
    return;
  }

  const explicitlyApproved = process.env.BOOTSTRAP_SUPER_ADMIN_APPROVED === "YES";
  if (!explicitlyApproved) {
    throw new Error("Explicit target-bound owner approval is required.");
  }

  const targetUserId = process.env.BOOTSTRAP_SUPER_ADMIN_USER_ID?.trim() ?? "";
  const confirmedTargetUserId =
    process.env.BOOTSTRAP_SUPER_ADMIN_CONFIRM_USER_ID?.trim() ?? "";
  const expectedOwnerEmail =
    process.env.BOOTSTRAP_SUPER_ADMIN_EXPECTED_EMAIL?.trim() ?? "";
  const result = await bootstrapSuperAdmin(client, {
    targetUserId,
    confirmedTargetUserId,
    expectedOwnerEmail,
    explicitlyApproved,
  });
  console.info(result === "created" ? "Super Admin bootstrap completed." : "Super Admin is already configured.");
}

if (process.argv[1]?.endsWith("bootstrapSuperAdmin.ts")) {
  main().catch(() => {
    console.error("Super Admin bootstrap stopped. Check the setup requirements; no credentials were printed.");
    process.exitCode = 1;
  });
}
