import { getApiBaseUrl } from "@/lib/api-base";
import { ADMIN_PAGES } from "@/lib/kiosk-routes";
import {
  clearDeviceSession,
  getAccessToken,
  getRefreshToken,
  getSessionKind,
  hasAdminSession,
  isAccessTokenFresh,
  saveDeviceSession,
  type DeviceTokenView,
} from "@/lib/device-session";

const SUCCESS_CODES = new Set(["0", "00000", "200", "OK", "SUCCESS"]);

export class ScreenHttpError extends Error {
  status: number;
  code?: string;
  traceId?: string;

  constructor(status: number, message: string, code?: string, traceId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

export type ScreenRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: unknown;
  withAuth?: boolean;
  skipRefresh?: boolean;
  requireAdmin?: boolean;
};

type Envelope = {
  code?: string;
  message?: string;
  data?: unknown;
  trace?: { traceId?: string };
};

let refreshInFlight: Promise<boolean> | null = null;

export async function screenRequest<T>(path: string, options: ScreenRequestOptions = {}): Promise<T> {
  const withAuth = options.withAuth ?? true;
  const skipRefresh = options.skipRefresh ?? false;
  if (options.requireAdmin && !hasAdminSession()) {
    clearDeviceSession();
    uni.reLaunch({ url: ADMIN_PAGES.login });
    throw new ScreenHttpError(401, "请先登录管理员后台", "AUTH-401");
  }
  if (withAuth && !skipRefresh) {
    await ensureAccessToken(options.requireAdmin === true);
    if (!getAccessToken()) {
      return failUnauthenticated(options.requireAdmin === true);
    }
  }
  const first = await send(path, options, withAuth);
  if (first.unauthorized && withAuth && !skipRefresh) {
    const recovered = await recoverAccessToken(options.requireAdmin === true);
    if (recovered) {
      const retry = await send(path, options, true);
      if (retry.unauthorized) {
        return failUnauthenticated(options.requireAdmin === true);
      }
      if (retry.error) {
        throw retry.error;
      }
      return retry.data as T;
    }
    return failUnauthenticated(options.requireAdmin === true);
  }
  if (first.error) {
    throw first.error;
  }
  return first.data as T;
}

async function ensureAccessToken(requireAdmin: boolean): Promise<void> {
  if (isAccessTokenFresh()) {
    return;
  }
  await recoverAccessToken(requireAdmin);
}

async function recoverAccessToken(requireAdmin: boolean): Promise<boolean> {
  if (await refreshDeviceSession()) {
    return true;
  }
  if (requireAdmin) {
    return false;
  }
  return bootstrapKioskSession();
}

async function bootstrapKioskSession(): Promise<boolean> {
  const { bootstrapDevice, isDeviceUnauthorized } = await import("@/lib/device-auth");
  try {
    await bootstrapDevice();
    return Boolean(getAccessToken());
  } catch (error) {
    if (isDeviceUnauthorized(error)) {
      onAuthLost();
    }
    return Boolean(getAccessToken());
  }
}

function failUnauthenticated(requireAdmin: boolean): never {
  onAuthLost();
  if (requireAdmin || getSessionKind() === "admin") {
    throw new ScreenHttpError(401, "请先登录管理员后台", "AUTH-401");
  }
  throw new ScreenHttpError(0, BUSY_MESSAGE, "COMMON-AUTH-401");
}

async function send(
  path: string,
  options: ScreenRequestOptions,
  withAuth: boolean,
): Promise<{ data?: unknown; error?: ScreenHttpError; unauthorized: boolean }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Trace-Id": createTraceId(),
  };
  if (options.data !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (withAuth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }
  }

  let response: UniApp.RequestSuccessCallbackResult;
  try {
    response = await uniRequest({
      url: `${getApiBaseUrl()}${path}`,
      method: (options.method || "GET") as unknown as UniApp.RequestOptions["method"],
      header: headers,
      data: options.data as UniApp.RequestOptions["data"],
      timeout: 15000,
    });
  } catch {
    return { error: new ScreenHttpError(0, "网络异常，请稍后重试"), unauthorized: false };
  }

  const status = response.statusCode || 0;
  if (status === 204) {
    return { data: undefined, unauthorized: false };
  }
  const envelope = asEnvelope(response.data);
  const unauthorized = status === 401;

  if (status < 200 || status >= 300 || (envelope.code && !isSuccessCode(envelope.code))) {
    const message = userFacingMessage(status, envelope.code, envelope.message || statusFallback(status));
    const error = new ScreenHttpError(status, message, envelope.code, envelope.trace?.traceId);
    return { error, unauthorized };
  }

  return { data: envelope.data, unauthorized: false };
}

export async function refreshDeviceSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const view = await screenRequest<DeviceTokenView>("/api/screen/device/auth/token/refresh", {
          method: "POST",
          data: { refreshToken },
          withAuth: false,
          skipRefresh: true,
        });
        if (!view?.accessToken) {
          return false;
        }
        saveDeviceSession(view, getSessionKind() || "kiosk");
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function onAuthLost(): void {
  clearDeviceSession();
  const pages = getCurrentPages();
  const last = pages[pages.length - 1] as { route?: string } | undefined;
  const route = last?.route || "";
  if (route.startsWith("pages/admin/") && route !== "pages/admin/login/index") {
    uni.reLaunch({ url: ADMIN_PAGES.login });
  }
}

function uniRequest(options: UniApp.RequestOptions): Promise<UniApp.RequestSuccessCallbackResult> {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => resolve(res),
      fail: (err) => reject(err),
    });
  });
}

function asEnvelope(body: unknown): Envelope {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }
  return body as Envelope;
}

function isSuccessCode(code: string): boolean {
  return SUCCESS_CODES.has(String(code).toUpperCase());
}

function createTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `screen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const BUSY_MESSAGE = "服务繁忙，请稍后重试";
const GENERIC_FAILURE_TEXT = new Set([
  "系统内部错误",
  "系统错误",
  "请求失败",
  "internal server error",
  BUSY_MESSAGE.toLowerCase(),
]);

function statusFallback(status: number): string {
  if (status === 401) {
    return "登录已过期，请重新登录";
  }
  if (status === 403) {
    return "暂无权限执行该操作";
  }
  if (status === 0) {
    return "网络异常，请稍后重试";
  }
  if (status === 503 || status === 502 || status >= 500) {
    return BUSY_MESSAGE;
  }
  return "请求失败";
}

function userFacingMessage(status: number, code: string | undefined, raw: string): string {
  const message = stripTraceSuffix(raw);
  if (isGatewayUnauthenticated(status, code, message)) {
    return BUSY_MESSAGE;
  }
  if (isGenericServerFailure(status, code, message)) {
    return BUSY_MESSAGE;
  }
  return message || statusFallback(status);
}

function isGatewayUnauthenticated(status: number, code: string | undefined, message: string): boolean {
  if (status !== 401 && code !== "COMMON-AUTH-401") {
    return false;
  }
  const lower = message.toLowerCase();
  return (
    code === "COMMON-AUTH-401" ||
    lower === "not authenticated" ||
    lower === "unauthorized" ||
    message.includes("请先登录") ||
    message.includes("登录已过期")
  );
}

function isGenericServerFailure(status: number, code: string | undefined, message: string): boolean {
  if (code === "COMMON-INTERNAL-500" || status === 503) {
    return true;
  }
  return GENERIC_FAILURE_TEXT.has(message.toLowerCase());
}

export function showScreenError(error: unknown, fallback = "请求失败") {
  uni.showToast({
    title: resolveScreenErrorTitle(error, fallback).slice(0, 40),
    icon: "none",
    duration: 3000,
  });
}

export function resolveScreenErrorTitle(error: unknown, fallback = "请求失败"): string {
  if (error instanceof ScreenHttpError) {
    if (isGenericServerFailure(error.status, error.code, stripTraceSuffix(error.message))) {
      return fallback === "请求失败" ? BUSY_MESSAGE : fallback;
    }
    return stripTraceSuffix(error.message) || fallback;
  }
  if (error instanceof Error) {
    const message = stripTraceSuffix(error.message);
    if (!message || isGenericServerFailure(0, undefined, message)) {
      return fallback === "请求失败" ? BUSY_MESSAGE : fallback;
    }
    return message;
  }
  return fallback;
}

function stripTraceSuffix(message: string): string {
  return message.replace(/\s*\[traceId:[^\]]*\]\s*$/i, "").trim();
}
