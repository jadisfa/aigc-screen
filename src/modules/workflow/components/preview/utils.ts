import { formatDateTime } from "@/shared/lib/datetime";
import { type Dispatch as SchedulerDispatch, type DispatchTimelineItem } from "@/shared/api/sys/scheduler";

export function isTerminalStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "succeeded" || s === "failed" || s === "canceled";
}

/** 任务仍在执行链路中（含 claimed / 本地 submitting 等），应展示生成占位而非空白。 */
export function isInFlightStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  if (!s || isTerminalStatus(s)) return false;
  return [
    "queued",
    "claimed",
    "running",
    "submitted",
    "pending",
    "submitting",
    "requeued",
  ].includes(s);
}

/** 飞行中状态的用户可见文案，避免直接展示 claimed 等内部态。 */
export function formatInFlightStatusLabel(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  if (s === "queued") return "排队中";
  if (s === "submitting") return "提交中";
  if (s === "claimed" || s === "running" || s === "submitted" || s === "pending" || s === "requeued") {
    return "生成中";
  }
  return status || "";
}

export function shouldShowLiveProgressOverlay(args: {
  isRunning: boolean;
  isCurrent: boolean;
  hasDetail: boolean;
}): boolean {
  return args.isRunning && args.isCurrent && args.hasDetail;
}

export function hasPendingReviewAssets(assets: SchedulerDispatch["assets"] | null | undefined): boolean {
  const items = Array.isArray(assets) ? assets : [];
  for (const a of items) {
    const v = String(a?.reviewStatus || "").toLowerCase();
    if (v === "pending") return true;
  }
  return false;
}

export function shouldStopAutoRefresh(detail: SchedulerDispatch | null): boolean {
  if (!detail) return false;
  if (!isTerminalStatus(detail.status)) return false;
  return !hasPendingReviewAssets(detail.assets);
}

export function getStatusBadgeVariant(status: string | null | undefined): "default" | "secondary" | "outline" | "destructive" {
  const s = (status || "").toLowerCase();
  if (s === "succeeded") return "default";
  if (s === "failed") return "destructive";
  if (s === "canceled") return "outline";
  return "secondary";
}

export function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function toCompactJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const WORKFLOW_PREVIEW_DEBUG_LOG_KEY = "workflow.preview.debugLogs";

export function shouldEnableDebugLogs(showDebug: boolean): boolean {
  if (showDebug) return true;
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WORKFLOW_PREVIEW_DEBUG_LOG_KEY) === "1";
}

export function debugLog(enabled: boolean, stage: string, payload?: Record<string, unknown>): void {
  if (!enabled) return;
  const ts = new Date().toISOString();
  if (payload) {
    console.debug(`[WorkflowPreview][${ts}] ${stage}`, payload);
    return;
  }
  console.debug(`[WorkflowPreview][${ts}] ${stage}`);
}

export function extractTextFromUnknown(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() ? value : null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = extractTextFromUnknown(v);
      if (s) return s;
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferredKeys = ["content", "text", "answer", "result", "message", "output", "data"];
    for (const k of preferredKeys) {
      if (k in obj) {
        const s = extractTextFromUnknown(obj[k]);
        if (s) return s;
      }
    }
    for (const k of Object.keys(obj)) {
      const s = extractTextFromUnknown(obj[k]);
      if (s) return s;
    }
  }
  return null;
}

export function normalizeDisplayText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (text === "{}") return null;
  return text;
}

export function isProbablyVideoUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (u.startsWith("blob:")) return true;
  if (!/^https?:\/\//.test(u)) return false;
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/.test(u) || u.includes("/videos/") || u.includes("video");
}

export function isProbablyImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!/^https?:\/\//.test(u)) return false;
  return /\.(png|jpg|jpeg|webp|gif|bmp|svg)(\?.*)?$/.test(u) || u.includes("/image") || u.includes("image") || u.includes("view?filename=");
}

export function generateId32(): string {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function taskTime(item: DispatchTimelineItem): string | null {
  return item.finishedAt || item.startedAt || item.submittedAt || null;
}

export { formatDateTime };

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  if (ms < 1000) return `0s`; // changed from Math.round(ms)ms to 0s to look cleaner for end users
  const s = ms / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  if (m < 60) return `${m}m${rs ? `${rs}s` : ""}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm ? `${rm}m` : ""}`;
}

export function getExpectedImageCount(item: DispatchTimelineItem): number {
  let expectedImageCount = 4;
  try {
    if (item.inputJson) {
      const inputObj = JSON.parse(item.inputJson);
      const hintedCount = Number(inputObj?.expectedImageCount);
      if (hintedCount > 0 && hintedCount <= 20) {
        expectedImageCount = hintedCount;
      } else if (inputObj && inputObj.params) {
        const batchSize = Number(inputObj.params.batch_size) || Number(inputObj.params.count);
        if (batchSize > 0 && batchSize <= 20) {
          expectedImageCount = batchSize;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return expectedImageCount;
}
