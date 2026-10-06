import type express from "express";
import type postgres from "postgres";

import { createCustomersRouter } from "./customers";
import { createQuotesRouter } from "./quotes";
import { createHistoryRouter } from "./history";
import { createSpoolsRouter } from "./spools";
import { createProductsRouter } from "./products";
import { createCatalogRouter } from "./catalog";
import { createSettingsRouter } from "./settings";

export function mountRoutes(app: express.Application, sql: postgres.Sql): void {
  app.use("/api/customers", createCustomersRouter(sql));
  app.use("/api/quotes", createQuotesRouter(sql));
  app.use("/api/history", createHistoryRouter(sql));
  app.use("/api/spools", createSpoolsRouter(sql));
  app.use("/api/products", createProductsRouter(sql));
  app.use("/api/catalog", createCatalogRouter(sql));
  app.use("/api/settings", createSettingsRouter(sql));
}