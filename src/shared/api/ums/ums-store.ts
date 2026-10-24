import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type Store = {
  id: string;
  code: string;
  name: string;
  balance?: number | null;
  merchantId: string;
  merchantName?: string | null;
  storeType?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function listStores(params: {
  merchantId?: string;
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  storeType?: string;
}): Promise<{ page: PageResult; items: Store[] }> {
  const qs = buildPageSearchParams(params);
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.storeType) qs.set("storeType", params.storeType);
  return apiFetch<{ page: PageResult; items: Store[] }>(`/api/admin/ums/stores?${qs.toString()}`, { method: "GET" });
}

export async function getStore(id: string): Promise<Store> {
  return apiFetch<Store>(`/api/admin/ums/stores/${encodeURIComponent(id)}`, { method: "GET" });
}

export type CreateStoreCommand = {
  name: string;
  code?: string;
  merchantId: string;
  storeType?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  address?: string | null;
};

export type UpdateStoreCommand = {
  name?: string;
  code?: string;
  merchantId?: string;
  storeType?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status?: string | null;
};

export async function createStore(payload: CreateStoreCommand): Promise<string> {
  const res = await apiFetch<string>("/api/admin/ums/stores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res;
}

export async function updateStore(id: string, payload: UpdateStoreCommand): Promise<void> {
  await apiFetch(`/api/admin/ums/stores/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteStore(id: string): Promise<void> {
  await apiFetch(`/api/admin/ums/stores/${id}`, {
    method: "DELETE",
  });
}
