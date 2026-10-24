import { apiFetch } from "@/shared/api/sys/http";

export type WorkflowCate = {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  iconUrl: string | null;
  sortNo: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type UpsertWorkflowCateCommand = {
  id?: string | null;
  name: string;
  parentId?: string | null;
  iconUrl?: string | null;
  sortNo?: number | null;
};

export type DeleteWorkflowCateCheckResult = {
  canDelete: boolean;
  forceRequired: boolean;
  message: string;
};

export async function listWorkflowCates(): Promise<WorkflowCate[]> {
  return apiFetch<WorkflowCate[]>("/api/admin/app/workflowCate", { method: "GET" });
}

export async function upsertWorkflowCate(cmd: UpsertWorkflowCateCommand): Promise<string> {
  return apiFetch<string>("/api/admin/app/workflowCate", { method: "POST", body: JSON.stringify(cmd) });
}

export async function checkDeleteWorkflowCate(id: string): Promise<DeleteWorkflowCateCheckResult> {
  return apiFetch<DeleteWorkflowCateCheckResult>(`/api/admin/app/workflowCate/${encodeURIComponent(id)}/delete-check`, { method: "GET" });
}

export async function deleteWorkflowCate(id: string, options?: { force?: boolean }): Promise<boolean> {
  const force = options?.force ? "?force=true" : "";
  return apiFetch<boolean>(`/api/admin/app/workflowCate/${encodeURIComponent(id)}${force}`, { method: "DELETE" });
}
