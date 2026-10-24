import { apiFetch } from "@/shared/api/sys/http";
import { LOGIN_CALLBACK_PATHS } from "@/modules/sys/components/login-config/login-provider-meta";

export type SsoProviderCode = "dingtalk" | "google" | "feishu";

export type SsoOauthConfig = {
  providerCode: string;
  clientId: string;
  redirectUri: string;
};

const STATE_PREFIX = "sso_oauth_state:";

const PROVIDER_META: Record<
  SsoProviderCode,
  {
    label: string;
    callbackPath: string;
    buildAuthorizeUrl: (clientId: string, redirectUri: string, state: string) => string;
  }
> = {
  dingtalk: {
    label: "钉钉",
    callbackPath: LOGIN_CALLBACK_PATHS.dingtalk,
    buildAuthorizeUrl: (clientId, redirectUri, state) => {
      const query = new URLSearchParams({
        redirect_uri: redirectUri,
        response_type: "code",
        client_id: clientId,
        scope: "openid",
        state,
        prompt: "consent",
      });
      return `https://login.dingtalk.com/oauth2/auth?${query.toString()}`;
    },
  },
  google: {
    label: "谷歌",
    callbackPath: LOGIN_CALLBACK_PATHS.google,
    buildAuthorizeUrl: (clientId, redirectUri, state) => {
      const query = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        access_type: "online",
        prompt: "select_account",
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
    },
  },
  feishu: {
    label: "飞书",
    callbackPath: LOGIN_CALLBACK_PATHS.feishu,
    buildAuthorizeUrl: (clientId, redirectUri, state) => {
      const query = new URLSearchParams({
        app_id: clientId,
        redirect_uri: redirectUri,
        state,
      });
      return `https://open.feishu.cn/open-apis/authen/v1/authorize?${query.toString()}`;
    },
  },
};

export function isSsoProviderCode(code: string): code is SsoProviderCode {
  return code === "dingtalk" || code === "google" || code === "feishu";
}

export function ssoProviderLabel(code: SsoProviderCode): string {
  return PROVIDER_META[code].label;
}

export function ssoCallbackPath(code: SsoProviderCode): string {
  return PROVIDER_META[code].callbackPath;
}

export async function fetchSsoOauthConfig(providerCode: SsoProviderCode): Promise<SsoOauthConfig> {
  return apiFetch<SsoOauthConfig>(`/api/auth/login/${encodeURIComponent(providerCode)}/oauth-config`, {
    method: "GET",
    withAuth: false,
  });
}

/** 32 位 hex；兼容无 randomUUID 的非安全上下文（如局域网 HTTP）。 */
function randomHexId(): string {
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

export function createSsoOauthState(providerCode: SsoProviderCode): string {
  const state = `${providerCode}_${randomHexId()}`;
  sessionStorage.setItem(`${STATE_PREFIX}${providerCode}`, state);
  return state;
}

export function consumeSsoOauthState(providerCode: SsoProviderCode, state: string | null): boolean {
  const key = `${STATE_PREFIX}${providerCode}`;
  const expected = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!state || !expected) return false;
  return state === expected;
}

export function buildSsoAuthorizeUrl(
  providerCode: SsoProviderCode,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  return PROVIDER_META[providerCode].buildAuthorizeUrl(clientId.trim(), redirectUri.trim(), state);
}

/**
 * 拉取公开配置并跳转第三方授权页。
 */
export async function startSsoAuthorize(providerCode: SsoProviderCode): Promise<void> {
  const config = await fetchSsoOauthConfig(providerCode);
  const state = createSsoOauthState(providerCode);
  const url = buildSsoAuthorizeUrl(providerCode, config.clientId, config.redirectUri, state);
  window.location.assign(url);
}
