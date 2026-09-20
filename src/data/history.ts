import type { ScreenGeneration } from "@/lib/screen-api/generations";

export type HistoryKind = "outfit" | "text";

export type HistoryItem = {
  id: string;
  createdAt: string;
  count: number;
  kind: HistoryKind;
  tags: string[];
  thumb: string;
  outfit: string;
  looks: string[];
  points: number;
};

let historyCache: HistoryItem[] = [];

export function cacheHistory(items: HistoryItem[]) {
  historyCache = items;
}

export function findHistory(id: string) {
  return historyCache.find((row) => row.id === id) ?? emptyHistory(id);
}

export function emptyHistory(id = ""): HistoryItem {
  return {
    id,
    createdAt: "",
    count: 0,
    kind: "outfit",
    tags: [],
    thumb: "",
    outfit: "",
    looks: [],
    points: 0,
  };
}

export function toHistoryItem(row: ScreenGeneration): HistoryItem {
  const kind: HistoryKind = row.scene === "keyword" ? "text" : "outfit";
  const result = row.resultImageUrl || "";
  const tags = [
    kind === "text" ? "文生美甲" : "美甲穿搭",
    "AI试戴",
    row.stockKind === "custom_no_stock" ? "定制款" : row.stockKind ? "推荐款" : "",
  ].filter((tag): tag is string => Boolean(tag));
  const points = Number(row.computeAmount ?? 0);
  return {
    id: row.id,
    createdAt: formatHistoryTime(row.generatedAt),
    count: 1,
    kind,
    tags,
    thumb: result || row.product?.coverImageUrl || "",
    outfit: row.outfitImageUrl || "",
    looks: result ? [result] : [],
    points: Number.isFinite(points) ? points : 0,
  };
}

function formatHistoryTime(value?: string) {
  if (!value) {
    return "";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
