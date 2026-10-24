import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

export type StatusBadgeTone = "success" | "warning" | "info" | "danger" | "neutral";

const toneClass: Record<StatusBadgeTone, string> = {
  success: "status-badge-success",
  warning: "status-badge-warning",
  info: "status-badge-info",
  danger: "status-badge-danger",
  neutral: "status-badge-neutral",
};

/**
 * 业务状态标签。色值真源：`index.css` → `.status-badge-*` + `--success/--warning/...`
 * 禁止页面内再写 bg-green-50 / bg-amber-500/12 等硬编码。
 */
export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusBadgeTone;
};

export function StatusBadge({ tone = "neutral", className, ...props }: StatusBadgeProps) {
  return <span className={cn("status-badge", toneClass[tone], className)} {...props} />;
}

/** 常见工单/订单状态 → tone 映射，可按需扩展，避免各页复制 */
export function statusToneFromCode(status: string | null | undefined): StatusBadgeTone {
  const value = (status || "").trim().toLowerCase();
  if (!value) return "neutral";
  if (["paid", "success", "enabled", "active", "done", "completed", "closed"].includes(value)) {
    return "success";
  }
  if (["pending", "paying", "waiting", "open", "created"].includes(value)) {
    return "warning";
  }
  if (["processing", "processing_reply", "assigned", "in_progress", "info"].includes(value)) {
    return "info";
  }
  if (["failed", "error", "rejected", "cancelled", "canceled", "disabled", "banned"].includes(value)) {
    return "danger";
  }
  if (["deleted", "inactive", "archived"].includes(value)) {
    return "neutral";
  }
  return "neutral";
}
