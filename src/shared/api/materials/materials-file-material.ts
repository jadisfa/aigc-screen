import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";
import type {
  MaterialAuditStatus,
  MaterialCategoryType,
  MaterialPublishStatus,
} from "@/modules/materials/lib/material-governance";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type FileMaterial = {
  id: string;
  fileName: string;
  fileType: "image" | "video" | "file" | string;
  mimeType?: string | null;
  fileSize: number;
  fileHash: string;
  storageProviderCode: string;
  storagePath: string;
  accessUrl: string;
  tags?: string | null;
  tagCodes?: string[] | null;
  tagLabels?: string[] | null;
  categoryType: MaterialCategoryType | string;
  categoryTypeLabel?: string | null;
  auditStatus: MaterialAuditStatus | string;
  auditStatusLabel?: string | null;
  publishStatus: MaterialPublishStatus | string;
  publishStatusLabel?: string | null;
  ownerPrincipalId: string;
  ownerKind?: "user" | "device" | string | null;
  ownerName?: string | null;
  deviceCode?: string | null;
  merchantId: string | null;
  storeId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export type FileMaterialUploadResult = {
  file: FileMaterial;
  existed: boolean;
};

export async function listFileMaterials(params: {
  fileType?: "image" | "video" | "file";
  keyword?: string;
  merchantId?: string;
  storeId?: string;
  ownerPrincipalId?: string;
  categoryType?: string;
  auditStatus?: string;
  publishStatus?: string;
  pageNo: number;
  pageSize: number;
  total?: number;
}): Promise<{ page: PageResult; items: FileMaterial[] }> {
  const qs = buildPageSearchParams(params);
  if (params.fileType) qs.set("fileType", params.fileType);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.storeId) qs.set("storeId", params.storeId);
  if (params.ownerPrincipalId) qs.set("ownerPrincipalId", params.ownerPrincipalId);
  if (params.categoryType) qs.set("categoryType", params.categoryType);
  if (params.auditStatus) qs.set("auditStatus", params.auditStatus);
  if (params.publishStatus) qs.set("publishStatus", params.publishStatus);
  return apiFetch<{ page: PageResult; items: FileMaterial[] }>(`/api/admin/material/fileMaterial?${qs.toString()}`, { method: "GET" });
}

export async function getFileMaterialByHash(params: {
  merchantId?: string;
  fileHash: string;
  storeId?: string;
}): Promise<FileMaterial | null> {
  const qs = new URLSearchParams({
    fileHash: params.fileHash,
  });
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.storeId) qs.set("storeId", params.storeId);
  return apiFetch<FileMaterial | null>(`/api/admin/material/fileMaterial/by-hash?${qs.toString()}`, { method: "GET" });
}

export async function listRecommendedFileMaterials(params?: {
  fileType?: "image" | "video" | "file";
  limit?: number;
  excludeIds?: string[];
}): Promise<FileMaterial[]> {
  const qs = new URLSearchParams();
  if (params?.fileType) qs.set("fileType", params.fileType);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  params?.excludeIds?.forEach((id) => {
    if (id) qs.append("excludeIds", id);
  });
  return apiFetch<FileMaterial[]>(`/api/admin/material/fileMaterial/recommendations?${qs.toString()}`, { method: "GET" });
}

export async function uploadFileMaterialForm(payload: {
  file: File;
  fileType: "image" | "video" | "file";
  fileHash: string;
  tags?: string[];
  merchantId?: string;
  storeId?: string;
  ownerPrincipalId?: string;
}): Promise<FileMaterialUploadResult> {
  const form = new FormData();
  form.set("file", payload.file);
  form.set("fileType", payload.fileType);
  form.set("fileHash", payload.fileHash);
  payload.tags?.forEach((tag) => {
    if (tag) form.append("tags", tag);
  });
  if (payload.merchantId) form.set("merchantId", payload.merchantId);
  if (payload.storeId) form.set("storeId", payload.storeId);
  if (payload.ownerPrincipalId) form.set("ownerPrincipalId", payload.ownerPrincipalId);

  return apiFetch<FileMaterialUploadResult>("/api/admin/material/fileMaterial/upload", { method: "POST", body: form });
}

export async function deleteFileMaterialsBatch(ids: string[]): Promise<boolean> {
  return apiFetch<boolean>("/api/admin/material/fileMaterial", { method: "DELETE", body: JSON.stringify({ ids }) });
}

export async function auditFileMaterial(id: string, payload: { status: "approved" | "rejected"; reason?: string }): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/fileMaterial/${encodeURIComponent(id)}/audit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function publishFileMaterial(id: string, status: "online" | "offline"): Promise<boolean> {
  const qs = new URLSearchParams({ status });
  return apiFetch<boolean>(`/api/admin/material/fileMaterial/${encodeURIComponent(id)}/publish?${qs.toString()}`, {
    method: "POST",
  });
}

export async function updateFileMaterialName(id: string, fileName: string): Promise<void> {
  return apiFetch<void>(`/api/admin/material/fileMaterial/${encodeURIComponent(id)}/name`, {
    method: "PUT",
    body: JSON.stringify({ fileName }),
  });
}
