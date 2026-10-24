import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type Paged<T> = {
  page: PageResult;
  items: T[];
};

export type ComfyUIServerGroup = {
  id: string;
  name: string;
  description: string | null;
  serverCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type CreateComfyUIServerGroupCommand = {
  name: string;
  description?: string | null;
};

export type UpdateComfyUIServerGroupCommand = {
  name: string;
  description?: string | null;
};

export async function listComfyUIServerGroups(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
}): Promise<Paged<ComfyUIServerGroup>> {
  const qs = buildPageSearchParams(params);
  if (params.keyword) qs.set("keyword", params.keyword);
  return apiFetch<Paged<ComfyUIServerGroup>>(`/api/admin/int/comfyUIServerGroup?${qs.toString()}`, { method: "GET" });
}

export async function getComfyUIServerGroup(id: string): Promise<ComfyUIServerGroup | null> {
  return apiFetch<ComfyUIServerGroup | null>(`/api/admin/int/comfyUIServerGroup/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createComfyUIServerGroup(cmd: CreateComfyUIServerGroupCommand): Promise<string> {
  return apiFetch<string>("/api/admin/int/comfyUIServerGroup", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateComfyUIServerGroup(id: string, cmd: UpdateComfyUIServerGroupCommand): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/comfyUIServerGroup/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function deleteComfyUIServerGroup(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/comfyUIServerGroup/${encodeURIComponent(id)}`, { method: "DELETE" });
}

