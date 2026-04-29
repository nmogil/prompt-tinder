import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DockviewApi, SerializedDockview } from "dockview";

import { DEFAULT_LAYOUTS, type DockRoute } from "./defaultLayouts";

const STORAGE_PREFIX = "bb.dock";

function storageKey(route: DockRoute, userId: string | null): string {
  return `${STORAGE_PREFIX}.${route}.${userId ?? "anon"}`;
}

interface UseDockLayoutOptions {
  route: DockRoute;
  userId: string | null;
  /** Override the default layout for this (route, user) pair. */
  override?: SerializedDockview;
  /** Disable persistence (e.g., for evaluator sessions where layout is fixed). */
  disabled?: boolean;
}

/**
 * Manages dock layout persistence per (route, user) (M27.7).
 *
 * On dock ready: restore from localStorage if present, else use the route's
 * default layout. After ready, listens to the dockview onDidLayoutChange
 * event and writes to localStorage on every change.
 *
 * Per UX Spec §8.11: server-side persistence is out of scope for M27 —
 * localStorage is enough for v1.
 */
export function useDockLayout({
  route,
  userId,
  override,
  disabled = false,
}: UseDockLayoutOptions) {
  const apiRef = useRef<DockviewApi | null>(null);

  const initial = useMemo<SerializedDockview>(() => {
    if (override) return override;
    if (disabled) return DEFAULT_LAYOUTS[route];
    if (typeof window === "undefined") return DEFAULT_LAYOUTS[route];
    try {
      const raw = window.localStorage.getItem(storageKey(route, userId));
      if (raw) return JSON.parse(raw) as SerializedDockview;
    } catch {
      // Fall through to default on parse error.
    }
    return DEFAULT_LAYOUTS[route];
  }, [route, userId, override, disabled]);

  const onReady = useCallback(
    (api: DockviewApi) => {
      apiRef.current = api;
      try {
        api.fromJSON(initial);
      } catch {
        // If the persisted layout is incompatible with the current panel
        // registry, reset to the default. The user just gets the default
        // layout next time — better than a blank dock.
        api.fromJSON(DEFAULT_LAYOUTS[route]);
      }
    },
    [initial, route],
  );

  useEffect(() => {
    if (disabled) return;
    const api = apiRef.current;
    if (!api) return;
    const sub = api.onDidLayoutChange(() => {
      try {
        const serialized = api.toJSON();
        window.localStorage.setItem(
          storageKey(route, userId),
          JSON.stringify(serialized),
        );
      } catch {
        // localStorage may be full or sandboxed — silently ignore.
      }
    });
    return () => sub.dispose();
  }, [route, userId, disabled]);

  const reset = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      window.localStorage.removeItem(storageKey(route, userId));
    } catch {
      // ignore
    }
    api.fromJSON(DEFAULT_LAYOUTS[route]);
  }, [route, userId]);

  return { onReady, reset };
}
