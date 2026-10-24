/**
 * Shared display formatters for admin console pages.
 * Prefer these over page-local helpers for numbers, money, latency, and JSON.
 */

const EMPTY = "-";

export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat("zh-CN", options).format(value ?? 0);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 2): string {
  return `${(value ?? 0).toFixed(fractionDigits)}%`;
}

/** Prefix-style money display, e.g. ¥12.30 / USD 12.30 */
export function formatCurrency(value: number | null | undefined, currency: string | null | undefined = "CNY"): string {
  if (value === null || value === undefined) {
    return EMPTY;
  }
  const code = (currency || "CNY").toUpperCase();
  const prefix = code === "CNY" ? "¥" : `${code} `;
  return `${prefix}${Number(value).toFixed(2)}`;
}

/** 资金消耗：库内为分，前端按元展示，如 ¥0.10。 */
export function formatFen(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return EMPTY;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return EMPTY;
  }
  return formatCurrency(n / 100);
}

/** Amount + currency suffix, e.g. 1,234.56 CNY */
export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  const value = formatNumber(amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return currency ? `${value} ${currency}` : value;
}

/** 将资金结算金额（CNY 元）转为分，供预览与工作流金额相加。 */
export function yuanAmountToFen(amount: unknown): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/** Plain price text without currency symbol (integration catalog). */
export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return EMPTY;
  }
  if (typeof value === "number") {
    return String(value);
  }
  const trimmed = value.trim();
  return trimmed || EMPTY;
}

/** Human elapsed duration, e.g. 2天 3小时 / 15分钟 / 8秒. */
export function formatElapsedDuration(durationMs: number | null | undefined): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) {
    return EMPTY;
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${Math.max(0, totalSeconds)}秒`;
  }
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) {
    return hours > 0 ? `${days}天 ${hours}小时` : `${days}天`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}小时 ${minutes}分钟` : `${hours}小时`;
  }
  return `${minutes}分钟`;
}

export function formatLatencyMs(durationMs: number | null | undefined): string {
  if (durationMs === null || durationMs === undefined || !Number.isFinite(durationMs) || durationMs < 0) {
    return EMPTY;
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function formatLatency(
  startedAt: string | number | Date | null | undefined,
  finishedAt: string | number | Date | null | undefined,
): string {
  if (startedAt == null || finishedAt == null || startedAt === "" || finishedAt === "") {
    return EMPTY;
  }
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return EMPTY;
  }
  return formatLatencyMs(end - start);
}

export function formatJson(raw: string | null | undefined): string {
  if (!raw) {
    return EMPTY;
  }
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Avatar / logo fallback text: Chinese first 2 chars, otherwise uppercase 2 chars. */
export function getDisplayFallback(value: string | null | undefined, emptyFallback = "MH"): string {
  const normalized = (value || "").trim();
  if (!normalized) {
    return emptyFallback;
  }
  if (/[\u4e00-\u9fa5]/.test(normalized)) {
    return normalized.slice(0, 2);
  }
  return normalized.slice(0, 2).toUpperCase();
}
