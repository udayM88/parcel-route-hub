import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "vs_chunk_reload_at";

/**
 * React.lazy wrapper that recovers from stale-deploy chunk 404s.
 * 1. Retries the dynamic import once (transient network failures).
 * 2. If it still fails, forces a one-time hard reload so the browser
 *    fetches the fresh index.html + new asset hashes.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      try {
        await new Promise((r) => setTimeout(r, 400));
        return await factory();
      } catch (finalErr) {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
          window.location.reload();
          // Keep the promise pending while the page reloads.
          return await new Promise<{ default: T }>(() => {});
        }
        throw finalErr;
      }
    }
  });
}
