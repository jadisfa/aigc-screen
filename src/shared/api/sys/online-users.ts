import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import { isHiddenAppSource } from "@/shared/lib/dicts";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type OnlineUser = {
  sessionId: string;
  principalId?: string | null;
  nickname?: string | null;
  avatarUrl?: string | null;
  merchantId?: string | null;
  merchantName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  source: string;
  sourceLabel: string;
  loginAt?: string | null;
  loginDurationSeconds: number;
};

export type OnlineUserSourceOption = {
  value: string;
  label: string;
};

export type ListOnlineUsersParams = {
  source?: string;
  keyword?: string;
  pageNo: number;
  pageSize: number;
  total?: number;
};

export const ONLINE_USER_SOURCE_OPTIONS: OnlineUserSourceOption[] = [
  { value: "ai_admin", label: "AI中台" },
  { value: "ai_portal", label: "AI应用门户" },
  { value: "store_ops", label: "门店运营系统" },
  { value: "store_screen", label: "门店电子屏" },
  { value: "design_tools", label: "小满AI工作台" },
].filter((item) => !isHiddenAppSource(item.value));

export async function listOnlineUsers(
  params: ListOnlineUsersParams,
): Promise<{ page: PageResult; items: OnlineUser[] }> {
  const qs = buildPageSearchParams(params);
  if (params.source) qs.set("source", params.source);
  if (params.keyword) qs.set("keyword", params.keyword);
  return apiFetch<{ page: PageResult; items: OnlineUser[] }>(`/api/admin/ops/online-users?${qs.toString()}`, {
    method: "GET",
  });
}

export async function kickOnlineUser(sessionId: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/online-users/${encodeURIComponent(sessionId)}/kick`, {
    method: "POST",
  });
}
