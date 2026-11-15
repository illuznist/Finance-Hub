import { Router, type IRouter } from "express";

import { resolveProAccess, type AccountRole } from "../lib/authorization";
import { getSupabaseServiceClient } from "../lib/supabase";
import { requireOnlineUser } from "../middlewares/requireOnlineUser";

const router: IRouter = Router();

router.get("/access", requireOnlineUser, async (req, res) => {
  try {
    const identity = req.onlineIdentity;
    const client = getSupabaseServiceClient();
    if (!identity || !client) {
      res.status(503).json({ error: "Online account service is unavailable." });
      return;
    }

    const { data: roleRows, error: roleError } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", identity.userId);
    if (roleError || !roleRows) {
      res.status(503).json({ error: "Account access could not be loaded." });
      return;
    }
    const roles = roleRows.flatMap((row) =>
      row.role === "USER" || row.role === "ADMIN" || row.role === "SUPER_ADMIN"
        ? [row.role as AccountRole]
        : [],
    );

    const now = new Date().toISOString();
    const [permanentGrants, expiringGrants] = await Promise.all([
      client
        .from("promotional_grants")
        .select("id")
        .eq("user_id", identity.userId)
        .is("revoked_at", null)
        .is("expires_at", null)
        .limit(1),
      client
        .from("promotional_grants")
        .select("id")
        .eq("user_id", identity.userId)
        .is("revoked_at", null)
        .gt("expires_at", now)
        .limit(1),
    ]);
    if (permanentGrants.error || expiringGrants.error || !permanentGrants.data || !expiringGrants.data) {
      res.status(503).json({ error: "Account access could not be loaded." });
      return;
    }
    const hasActivePromotionalGrant =
      permanentGrants.data.length > 0 || expiringGrants.data.length > 0;
    const access = resolveProAccess(roles, hasActivePromotionalGrant);

    res.json({
      accountId: identity.userId,
      emailVerified: identity.emailVerified,
      roles,
      isPro: access.isPro,
      proSource: access.source,
      paidPurchasesAvailable: false,
    });
  } catch {
    res.status(503).json({ error: "Online account service is unavailable." });
  }
});

export default router;
