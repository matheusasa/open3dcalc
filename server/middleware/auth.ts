import type { Request, Response, NextFunction } from "express";
import { auth } from "../auth";

/**
 * Express middleware that enforces Better Auth session authentication.
 *
 * - Reads the session cookie via `auth.api.getSession()`.
 * - Rejects unauthenticated requests with 401.
 * - Attaches the authenticated user's ID to `req.userId`.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });

    if (!session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.userId = session.user.id;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(401).json({ error: "Unauthorized", message });
  }
}