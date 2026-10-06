import { Router } from "express";
import crypto from "node:crypto";
import type postgres from "postgres";

export function createQuotesRouter(sql: postgres.Sql): Router {
  const router = Router();

  // TODO: Migration needed — add user_id column to quotes table:
  // ALTER TABLE quotes ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
  // CREATE INDEX idx_quotes_user_id ON quotes(user_id);
  // TODO: Migration needed — add user_id column to quote_items table (or scope via quotes join):
  // ALTER TABLE quote_items ADD COLUMN user_id TEXT NOT NULL REFERENCES users(id);
  // CREATE INDEX idx_quote_items_user_id ON quote_items(user_id);

  // GET /api/quotes — list all, optional ?status= and ?customerId= filters
  router.get("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const customerId = typeof req.query.customerId === "string" ? req.query.customerId.trim() : "";

      if (status && customerId) {
        const rows = await sql`
          SELECT * FROM quotes
          WHERE user_id = ${userId} AND status = ${status} AND customer_id = ${customerId}
          ORDER BY created_at DESC
        `;
        res.json(rows);
      } else if (status) {
        const rows = await sql`
          SELECT * FROM quotes WHERE user_id = ${userId} AND status = ${status}
          ORDER BY created_at DESC
        `;
        res.json(rows);
      } else if (customerId) {
        const rows = await sql`
          SELECT * FROM quotes WHERE user_id = ${userId} AND customer_id = ${customerId}
          ORDER BY created_at DESC
        `;
        res.json(rows);
      } else {
        const rows = await sql`SELECT * FROM quotes WHERE user_id = ${userId} ORDER BY created_at DESC`;
        res.json(rows);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/quotes — create with items array in body
  router.post("/", async (req, res) => {
    try {
      const userId = req.userId!;
      const {
        number, title, customerId, customerSnapshot,
        globalDiscountPercent, subtotal, discountAmount, total,
        status, validUntil, paymentTerms, deliveryEstimate, footerNote,
        items,
      } = req.body;

      if (!title || typeof title !== "string" || title.trim().length === 0) {
        res.status(400).json({ error: "title is required" });
        return;
      }
      if (number == null || typeof number !== "number") {
        res.status(400).json({ error: "number is required" });
        return;
      }
      if (!validUntil || typeof validUntil !== "string") {
        res.status(400).json({ error: "validUntil is required" });
        return;
      }

      const id = `quote_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const now = Date.now();

      const quoteRows = await sql`
        INSERT INTO quotes (
          id, user_id, number, title, customer_id, customer_snapshot,
          global_discount_percent, subtotal, discount_amount, total,
          status, valid_until, payment_terms, delivery_estimate, footer_note,
          created_at, updated_at
        ) VALUES (
          ${id}, ${userId}, ${number}, ${title}, ${customerId ?? null}, ${customerSnapshot ?? null},
          ${globalDiscountPercent ?? 0}, ${subtotal ?? 0}, ${discountAmount ?? 0}, ${total ?? 0},
          ${status ?? "draft"}, ${validUntil}, ${paymentTerms ?? ""}, ${deliveryEstimate ?? ""}, ${footerNote ?? null},
          ${now}, ${now}
        )
        RETURNING *
      `;

      const quote = quoteRows[0];

      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await sql`
            INSERT INTO quote_items (quote_id, user_id, history_entry_id, name, quantity, unit_price, total_price, discount_percent)
            VALUES (${id}, ${userId}, ${item.historyEntryId}, ${item.name}, ${item.quantity ?? 1}, ${item.unitPrice ?? 0}, ${item.totalPrice ?? 0}, ${item.discountPercent ?? 0})
          `;
        }
      }

      res.status(201).json(quote);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/quotes/:id — get one with items joined
  router.get("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const quoteRows = await sql`SELECT * FROM quotes WHERE id = ${id} AND user_id = ${userId}`;
      if (quoteRows.length === 0) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }
      const itemRows = await sql`SELECT * FROM quote_items WHERE quote_id = ${id} AND user_id = ${userId} ORDER BY id ASC`;
      const result = { ...quoteRows[0], items: itemRows };
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/quotes/:id — update quote + sync items (delete old, insert new)
  router.put("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const existing = await sql`SELECT id FROM quotes WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }

      const {
        number, title, customerId, customerSnapshot,
        globalDiscountPercent, subtotal, discountAmount, total,
        status, validUntil, paymentTerms, deliveryEstimate, footerNote,
        items,
      } = req.body;

      const now = Date.now();

      const quoteRows = await sql`
        UPDATE quotes SET
          number = COALESCE(${number ?? null}, number),
          title = COALESCE(${title ?? null}, title),
          customer_id = COALESCE(${customerId ?? null}, customer_id),
          customer_snapshot = COALESCE(${customerSnapshot ?? null}, customer_snapshot),
          global_discount_percent = COALESCE(${globalDiscountPercent ?? null}, global_discount_percent),
          subtotal = COALESCE(${subtotal ?? null}, subtotal),
          discount_amount = COALESCE(${discountAmount ?? null}, discount_amount),
          total = COALESCE(${total ?? null}, total),
          status = COALESCE(${status ?? null}, status),
          valid_until = COALESCE(${validUntil ?? null}, valid_until),
          payment_terms = COALESCE(${paymentTerms ?? null}, payment_terms),
          delivery_estimate = COALESCE(${deliveryEstimate ?? null}, delivery_estimate),
          footer_note = COALESCE(${footerNote ?? null}, footer_note),
          updated_at = ${now}
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;

      // Sync items: delete old, insert new
      if (Array.isArray(items)) {
        await sql`DELETE FROM quote_items WHERE quote_id = ${id} AND user_id = ${userId}`;
        for (const item of items) {
          await sql`
            INSERT INTO quote_items (quote_id, user_id, history_entry_id, name, quantity, unit_price, total_price, discount_percent)
            VALUES (${id}, ${userId}, ${item.historyEntryId}, ${item.name}, ${item.quantity ?? 1}, ${item.unitPrice ?? 0}, ${item.totalPrice ?? 0}, ${item.discountPercent ?? 0})
          `;
        }
      }

      res.json(quoteRows[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // DELETE /api/quotes/:id — cascade deletes items
  router.delete("/:id", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      // Delete items first (scoped by user_id)
      await sql`DELETE FROM quote_items WHERE quote_id = ${id} AND user_id = ${userId}`;
      const rows = await sql`DELETE FROM quotes WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  });

  // PATCH /api/quotes/:id/status — update status only
  router.patch("/:id/status", async (req, res) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { status } = req.body;
      const validStatuses = ["draft", "sent", "approved", "rejected"];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
        return;
      }
      const existing = await sql`SELECT id FROM quotes WHERE id = ${id} AND user_id = ${userId}`;
      if (existing.length === 0) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }
      const now = Date.now();
      const rows = await sql`
        UPDATE quotes SET status = ${status}, updated_at = ${now}
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