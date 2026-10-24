import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type WorkflowSortDirection = "up" | "down";

export type WorkflowTag = {
  id: string;
  name: string;
  enName: string | null;
  sortNo: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type UpsertWorkflowTagCommand = {
  id?: string | null;
  name: string;
  enName?: string | null;
  sortNo?: number | null;
};

export type DeleteWorkflowTagCheckResult = {
  canDelete: boolean;
  forceRequired: boolean;
  message: string;
};

export async function listWorkflowTags(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
}): Promise<{ page: PageResult; items: WorkflowTag[] }> {
  const qs = buildPageSearchParams(params);
  if (params.keyword) qs.set("keyword", params.keyword);
  return apiFetch<{ page: PageResult; items: WorkflowTag[] }>(`/api/admin/app/workflowTag?${qs.toString()}`, { method: "GET" });
}

export async function upsertWorkflowTag(cmd: UpsertWorkflowTagCommand): Promise<string> {
  return apiFetch<string>("/api/admin/app/workflowTag", { method: "POST", body: JSON.stringify(cmd) });
}

export async function moveWorkflowTag(id: string, direction: WorkflowSortDirection): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/app/workflowTag/${encodeURIComponent(id)}/move`, {
    method: "POST",
    body: JSON.stringify({ direction }),
  });
}

export async function checkDeleteWorkflowTag(id: string): Promise<DeleteWorkflowTagCheckResult> {
  return apiFetch<DeleteWorkflowTagCheckResult>(
    `/api/admin/app/workflowTag/${encodeURIComponent(id)}/delete-check`,
    { method: "GET" }
  );
}

export async function deleteWorkflowTag(id: string, options?: { force?: boolean }): Promise<boolean> {
  const force = options?.force ? "?force=true" : "";
  return apiFetch<boolean>(`/api/admin/app/workflowTag/${encodeURIComponent(id)}${force}`, { method: "DELETE" });
}
