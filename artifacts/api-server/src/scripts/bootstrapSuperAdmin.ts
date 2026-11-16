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

const SUPABASE_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
  const explicitlyApproved = process.env.BOOTSTRAP_SUPER_ADMIN_APPROVED === "YES";
  if (!explicitlyApproved) {
    throw new Error("Explicit target-bound owner approval is required.");
  }

  const targetUserId = process.env.BOOTSTRAP_SUPER_ADMIN_USER_ID?.trim() ?? "";
  const confirmedTargetUserId =
    process.env.BOOTSTRAP_SUPER_ADMIN_CONFIRM_USER_ID?.trim() ?? "";
  const expectedOwnerEmail =
    process.env.BOOTSTRAP_SUPER_ADMIN_EXPECTED_EMAIL?.trim() ?? "";
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error("Supabase server configuration is unavailable.");
  }
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
