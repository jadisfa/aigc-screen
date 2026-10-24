import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/shared/api/auth/auth";
import { getApiBaseUrl } from "@/shared/api/sys/api-base";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  tokenType?: string;
};

/** refresh 结果：success 可继续；invalid 应登出；transient 保留会话稍后重试。 */
export type RefreshOutcome = "success" | "invalid" | "transient";

const PRE_REFRESH_WINDOW_SECONDS = 120;
const PROACTIVE_REFRESH_COOLDOWN_MS = 30_000;
const REFRESH_NETWORK_RETRY = 2;
const REFRESH_NETWORK_RETRY_DELAY_MS = 400;
const CROSS_TAB_CHANNEL = "aigc-auth-token-refresh";
const CROSS_TAB_LOCK_KEY = "aigc_refresh_lock";
const CROSS_TAB_LOCK_TTL_MS = 8_000;

let refreshingPromise: Promise<RefreshOutcome> | null = null;
let lastSuccessfulRefreshAt = 0;
let keepAliveInstalled = false;

function createTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeJwtExpSeconds(token: string): number | null {
  const raw = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
  const parts = raw.split(".");
  if (parts.length < 2) return null;
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  try {
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function shouldPreRefreshToken(token: string | null): boolean {
  if (!token) return false;
  const exp = decodeJwtExpSeconds(token);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= PRE_REFRESH_WINDOW_SECONDS;
}

export function isAccessTokenExpired(token: string | null, skewSeconds = 5): boolean {
  if (!token) return true;
  const exp = decodeJwtExpSeconds(token);
  if (!exp) return false;
  return exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}

function broadcastTokens(pair: TokenPair) {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(CROSS_TAB_CHANNEL);
    channel.postMessage({
      type: "tokens",
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
    });
    channel.close();
  } catch {
    // ignore
  }
}

function tryAcquireCrossTabLock(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const now = Date.now();
    const raw = localStorage.getItem(CROSS_TAB_LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { exp?: number; owner?: string };
      if (typeof parsed.exp === "number" && parsed.exp > now) {
        return false;
      }
    }
    const owner = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(CROSS_TAB_LOCK_KEY, JSON.stringify({ owner, exp: now + CROSS_TAB_LOCK_TTL_MS }));
    const confirm = localStorage.getItem(CROSS_TAB_LOCK_KEY);
    if (!confirm) return true;
    const confirmed = JSON.parse(confirm) as { owner?: string };
    return confirmed.owner === owner;
  } catch {
    return true;
  }
}

function releaseCrossTabLock() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(CROSS_TAB_LOCK_KEY);
  } catch {
    // ignore
  }
}

async function waitForPeerRefresh(timeoutMs: number, previousRefreshToken: string | null): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = getRefreshToken();
    if (current && current !== previousRefreshToken) {
      lastSuccessfulRefreshAt = Date.now();
      return true;
    }
    if (!shouldPreRefreshToken(getAccessToken()) && getAccessToken()) {
      // access 仍有效且未逼近过期，说明可能已有新 access
      const access = getAccessToken();
      if (access && !isAccessTokenExpired(access, 30)) {
        lastSuccessfulRefreshAt = Date.now();
        return true;
      }
    }
    await sleep(120);
  }
  const current = getRefreshToken();
  if (current && previousRefreshToken && current !== previousRefreshToken) {
    lastSuccessfulRefreshAt = Date.now();
    return true;
  }
  return false;
}

async function requestRefreshOnce(refreshToken: string): Promise<{
  outcome: RefreshOutcome;
  pair?: TokenPair;
}> {
  const url = `${getApiBaseUrl()}/api/auth/refresh`;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("X-Trace-Id", createTraceId());

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return { outcome: "transient" };
  }

  if (res.status === 401 || res.status === 403) {
    // 多标签：本标签用旧 refresh 失败时，另一标签可能已写入新 token
    const latest = getRefreshToken();
    if (latest && latest !== refreshToken) {
      return { outcome: "success" };
    }
    return { outcome: "invalid" };
  }

  if (res.status >= 500 || res.status === 429) {
    return { outcome: "transient" };
  }

  if (!res.ok) {
    return { outcome: "transient" };
  }

  const data = (await res.json().catch(() => undefined)) as { data?: TokenPair } | undefined;
  const pair = data?.data;
  if (!pair?.accessToken || !pair?.refreshToken) {
    return { outcome: "transient" };
  }
  return { outcome: "success", pair };
}

async function doRefreshToken(): Promise<RefreshOutcome> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return "invalid";
  }

  if (!tryAcquireCrossTabLock()) {
    const peerOk = await waitForPeerRefresh(2_500, refreshToken);
    if (peerOk) return "success";
  }

  try {
    let lastOutcome: RefreshOutcome = "transient";
    for (let attempt = 0; attempt <= REFRESH_NETWORK_RETRY; attempt += 1) {
      // 每轮重读：其他标签可能已刷新
      const currentRefresh = getRefreshToken();
      if (!currentRefresh) {
        return "invalid";
      }
      if (currentRefresh !== refreshToken && attempt > 0) {
        lastSuccessfulRefreshAt = Date.now();
        return "success";
      }

      const result = await requestRefreshOnce(currentRefresh);
      lastOutcome = result.outcome;
      if (result.outcome === "success") {
        if (result.pair) {
          setAccessToken(result.pair.accessToken);
          setRefreshToken(result.pair.refreshToken);
          broadcastTokens(result.pair);
        }
        lastSuccessfulRefreshAt = Date.now();
        return "success";
      }
      if (result.outcome === "invalid") {
        const latest = getRefreshToken();
        if (latest && latest !== currentRefresh) {
          lastSuccessfulRefreshAt = Date.now();
          return "success";
        }
        return "invalid";
      }
      if (attempt < REFRESH_NETWORK_RETRY) {
        await sleep(REFRESH_NETWORK_RETRY_DELAY_MS * (attempt + 1));
      }
    }
    return lastOutcome;
  } finally {
    releaseCrossTabLock();
  }
}

/**
 * 统一 refresh 入口（单飞 + 跨标签协调 + 瞬时失败重试）。
 * @param force 为 true 时忽略冷却（用于 401 后强制刷新）
 */
export async function tryRefreshToken(force = false): Promise<RefreshOutcome> {
  if (!force && Date.now() - lastSuccessfulRefreshAt < PROACTIVE_REFRESH_COOLDOWN_MS) {
    return "success";
  }
  if (refreshingPromise) {
    return refreshingPromise;
  }
  refreshingPromise = doRefreshToken().finally(() => {
    refreshingPromise = null;
  });
  return refreshingPromise;
}

/** 兼容旧布尔语义：仅 success 为 true。 */
export async function tryRefreshTokenBool(force = false): Promise<boolean> {
  return (await tryRefreshToken(force)) === "success";
}

/**
 * 用户活跃时提前续期，避免长时间只操作 UI 后首个请求撞上过期。
 */
export function installSessionKeepAlive() {
  if (keepAliveInstalled || typeof window === "undefined") return;
  keepAliveInstalled = true;

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(CROSS_TAB_CHANNEL);
      channel.onmessage = (event) => {
        const data = event.data as { type?: string; accessToken?: string; refreshToken?: string } | null;
        if (!data || data.type !== "tokens") return;
        if (typeof data.accessToken === "string" && data.accessToken) {
          setAccessToken(data.accessToken);
        }
        if (typeof data.refreshToken === "string" && data.refreshToken) {
          setRefreshToken(data.refreshToken);
        }
        lastSuccessfulRefreshAt = Date.now();
      };
    } catch {
      // ignore
    }
  }

  const maybeRefresh = () => {
    const token = getAccessToken();
    if (!token || !getRefreshToken()) return;
    if (!shouldPreRefreshToken(token)) return;
    void tryRefreshToken(false);
  };

  const onActivity = () => {
    maybeRefresh();
  };

  window.addEventListener("focus", onActivity);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onActivity();
  });
  window.addEventListener("pointerdown", onActivity, { passive: true });
  window.setInterval(maybeRefresh, 60_000);
  maybeRefresh();
}
