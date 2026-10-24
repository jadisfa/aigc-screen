import { getDeviceSession, rememberDeviceStore } from "@/lib/device-session";
import { fetchScreenStore } from "@/lib/screen-api/me";

export type StoreInfo = {
  name: string;
  address: string;
};

const STORE_KEY = "kiosk.store";

export const UPDATING_STORE_TEXT = "正在更新中";
export const UPDATING_STORE_ADDRESS_TEXT = "正在更新门店地址，请稍后....";

/** 门店名址本地有效期，过期才重新打 /me/store。 */
export const STORE_TTL_MS = 24 * 60 * 1000;

type CachedStore = StoreInfo & {
  deviceCode: string;
  cachedAt: number;
  expiresAt: number;
};

let inflight: Promise<StoreInfo | null> | null = null;

export function peekStore(): StoreInfo | null {
  const cached = readCachedStore();
  if (!cached) {
    return null;
  }
  return { name: cached.name, address: cached.address };
}

export function peekFreshStore(): StoreInfo | null {
  const cached = readCachedStore();
  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }
  return { name: cached.name, address: cached.address };
}

export function peekStoreName(): string {
  return peekStore()?.name || "";
}

export function peekStoreAddress(): string {
  return peekStore()?.address || "";
}

export function cacheStore(info: StoreInfo, deviceCode?: string) {
  const name = info.name.trim();
  const address = info.address.trim();
  const code = (deviceCode || getDeviceSession()?.deviceCode || "").trim();
  if (!code || (!name && !address)) {
    return;
  }
  const now = Date.now();
  const cached: CachedStore = {
    name,
    address,
    deviceCode: code,
    cachedAt: now,
    expiresAt: now + STORE_TTL_MS,
  };
  uni.setStorageSync(STORE_KEY, JSON.stringify(cached));
}

export function clearStoreCache() {
  uni.removeStorageSync(STORE_KEY);
}

/** 没有缓存返回 null；旧缓存没有设备编码时返回空串。 */
export function storedStoreDeviceCode(): string | null {
  const cached = readCachedStoreRaw();
  if (!cached) {
    return null;
  }
  return cached.deviceCode;
}

export function syncStoreFromDeviceContext(view: {
  deviceCode?: string;
  storeName?: string;
  storeAddress?: string;
}) {
  const deviceCode = (view.deviceCode || getDeviceSession()?.deviceCode || "").trim();
  const name = (view.storeName || "").trim();
  const address = (view.storeAddress || "").trim();
  if (!deviceCode || (!name && !address)) {
    clearStoreCache();
    return;
  }
  cacheStore({ name, address }, deviceCode);
}

export function resolveStoreName(name?: string | null): string {
  return resolveStoreField(name, peekStoreName);
}

export function resolveStoreAddress(address?: string | null): string {
  return resolveStoreField(address, peekStoreAddress);
}

/** 先对齐当前设备，再使用该设备自己的名址；对不上就重新向服务端核对。 */
export async function ensureStore(): Promise<StoreInfo | null> {
  const { alignSessionToConfiguredDevice } = await import("@/lib/device-auth");
  await alignSessionToConfiguredDevice();
  const fresh = peekFreshStore();
  if (fresh?.name && fresh?.address) {
    return fresh;
  }
  return refreshStore();
}

/** 强制拉一次门店名址并刷新 TTL。 */
export async function refreshStore(): Promise<StoreInfo | null> {
  if (!inflight) {
    inflight = doRefreshStore().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function doRefreshStore(): Promise<StoreInfo | null> {
  const cached = peekStore();
  try {
    const store = await fetchScreenStore();
    const verified = peekStore();
    const next: StoreInfo = {
      name: (store.name || "").trim() || verified?.name || cached?.name || "",
      address: (store.address || "").trim() || verified?.address || cached?.address || "",
    };
    cacheStore(next);
    rememberDeviceStore(next);
    return peekStore();
  } catch {
    return cached;
  }
}

function readCachedStore(): CachedStore | null {
  const cached = readCachedStoreRaw();
  const sessionCode = getDeviceSession()?.deviceCode?.trim() || "";
  if (!cached?.deviceCode || !sessionCode || cached.deviceCode !== sessionCode) {
    return null;
  }
  return cached;
}

function readCachedStoreRaw(): CachedStore | null {
  try {
    const raw = uni.getStorageSync(STORE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<CachedStore>;
    const name = typeof parsed?.name === "string" ? parsed.name.trim() : "";
    const address = typeof parsed?.address === "string" ? parsed.address.trim() : "";
    if (!name && !address) {
      return null;
    }
    const deviceCode = typeof parsed.deviceCode === "string" ? parsed.deviceCode.trim() : "";
    const cachedAt = typeof parsed.cachedAt === "number" ? parsed.cachedAt : 0;
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;
    return { name, address, deviceCode, cachedAt, expiresAt };
  } catch {
    return null;
  }
}

function resolveStoreField(value: string | null | undefined, peek: () => string): string {
  const next = (value || "").trim();
  if (next) {
    return next;
  }
  return peek() || UPDATING_STORE_TEXT;
}
