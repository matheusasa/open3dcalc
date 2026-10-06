import { Router } from "express";
import crypto from "node:crypto";
import type postgres from "postgres";

export function createHistoryRouter(sql: postgres.Sql): Router {
  const router = Router();

  // TODO: Migration needed — add user_id column to history_entries table:
  // ALTER TABLE history_entries ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
  // CREATE INDEX idx_history_entries_user_id ON history_entries(user_id);

  // GET /api/history — list all, optional ?type=fdm|resin, ?from=, ?to= timestamps
  router.get("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
      const from = typeof req.query.from === "string" ? Number(req.query.from) : NaN;
      const to = typeof req.query.to === "string" ? Number(req.query.to) : NaN;

      const hasType = type === "fdm" || type === "resin";
      const hasFrom = !Number.isNaN(from);
      const hasTo = !Number.isNaN(to);

      if (hasType && hasFrom && hasTo) {
        const rows = await sql`
          SELECT * FROM history_entries
          WHERE user_id = ${userId} AND type = ${type} AND timestamp >= ${from} AND timestamp <= ${to}
          ORDER BY timestamp DESC
        `;
        res.json(rows);
      } else if (hasType && hasFrom) {
        const rows = await sql`
          SELECT * FROM history_entries
          WHERE user_id = ${userId} AND type = ${type} AND timestamp >= ${from}
          ORDER BY timestamp DESC
        `;
        res.json(rows);
      } else if (hasType && hasTo) {
        const rows = await sql`
          SELECT * FROM history_entries
          WHERE user_id = ${userId} AND type = ${type} AND timestamp <= ${to}
          ORDER BY timestamp DESC
        `;
        res.json(rows);
      } else if (hasFrom && hasTo) {
        const rows = await sql`
          SELECT * FROM history_entries
          WHERE user_id = ${userId} AND timestamp >= ${from} AND timestamp <= ${to}
          ORDER BY timestamp DESC
        `;
        res.json(rows);
      } else if (hasType) {
        const rows = await sql`
          SELECT * FROM history_entries WHERE user_id = ${userId} AND type = ${type}
          ORDER BY timestamp DESC
        `;
        res.json(rows);
      } else if (hasFrom) {
        const rows = await sql`
          SELECT * FROM history_entries WHERE user_id = ${userId} AND timestamp >= ${from}
          ORDER BY timestamp DESC
        `;
        res.json(rows);
      } else if (hasTo) {
        const rows = await sql`
          SELECT * FROM history_entries WHERE user_id = ${userId} AND timestamp <= ${to}
          ORDER BY timestamp DESC
        `;
        res.json(rows);
      } else {
        const rows = await sql`SELECT * FROM history_entries WHERE user_id = ${userId} ORDER BY timestamp DESC`;
        res.json(rows);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/history — create entry
  router.post("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const {
        type, name, summary, totalCost, sellPrice, profit,
        resultJson, snapshotJson,
      } = req.body;

      if (!type || (type !== "fdm" && type !== "resin")) {
        res.status(400).json({ error: "type must be 'fdm' or 'resin'" });
        return;
      }
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      if (!resultJson) {
        res.status(400).json({ error: "resultJson is required" });
        return;
      }

      const id = `hist_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const timestamp = Date.now();

      const rows = await sql`
        INSERT INTO history_entries (
          id, user_id, timestamp, type, name, summary,
          total_cost, sell_price, profit,
          result_json, snapshot_json
        ) VALUES (
          ${id}, ${userId}, ${timestamp}, ${type}, ${name}, ${summary ?? ""},
          ${totalCost ?? 0}, ${sellPrice ?? 0}, ${profit ?? 0},
          ${JSON.stringify(resultJson)}, ${snapshotJson != null ? JSON.stringify(snapshotJson) : null}
        )
        RETURNING *
      `;
      res.status(201).json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/history/:id — get one
  router.get("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const rows = await sql`SELECT * FROM history_entries WHERE id = ${id} AND user_id = ${userId}`;
      if (rows.length === 0) {
        res.status(404).json({ error: "History entry not found" });
        return;
      }
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/history/:id — delete one
  router.delete("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const rows = await sql`DELETE FROM history_entries WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
      if (rows.length === 0) {
        res.status(404).json({ error: "History entry not found" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/history — clear all (scoped to user)
  router.delete("/", async (req, res) => {
    try {
      const userId = req.userId!;
      await sql`DELETE FROM history_entries WHERE user_id = ${userId}`;
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}