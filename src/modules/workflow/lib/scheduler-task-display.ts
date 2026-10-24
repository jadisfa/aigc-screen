import type { Asset, Task } from "@/shared/api/sys/scheduler";
import {
  firstItemUrl,
  parseWorkItems,
  workImageUrls,
  type WorkGeneratedItem,
} from "@/modules/materials/lib/work-material-items";

export type SchedulerTaskWorkType = "image" | "video" | "copywriting" | "unknown";

export function taskOutputItems(task: Task): WorkGeneratedItem[] {
  const fromWork = parseWorkItems(task.itemsJson);
  if (fromWork.length > 0) return fromWork;
  return (task.assets || [])
    .map(assetToItem)
    .filter((item): item is WorkGeneratedItem => !!item);
}

function assetToItem(asset: Asset): WorkGeneratedItem | null {
  if (!asset) return null;
  const kind = (asset.kind || "").trim().toLowerCase();
  const text = typeof asset.textContent === "string" ? asset.textContent.trim() : "";
  if (!kind && !text) return null;
  if (kind === "image" || kind === "video") {
    return text ? { kind, url: text } : { kind };
  }
  return { kind: kind || "copywriting", text };
}

export function inferTaskWorkType(task: Task, items: WorkGeneratedItem[]): SchedulerTaskWorkType {
  const explicit = (task.workType || "").trim().toLowerCase();
  if (explicit === "image" || explicit === "video" || explicit === "copywriting") return explicit;
  if (items.some((item) => (item.kind || "").toLowerCase() === "video")) return "video";
  if (items.some((item) => (item.kind || "").toLowerCase() === "image" && !!item.url)) return "image";
  if (items.some((item) => {
    const kind = (item.kind || "").toLowerCase();
    return kind === "copywriting" || kind === "text" || !!item.text;
  })) {
    return "copywriting";
  }
  return "unknown";
}

export function taskImageUrls(items: WorkGeneratedItem[]): string[] {
  return workImageUrls(items);
}

export function taskVideoUrl(items: WorkGeneratedItem[]): string {
  return firstItemUrl(items, "video");
}

export function taskCopyText(items: WorkGeneratedItem[]): string {
  const first = items.find((item) => {
    const text = typeof item.text === "string" ? item.text.trim() : "";
    const url = typeof item.url === "string" ? item.url.trim() : "";
    return !!text || !!url;
  });
  if (!first) return "";
  return (typeof first.text === "string" && first.text.trim()) || (typeof first.url === "string" && first.url.trim()) || "";
}

export function taskCreatedAt(task: Task): string {
  return task.submittedAt || task.createdAt || "";
}

export function taskGenerateDurationMs(task: Task): number | null {
  if (typeof task.generateDurationMs === "number") return task.generateDurationMs;
  if (typeof task.generateTimeSec === "number") return task.generateTimeSec * 1000;
  return null;
}

export function taskFundAmount(task: Task): number | null {
  if (task.consumptionAmount != null && task.consumptionAmount !== "") {
    const parsed = Number(task.consumptionAmount);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof task.computeUnits === "number") return task.computeUnits;
  return null;
}
