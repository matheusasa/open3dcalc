import { Router } from "express";
import crypto from "node:crypto";
import type postgres from "postgres";

export function createCustomersRouter(sql: postgres.Sql): Router {
  const router = Router();

  // TODO: Migration needed — add user_id column to customers table:
  //   ALTER TABLE customers ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
  //   CREATE INDEX idx_customers_user_id ON customers(user_id);

  // GET /api/customers — list all, optional ?search=
  router.get("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      if (search) {
        const pattern = `%${search}%`;
        const rows = await sql`
          SELECT * FROM customers
          WHERE user_id = ${userId}
            AND (name ILIKE ${pattern}
                 OR email ILIKE ${pattern}
                 OR company ILIKE ${pattern})
          ORDER BY created_at DESC
        `;
        res.json(rows);
      } else {
        const rows = await sql`
          SELECT * FROM customers
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
        `;
        res.json(rows);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/customers — create
  router.post("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const { name, company, email, phone, address, notes } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      const id = `cust_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const now = Date.now();
      const rows = await sql`
        INSERT INTO customers (id, user_id, name, company, email, phone, address, notes, created_at, updated_at)
        VALUES (${id}, ${userId}, ${name}, ${company ?? null}, ${email ?? null}, ${phone ?? null}, ${address ?? null}, ${notes ?? null}, ${now}, ${now})
        RETURNING *
      `;
      res.status(201).json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/customers/:id — get one
  router.get("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const rows = await sql`SELECT * FROM customers WHERE id = ${id} AND user_id = ${userId}`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      res.json(rows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/customers/:id — update
  router.put("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const existing = await sql`SELECT id FROM customers WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      const { name, company, email, phone, address, notes } = req.body;
      const now = Date.now();
      const rows = await sql`
        UPDATE customers
        SET name = COALESCE(${name ?? null}, name),
            company = COALESCE(${company ?? null}, company),
            email = COALESCE(${email ?? null}, email),
            phone = COALESCE(${phone ?? null}, phone),
            address = COALESCE(${address ?? null}, address),
            notes = COALESCE(${notes ?? null}, notes),
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

  // DELETE /api/customers/:id — delete
  router.delete("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const rows = await sql`DELETE FROM customers WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Customer not found" });
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