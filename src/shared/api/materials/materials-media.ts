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

export type MediaMaterial = {
  id: string;
  mediaType: "image" | "video" | string;
  categoryType: MaterialCategoryType | string;
  fileHash: string;
  assetUrl: string;
  storageRef: string | null;
  previewUrl: string | null;
  tagsJson: string | null;
  auditStatus: MaterialAuditStatus | string;
  publishStatus: MaterialPublishStatus | string;
  materialCategoryId?: string | null;
  ownerPrincipalId: string | null;
  merchantId: string | null;
  storeId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type MediaMaterialUploadResult = {
  media: MediaMaterial;
  existed: boolean;
};

export async function listMediaMaterials(params: {
  mediaType?: "image" | "video" | string;
  categoryType?: string;
  auditStatus?: string;
  publishStatus?: string;
  tagId?: string;
  tagName?: string;
  categoryId?: string;
  pageNo: number;
  pageSize: number;
  total?: number;
}): Promise<{ page: PageResult; items: MediaMaterial[] }> {
  const qs = buildPageSearchParams(params);
  if (params.mediaType) qs.set("mediaType", params.mediaType);
  if (params.categoryType) qs.set("categoryType", params.categoryType);
  if (params.auditStatus) qs.set("auditStatus", params.auditStatus);
  if (params.publishStatus) qs.set("publishStatus", params.publishStatus);
  if (params.tagId) qs.set("tagId", params.tagId);
  if (params.tagName) qs.set("tagName", params.tagName);
  if (params.categoryId) qs.set("categoryId", params.categoryId);

  return apiFetch<{ page: PageResult; items: MediaMaterial[] }>(`/api/admin/material/mediaMaterail?${qs.toString()}`, {
    method: "GET",
  });
}

export async function uploadMediaMaterial(payload: {
  mediaType: "image" | "video";
  categoryType: MaterialCategoryType;
  fileHash: string;
  assetUrl: string;
  storageRef?: string;
  previewUrl?: string;
  tags?: string[];
  auditStatus?: MaterialAuditStatus;
  ownerPrincipalId?: string;
  merchantId?: string;
  storeId?: string;
  materialCategoryId?: string;
}): Promise<MediaMaterialUploadResult> {
  return apiFetch<MediaMaterialUploadResult>(`/api/admin/material/mediaMaterail/upload`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMediaMaterialByHash(params: {
  mediaType: "image" | "video";
  fileHash: string;
  merchantId?: string;
  storeId?: string;
}): Promise<MediaMaterial | null> {
  const qs = new URLSearchParams({
    mediaType: params.mediaType,
    fileHash: params.fileHash,
  });
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.storeId) qs.set("storeId", params.storeId);
  return apiFetch<MediaMaterial | null>(`/api/admin/material/mediaMaterail/by-hash?${qs.toString()}`, { method: "GET" });
}

export async function auditMediaMaterial(id: string, payload: { status: "approved" | "rejected"; reason?: string }): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/mediaMaterail/${encodeURIComponent(id)}/audit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function publishMediaMaterial(id: string, status: "online" | "offline"): Promise<boolean> {
  const qs = new URLSearchParams({ status });
  return apiFetch<boolean>(`/api/admin/material/mediaMaterail/${encodeURIComponent(id)}/publish?${qs.toString()}`, { method: "POST" });
}

export async function deleteMediaMaterials(ids: string[]): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/mediaMaterail`, {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}
