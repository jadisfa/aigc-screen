import type { BadgeProps } from "@/shared/ui/badge";

export type MaterialCategoryType = "system" | "user";
export type MaterialCategoryFilter = "all" | MaterialCategoryType;
export type MaterialAuditStatus = "pending" | "approved" | "rejected";
export type MaterialAuditFilter = "all" | MaterialAuditStatus;
export type MaterialPublishStatus = "online" | "offline";
export type MaterialPublishFilter = "all" | MaterialPublishStatus;

export function materialCategoryLabel(categoryType?: string | null, label?: string | null) {
  if (label) return label;
  if (categoryType === "system") return "公共";
  if (categoryType === "user") return "私有";
  return categoryType || "-";
}

export function materialAuditLabel(status?: string | null, label?: string | null) {
  if (label) return label;
  if (status === "pending") return "待审核";
  if (status === "approved") return "已通过";
  if (status === "rejected") return "已拒绝";
  return status || "-";
}

export function materialPublishLabel(status?: string | null, label?: string | null) {
  if (label) return label;
  if (status === "online") return "上架";
  if (status === "offline") return "下架";
  return status || "-";
}

export function materialAuditBadgeVariant(status?: string | null): BadgeProps["variant"] {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  if (status === "pending") return "secondary";
  return "outline";
}

export function materialPublishBadgeVariant(status?: string | null): BadgeProps["variant"] {
  if (status === "online") return "default";
  if (status === "offline") return "secondary";
  return "outline";
}

export function materialSourceLabel(sourceType?: string | null): string {
  if (sourceType === "workflow") return "工作流";
  if (sourceType === "agent") return "Agent";
  if (sourceType === "canvas") return "画布";
  return sourceType || "-";
}
