import { HttpError } from "@/shared/api/sys/http";
import { hasBackendErrorCode, tryGetBackendErrorStatus } from "@/shared/api/sys/error-message";
import {
  pendingBindToAction,
  parsePhoneBindFromHttpBody,
} from "@/shared/api/auth/pending-phone-bind";
import { CONSOLE_ROUTES } from "@/shared/lib/permissions";

export const LOGIN_PLATFORM_CODE = "ai_admin";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
};

type TokenPairLike = Partial<TokenPair> & {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
};

export type AuthFlowAction = {
  action: "bind_phone";
  bindToken: string;
  expiresAt: number;
  channel: "email" | "wechat" | "username" | "dingtalk" | "google" | "feishu";
};

export type AuthFlowResponse = {
  status: string;
  token: TokenPair | null;
  nextAction: AuthFlowAction | null;
  error?: {
    status: string;
    nextAction?: string | null;
    recoverable?: boolean;
    field?: string | null;
  } | null;
};

export type OtpSendResponse = {
  status: string;
  requestId: string;
};

export const BIND_CHANNEL_LABEL: Record<AuthFlowAction["channel"], string> = {
  email: "邮箱",
  wechat: "微信",
  username: "账号",
  dingtalk: "钉钉",
  google: "谷歌",
  feishu: "飞书",
};

export const isValidPhone = (v: string) => !!v && v.trim().length >= 11;

export const isValidOtp = (v: string) => !!v && v.trim().length >= 4;

export const isValidEmail = (v: string) => !!v && v.includes("@");

export const getBindRequiredFromError = (e: unknown): AuthFlowAction | null => {
  if (!(e instanceof HttpError)) return null;
  if (!hasBackendErrorCode(e, "AUTH-428-PHONE-BIND-REQUIRED") && e.status !== 428) return null;
  return pendingBindToAction(parsePhoneBindFromHttpBody(e.body));
};

/** 短信发送被服务端限额拦截（同号冷却 / 日上限 / 同 IP 小时上限）。 */
export function isOtpSendTooFrequent(error: unknown): boolean {
  if (hasBackendErrorCode(error, "AUTH-429-OTP-SEND-TOO-FREQUENT")) return true;
  if (tryGetBackendErrorStatus(error) === "too_frequent") return true;
  return error instanceof HttpError && error.status === 429;
}

export function normalizeTokenPair(raw: unknown): TokenPair | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const token = raw as TokenPairLike;
  const accessToken = typeof token.accessToken === "string"
    ? token.accessToken.trim()
    : typeof token.access_token === "string"
      ? token.access_token.trim()
      : "";
  const refreshToken = typeof token.refreshToken === "string"
    ? token.refreshToken.trim()
    : typeof token.refresh_token === "string"
      ? token.refresh_token.trim()
      : "";
  const tokenType = typeof token.tokenType === "string"
    ? token.tokenType.trim()
    : typeof token.token_type === "string"
      ? token.token_type.trim()
      : "Bearer";
  const expiresAtRaw = typeof token.expiresAt === "number"
    ? token.expiresAt
    : typeof token.expires_at === "number"
      ? token.expires_at
      : 0;

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAtRaw,
    tokenType: tokenType || "Bearer",
  };
}

export function extractAuthenticatedToken(flow: AuthFlowResponse | null): TokenPair | null {
  if (!flow) return null;
  if (flow.status !== "authenticated" || !flow.token) return null;
  return normalizeTokenPair(flow.token);
}

export function resolveLoginRedirect(from: unknown): string {
  if (typeof from !== "string") {
    return "/";
  }
  const path = from.trim();
  if (!path.startsWith("/") || path === CONSOLE_ROUTES.login || path.startsWith("/login?") || path.startsWith("/auth/")) {
    return "/";
  }
  return path;
}
