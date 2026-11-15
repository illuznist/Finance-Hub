import { randomUUID } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "../lib/supabase";
import { logger } from "../lib/logger";

export async function bootstrapSuperAdmin(
  client: SupabaseClient,
  userId: string,
  explicitlyApproved: boolean,
): Promise<"created" | "already-configured"> {
  if (!explicitlyApproved) {
    throw new Error("Explicit owner approval is required.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("A valid Supabase user ID is required.");
  }

  const { data: userResult, error: userError } = await client.auth.admin.getUserById(userId);
  const user: User | null = userResult.user;
  if (userError || !user) throw new Error("The requested online account could not be verified.");
  if (!user.email_confirmed_at) throw new Error("The online account email must be verified first.");
  if (!user.factors?.some((factor) => factor.status === "verified")) {
    throw new Error("A verified MFA factor is required before Super Admin setup.");
  }

  const { data, error } = await client.rpc("bootstrap_super_admin", {
    target_user_id: userId,
    operation_id: randomUUID(),
  });
  if (error || (data !== "created" && data !== "already-configured")) {
    logger.error({ event: "super_admin_bootstrap_failed" }, "Bootstrap role assignment failed");
    throw new Error("Super Admin bootstrap did not complete.");
  }
  return data;
}

async function main() {
  const client = getSupabaseServiceClient();
  const userId = process.env.BOOTSTRAP_SUPER_ADMIN_USER_ID?.trim();
  const explicitlyApproved = process.env.BOOTSTRAP_SUPER_ADMIN_APPROVED === "YES";
  if (!client || !userId) {
    throw new Error("Supabase server secrets and an approved user ID must be configured first.");
  }
  const result = await bootstrapSuperAdmin(client, userId, explicitlyApproved);
  console.info(result === "created" ? "Super Admin bootstrap completed." : "Super Admin is already configured.");
}

if (process.argv[1]?.endsWith("bootstrapSuperAdmin.ts")) {
  main().catch(() => {
    console.error("Super Admin bootstrap stopped. Check the setup requirements; no credentials were printed.");
    process.exitCode = 1;
  });
}
