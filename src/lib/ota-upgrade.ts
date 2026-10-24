import { getAccessToken } from "@/lib/device-session";
import { fetchOtaCurrent, fetchOtaLatest, type ScreenOtaVersion } from "@/lib/screen-api/ota";
import { resolveLocalScreenVersionNo, writeLocalScreenRelease } from "@/lib/screen-version";

export const OTA_FORCE_CHECK_MS = 2 * 60 * 60 * 1000;
export const OTA_SCHEDULE_TICK_MS = 60 * 1000;

const SCHEDULE_KEY = "screen.ota.forceSchedule";
const EMPTY_CHECK: OtaCheckResult = {
  hasUpdate: false,
  kind: "optional",
  current: null,
  latest: null,
};

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

function toVersionNo(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.floor(n);
}

/** 当前版本是本机已安装的 versionNo；服务端 latest.versionNo 更大才需要升级。 */
export function hasOtaUpdate(latest: ScreenOtaVersion | null) {
  const remote = toVersionNo(latest?.versionNo);
  if (remote == null) {
    return false;
  }
  return remote > resolveLocalScreenVersionNo();
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
  } else {
    uni.setStorageSync(SCHEDULE_KEY, JSON.stringify(schedule));
  }
  notifyForce();
}

/** 该版本已预约、且安装时间还没到。 */
export function isForceScheduleWaiting(versionNo: number) {
  const schedule = readForceSchedule();
  return Boolean(schedule && schedule.versionNo === versionNo && Date.now() < schedule.at);
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
type ResultListener = (result: OtaCheckResult) => void;
type ForceListener = (pending: boolean) => void;

const inspectListeners = new Set<InspectListener>();
const resultListeners = new Set<ResultListener>();
const forceListeners = new Set<ForceListener>();
let inspectWaiting = false;

let cache: { at: number; result: OtaCheckResult } | null = null;
let inflight: Promise<OtaCheckResult> | null = null;

export function subscribeOtaInspect(listener: InspectListener) {
  inspectListeners.add(listener);
  if (inspectWaiting) {
    inspectWaiting = false;
    listener();
  }
  return () => {
    inspectListeners.delete(listener);
  };
}

export function requestOtaInspect() {
  if (inspectListeners.size === 0) {
    inspectWaiting = true;
    return;
  }
  inspectListeners.forEach((listener) => listener());
}

export function subscribeOtaResult(listener: ResultListener) {
  resultListeners.add(listener);
  if (cache?.result) {
    listener(cache.result);
  }
  return () => {
    resultListeners.delete(listener);
  };
}

/** 未过期的检查结果。首页角标复用，避免每次进入都打接口。 */
export function peekOtaCheck(): OtaCheckResult | null {
  if (!cache || Date.now() - cache.at >= OTA_FORCE_CHECK_MS) {
    return null;
  }
  return cache.result;
}

/** 含已过期的最近一次结果，供到点安装，不再为此请求接口。 */
export function peekOtaSnapshot(): OtaCheckResult | null {
  return cache?.result ?? null;
}

export function isForceUpgradePending() {
  const result = cache?.result;
  return Boolean(result?.hasUpdate && result.kind === "force" && result.latest);
}

/** 强制升级窗正占着首页。已预约、未到安装时间时不挡全屏广告。 */
export function isForceUpgradeBlocking() {
  if (!isForceUpgradePending()) {
    return false;
  }
  const versionNo = cache?.result.latest?.versionNo ?? 0;
  return !isForceScheduleWaiting(versionNo);
}

export function subscribeForceUpgrade(listener: ForceListener) {
  forceListeners.add(listener);
  listener(isForceUpgradeBlocking());
  return () => {
    forceListeners.delete(listener);
  };
}

function notifyForce() {
  const blocking = isForceUpgradeBlocking();
  forceListeners.forEach((listener) => listener(blocking));
}

function publish(result: OtaCheckResult) {
  cache = { at: Date.now(), result };
  resultListeners.forEach((listener) => listener(result));
  notifyForce();
}

async function queryOta(requireAdmin: boolean): Promise<OtaCheckResult | null> {
  const localVersionNo = resolveLocalScreenVersionNo();
  console.log("[ota] 本地版本", localVersionNo);
  try {
    const latest = await fetchOtaLatest(requireAdmin);
    console.log(
      "[ota] 服务端最新版本",
      toVersionNo(latest?.versionNo),
      "本地版本",
      localVersionNo,
      "升级策略",
      latest?.upgradeKind || "optional",
    );
    const current = requireAdmin ? await fetchOtaCurrent().catch(() => null) : null;
    const kind: OtaUpgradeKind = isForceKind(latest?.upgradeKind) ? "force" : "optional";
    return {
      hasUpdate: hasOtaUpdate(latest),
      kind,
      current,
      latest,
    };
  } catch {
    return null;
  }
}

/**
 * 进入首页后的版本检查。2 小时内复用缓存。
 * `refresh` 仅用于版本页主动查看。
 */
export async function checkOtaUpdate(requireAdmin = false, refresh = false): Promise<OtaCheckResult> {
  if (!refresh) {
    const fresh = peekOtaCheck();
    if (fresh) {
      return fresh;
    }
  }
  if (!getAccessToken()) {
    return peekOtaSnapshot() ?? { ...EMPTY_CHECK };
  }
  if (inflight) {
    return inflight;
  }
  inflight = queryOta(requireAdmin)
    .then((loaded) => {
      if (!loaded) {
        return peekOtaSnapshot() ?? { ...EMPTY_CHECK };
      }
      publish(loaded);
      return loaded;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function commitLocalScreenVersion(versionNo?: number | null, changelog?: string | null) {
  const written = writeLocalScreenRelease(versionNo, changelog);
  if (!cache?.result) {
    return written;
  }
  const latest = cache.result.latest;
  const hasUpdate = hasOtaUpdate(latest);
  publish({
    ...cache.result,
    hasUpdate,
    kind: hasUpdate ? cache.result.kind : "optional",
  });
  return written;
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
