import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type Tag = {
  tagId: string;
  name: string;
  createdAt: string | null;
};

export async function listTags(params: { q?: string; pageNo: number; pageSize: number; total?: number }): Promise<{ page: PageResult; items: Tag[] }> {
  const qs = buildPageSearchParams(params);
  if (params.q && params.q.trim()) {
    qs.set("q", params.q.trim());
  }
  return apiFetch<{ page: PageResult; items: Tag[] }>(`/api/tags?${qs.toString()}`, { method: "GET" });
}

export async function createTag(name: string): Promise<Tag> {
  return apiFetch<Tag>("/api/tags", { method: "POST", body: JSON.stringify({ name }) });
}

export async function deleteTag(tagId: string): Promise<void> {
  await apiFetch<void>(`/api/tags/${tagId}`, { method: "DELETE" });
}

