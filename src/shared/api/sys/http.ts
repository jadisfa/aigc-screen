import { clearAuthSession, getAccessToken } from "@/shared/api/auth/auth";
import { shouldPreRefreshToken, tryRefreshToken } from "@/shared/api/auth/token-refresh";
import { getApiBaseUrl } from "@/shared/api/sys/api-base";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { notify } from "@/shared/lib/notify";

export type TraceMetadata = {
  traceId: string;
  requestedAt: string;
  tenantId?: string;
};

export type ErrorResponse = {
  code: string;
  message: string;
  data?: unknown;
  trace?: TraceMetadata;
};

export class HttpError extends Error {
  status: number;
  body?: unknown;
  trace?: TraceMetadata;
  traceId?: string;

  constructor(status: number, message: string, body?: unknown, trace?: TraceMetadata) {
    super(message);
    this.status = status;
    this.body = body;
    this.trace = trace;
    this.traceId = trace?.traceId;
  }
}

function getBaseUrl(): string {
  return getApiBaseUrl();
}

function createTraceId(): string {
  // Backend TraceIdUtil/UuidUtil only accepts 32-hex or 36-dashed UUID.
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

function tryGetTraceMetadata(input: unknown): TraceMetadata | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const trace = input as Record<string, unknown>;
  const traceId = typeof trace.traceId === "string" ? trace.traceId.trim() : "";
  if (!traceId) return undefined;
  return {
    traceId,
    requestedAt: typeof trace.requestedAt === "string" ? trace.requestedAt : "",
    tenantId: typeof trace.tenantId === "string" ? trace.tenantId : undefined,
  };
}

function tryGetErrorResponse(body: unknown): ErrorResponse | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const payload = body as Record<string, unknown>;
  const code = typeof payload.code === "string" ? payload.code : "";
  const message = typeof payload.message === "string" ? payload.message : "";
  const trace = tryGetTraceMetadata(payload.trace);
  if (!code && !message && !trace) return null;
  return {
    code,
    message,
    data: payload.data,
    trace,
  };
}

function normalizeErrorMessage(message: string | null | undefined): string {
  return typeof message === "string" ? message.replace(/\s+/g, " ").trim() : "";
}

function isGenericBackendMessage(message: string): boolean {
  const normalized = normalizeErrorMessage(message);
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  return (
    lower === "internal error" ||
    lower === "internal server error" ||
    lower === "request failed" ||
    lower === "bad request" ||
    lower === "forbidden" ||
    lower === "unauthorized" ||
    lower === "service is currently unavailable, please try again later." ||
    normalized === "系统错误" ||
    normalized === "服务器内部错误" ||
    normalized === "服务异常" ||
    normalized === "请求失败"
  );
}

function getFallbackErrorMessage(status: number, statusText: string): string {
  switch (status) {
    case 400:
      return "请求参数错误，请检查后重试";
    case 401:
      return "登录已过期，请重新登录";
    case 403:
      return "暂无权限执行该操作";
    case 404:
      return "请求的资源不存在或已删除";
    case 409:
      return "数据冲突，请刷新后重试";
    case 429:
      return "请求过于频繁，请稍后再试";
    case 500:
    case 502:
      return "系统繁忙，请稍后重试";
    case 503:
    case 504:
      return "服务当前不可用，请稍后再试";
    default:
      return normalizeErrorMessage(statusText) || "Request failed";
  }
}

function resolveHttpErrorPayload(body: unknown, status: number, statusText: string, headerTraceId?: string | null) {
  const errorResponse = tryGetErrorResponse(body);
  const trace = errorResponse?.trace ?? (headerTraceId ? { traceId: headerTraceId, requestedAt: "" } : undefined);
  const backendMessage = normalizeErrorMessage(errorResponse?.message);
  const preferredMessage = resolveUserErrorMessage(
    {
      status,
      body,
      trace,
      traceId: trace?.traceId,
      message: isGenericBackendMessage(backendMessage) ? "" : backendMessage,
    },
    getFallbackErrorMessage(status, statusText)
  );
  return {
    trace,
    message: preferredMessage,
    error: errorResponse,
  };
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { withAuth?: boolean }
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers = new Headers(init?.headers);

  headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init?.body) {
    if (typeof init.body === "string") {
      headers.set("Content-Type", "application/json");
    }
    if (typeof URLSearchParams !== "undefined" && init.body instanceof URLSearchParams) {
      headers.set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
    }
  }

  headers.set("X-Trace-Id", createTraceId());

  const withAuth = init?.withAuth ?? true;
  if (withAuth && !path.startsWith("/api/auth/refresh")) {
    const token = getAccessToken();
    if (shouldPreRefreshToken(token)) {
      await tryRefreshToken(false);
    }
  }
  if (withAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
    }
  }

  const res = await fetch(url, { ...init, headers });
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

  if (res.status === 401 && withAuth && !path.startsWith("/api/auth/refresh")) {
    const refreshOutcome = await tryRefreshToken(true);
    if (refreshOutcome === "success") {
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set("Accept", "application/json");
      if (!retryHeaders.has("Content-Type") && init?.body) {
        if (typeof init.body === "string") {
          retryHeaders.set("Content-Type", "application/json");
        }
        if (typeof URLSearchParams !== "undefined" && init.body instanceof URLSearchParams) {
          retryHeaders.set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
        }
      }
      retryHeaders.set("X-Trace-Id", createTraceId());
      const retryToken = getAccessToken();
      if (retryToken) {
        retryHeaders.set("Authorization", retryToken.startsWith("Bearer ") ? retryToken : `Bearer ${retryToken}`);
      }
      const retryRes = await fetch(url, { ...init, headers: retryHeaders });
      const retryContentType = retryRes.headers.get("content-type") || "";
      const retryIsJson = retryContentType.includes("application/json");
      const retryBody = retryIsJson ? await retryRes.json().catch(() => undefined) : await retryRes.text().catch(() => undefined);
      if (!retryRes.ok) {
        const { message, trace, error } = resolveHttpErrorPayload(
          retryBody,
          retryRes.status,
          retryRes.statusText,
          retryRes.headers.get("X-Trace-Id") ?? retryRes.headers.get("Trace-Id")
        );
        // refresh 已成功但业务仍 401：仅账号禁用才强制登出，避免瞬时态误踢
        if (retryRes.status === 401 || (retryRes.status === 403 && error?.code === "AUTH-ACCOUNT-DISABLED")) {
          forceLogoutToLogin(error?.code);
        }
        throw new HttpError(retryRes.status, message, retryBody, trace);
      }
      if (
        retryIsJson &&
        retryBody &&
        typeof retryBody === "object" &&
        "code" in (retryBody as Record<string, unknown>) &&
        "data" in (retryBody as Record<string, unknown>)
      ) {
        return (retryBody as { data: T }).data;
      }
      return retryBody as T;
    }
    if (refreshOutcome === "transient") {
      const { message, trace } = resolveHttpErrorPayload(
        body,
        res.status,
        res.statusText,
        res.headers.get("X-Trace-Id") ?? res.headers.get("Trace-Id")
      );
      throw new HttpError(401, message || "网络异常，登录态暂未刷新，请稍后重试", body, trace);
    }
    // refresh 明确无效：再登出
    forceLogoutToLogin(undefined);
  }

  if (!res.ok) {
    const { message, trace, error } = resolveHttpErrorPayload(
      body,
      res.status,
      res.statusText,
      res.headers.get("X-Trace-Id") ?? res.headers.get("Trace-Id")
    );

    const errorCode = error?.code;
    if (withAuth && res.status === 403 && errorCode === "AUTH-ACCOUNT-DISABLED") {
      forceLogoutToLogin(errorCode);
    }

    throw new HttpError(res.status, message, body, trace);
  }

  if (isJson && body && typeof body === "object" && "code" in (body as Record<string, unknown>) && "data" in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function forceLogoutToLogin(errorCode?: string) {
  clearAuthSession();
  if (errorCode === "AUTH-ACCOUNT-DISABLED") {
    notify.error("账号已被禁用，请联系管理员");
  } else {
    notify.error("登录已过期，请重新登录");
  }
  if (typeof window !== "undefined") {
   window.dispatchEvent(
        new CustomEvent('openLogin', {
          detail: { value: true },
        })
      );
  }
  // if (typeof window !== "undefined" && window.location.pathname !== "/login") {
  //   window.location.replace("/login");
  // }
}
