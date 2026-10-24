/** 站内信 / 顶栏消息 eventType 中文展示。
 * 与后端 {@code MessageDictionaryCatalog.INBOX_EVENT_TYPE_OPTIONS} 对齐，新增类型需两边同步。
 */
export const INBOX_EVENT_TYPE_LABELS: Record<string, string> = {
  created: "新建工单",
  replied: "工单回复",
  closed: "工单关闭",
  assign: "分配工单",
  reassign: "重新分配",
  unassign: "取消分配",
  broadcast: "运营群发",
  fund_lot_expire_warn: "余额即将过期",
  fund_lot_expired: "余额过期通知",
};

export function inboxEventTypeLabel(value?: string | null, fallback = "-") {
  if (!value) return fallback;
  return INBOX_EVENT_TYPE_LABELS[value] || value;
}
