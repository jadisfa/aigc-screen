import { apiFetch } from "@/shared/api/sys/http";
import type { PageResult } from "@/shared/api/ops/ops-ticket";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import type { QueryClient } from "@tanstack/react-query";

export type TicketInboxMessage = {
  id: string;
  subject: string;
  content: string;
  read: boolean;
  createdAt: string;
  eventType?: string | null;
  senderName?: string | null;
  bizType?: string | null;
  bizId?: string | null;
  bizUrl?: string | null;
};

export type TicketInboxPaged = {
  page: PageResult;
  items: TicketInboxMessage[];
};

export type ListTicketInboxMessagesParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  type?: string;
  keyword?: string;
  read?: boolean;
};

/** 顶栏 Popover 与收件箱页共享的 React Query key，保证已读/未读联动。 */
export const OPS_INBOX_QUERY_ROOT = ["ops", "inbox"] as const;

export const opsInboxQueryKeys = {
  all: OPS_INBOX_QUERY_ROOT,
  unread: (scopeKey: string) => [...OPS_INBOX_QUERY_ROOT, "unread", scopeKey] as const,
  types: (scopeKey: string) => [...OPS_INBOX_QUERY_ROOT, "types", scopeKey] as const,
  messages: (scopeKey: string, params: Record<string, unknown>) =>
    [...OPS_INBOX_QUERY_ROOT, "messages", scopeKey, params] as const,
  recent: (scopeKey: string) => [...OPS_INBOX_QUERY_ROOT, "recent", scopeKey] as const,
  detail: (scopeKey: string, messageId: string) => [...OPS_INBOX_QUERY_ROOT, "detail", scopeKey, messageId] as const,
};

export async function invalidateOpsInboxQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: OPS_INBOX_QUERY_ROOT });
}

export async function listTicketInboxMessages(params: ListTicketInboxMessagesParams): Promise<TicketInboxPaged> {
  const qs = buildPageSearchParams(params);
  if (params.type) qs.set("type", params.type);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.read !== undefined) qs.set("read", params.read ? "true" : "false");

  return apiFetch<TicketInboxPaged>(`/api/admin/ops/tickets/inbox/messages?${qs.toString()}`, { method: "GET" });
}

export async function getTicketInboxMessage(messageId: string): Promise<TicketInboxMessage> {
  return apiFetch<TicketInboxMessage>(`/api/admin/ops/tickets/inbox/messages/${encodeURIComponent(messageId)}`, { method: "GET" });
}

export async function listTicketInboxMessageTypes(): Promise<string[]> {
  return apiFetch<string[]>("/api/admin/ops/tickets/inbox/types", { method: "GET" });
}

export async function getTicketInboxUnreadCount(): Promise<number> {
  return apiFetch<number>("/api/admin/ops/tickets/inbox/unread-count", { method: "GET" });
}

export async function markTicketInboxMessageRead(messageId: string): Promise<boolean> {
  await apiFetch<boolean>(`/api/admin/ops/tickets/inbox/messages/${encodeURIComponent(messageId)}/read`, { method: "POST" });
  return true;
}

export async function markAllTicketInboxMessagesRead(): Promise<boolean> {
  await apiFetch<boolean>("/api/admin/ops/tickets/inbox/messages/read-all", { method: "POST" });
  return true;
}

export async function deleteTicketInboxMessage(messageId: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/tickets/inbox/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
}
