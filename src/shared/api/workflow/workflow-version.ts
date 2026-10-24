import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type WorkflowVersion = {
  id: string;
  workflowId: string;
  versionNo: string;
  changelog: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
};

export type WorkflowVersionDetail = WorkflowVersion & {
  workflowJson: string;
  workflowJsonText: string | null;
  configJson: string | null;
  inputSchema: string | null;
  outputSchema: string | null;
  uiSchema: string | null;
};

export type CreateWorkflowVersionCommand = {
  workflowId: string;
  versionNo: string;
  changelog?: string | null;
  workflowJson: unknown;
  workflowJsonText?: string | null;
  configJson?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
  uiSchema?: unknown;
};

export type UpdateWorkflowVersionCommand = {
  changelog?: string | null;
  workflowJson?: unknown;
  workflowJsonText?: string | null;
  configJson?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
  uiSchema?: unknown;
};

export async function listWorkflowVersions(params: {
  workflowId: string;
  pageNo?: number;
  pageSize?: number;
  total?: number;
}): Promise<{ page: PageResult; items: WorkflowVersion[] }> {
  const qs = buildPageSearchParams({
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 10,
    total: params.total,
  });
  qs.set("workflowId", params.workflowId);
  return apiFetch<{ page: PageResult; items: WorkflowVersion[] }>(`/api/admin/app/workflowVersion?${qs.toString()}`, { method: "GET" });
}

export async function getWorkflowVersion(id: string): Promise<WorkflowVersionDetail> {
  return apiFetch<WorkflowVersionDetail>(`/api/admin/app/workflowVersion/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createWorkflowVersion(cmd: CreateWorkflowVersionCommand): Promise<string> {
  return apiFetch<string>("/api/admin/app/workflowVersion", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateWorkflowVersion(id: string, cmd: UpdateWorkflowVersionCommand): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/app/workflowVersion/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function activateWorkflowVersion(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/app/workflowVersion/${encodeURIComponent(id)}/activate`, { method: "POST" });
}

export async function deactivateWorkflowVersion(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/app/workflowVersion/${encodeURIComponent(id)}/deactivate`, { method: "POST" });
}

export async function deleteWorkflowVersion(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/app/workflowVersion/${encodeURIComponent(id)}`, { method: "DELETE" });
}
