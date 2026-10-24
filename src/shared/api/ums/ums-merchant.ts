import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type Merchant = {
  id: string;
  code: string;
  name: string;
  balance?: number | null;
  principalId?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function listMerchants(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
}): Promise<{ page: PageResult; items: Merchant[] }> {
  const qs = buildPageSearchParams(params);
  if (params.keyword) qs.set("keyword", params.keyword);
  return apiFetch<{ page: PageResult; items: Merchant[] }>(`/api/admin/ums/merchants?${qs.toString()}`, { method: "GET" });
}

export async function getMerchant(id: string): Promise<Merchant> {
  return apiFetch<Merchant>(`/api/admin/ums/merchants/${encodeURIComponent(id)}`, { method: "GET" });
}

export type CreateMerchantCommand = {
  name: string;
  code?: string;
  principalId?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  address?: string | null;
};

export type UpdateMerchantCommand = {
  name?: string;
  code?: string;
  principalId?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status?: string | null;
};

export async function createMerchant(payload: CreateMerchantCommand): Promise<string> {
  const res = await apiFetch<string>("/api/admin/ums/merchants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res;
}

export async function updateMerchant(id: string, payload: UpdateMerchantCommand): Promise<void> {
  await apiFetch(`/api/admin/ums/merchants/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteMerchant(id: string): Promise<void> {
  await apiFetch(`/api/admin/ums/merchants/${id}`, {
    method: "DELETE",
  });
}
