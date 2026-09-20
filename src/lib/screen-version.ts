/**
 * 电子屏本机版本号与已安装版本说明。
 * 与设备编码一样落盘：plus.storage 优先，其次 uni storage。
 * 出厂未写入时版本为 1，说明为 data/version.ts 的出厂文案；
 * 升级完成后写入对应 OTA 版本的 changelog。
 */

import {
  FACTORY_CHANGELOG,
  INITIAL_SCREEN_VERSION_NO,
} from "@/data/version";

export { INITIAL_SCREEN_VERSION_NO };

const VERSION_KEY = "screen.device.version";
const NATIVE_VERSION_KEY = "screen.device.version.native";
const CHANGELOG_KEY = "screen.device.version.changelog";
const NATIVE_CHANGELOG_KEY = "screen.device.version.changelog.native";

export function formatLocalScreenVersion(versionNo: number) {
  return `V${versionNo}`;
}

/** 启动时调用：没有本机版本则写入 1 及出厂说明。 */
export function ensureLocalScreenVersion(): number {
  const existing = readStoredVersionNo();
  if (existing == null) {
    writeLocalScreenRelease(INITIAL_SCREEN_VERSION_NO, FACTORY_CHANGELOG);
    return INITIAL_SCREEN_VERSION_NO;
  }
  if (!hasStoredChangelog() && existing === INITIAL_SCREEN_VERSION_NO) {
    writeLocalScreenChangelog(FACTORY_CHANGELOG);
  }
  return existing;
}

export function resolveLocalScreenVersionNo(): number {
  return readStoredVersionNo() ?? INITIAL_SCREEN_VERSION_NO;
}

export function readLocalScreenChangelog(): string {
  const stored = readStoredChangelog();
  if (stored != null) {
    return stored;
  }
  if (resolveLocalScreenVersionNo() === INITIAL_SCREEN_VERSION_NO) {
    return FACTORY_CHANGELOG;
  }
  return "";
}

export function writeLocalScreenVersionNo(versionNo?: number | null): number | null {
  if (versionNo == null || !Number.isFinite(versionNo) || versionNo < INITIAL_SCREEN_VERSION_NO) {
    return null;
  }
  const normalized = Math.floor(versionNo);
  writeNativeItem(NATIVE_VERSION_KEY, String(normalized));
  uni.setStorageSync(VERSION_KEY, normalized);
  return normalized;
}

export function writeLocalScreenChangelog(changelog?: string | null): string {
  const text = typeof changelog === "string" ? changelog : "";
  writeNativeItem(NATIVE_CHANGELOG_KEY, encodeChangelog(text));
  uni.setStorageSync(CHANGELOG_KEY, encodeChangelog(text));
  return text;
}

export function writeLocalScreenRelease(versionNo?: number | null, changelog?: string | null): number | null {
  const written = writeLocalScreenVersionNo(versionNo);
  if (written == null) {
    return null;
  }
  writeLocalScreenChangelog(changelog);
  return written;
}

function hasStoredChangelog(): boolean {
  return readStoredChangelog() != null;
}

function readStoredVersionNo(): number | null {
  const native = parseVersion(readNativeItem(NATIVE_VERSION_KEY));
  if (native != null) {
    return native;
  }
  try {
    return parseVersion(uni.getStorageSync(VERSION_KEY));
  } catch {
    return null;
  }
}

function readStoredChangelog(): string | null {
  const native = decodeChangelog(readNativeItem(NATIVE_CHANGELOG_KEY));
  if (native != null) {
    return native;
  }
  try {
    return decodeChangelog(uni.getStorageSync(CHANGELOG_KEY));
  } catch {
    return null;
  }
}

function encodeChangelog(text: string): string {
  return JSON.stringify({ text });
}

function decodeChangelog(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as { text?: unknown };
      if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
        return parsed.text;
      }
    } catch {
      return value;
    }
    return value;
  }
  if (typeof value === "object" && value && "text" in value && typeof (value as { text: unknown }).text === "string") {
    return (value as { text: string }).text;
  }
  return null;
}

function parseVersion(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || n < INITIAL_SCREEN_VERSION_NO) {
    return null;
  }
  return Math.floor(n);
}

function readNativeItem(key: string): string {
  try {
    const storage = plusStorage();
    if (!storage) {
      return "";
    }
    const raw = storage.getItem(key);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

function writeNativeItem(key: string, value: string): void {
  try {
    const storage = plusStorage();
    if (!storage) {
      return;
    }
    storage.setItem(key, value);
  } catch {
    // H5 无 plus.storage，值仍写在 uni storage
  }
}

function plusStorage():
  | { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }
  | null {
  const plusRoot = (globalThis as { plus?: { storage?: unknown } }).plus;
  const storage = plusRoot?.storage;
  if (!storage || typeof storage !== "object") {
    return null;
  }
  const typed = storage as {
    getItem?: (key: string) => string | null;
    setItem?: (key: string, value: string) => void;
  };
  if (typeof typed.getItem !== "function" || typeof typed.setItem !== "function") {
    return null;
  }
  return typed as { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void };
}
