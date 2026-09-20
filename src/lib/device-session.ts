export type DeviceTokenView = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType?: string;
  sessionId?: string;
  source?: string;
  contextVersion?: number;
  deviceId?: string;
  deviceCode?: string;
  storeId?: string;
  merchantId?: string;
};

export type DeviceContextView = {
  tenantId?: string;
  principalId?: string;
  devicePrincipalId?: string;
  merchantId?: string;
  storeId?: string;
  source?: string;
  contextVersion?: number;
  deviceId?: string;
  deviceCode?: string;
  deviceName?: string;
  deviceType?: string;
  boundStoreId?: string;
  authorities?: string[];
  roles?: string[];
  permissions?: string[];
};

/** 设备编码来源。native / provisioned 才落盘；query / file 不当成本机身份。 */
export type DeviceCodeSource = "native" | "provisioned" | "query" | "file";

export type DeviceIdentity = {
  deviceCode: string;
  source: DeviceCodeSource;
};

const LEGACY_CODE_KEY = "screen.device.code";
const IDENTITY_KEY = "screen.device.identity";
const NATIVE_CODE_KEY = "screen.device.identity.native";
const SESSION_KEY = "screen.device.session";
const CONTEXT_KEY = "screen.device.context";
const KIND_KEY = "screen.device.sessionKind";

/** 运行时读取，不进 JS 编译产物；部署/本机可改此文件换机。 */
const DEVICE_FILE_URL = "/static/device.json";

/** 设备编码验证通过后的本地有效期，过期才重新打 device-context。 */
export const DEVICE_CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CachedDeviceContext = {
  view: DeviceContextView;
  verifiedAt: number;
  expiresAt: number;
};

export type SessionKind = "admin" | "kiosk";

/** 启动参数只活在本次进程，避免 URL 改写已绑定设备。 */
let launchDeviceCode = "";
/** `/static/device.json` 读到的编码，仅内存。 */
let fileDeviceCode = "";
let fileLoad: Promise<void> | null = null;

export function resolveDeviceCode(): string {
  return resolveDeviceIdentity()?.deviceCode || "";
}

export function resolveDeviceIdentity(): DeviceIdentity | null {
  const native = readNativeDeviceCode();
  if (native) {
    return { deviceCode: native, source: "native" };
  }
  const bound = readBoundIdentity();
  if (bound) {
    return bound;
  }
  if (launchDeviceCode) {
    return { deviceCode: launchDeviceCode, source: "query" };
  }
  if (fileDeviceCode) {
    return { deviceCode: fileDeviceCode, source: "file" };
  }
  return null;
}

/** 启动时拉取固定配置文件；缺文件或无编码视为未配置。 */
export function loadDeviceCodeFromFile(): Promise<void> {
  if (!fileLoad) {
    fileLoad = readDeviceFile();
  }
  return fileLoad;
}

export function captureDeviceCodeFromLaunch(query?: Record<string, string | undefined>): void {
  const fromLaunch = readLaunchDeviceCode(query);
  if (!fromLaunch) {
    return;
  }
  launchDeviceCode = fromLaunch;
}

/**
 * 开通 / MDM / 原生安装器写入。已绑定后 URL 不能覆盖。
 */
export function provisionDeviceCode(deviceCode: string, source: "native" | "provisioned" = "native"): void {
  const value = deviceCode.trim();
  if (!value) {
    return;
  }
  if (source === "native") {
    writeNativeDeviceCode(value);
  }
  writeBoundIdentity({ deviceCode: value, source });
}

/** 登录成功后以服务端回写为准，升格为本机身份。 */
export function bindDeviceCodeFromServer(deviceCode: string): void {
  const value = deviceCode.trim();
  if (!value) {
    return;
  }
  if (readNativeDeviceCode()) {
    return;
  }
  writeBoundIdentity({ deviceCode: value, source: "provisioned" });
}

/** 换机 / 恢复出厂才清身份；登出只清 token。 */
export function clearDeviceIdentity(): void {
  launchDeviceCode = "";
  uni.removeStorageSync(IDENTITY_KEY);
  uni.removeStorageSync(LEGACY_CODE_KEY);
  writeNativeDeviceCode("");
  clearDeviceContext();
}

export function saveDeviceSession(view: DeviceTokenView, kind: SessionKind = "admin"): void {
  uni.setStorageSync(SESSION_KEY, view);
  uni.setStorageSync(KIND_KEY, kind);
  if (view.deviceCode) {
    bindDeviceCodeFromServer(view.deviceCode);
  }
}

export function getDeviceSession(): DeviceTokenView | null {
  const session = readObject<DeviceTokenView>(uni.getStorageSync(SESSION_KEY));
  if (!session?.accessToken) {
    return null;
  }
  return session;
}

export function getAccessToken(): string {
  return getDeviceSession()?.accessToken || "";
}

export function getRefreshToken(): string {
  return getDeviceSession()?.refreshToken || "";
}

export function hasDeviceSession(): boolean {
  return Boolean(getAccessToken());
}

/** accessToken 是否仍可交给网关。过期窗口按秒/毫秒 Unix 兼容。 */
export function isAccessTokenFresh(skewMs = 30_000): boolean {
  if (!getAccessToken()) {
    return false;
  }
  const expiresAtMs = accessTokenExpiresAtMs();
  if (expiresAtMs == null) {
    return true;
  }
  return expiresAtMs - skewMs > Date.now();
}

function accessTokenExpiresAtMs(): number | null {
  const raw = getDeviceSession()?.expiresAt;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  return raw < 1_000_000_000_000 ? raw * 1000 : raw;
}

export function getSessionKind(): SessionKind | null {
  const stored = readString(uni.getStorageSync(KIND_KEY));
  if (stored === "admin" || stored === "kiosk") {
    return stored;
  }
  return getAccessToken() ? "admin" : null;
}

export function hasAdminSession(): boolean {
  return hasDeviceSession() && getSessionKind() === "admin";
}

export function clearDeviceSession(): void {
  uni.removeStorageSync(SESSION_KEY);
  uni.removeStorageSync(KIND_KEY);
}

export function clearDeviceContext(): void {
  uni.removeStorageSync(CONTEXT_KEY);
}

export function saveDeviceContext(view: DeviceContextView): void {
  const now = Date.now();
  const cached: CachedDeviceContext = {
    view,
    verifiedAt: now,
    expiresAt: now + DEVICE_CONTEXT_TTL_MS,
  };
  uni.setStorageSync(CONTEXT_KEY, cached);
}

export function getDeviceContext(): DeviceContextView | null {
  return readCachedContext()?.view || readLegacyContext();
}

/** 一周内已验证过的设备上下文，未过期则不必再请求 device-context。 */
export function getFreshDeviceContext(): DeviceContextView | null {
  const cached = readCachedContext();
  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }
  return cached.view;
}

function readCachedContext(): CachedDeviceContext | null {
  const stored = readObject<CachedDeviceContext>(uni.getStorageSync(CONTEXT_KEY));
  if (stored?.view && typeof stored.expiresAt === "number" && typeof stored.verifiedAt === "number") {
    return stored;
  }
  const legacy = readLegacyContext();
  if (!legacy) {
    return null;
  }
  saveDeviceContext(legacy);
  return readObject<CachedDeviceContext>(uni.getStorageSync(CONTEXT_KEY));
}

function readLegacyContext(): DeviceContextView | null {
  const stored = readObject<DeviceContextView>(uni.getStorageSync(CONTEXT_KEY));
  if (!stored || typeof (stored as CachedDeviceContext).expiresAt === "number") {
    return null;
  }
  if (stored.deviceId || stored.deviceCode || stored.storeId) {
    return stored;
  }
  return null;
}

function readBoundIdentity(): DeviceIdentity | null {
  const stored = readObject<DeviceIdentity>(uni.getStorageSync(IDENTITY_KEY));
  const code = stored?.deviceCode?.trim();
  if (code && (stored?.source === "native" || stored?.source === "provisioned")) {
    return { deviceCode: code, source: stored.source };
  }
  const legacy = readString(uni.getStorageSync(LEGACY_CODE_KEY));
  if (!legacy) {
    return null;
  }
  const migrated: DeviceIdentity = { deviceCode: legacy, source: "provisioned" };
  writeBoundIdentity(migrated);
  uni.removeStorageSync(LEGACY_CODE_KEY);
  return migrated;
}

function writeBoundIdentity(identity: DeviceIdentity): void {
  uni.setStorageSync(IDENTITY_KEY, identity);
}

function readNativeDeviceCode(): string {
  try {
    const storage = plusStorage();
    if (!storage) {
      return "";
    }
    return readString(storage.getItem(NATIVE_CODE_KEY));
  } catch {
    return "";
  }
}

function writeNativeDeviceCode(value: string): void {
  try {
    const storage = plusStorage();
    if (!storage) {
      return;
    }
    if (!value) {
      storage.removeItem?.(NATIVE_CODE_KEY);
      return;
    }
    storage.setItem(NATIVE_CODE_KEY, value);
  } catch {
    // H5 无 plus.storage；身份仍写在 IDENTITY_KEY
  }
}

function plusStorage():
  | { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem?: (key: string) => void }
  | null {
  const plusRoot = (globalThis as { plus?: { storage?: unknown } }).plus;
  const storage = plusRoot?.storage;
  if (!storage || typeof storage !== "object") {
    return null;
  }
  const typed = storage as {
    getItem?: (key: string) => string | null;
    setItem?: (key: string, value: string) => void;
    removeItem?: (key: string) => void;
  };
  if (typeof typed.getItem !== "function" || typeof typed.setItem !== "function") {
    return null;
  }
  return typed as {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem?: (key: string) => void;
  };
}

function readDeviceFile(): Promise<void> {
  return new Promise((resolve) => {
    uni.request({
      url: DEVICE_FILE_URL,
      method: "GET",
      success: (res) => {
        const body = readObject<{ deviceCode?: string }>(res.data);
        fileDeviceCode = readString(body?.deviceCode);
        resolve();
      },
      fail: () => {
        fileDeviceCode = "";
        resolve();
      },
    });
  });
}

function readLaunchDeviceCode(query?: Record<string, string | undefined>): string {
  const fromQuery = (query?.deviceCode || "").trim();
  if (fromQuery) {
    return fromQuery;
  }
  if (typeof window === "undefined") {
    return "";
  }
  const search = new URLSearchParams(window.location.search).get("deviceCode");
  const hash = window.location.hash;
  const hashQuery = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const fromHash = new URLSearchParams(hashQuery).get("deviceCode");
  return (search || fromHash || "").trim();
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readObject<T extends object>(value: unknown): T | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as T) : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return null;
}
