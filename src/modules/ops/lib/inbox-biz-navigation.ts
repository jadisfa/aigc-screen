import type { NavigateFunction } from "react-router-dom";
import type { TicketInboxMessage } from "@/shared/api/ops/ops-ticket-inbox";

export type InboxBizMessage = Pick<TicketInboxMessage, "bizType" | "bizId" | "bizUrl" | "eventType">;

export type InboxBizTarget =
  | { mode: "internal"; path: string; label: string }
  | { mode: "external"; url: string; label: string }
  | { mode: "none"; label: string };

const TICKET_EVENT_LABELS: Record<string, string> = {
  created: "处理工单",
  replied: "查看回复",
  closed: "查看工单",
  assign: "处理指派",
  reassign: "处理改派",
  unassign: "查看工单",
};

function normalize(value?: string | null) {
  return (value ?? "").trim();
}

function isRelativeAppPath(url: string) {
  return url.startsWith("/") && !url.startsWith("//");
}

function isAbsoluteHttpUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function ticketActionLabel(eventType: string) {
  return TICKET_EVENT_LABELS[eventType] || "前往工单";
}

function bizTypeActionLabel(bizType: string, eventType: string) {
  if (bizType === "ticket") return ticketActionLabel(eventType);
  if (bizType) return "前往业务";
  return "前往处理";
}

/**
 * 按业务类型解析站内信跳转目标，便于顶栏与收件箱统一处理。
 * 优先级：相对 bizUrl → 绝对 bizUrl → bizType+bizId 映射。
 */
export function resolveInboxBizTarget(message: InboxBizMessage | null | undefined): InboxBizTarget {
  if (!message) return { mode: "none", label: "前往处理" };

  const bizUrl = normalize(message.bizUrl);
  const bizType = normalize(message.bizType).toLowerCase();
  const bizId = normalize(message.bizId);
  const eventType = normalize(message.eventType).toLowerCase();
  const label = bizTypeActionLabel(bizType, eventType);

  if (bizUrl) {
    if (isRelativeAppPath(bizUrl)) {
      return { mode: "internal", path: bizUrl, label };
    }
    if (isAbsoluteHttpUrl(bizUrl)) {
      return { mode: "external", url: bizUrl, label };
    }
  }

  if (bizType === "ticket" && bizId) {
    return {
      mode: "internal",
      path: `/ops/tickets/${encodeURIComponent(bizId)}/replies`,
      label: ticketActionLabel(eventType),
    };
  }

  // 兼容仅有 ticketId、未写 bizType 的历史数据
  if (!bizType && bizId && (eventType in TICKET_EVENT_LABELS || !eventType)) {
    return {
      mode: "internal",
      path: `/ops/tickets/${encodeURIComponent(bizId)}/replies`,
      label: ticketActionLabel(eventType),
    };
  }

  return { mode: "none", label };
}

export function canNavigateInboxBiz(target: InboxBizTarget) {
  return target.mode === "internal" || target.mode === "external";
}

export function navigateInboxBiz(navigate: NavigateFunction, target: InboxBizTarget) {
  if (target.mode === "internal") {
    navigate(target.path);
    return true;
  }
  if (target.mode === "external") {
    window.open(target.url, "_blank", "noreferrer");
    return true;
  }
  return false;
}
