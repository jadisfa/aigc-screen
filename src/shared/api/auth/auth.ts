export const AUTH_TOKEN_STORAGE_KEY = "aigc_access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "aigc_refresh_token";
export const TENANT_ID_STORAGE_KEY = "aigc_tenant_id";
export const MERCHANT_ID_STORAGE_KEY = "aigc_merchant_id";
export const STORE_ID_STORAGE_KEY = "aigc_store_id";
export const REMEMBER_ME_STORAGE_KEY = "aigc_remember_me";
/** 新标签页鉴权交接（sessionStorage 不跨标签；仅短时写入 localStorage） */
const AUTH_TAB_HANDOFF_KEY = "aigc_auth_tab_handoff";
const AUTH_TAB_HANDOFF_TTL_MS = 15_000;

type AuthTabHandoff = {
  accessToken: string | null;
  refreshToken: string | null;
  rememberMe: boolean;
  exp: number;
};

function normalizeStoredValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return null;
  }
  return normalized;
}

export function setRememberMe(value: boolean) {
  localStorage.setItem(REMEMBER_ME_STORAGE_KEY, value ? "true" : "false");
}

export function getRememberMe(): boolean {
  // Default to true if not set
  const val = localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
  return val !== "false";
}

export function getAccessToken(): string | null {
  return normalizeStoredValue(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) ||
         normalizeStoredValue(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
}

export function setAccessToken(token: string) {
  const normalized = normalizeStoredValue(token);
  if (!normalized) {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    return;
  }
  if (getRememberMe()) {
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalized);
  }
}

export function clearAccessToken() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function getRefreshToken(): string | null {
  return normalizeStoredValue(localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)) ||
         normalizeStoredValue(sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY));
}

export function setRefreshToken(token: string) {
  const normalized = normalizeStoredValue(token);
  if (!normalized) {
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    return;
  }
  if (getRememberMe()) {
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, normalized);
  }
}

export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

export function clearScopeContext() {
  localStorage.removeItem(TENANT_ID_STORAGE_KEY);
  localStorage.removeItem(MERCHANT_ID_STORAGE_KEY);
  localStorage.removeItem(STORE_ID_STORAGE_KEY);
  sessionStorage.removeItem(TENANT_ID_STORAGE_KEY);
  sessionStorage.removeItem(MERCHANT_ID_STORAGE_KEY);
  sessionStorage.removeItem(STORE_ID_STORAGE_KEY);
}

/** 清除本地登录态（access/refresh/scope），用于退出或会话失效。 */
export function clearAuthSession() {
  clearAccessToken();
  clearRefreshToken();
  clearScopeContext();
  localStorage.removeItem(AUTH_TAB_HANDOFF_KEY);
}

/**
 * 打开需登录的同站路径（新标签）。
 * 未勾选 7 天免登录时 token 在 sessionStorage，新标签默认读不到；
 * 这里用短时 localStorage handoff 把登录态交给新标签。
 */
export function openAuthenticatedPath(path: string) {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const hasLocalAccess = !!normalizeStoredValue(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
  if ((accessToken || refreshToken) && !hasLocalAccess) {
    const handoff: AuthTabHandoff = {
      accessToken,
      refreshToken,
      rememberMe: getRememberMe(),
      exp: Date.now() + AUTH_TAB_HANDOFF_TTL_MS,
    };
    localStorage.setItem(AUTH_TAB_HANDOFF_KEY, JSON.stringify(handoff));
  }
  const absolute =
    path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  window.open(absolute, "_blank", "noopener,noreferrer");
}

/** 新标签启动时消费鉴权交接（须在首次 getAccessToken / 路由守卫之前调用）。 */
export function consumeAuthTabHandoff() {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(AUTH_TAB_HANDOFF_KEY);
  if (!raw) return;
  localStorage.removeItem(AUTH_TAB_HANDOFF_KEY);
  if (getAccessToken()) return;
  try {
    const handoff = JSON.parse(raw) as AuthTabHandoff;
    if (!handoff || typeof handoff.exp !== "number" || Date.now() > handoff.exp) {
      return;
    }
    setRememberMe(handoff.rememberMe !== false);
    if (handoff.accessToken) {
      setAccessToken(handoff.accessToken);
    }
    if (handoff.refreshToken) {
      setRefreshToken(handoff.refreshToken);
    }
  } catch {
    // ignore malformed handoff
  }
}
