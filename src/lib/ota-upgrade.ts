import { getAccessToken } from "@/lib/device-session";
import { fetchOtaCurrent, fetchOtaLatest, type ScreenOtaVersion } from "@/lib/screen-api/ota";
import { resolveLocalScreenVersionNo, writeLocalScreenRelease } from "@/lib/screen-version";

export const OTA_FORCE_CHECK_MS = 60 * 60 * 1000;
export const OTA_SCHEDULE_TICK_MS = 60 * 1000;

const SCHEDULE_KEY = "screen.ota.forceSchedule";

export type OtaUpgradeKind = "optional" | "force";

export type OtaCheckResult = {
  hasUpdate: boolean;
  kind: OtaUpgradeKind;
  current: ScreenOtaVersion | null;
  latest: ScreenOtaVersion | null;
};

export type ForceSchedule = {
  versionNo: number;
  at: number;
};

export function isForceKind(kind?: string | null): kind is "force" {
  return (kind || "").trim().toLowerCase() === "force";
}

export function formatOtaSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) {
    return "--";
  }
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
}

export function splitOtaNotes(changelog?: string) {
  if (!changelog) {
    return ["暂无更新说明"];
  }
  return changelog.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function hasOtaUpdate(latest: ScreenOtaVersion | null) {
  if (!latest || latest.versionNo == null) {
    return false;
  }
  return latest.versionNo > resolveLocalScreenVersionNo();
}

export function readForceSchedule(): ForceSchedule | null {
  try {
    const raw = uni.getStorageSync(SCHEDULE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed.versionNo !== "number" || typeof parsed.at !== "number") {
      return null;
    }
    return parsed as ForceSchedule;
  } catch {
    return null;
  }
}

export function writeForceSchedule(schedule: ForceSchedule | null) {
  if (!schedule) {
    uni.removeStorageSync(SCHEDULE_KEY);
    return;
  }
  uni.setStorageSync(SCHEDULE_KEY, JSON.stringify(schedule));
}

export function tonightAt(hour = 2) {
  const now = new Date();
  const at = new Date(now);
  at.setHours(hour, 0, 0, 0);
  if (at.getTime() <= now.getTime()) {
    at.setDate(at.getDate() + 1);
  }
  return at.getTime();
}

export function hoursLater(hours: number) {
  return Date.now() + hours * 60 * 60 * 1000;
}

export function formatScheduleTime(at: number) {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type InspectListener = () => void;
const inspectListeners = new Set<InspectListener>();

export function subscribeOtaInspect(listener: InspectListener) {
  inspectListeners.add(listener);
  return () => {
    inspectListeners.delete(listener);
  };
}

export function requestOtaInspect() {
  inspectListeners.forEach((listener) => listener());
}

export async function checkOtaUpdate(requireAdmin: boolean): Promise<OtaCheckResult> {
  if (!getAccessToken()) {
    return { hasUpdate: false, kind: "optional", current: null, latest: null };
  }
  const [current, latest] = await Promise.all([
    requireAdmin ? fetchOtaCurrent().catch(() => null) : Promise.resolve(null),
    fetchOtaLatest(requireAdmin).catch(() => null),
  ]);
  const kind: OtaUpgradeKind = isForceKind(latest?.upgradeKind) ? "force" : "optional";
  return {
    hasUpdate: hasOtaUpdate(latest),
    kind,
    current,
    latest,
  };
}

export function commitLocalScreenVersion(versionNo?: number | null, changelog?: string | null) {
  return writeLocalScreenRelease(versionNo, changelog);
}

export function openOtaPackage(url?: string) {
  if (!url) {
    uni.showToast({ title: "安装包地址不可用", icon: "none" });
    return;
  }
  // #ifdef H5
  window.open(url, "_blank");
  // #endif
  // #ifdef APP-PLUS
  plus.runtime.openURL(url);
  // #endif
}
