import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { User } from "@supabase/supabase-js";

import { extractBearerToken, decodeVerifiedAal, type AuthorizationIdentity } from "../lib/authorization";
import { getSupabaseServiceClient } from "../lib/supabase";

declare global {
  namespace Express {
    interface Request {
      onlineIdentity?: AuthorizationIdentity;
    }
  }
}

export type TokenVerification =
  | { status: "valid"; identity: AuthorizationIdentity }
  | { status: "invalid" }
  | { status: "unavailable" };

export type TokenVerifier = (token: string) => Promise<TokenVerification>;

export async function verifySupabaseAccessToken(token: string): Promise<TokenVerification> {
  const client = getSupabaseServiceClient();
  if (!client) return { status: "unavailable" };

  try {
    const { data, error } = await client.auth.getUser(token);
    const user: User | null = data.user;
    if (error || !user) return { status: "invalid" };
    const aal = decodeVerifiedAal(token, user.id);
    return {
      status: "valid",
      identity: {
        userId: user.id,
        email: user.email,
        emailVerified: Boolean(user.email_confirmed_at),
        aal,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

export function createRequireOnlineUser(verifyToken: TokenVerifier): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req.header("authorization"));
    if (!token) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    const result = await verifyToken(token);
    if (result.status === "unavailable") {
      res.status(503).json({ error: "Online account service is unavailable." });
      return;
    }
    if (result.status !== "valid") {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    req.onlineIdentity = result.identity;
    next();
  };
}

export const requireOnlineUser = createRequireOnlineUser(verifySupabaseAccessToken);
