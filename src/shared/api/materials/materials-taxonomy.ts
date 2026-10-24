import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type MaterialCategory = {
  id: string;
  materialType: "image" | "video" | "model" | string;
  name: string;
  description: string | null;
  merchantId: string | null;
  sortNo: number | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type MaterialTag = {
  id: string;
  materialType: "image" | "video" | "model" | string;
  categoryId: string;
  name: string;
  description: string | null;
  merchantId: string | null;
  sortNo: number | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type MaterialSortDirection = "up" | "down";

export async function listMaterialCategories(params: { materialType: "image" | "video" | "model" | string }): Promise<MaterialCategory[]> {
  const qs = new URLSearchParams({ materialType: params.materialType });
  return apiFetch<MaterialCategory[]>(`/api/admin/material/materialCategory?${qs.toString()}`, { method: "GET" });
}

export async function createMaterialCategory(payload: {
  materialType: "image" | "video" | "model" | string;
  name: string;
  description?: string;
  publicScope?: boolean;
  sortNo?: number | null;
}): Promise<string> {
  return apiFetch<string>(`/api/admin/material/materialCategory`, { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteMaterialCategory(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/materialCategory/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateMaterialCategory(
  id: string,
  payload: {
    name: string;
    description?: string;
    sortNo?: number | null;
  },
): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/materialCategory/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function moveMaterialCategory(id: string, direction: MaterialSortDirection): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/materialCategory/${encodeURIComponent(id)}/move`, {
    method: "POST",
    body: JSON.stringify({ direction }),
  });
}

export async function listMaterialTags(params: {
  materialType: "image" | "video" | "model" | string;
  categoryId?: string;
  keyword?: string;
  pageNo: number;
  pageSize: number;
  total?: number;
}): Promise<{ page: PageResult; items: MaterialTag[] }> {
  const qs = buildPageSearchParams(params);
  qs.set("materialType", params.materialType);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.keyword) qs.set("keyword", params.keyword);
  return apiFetch<{ page: PageResult; items: MaterialTag[] }>(`/api/admin/material/materialTag?${qs.toString()}`, { method: "GET" });
}

export async function createMaterialTag(payload: {
  materialType: "image" | "video" | "model" | string;
  categoryId: string;
  name: string;
  description?: string;
  publicScope?: boolean;
  sortNo?: number | null;
}): Promise<string> {
  return apiFetch<string>(`/api/admin/material/materialTag`, { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteMaterialTag(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/materialTag/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function updateMaterialTag(
  id: string,
  payload: {
    name: string;
    description?: string;
    sortNo?: number | null;
  },
): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/materialTag/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function moveMaterialTag(id: string, direction: MaterialSortDirection): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/materialTag/${encodeURIComponent(id)}/move`, {
    method: "POST",
    body: JSON.stringify({ direction }),
  });
}
