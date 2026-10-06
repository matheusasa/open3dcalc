import { Router } from "express";
import postgres from "postgres";

export function createSpoolsRouter(sql: postgres.Sql): Router {
  const router = Router();

  // TODO: Migration needed — add user_id column to filament_spools table:
  // ALTER TABLE filament_spools ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
  // CREATE INDEX idx_filament_spools_user_id ON filament_spools(user_id);

  // GET /api/spools — list all, optional ?material= and ?status= filters
  router.get("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const { material, status } = req.query as { material?: string; status?: string };

      if (material && status) {
        const rows = await sql`
          SELECT * FROM filament_spools
          WHERE user_id = ${userId} AND material = ${material} AND status = ${status}
          ORDER BY date_added DESC
        `;
        res.json(rows);
        return;
      }
      if (material) {
        const rows = await sql`
          SELECT * FROM filament_spools
          WHERE user_id = ${userId} AND material = ${material}
          ORDER BY date_added DESC
        `;
        res.json(rows);
        return;
      }
      if (status) {
        const rows = await sql`
          SELECT * FROM filament_spools
          WHERE user_id = ${userId} AND status = ${status}
          ORDER BY date_added DESC
        `;
        res.json(rows);
        return;
      }

      const rows = await sql`SELECT * FROM filament_spools WHERE user_id = ${userId} ORDER BY date_added DESC`;
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/spools — create
  router.post("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const body = req.body;
      const id = `spool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();

      const rows = await sql`
        INSERT INTO filament_spools (
          id, user_id, brand, material, color, color_hex,
          weight_grams, original_weight_grams, cost_per_kg,
          diameter_mm, date_added, notes, status,
          purchase_store, tare_grams
        ) VALUES (
          ${id},
          ${userId},
          ${body.brand ?? ""},
          ${body.material ?? "PLA"},
          ${body.color ?? ""},
          ${body.colorHex ?? ""},
          ${body.weightGrams ?? 0},
          ${body.originalWeightGrams ?? 1000},
          ${body.costPerKg ?? 0},
          ${body.diameterMm ?? 1.75},
          ${now},
          ${body.notes ?? ""},
          ${body.status ?? "in_stock"},
          ${body.purchaseStore ?? ""},
          ${body.tareGrams ?? null}
        )
        RETURNING *
      `;
      res.status(201).json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/spools/:id — get one
  router.get("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const rows = await sql`SELECT * FROM filament_spools WHERE id = ${id} AND user_id = ${userId}`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/spools/:id — update
  router.put("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const body = req.body;

      const existing = await sql`SELECT id FROM filament_spools WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const rows = await sql`
        UPDATE filament_spools SET
          brand = COALESCE(${body.brand ?? null}, brand),
          material = COALESCE(${body.material ?? null}, material),
          color = COALESCE(${body.color ?? null}, color),
          color_hex = COALESCE(${body.colorHex ?? null}, color_hex),
          weight_grams = COALESCE(${body.weightGrams ?? null}, weight_grams),
          original_weight_grams = COALESCE(${body.originalWeightGrams ?? null}, original_weight_grams),
          cost_per_kg = COALESCE(${body.costPerKg ?? null}, cost_per_kg),
          diameter_mm = COALESCE(${body.diameterMm ?? null}, diameter_mm),
          notes = COALESCE(${body.notes ?? null}, notes),
          status = COALESCE(${body.status ?? null}, status),
          purchase_store = COALESCE(${body.purchaseStore ?? null}, purchase_store),
          tare_grams = COALESCE(${body.tareGrams ?? null}, tare_grams)
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/spools/:id — delete
  router.delete("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const rows = await sql`DELETE FROM filament_spools WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PATCH /api/spools/:id/deduct — deduct weight
  router.patch("/:id/deduct", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { grams } = req.body as { grams?: number };

      if (typeof grams !== "number" || grams <= 0) {
        res.status(400).json({ error: "grams must be a positive number" });
        return;
      }

      const existing = await sql`SELECT id, weight_grams FROM filament_spools WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const newWeight = Math.max(0, (existing[0].weight_grams as number) - grams);
      const rows = await sql`
        UPDATE filament_spools
        SET weight_grams = ${newWeight}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}