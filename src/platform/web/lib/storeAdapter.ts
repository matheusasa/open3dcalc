/**
 * Drop-in Zustand persist storage adapters for the web platform.
 *
 * Each export mirrors the storage key used by the corresponding desktop/local
 * store, but routes reads/writes through the REST API (PostgreSQL) instead of
 * localStorage. Import these in place of the desktop storage objects when
 * running on the web platform.
 */

import { createApiStorage } from "./apiStorage";

export const gatedPiiPersistStorage = {
  customers: createApiStorage("customers"),
  quotes: createApiStorage("quotes"),
  history: createApiStorage("history"),
};

export const manifestStorage = {
  products: createApiStorage("products"),
  catalogPrinters: createApiStorage("catalog_printers"),
  catalogMaterials: createApiStorage("catalog_materials"),
  catalogMarketplaces: createApiStorage("catalog_marketplaces"),
};

export const guardedStorage = {
  calculator: createApiStorage("settings_calculator"),
  app: createApiStorage("settings_app"),
};