import {
  loadDeviceCodeFromFile,
  resolveDeviceCode,
  saveDeviceContext,
  saveDeviceSession,
  type DeviceContextView,
  type DeviceTokenView,
} from "@/lib/device-session";
import { ScreenHttpError, screenRequest } from "@/lib/screen-http";
import deviceConfig from '@/device.json';

export const DEVICE_UNAUTHORIZED_MESSAGE = "设备未授权，请联系设备厂商";

const VERIFY_TRIES = 3;
const VERIFY_RETRY_MS = 400;

export async function retryVerify<T>(run: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= VERIFY_TRIES; attempt++) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (!isRetryableVerifyError(error) || attempt === VERIFY_TRIES) {
        throw error;
      }
      await delay(VERIFY_RETRY_MS * attempt);
    }
  }
  throw last;
}

function isRetryableVerifyError(error: unknown): boolean {
  if (isDeviceUnauthorized(error)) {
    return false;
  }
  if (!(error instanceof ScreenHttpError)) {
    return true;
  }
  if (error.status === 401 || error.status === 403) {
    return false;
  }
  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function loginDevice(password: string): Promise<DeviceTokenView> {
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) await loadDeviceCodeFromFile();
  const deviceCode = !isDev ? resolveDeviceCode() : deviceConfig.deviceCode;
  if (!deviceCode) {
    throw new ScreenHttpError(0, "未配置设备编码");
  }
  const view = await screenRequest<DeviceTokenView>("/api/screen/device/auth/login", {
    method: "POST",
    data: { deviceCode, password },
    withAuth: false,
  });
  if (!view?.accessToken) {
    throw new ScreenHttpError(0, "登录失败");
  }
  saveDeviceSession(view, "admin");
  try {
    saveDeviceContext(await retryVerify(() => fetchDeviceContext()));
  } catch {
    // 登录已成功；设备上下文供后续页展示，失败不挡进入后台
  }
  return view;
}

export async function bootstrapDevice(): Promise<DeviceTokenView> {
  await loadDeviceCodeFromFile();
  const deviceCode = resolveDeviceCode();
  if (!deviceCode) {
    throw new ScreenHttpError(0, DEVICE_UNAUTHORIZED_MESSAGE, "SCREEN_DEVICE_UNAUTHORIZED");
  }
  const view = await screenRequest<DeviceTokenView>("/api/screen/device/auth/bootstrap", {
    method: "POST",
    data: { deviceCode },
    withAuth: false,
  });
  if (!view?.accessToken) {
    throw new ScreenHttpError(0, DEVICE_UNAUTHORIZED_MESSAGE, "SCREEN_DEVICE_UNAUTHORIZED");
  }
  saveDeviceSession(view, "kiosk");
  try {
    saveDeviceContext(await retryVerify(() => fetchDeviceContext()));
  } catch {
    // 开通成功即可进 C 端
  }
  return view;
}

export async function fetchDeviceContext(): Promise<DeviceContextView> {
  return screenRequest<DeviceContextView>("/api/screen/auth/device-context", { skipRefresh: true });
}

export function isDeviceUnauthorized(error: unknown): boolean {
  if (error instanceof ScreenHttpError) {
    if (error.code === "SCREEN_DEVICE_UNAUTHORIZED") {
      return true;
    }
    if (error.message.includes(DEVICE_UNAUTHORIZED_MESSAGE)) {
      return true;
    }
  }
  return false;
}

export function loginErrorMessage(error: unknown): string {
  if (isDeviceUnauthorized(error)) {
    return DEVICE_UNAUTHORIZED_MESSAGE;
  }
  const code = error instanceof ScreenHttpError ? error.code : undefined;
  const raw = stripTraceSuffix(error instanceof Error ? error.message : "");
  const lower = raw.toLowerCase();
  if (!raw || raw.includes("未配置设备编码")) {
    return raw || "登录失败";
  }
  if (
    lower.includes("device login locked") ||
    raw.includes("次数过多") ||
    raw.includes("已锁定")
  ) {
    return "登录失败次数过多，请稍后再试";
  }
  if (
    lower.includes("device password not set") ||
    raw.includes("尚未设置管理员密码")
  ) {
    return "设备尚未设置管理员密码，请在运营后台设置";
  }
  if (
    code === "AUTH-401" ||
    lower === "unauthorized" ||
    raw === "认证失败" ||
    raw === "请先登录" ||
    lower.includes("invalid credentials") ||
    raw.includes("密码错误")
  ) {
    return "密码错误，请重新输入";
  }
  if (lower.includes("network") || raw.includes("网络异常")) {
    return "网络异常，请稍后重试";
  }
  return raw || "登录失败";
}

function stripTraceSuffix(message: string): string {
  return message.replace(/\s*\[traceId:[^\]]*\]\s*$/i, "").trim();
}

export function showLoginError(error: unknown): void {
  uni.showToast({
    title: loginErrorMessage(error),
    icon: "none",
    duration: 3000,
  });
}
