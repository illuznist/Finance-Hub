import { Router, type IRouter } from "express";

import { getSupabaseAdminClient } from "../lib/supabase";
import { requireAdmin } from "../middlewares/requireAdmin";
import { requireOnlineUser } from "../middlewares/requireOnlineUser";

const router: IRouter = Router();

router.get("/access-check", requireOnlineUser, requireAdmin, (_req, res) => {
  res.json({ status: "authorized" });
});

router.get("/audit", requireOnlineUser, requireAdmin, async (_req, res) => {
  try {
    const client = getSupabaseAdminClient();
    if (!client) {
      res.status(503).json({ error: "Authorization service is unavailable." });
      return;
    }
    const { data, error } = await client
      .from("admin_audit_logs")
      .select("id, actor_user_id, action, target_user_id, outcome, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error || !data) {
      res.status(503).json({ error: "Audit records could not be loaded." });
      return;
    }
    res.json({ entries: data });
  } catch {
    res.status(503).json({ error: "Audit records could not be loaded." });
  }
});

export default router;
