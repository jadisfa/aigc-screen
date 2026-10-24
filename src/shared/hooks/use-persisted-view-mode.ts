import { useCallback, useState } from "react";

export type CatalogViewMode = "card" | "list";

const STORAGE_PREFIX = "aigc_view_mode_";

export function readCatalogViewMode(key: string, fallback: CatalogViewMode): CatalogViewMode {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (stored === "card" || stored === "list") {
      return stored;
    }
  } catch {
    // private mode / quota
  }
  return fallback;
}

export function writeCatalogViewMode(key: string, value: CatalogViewMode) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
  } catch {
    // private mode / quota
  }
}

/** 卡片/列表切换按浏览器记住，各页独立 key。 */
export function usePersistedViewMode(key: string, fallback: CatalogViewMode) {
  const [viewMode, setViewModeState] = useState<CatalogViewMode>(() => readCatalogViewMode(key, fallback));

  const setViewMode = useCallback((next: CatalogViewMode) => {
    setViewModeState(next);
    writeCatalogViewMode(key, next);
  }, [key]);

  return [viewMode, setViewMode] as const;
}
