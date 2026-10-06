/**
 * Async StateStorage adapter for Zustand persist middleware.
 *
 * Bridges zustand/persist (which expects sync localStorage) to the async
 * REST API backed by PostgreSQL. Uses skipHydration + manual rehydrate
 * pattern since fetch is inherently async.
 *
 * Offline fallback: on network failure, reads/writes go to localStorage
 * as a cache layer and sync is queued for retry on next successful request.
 */

import type { StateStorage } from "zustand/middleware";

type EntityName =
  | "customers"
  | "quotes"
  | "history"
  | "spools"
  | "products"
  | "catalog_printers"
  | "catalog_materials"
  | "catalog_marketplaces"
  | "settings_calculator"
  | "settings_app";

const CACHE_PREFIX = "open3dcalc_cache_";
const SYNC_QUEUE_KEY = "open3dcalc_sync_queue";

interface SyncEntry {
  entity: EntityName;
  key: string;
  value: string;
  timestamp: number;
}

function getCacheKey(entity: EntityName, key: string): string {
  return `${CACHE_PREFIX}${entity}:${key}`;
}

function readCache(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCache(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable — silently degrade.
  }
}

function removeCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

function enqueueSync(entry: SyncEntry): void {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncEntry[] = raw ? JSON.parse(raw) : [];
    queue.push(entry);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Queue persistence failed — entry will be lost on reload.
  }
}

export function createApiStorage(entity: EntityName): StateStorage {
  return {
    getItem(name: string): string | Promise<string | null> | null {
      return readCache(getCacheKey(entity, name));
    },

    setItem(name: string, value: string): void | Promise<void> {
      const cacheKey = getCacheKey(entity, name);
      writeCache(cacheKey, value);

      const url =
        entity === "settings_calculator"
          ? "/api/settings/calculator"
          : entity === "settings_app"
            ? `/api/settings/app/${encodeURIComponent(name)}`
            : `/api/${entity}`;

      const body =
        entity === "settings_calculator"
          ? JSON.stringify({ stateJson: JSON.parse(value) })
          : entity === "settings_app"
            ? JSON.stringify({ value })
            : value;

      fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {
        enqueueSync({ entity, key: name, value, timestamp: Date.now() });
      });
    },

    removeItem(name: string): void | Promise<void> {
      const cacheKey = getCacheKey(entity, name);
      removeCache(cacheKey);

      const url =
        entity === "settings_calculator"
          ? "/api/settings/calculator"
          : entity === "settings_app"
            ? `/api/settings/app/${encodeURIComponent(name)}`
            : `/api/${entity}/${encodeURIComponent(name)}`;

      fetch(url, {
        method: "DELETE",
        credentials: "include",
      }).catch(() => {
        // Deletion failures are not queued — cache-only removal is safe.
      });
    },
  };
}

/**
 * Flush pending sync queue entries to the API.
 * Call on app startup or when connectivity is restored.
 */
export async function flushSyncQueue(): Promise<number> {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return 0;

    const queue: SyncEntry[] = JSON.parse(raw);
    let flushed = 0;

    for (const entry of queue) {
      try {
        const url =
          entry.entity === "settings_calculator"
            ? "/api/settings/calculator"
            : entry.entity === "settings_app"
              ? `/api/settings/app/${encodeURIComponent(entry.key)}`
              : `/api/${entry.entity}`;

        const body =
          entry.entity === "settings_calculator"
            ? JSON.stringify({ stateJson: JSON.parse(entry.value) })
            : entry.entity === "settings_app"
              ? JSON.stringify({ value: entry.value })
              : entry.value;

        await fetch(url, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body,
        });
        flushed++;
      } catch {
        break;
      }
    }

    const remaining = queue.slice(flushed);
    if (remaining.length === 0) {
      localStorage.removeItem(SYNC_QUEUE_KEY);
    } else {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
    }

    return flushed;
  } catch {
    return 0;
  }
}