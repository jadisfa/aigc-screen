import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { toast as sonnerToast } from "sonner";

export const APP_UPDATE_RELOAD_KEY = "aigc:app-update-reload-at";
export const APP_UPDATE_TOAST_ID = "app-update-available";
export const APP_UPDATE_RELOAD_GUARD_MS = 15_000;
export const APP_UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;
export const APP_UPDATE_MIN_CHECK_INTERVAL_MS = 30_000;

const STALE_CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /loading chunk [\w-]+ failed/i,
  /unable to preload css/i,
  /loading css chunk/i,
];

export type AppVersionManifest = {
  buildId?: unknown;
  builtAt?: unknown;
};

export function isStaleChunkError(error: unknown): boolean {
  if (error && typeof error === "object" && "name" in error && (error as { name?: unknown }).name === "ChunkLoadError") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(message));
}

export function canReloadForStaleBundle(lastReloadAt: number | null, now: number, guardMs = APP_UPDATE_RELOAD_GUARD_MS): boolean {
  if (lastReloadAt == null || !Number.isFinite(lastReloadAt)) {
    return true;
  }
  return now - lastReloadAt >= guardMs;
}

export function parseRemoteBuildId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const buildId = (payload as AppVersionManifest).buildId;
  if (typeof buildId !== "string") {
    return null;
  }
  const trimmed = buildId.trim();
  return trimmed || null;
}

export function hasNewAppBuild(currentBuildId: string, remoteBuildId: string | null): boolean {
  if (!currentBuildId || !remoteBuildId) {
    return false;
  }
  return currentBuildId !== remoteBuildId;
}

export function currentAppBuildId(): string {
  return typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : "";
}

export function reloadForStaleBundle(reason: string): boolean {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return false;
  }
  const now = Date.now();
  const lastRaw = Number(sessionStorage.getItem(APP_UPDATE_RELOAD_KEY) ?? "");
  const lastReloadAt = Number.isFinite(lastRaw) ? lastRaw : null;
  if (!canReloadForStaleBundle(lastReloadAt, now)) {
    console.warn(`[app-update] skip reload loop (${reason})`);
    return false;
  }
  sessionStorage.setItem(APP_UPDATE_RELOAD_KEY, String(now));
  window.location.reload();
  return true;
}

/** 懒加载失败时自动刷新一次，避免发版后旧入口去拉已删除的 chunk */
export function lazyWithChunkReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (isStaleChunkError(error) && reloadForStaleBundle("lazy-import")) {
        return new Promise<{ default: T }>(() => undefined);
      }
      throw error;
    }),
  );
}

async function fetchRemoteBuildId(): Promise<string | null> {
  const response = await fetch(`/version.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
    },
  });
  if (!response.ok) {
    return null;
  }
  return parseRemoteBuildId(await response.json());
}

function promptReloadForNewBuild() {
  sonnerToast.info("发现新版本", {
    id: APP_UPDATE_TOAST_ID,
    description: "页面已更新，刷新后即可使用最新功能，避免因缓存导致异常。",
    duration: Number.POSITIVE_INFINITY,
    action: {
      label: "立即刷新",
      onClick: () => {
        window.location.reload();
      },
    },
  });
}

/**
 * 长期开着的 SPA 不会自动换新 HTML。轮询 version.json，并在 chunk 加载失败时强制刷新。
 * 开发环境不启用。
 */
export function installAppUpdateGuard(): () => void {
  if (import.meta.env.DEV || typeof window === "undefined") {
    return () => undefined;
  }

  const buildId = currentAppBuildId();
  if (!buildId) {
    return () => undefined;
  }

  let lastCheckAt = 0;
  let checking = false;
  let prompted = false;

  const checkForUpdate = async () => {
    if (checking || prompted) {
      return;
    }
    const now = Date.now();
    if (now - lastCheckAt < APP_UPDATE_MIN_CHECK_INTERVAL_MS) {
      return;
    }
    lastCheckAt = now;
    checking = true;
    try {
      const remoteBuildId = await fetchRemoteBuildId();
      if (hasNewAppBuild(buildId, remoteBuildId)) {
        prompted = true;
        promptReloadForNewBuild();
      }
    } catch {
      // 探测失败不影响主流程
    } finally {
      checking = false;
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      void checkForUpdate();
    }
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (isStaleChunkError(event.reason) && reloadForStaleBundle("unhandledrejection")) {
      event.preventDefault();
    }
  };

  const onWindowError = (event: ErrorEvent) => {
    if (isStaleChunkError(event.error ?? event.message)) {
      reloadForStaleBundle("window-error");
    }
  };

  window.addEventListener("focus", checkForUpdate);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  window.addEventListener("error", onWindowError);
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void checkForUpdate();
    }
  }, APP_UPDATE_POLL_INTERVAL_MS);

  return () => {
    window.removeEventListener("focus", checkForUpdate);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    window.removeEventListener("error", onWindowError);
    window.clearInterval(timer);
  };
}
