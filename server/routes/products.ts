import { Router } from "express";
import postgres from "postgres";

export function createProductsRouter(sql: postgres.Sql): Router {
  const router = Router();

  // TODO: Migration needed — add user_id column to products table:
  // ALTER TABLE products ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
  // CREATE INDEX idx_products_user_id ON products(user_id);

  // GET /api/products — list all, optional ?search= query param
  router.get("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const { search } = req.query as { search?: string };

      if (search && search.trim().length > 0) {
        const term = `%${search}%`;
        const rows = await sql`
          SELECT * FROM products
          WHERE user_id = ${userId}
            AND (name ILIKE ${term} OR filament_type ILIKE ${term})
          ORDER BY created_at DESC
        `;
        res.json(rows);
        return;
      }

      const rows = await sql`SELECT * FROM products WHERE user_id = ${userId} ORDER BY created_at DESC`;
      res.json(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/products — create
  router.post("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const body = req.body;
      const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const now = Date.now();

      const rows = await sql`
        INSERT INTO products (
          id, user_id, name, weight_grams, filament_type,
          cost_price, sale_price, sold,
          created_at, updated_at
        ) VALUES (
          ${id},
          ${userId},
          ${body.name ?? ""},
          ${body.weightGrams ?? 0},
          ${body.filamentType ?? ""},
          ${body.costPrice ?? 0},
          ${body.salePrice ?? 0},
          ${body.sold ?? false},
          ${now},
          ${now}
        )
        RETURNING *
      `;
      res.status(201).json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/products/:id — get one
  router.get("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const rows = await sql`SELECT * FROM products WHERE id = ${id} AND user_id = ${userId}`;
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

  // PUT /api/products/:id — update
  router.put("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const body = req.body;

      const existing = await sql`SELECT id FROM products WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const now = Date.now();
      const rows = await sql`
        UPDATE products SET
          name = COALESCE(${body.name ?? null}, name),
          weight_grams = COALESCE(${body.weightGrams ?? null}, weight_grams),
          filament_type = COALESCE(${body.filamentType ?? null}, filament_type),
          cost_price = COALESCE(${body.costPrice ?? null}, cost_price),
          sale_price = COALESCE(${body.salePrice ?? null}, sale_price),
          sold = COALESCE(${body.sold ?? null}, sold),
          updated_at = ${now}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/products/:id — delete
  router.delete("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const rows = await sql`DELETE FROM products WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
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

  // PATCH /api/products/:id/sold — toggle sold status
  router.patch("/:id/sold", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { sold } = req.body as { sold?: boolean };

      if (typeof sold !== "boolean") {
        res.status(400).json({ error: "sold must be a boolean" });
        return;
      }

      const existing = await sql`SELECT id FROM products WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const now = Date.now();
      const rows = await sql`
        UPDATE products
        SET sold = ${sold}, updated_at = ${now}
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