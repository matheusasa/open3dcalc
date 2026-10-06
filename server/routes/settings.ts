import { Router } from "express";
import type postgres from "postgres";

export function createSettingsRouter(sql: postgres.Sql): Router {
  const router = Router();

  // TODO: Migration needed — add user_id column to calculator_state table:
  // ALTER TABLE calculator_state ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
  // CREATE INDEX idx_calculator_state_user_id ON calculator_state(user_id);
  // TODO: Migration needed — add user_id column to app_settings table:
  // ALTER TABLE app_settings ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
  // CREATE INDEX idx_app_settings_user_id ON app_settings(user_id);
  // NOTE: Primary key for calculator_state may need to change from (id) to (id, user_id)
  // or keep id=1 per user with a unique constraint on (user_id).

  // ── Calculator State ───────────────────────────────────────────────────

  // GET /api/settings/calculator — get calculator state (single row per user)
  router.get("/calculator", async (req, res) => {
    try {
      const userId = req.userId!;
      const rows = await sql`SELECT state_json, updated_at FROM calculator_state WHERE id = 1 AND user_id = ${userId}`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Calculator state not found" });
        return;
      }
      res.json({
        stateJson: rows[0].state_json,
        updatedAt: rows[0].updated_at as number,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/settings/calculator — upsert full calculator state blob
  router.put("/calculator", async (req, res) => {
    try {
      const userId = req.userId!;
      const stateJson = req.body;
      if (stateJson === undefined || stateJson === null || typeof stateJson !== "object") {
        res.status(400).json({ error: "Body must be a JSON object" });
        return;
      }
      const now = Date.now();
      const rows = await sql`
        INSERT INTO calculator_state (id, user_id, state_json, updated_at)
        VALUES (1, ${userId}, ${JSON.stringify(stateJson)}::jsonb, ${now})
        ON CONFLICT (id, user_id) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at
        RETURNING state_json, updated_at
      `;
      res.json({
        stateJson: rows[0].state_json,
        updatedAt: rows[0].updated_at as number,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ── App Settings ───────────────────────────────────────────────────────

  // GET /api/settings/app/:key — get app setting by key
  router.get("/app/:key", async (req, res) => {
    try {
      const userId = req.userId!;
      const { key } = req.params;
      if (!key || key.trim().length === 0) {
        res.status(400).json({ error: "Key must be a non-empty string" });
        return;
      }
      const rows = await sql`SELECT key, value FROM app_settings WHERE key = ${key} AND user_id = ${userId}`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Setting not found" });
        return;
      }
      res.json({ key: rows[0].key as string, value: rows[0].value as string });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/settings/app/:key — upsert app setting
  router.put("/app/:key", async (req, res) => {
    try {
      const userId = req.userId!;
      const { key } = req.params;
      if (!key || key.trim().length === 0) {
        res.status(400).json({ error: "Key must be a non-empty string" });
        return;
      }
      const { value } = req.body as { value?: unknown };
      if (typeof value !== "string") {
        res.status(400).json({ error: "Value must be a string" });
        return;
      }
      await sql`
        INSERT INTO app_settings (key, value, user_id)
        VALUES (${key}, ${value}, ${userId})
        ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value
      `;
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/settings/app/:key — delete app setting
  router.delete("/app/:key", async (req, res) => {
    try {
      const userId = req.userId!;
      const { key } = req.params;
      if (!key || key.trim().length === 0) {
        res.status(400).json({ error: "Key must be a non-empty string" });
        return;
      }
      const rows = await sql`DELETE FROM app_settings WHERE key = ${key} AND user_id = ${userId} RETURNING key`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Setting not found" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}