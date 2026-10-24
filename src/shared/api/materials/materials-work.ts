import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import type {
  MaterialAuditStatus,
  MaterialPublishStatus,
} from "@/modules/materials/lib/material-governance";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type WorkTaskExecutionInfo = {
  sessionId?: string | null;
  workflowId?: string | null;
  workflowVersionId?: string | null;
  assignedServerId?: string | null;
  taskName?: string | null;
  prompt?: string | null;
  inputParams?: string | null;
  outputParams?: string | null;
  submittedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  generateTimeSec?: number | null;
  taskDurationMs?: number | null;
};

export type WorkMaterialSummary = {
  id: string;
  coverUrl: string | null;
  workType: string | null;
  sourceType: string | null;
  source?: string | null;
  clientType: string | null;
  fileHash: string | null;
  ownerPrincipalId: string | null;
  ownerKind?: "user" | "device" | string | null;
  ownerName: string | null;
  deviceCode?: string | null;
  ownerAvatarUrl?: string | null;
  merchantId: string | null;
  storeId: string | null;
  workflowId?: string | null;
  workflowTitle?: string | null;
  workflowCode?: string | null;
  serverId?: string | null;
  serverName?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMs?: number | null;
  computeCost?: number | string | null;
  requestParams?: string | null;
  deletedAt?: string | null;
  auditStatus: MaterialAuditStatus | string;
  publishStatus: MaterialPublishStatus | string;
  itemsJson: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  taskExecution?: WorkTaskExecutionInfo | null;
};

export async function listWorkMaterials(params: {
  workType?: string;
  keyword?: string;
  auditStatus?: string;
  publishStatus?: string;
  ownerPrincipalId?: string;
  merchantId?: string;
  storeId?: string;
  createdAtStart?: string;
  createdAtEnd?: string;
  includeTaskExecutionInfo?: boolean;
  pageNo: number;
  pageSize: number;
  total?: number;
}): Promise<{ page: PageResult; items: WorkMaterialSummary[] }> {
  const qs = buildPageSearchParams(params);
  if (params.workType) qs.set("workType", params.workType);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.auditStatus) qs.set("auditStatus", params.auditStatus);
  if (params.publishStatus) qs.set("publishStatus", params.publishStatus);
  if (params.ownerPrincipalId)
    qs.set("ownerPrincipalId", params.ownerPrincipalId);
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.storeId) qs.set("storeId", params.storeId);
  if (params.createdAtStart) qs.set("createdAtStart", params.createdAtStart);
  if (params.createdAtEnd) qs.set("createdAtEnd", params.createdAtEnd);
  if (params.includeTaskExecutionInfo) qs.set("includeTaskExecutionInfo", "true");

  return apiFetch<{ page: PageResult; items: WorkMaterialSummary[] }>(
    `/api/admin/material/workMaterail?${qs.toString()}`,
    {
      method: "GET",
    },
  );
}

export type WorkMaterialUploadResult = {
  work: WorkMaterialSummary;
  existed: boolean;
};

export async function getWorkMaterialByHash(params: {
  fileHash: string;
  merchantId?: string;
  storeId?: string;
}): Promise<WorkMaterialSummary | null> {
  const qs = new URLSearchParams({ fileHash: params.fileHash });
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.storeId) qs.set("storeId", params.storeId);
  return apiFetch<WorkMaterialSummary | null>(
    `/api/admin/material/workMaterail/by-hash?${qs.toString()}`,
    { method: "GET" },
  );
}

export async function uploadWorkMaterialForm(payload: {
  file: File;
  workType: "image" | "video" | "copywriting";
  fileHash: string;
  merchantId?: string;
  storeId?: string;
  ownerPrincipalId?: string;
  sourceType?: "workflow" | "agent" | "canvas";
  clientType?: "web" | "wechat" | "app";
}): Promise<WorkMaterialUploadResult> {
  const form = new FormData();
  form.set("file", payload.file);
  form.set("workType", payload.workType);
  form.set("fileHash", payload.fileHash);
  if (payload.merchantId) form.set("merchantId", payload.merchantId);
  if (payload.storeId) form.set("storeId", payload.storeId);
  if (payload.ownerPrincipalId)
    form.set("ownerPrincipalId", payload.ownerPrincipalId);
  if (payload.sourceType) form.set("sourceType", payload.sourceType);
  if (payload.clientType) form.set("clientType", payload.clientType);
  return apiFetch<WorkMaterialUploadResult>(
    "/api/admin/material/workMaterail/upload",
    { method: "POST", body: form },
  );
}

export async function auditWorkMaterial(
  id: string,
  payload: { status: "approved" | "rejected"; reason?: string },
): Promise<boolean> {
  return apiFetch<boolean>(
    `/api/admin/material/workMaterail/${encodeURIComponent(id)}/audit`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function publishWorkMaterial(
  id: string,
  status: "online" | "offline",
): Promise<boolean> {
  const qs = new URLSearchParams({ status });
  return apiFetch<boolean>(
    `/api/admin/material/workMaterail/${encodeURIComponent(id)}/publish?${qs.toString()}`,
    { method: "POST" },
  );
}

export async function deleteWorkMaterial(id: string): Promise<boolean> {
  return apiFetch<boolean>(
    `/api/admin/material/workMaterail/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
//  分页查询绘画历史
export async function queryWorkMaterials(params: any) {
  const qs = new URLSearchParams({ ...params });
  return apiFetch<{
    page: PageResult;
    items: any[];
  }>(`/api/admin/material/workMaterail?${qs.toString()}`, {
    method: "GET",
  });
}
