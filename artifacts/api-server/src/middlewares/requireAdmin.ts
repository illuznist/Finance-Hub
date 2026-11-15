import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AccountRole } from "../lib/authorization";
import { isAdminAuthorized } from "../lib/authorization";
import { getSupabaseAdminClient } from "../lib/supabase";
import { logger } from "../lib/logger";

type RoleReader = (userId: string) => Promise<AccountRole[] | null>;

async function readRoles(userId: string): Promise<AccountRole[] | null> {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data) return null;
  return data.flatMap((row) =>
    row.role === "USER" || row.role === "ADMIN" || row.role === "SUPER_ADMIN"
      ? [row.role]
      : [],
  );
}

export async function writeAdminAudit(
  actorUserId: string | null,
  action: string,
  outcome: "allowed" | "denied" | "succeeded" | "failed",
  requestId?: string,
): Promise<boolean> {
  const client = getSupabaseAdminClient();
  if (!client) return false;
  const { error } = await client.from("admin_audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    outcome,
    metadata: requestId ? { request_id: requestId.slice(0, 80) } : {},
  });
  if (error) {
    logger.warn({ event: "admin_audit_write_failed" }, "Admin audit entry could not be recorded");
    return false;
  }
  return true;
}

export function createRequireAdmin(
  getRoles: RoleReader,
  audit: typeof writeAdminAudit,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identity = req.onlineIdentity;
    if (!identity) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    let roles: AccountRole[] | null;
    try {
      roles = await getRoles(identity.userId);
    } catch {
      roles = null;
    }
    if (roles === null) {
      res.status(503).json({ error: "Authorization service is unavailable." });
      return;
    }

    const allowed = isAdminAuthorized(roles, identity.aal, identity.emailVerified);
    let auditWritten = false;
    try {
      auditWritten = await audit(
        identity.userId,
        "admin_access_check",
        allowed ? "allowed" : "denied",
        req.id === undefined ? undefined : String(req.id),
      );
    } catch {
      logger.warn({ event: "admin_audit_write_failed" }, "Admin audit entry could not be recorded");
    }

    if (!allowed) {
      res.status(403).json({ error: "Administrative access is not authorized." });
      return;
    }
    if (!auditWritten) {
      res.status(503).json({ error: "Administrative audit service is unavailable." });
      return;
    }
    next();
  };
}

export const requireAdmin = createRequireAdmin(readRoles, writeAdminAudit);
