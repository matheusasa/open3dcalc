/**
 * server/index.ts — REST API backend for the web version of Open3DCalc.
 *
 * Mirrors the Electron IPC handlers (db:load, db:save, db:delete, db:list-keys)
 * as HTTP endpoints so the web SPA can persist data to PostgreSQL.
 *
 * Endpoints:
 *   GET    /api/storage/:key  → load value by key
 *   POST   /api/storage       → save { key, value }
 *   DELETE /api/storage/:key  → delete by key
 *   GET    /api/storage       → list all keys
 *   GET    /api/health        → health check
 */
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { mountRoutes } from "./routes";
import { getSqlClient } from "./db/database";
import { requireAuth } from "./middleware/auth";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Better Auth routes (no auth required) ─────────────────────────────
app.all("/api/auth/{*path}", toNodeHandler(auth));

const sql = getSqlClient();

// ── Health check (no auth required) ───────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await sql`SELECT 1`;
    res.json({ status: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(503).json({ status: "error", message });
  }
});

// ── Authentication middleware for all other /api/* routes ──────────────
app.use("/api", requireAuth);

// ── Mounted CRUD routes (behind requireAuth) ──────────────────────────
mountRoutes(app, sql);

// ── List keys ─────────────────────────────────────────────────────────
app.get("/api/storage", async (_req, res) => {
  try {
    const rows = await sql`SELECT key FROM storage ORDER BY key`;
    res.json(rows.map((r) => r.key as string));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// ── Load value by key ─────────────────────────────────────────────────
app.get("/api/storage/:key", async (req, res) => {
  try {
    const { key } = req.params;
    if (!key || key.trim().length === 0) {
      res.status(400).json({ error: "Key must be a non-empty string" });
      return;
    }
    const rows = await sql`SELECT value FROM storage WHERE key = ${key}`;
    if (rows.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ key, value: rows[0].value as string });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// ── Save value ────────────────────────────────────────────────────────
app.post("/api/storage", async (req, res) => {
  try {
    const { key, value } = req.body as { key?: string; value?: string };
    if (!key || key.trim().length === 0) {
      res.status(400).json({ error: "Key must be a non-empty string" });
      return;
    }
    if (typeof value !== "string") {
      res.status(400).json({ error: "Value must be a string" });
      return;
    }
    await sql`
      INSERT INTO storage (key, value)
      VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    res.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// ── Delete value ──────────────────────────────────────────────────────
app.delete("/api/storage/:key", async (req, res) => {
  try {
    const { key } = req.params;
    if (!key || key.trim().length === 0) {
      res.status(400).json({ error: "Key must be a non-empty string" });
      return;
    }
    await sql`DELETE FROM storage WHERE key = ${key}`;
    res.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// ── Start server ──────────────────────────────────────────────────────
const PORT = Number(process.env["PORT"]) || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[api] Server listening on port ${PORT}`);
});