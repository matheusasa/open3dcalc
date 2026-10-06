import { Router } from "express";
import postgres from "postgres";

export function createCatalogRouter(sql: postgres.Sql): Router {
  const router = Router();

  // ── Printers ───────────────────────────────────────────────────────────

  // GET /api/catalog/printers — list all
  router.get("/printers", async (_req, res) => {
    try {
      const rows = await sql`SELECT * FROM catalog_printers ORDER BY name`;
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/catalog/printers — create custom printer
  router.post("/printers", async (req, res) => {
    try {
      const userId = req.userId!;
      const body = req.body;
      const id = `printer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const rows = await sql`
        INSERT INTO catalog_printers (
          id, name, brand, power, value, useful_life,
          maintenance_per_hour, image, max_filaments, custom, user_id
        ) VALUES (
          ${id},
          ${body.name ?? ""},
          ${body.brand ?? ""},
          ${body.power ?? 0},
          ${body.value ?? 0},
          ${body.usefulLife ?? 0},
          ${body.maintenancePerHour ?? 0},
          ${body.image ?? null},
          ${body.maxFilaments ?? null},
          true,
          ${userId}
        )
        RETURNING *
      `;
      res.status(201).json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/catalog/printers/:id — update
  router.put("/printers/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const body = req.body;

      const existing = await sql`SELECT id FROM catalog_printers WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const rows = await sql`
        UPDATE catalog_printers SET
          name = COALESCE(${body.name ?? null}, name),
          brand = COALESCE(${body.brand ?? null}, brand),
          power = COALESCE(${body.power ?? null}, power),
          value = COALESCE(${body.value ?? null}, value),
          useful_life = COALESCE(${body.usefulLife ?? null}, useful_life),
          maintenance_per_hour = COALESCE(${body.maintenancePerHour ?? null}, maintenance_per_hour),
          image = COALESCE(${body.image ?? null}, image),
          max_filaments = COALESCE(${body.maxFilaments ?? null}, max_filaments)
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/catalog/printers/:id — delete (only custom=true)
  router.delete("/printers/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const existing = await sql`SELECT id, custom FROM catalog_printers WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (!existing[0].custom) {
        res.status(403).json({ error: "Cannot delete built-in printer" });
        return;
      }

      await sql`DELETE FROM catalog_printers WHERE id = ${id} AND user_id = ${userId}`;
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ── Materials ──────────────────────────────────────────────────────────

  // GET /api/catalog/materials — list all, optional ?type=fdm|resin
  router.get("/materials", async (req, res) => {
    try {
      const { type } = req.query as { type?: string };

      if (type && (type === "fdm" || type === "resin")) {
        const rows = await sql`
          SELECT * FROM catalog_materials
          WHERE type = ${type}
          ORDER BY name
        `;
        res.json(rows);
        return;
      }

      const rows = await sql`SELECT * FROM catalog_materials ORDER BY name`;
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/catalog/materials — create custom material
  router.post("/materials", async (req, res) => {
    try {
      const userId = req.userId!;
      const body = req.body;
      const id = `mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const rows = await sql`
        INSERT INTO catalog_materials (
          id, name, density, avg_price, type, custom, user_id
        ) VALUES (
          ${id},
          ${body.name ?? ""},
          ${body.density ?? 0},
          ${body.avgPrice ?? 0},
          ${body.type ?? "fdm"},
          true,
          ${userId}
        )
        RETURNING *
      `;
      res.status(201).json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/catalog/materials/:id — update
  router.put("/materials/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const body = req.body;

      const existing = await sql`SELECT id FROM catalog_materials WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const rows = await sql`
        UPDATE catalog_materials SET
          name = COALESCE(${body.name ?? null}, name),
          density = COALESCE(${body.density ?? null}, density),
          avg_price = COALESCE(${body.avgPrice ?? null}, avg_price),
          type = COALESCE(${body.type ?? null}, type)
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/catalog/materials/:id — delete (only custom=true)
  router.delete("/materials/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const existing = await sql`SELECT id, custom FROM catalog_materials WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (!existing[0].custom) {
        res.status(403).json({ error: "Cannot delete built-in material" });
        return;
      }

      await sql`DELETE FROM catalog_materials WHERE id = ${id} AND user_id = ${userId}`;
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // ── Marketplaces ───────────────────────────────────────────────────────

  // GET /api/catalog/marketplaces — list all
  router.get("/marketplaces", async (_req, res) => {
    try {
      const rows = await sql`SELECT * FROM catalog_marketplaces ORDER BY name`;
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/catalog/marketplaces — create custom marketplace
  router.post("/marketplaces", async (req, res) => {
    try {
      const userId = req.userId!;
      const body = req.body;
      const id = `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const rows = await sql`
        INSERT INTO catalog_marketplaces (
          id, name, fee_percent, fee_fixed,
          has_free_shipping, shipping_fee_percent, custom, user_id
        ) VALUES (
          ${id},
          ${body.name ?? ""},
          ${body.feePercent ?? 0},
          ${body.feeFixed ?? 0},
          ${body.hasFreeShipping ?? false},
          ${body.shippingFeePercent ?? null},
          true,
          ${userId}
        )
        RETURNING *
      `;
      res.status(201).json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/catalog/marketplaces/:id — update
  router.put("/marketplaces/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const body = req.body;

      const existing = await sql`SELECT id FROM catalog_marketplaces WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const rows = await sql`
        UPDATE catalog_marketplaces SET
          name = COALESCE(${body.name ?? null}, name),
          fee_percent = COALESCE(${body.feePercent ?? null}, fee_percent),
          fee_fixed = COALESCE(${body.feeFixed ?? null}, fee_fixed),
          has_free_shipping = COALESCE(${body.hasFreeShipping ?? null}, has_free_shipping),
          shipping_fee_percent = COALESCE(${body.shippingFeePercent ?? null}, shipping_fee_percent)
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/catalog/marketplaces/:id — delete (only custom=true)
  router.delete("/marketplaces/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const existing = await sql`SELECT id, custom FROM catalog_marketplaces WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (!existing[0].custom) {
        res.status(403).json({ error: "Cannot delete built-in marketplace" });
        return;
      }

      await sql`DELETE FROM catalog_marketplaces WHERE id = ${id} AND user_id = ${userId}`;
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  return router;
}