/**
 * Web API Client
 *
 * Typed fetch wrappers for every REST endpoint served by the Express backend.
 * Replaces direct localStorage access in Zustand stores so the web platform
 * persists data through PostgreSQL via the nginx-proxied API.
 *
 * Conventions:
 * - Relative URLs (/api/...) — nginx reverse-proxies to the backend.
 * - credentials: 'include' — Better Auth session cookies travel automatically.
 * - Non-2xx responses throw an Error with the server message when available.
 * - 404 on single-resource GETs returns null instead of throwing.
 */

import type {
  Customer,
  CustomerFormData,
  Quote,
  QuoteItem,
  HistoryEntry,
  CalculationResult,
  CalculationSnapshot,
} from "@/shared/types";

import type {
  FilamentSpool,
  NewFilamentSpool,
  CatalogPrinter,
  NewCatalogPrinter,
  CatalogMaterial,
  NewCatalogMaterial,
  CatalogMarketplace,
  NewCatalogMarketplace,
  Product,
} from "../../../../db/schema/index";

import type { ProductFormData } from "@/shared/types/product";

// ── Local composite types ────────────────────────────────────────────────────

/** Quote shape accepted by createQuote / updateQuote (quote + line items). */
export interface QuoteWithItems {
  number?: number;
  title: string;
  customerId?: string | null;
  customerSnapshot?: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
  } | null;
  items: Array<{
    historyEntryId: string;
    name: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    discountPercent?: number;
  }>;
  globalDiscountPercent?: number;
  subtotal?: number;
  discountAmount?: number;
  total?: number;
  status?: Quote["status"];
  validUntil: string;
  paymentTerms?: string;
  deliveryEstimate?: string;
  footerNote?: string | null;
}

/** Shape accepted by createHistoryEntry — mirrors the POST body contract. */
export interface NewHistoryEntry {
  type: "fdm" | "resin";
  name: string;
  summary?: string;
  totalCost?: number;
  sellPrice?: number;
  profit?: number;
  resultJson: CalculationResult;
  snapshotJson?: CalculationSnapshot | null;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new Error(message);
  }

  // 204 No Content → void endpoints
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
}

// ── Customers ────────────────────────────────────────────────────────────────

export async function fetchCustomers(search?: string): Promise<Customer[]> {
  return request<Customer[]>(`/api/customers${buildQuery({ search })}`);
}

export async function fetchCustomer(id: string): Promise<Customer | null> {
  try {
    return await request<Customer>(`/api/customers/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function createCustomer(data: CustomerFormData): Promise<Customer> {
  return request<Customer>("/api/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCustomer(
  id: string,
  data: Partial<CustomerFormData>,
): Promise<Customer> {
  return request<Customer>(`/api/customers/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  return request<void>(`/api/customers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Quotes ───────────────────────────────────────────────────────────────────

export async function fetchQuotes(
  filters?: { status?: string; customerId?: string },
): Promise<Quote[]> {
  return request<Quote[]>(`/api/quotes${buildQuery(filters ?? {})}`);
}

export async function fetchQuote(id: string): Promise<Quote | null> {
  try {
    return await request<Quote>(`/api/quotes/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function createQuote(data: QuoteWithItems): Promise<Quote> {
  return request<Quote>("/api/quotes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateQuote(
  id: string,
  data: Partial<QuoteWithItems>,
): Promise<Quote> {
  return request<Quote>(`/api/quotes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteQuote(id: string): Promise<void> {
  return request<void>(`/api/quotes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function updateQuoteStatus(
  id: string,
  status: string,
): Promise<void> {
  await request<unknown>(`/api/quotes/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// ── History ──────────────────────────────────────────────────────────────────

export async function fetchHistory(
  filters?: { type?: string; from?: number; to?: number },
): Promise<HistoryEntry[]> {
  return request<HistoryEntry[]>(`/api/history${buildQuery(filters ?? {})}`);
}

export async function fetchHistoryEntry(id: string): Promise<HistoryEntry | null> {
  try {
    return await request<HistoryEntry>(`/api/history/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function createHistoryEntry(
  entry: NewHistoryEntry,
): Promise<HistoryEntry> {
  return request<HistoryEntry>("/api/history", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  return request<void>(`/api/history/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function clearHistory(): Promise<void> {
  return request<void>("/api/history", { method: "DELETE" });
}

// ── Spools ───────────────────────────────────────────────────────────────────

export async function fetchSpools(
  filters?: { material?: string; status?: string },
): Promise<FilamentSpool[]> {
  return request<FilamentSpool[]>(`/api/spools${buildQuery(filters ?? {})}`);
}

export async function fetchSpool(id: string): Promise<FilamentSpool | null> {
  try {
    return await request<FilamentSpool>(`/api/spools/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function createSpool(data: NewFilamentSpool): Promise<FilamentSpool> {
  return request<FilamentSpool>("/api/spools", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSpool(
  id: string,
  data: Partial<FilamentSpool>,
): Promise<FilamentSpool> {
  return request<FilamentSpool>(`/api/spools/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSpool(id: string): Promise<void> {
  return request<void>(`/api/spools/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function deductSpoolWeight(id: string, grams: number): Promise<void> {
  await request<unknown>(`/api/spools/${encodeURIComponent(id)}/deduct`, {
    method: "PATCH",
    body: JSON.stringify({ grams }),
  });
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function fetchProducts(search?: string): Promise<Product[]> {
  return request<Product[]>(`/api/products${buildQuery({ search })}`);
}

export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    return await request<Product>(`/api/products/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function createProduct(data: ProductFormData): Promise<Product> {
  return request<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  id: string,
  data: Partial<ProductFormData>,
): Promise<Product> {
  return request<Product>(`/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  return request<void>(`/api/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function markProductSold(id: string, sold: boolean): Promise<void> {
  await request<unknown>(`/api/products/${encodeURIComponent(id)}/sold`, {
    method: "PATCH",
    body: JSON.stringify({ sold }),
  });
}

// ── Catalog: Printers ────────────────────────────────────────────────────────

export async function fetchCatalogPrinters(): Promise<CatalogPrinter[]> {
  return request<CatalogPrinter[]>("/api/catalog/printers");
}

export async function createCatalogPrinter(
  data: NewCatalogPrinter,
): Promise<CatalogPrinter> {
  return request<CatalogPrinter>("/api/catalog/printers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCatalogPrinter(
  id: string,
  data: Partial<CatalogPrinter>,
): Promise<CatalogPrinter> {
  return request<CatalogPrinter>(`/api/catalog/printers/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCatalogPrinter(id: string): Promise<void> {
  return request<void>(`/api/catalog/printers/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Catalog: Materials ───────────────────────────────────────────────────────

export async function fetchCatalogMaterials(
  type?: string,
): Promise<CatalogMaterial[]> {
  return request<CatalogMaterial[]>(`/api/catalog/materials${buildQuery({ type })}`);
}

export async function createCatalogMaterial(
  data: NewCatalogMaterial,
): Promise<CatalogMaterial> {
  return request<CatalogMaterial>("/api/catalog/materials", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCatalogMaterial(
  id: string,
  data: Partial<CatalogMaterial>,
): Promise<CatalogMaterial> {
  return request<CatalogMaterial>(`/api/catalog/materials/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCatalogMaterial(id: string): Promise<void> {
  return request<void>(`/api/catalog/materials/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Catalog: Marketplaces ────────────────────────────────────────────────────

export async function fetchCatalogMarketplaces(): Promise<CatalogMarketplace[]> {
  return request<CatalogMarketplace[]>("/api/catalog/marketplaces");
}

export async function createCatalogMarketplace(
  data: NewCatalogMarketplace,
): Promise<CatalogMarketplace> {
  return request<CatalogMarketplace>("/api/catalog/marketplaces", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCatalogMarketplace(
  id: string,
  data: Partial<CatalogMarketplace>,
): Promise<CatalogMarketplace> {
  return request<CatalogMarketplace>(`/api/catalog/marketplaces/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCatalogMarketplace(id: string): Promise<void> {
  return request<void>(`/api/catalog/marketplaces/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function fetchCalculatorSettings(): Promise<object | null> {
  try {
    const result = await request<{ stateJson: object }>("/api/settings/calculator");
    return result.stateJson;
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function saveCalculatorSettings(state: object): Promise<void> {
  await request<unknown>("/api/settings/calculator", {
    method: "PUT",
    body: JSON.stringify(state),
  });
}

export async function fetchAppSetting(key: string): Promise<string | null> {
  try {
    const result = await request<{ key: string; value: string }>(
      `/api/settings/app/${encodeURIComponent(key)}`,
    );
    return result.value;
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    throw err;
  }
}

export async function saveAppSetting(key: string, value: string): Promise<void> {
  await request<unknown>(`/api/settings/app/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export async function deleteAppSetting(key: string): Promise<void> {
  return request<void>(`/api/settings/app/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}