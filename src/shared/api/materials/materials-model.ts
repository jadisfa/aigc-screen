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

export type ModelMaterial = {
  id: string;
  mediaType: "model" | string;
  categoryType: MaterialCategoryType | string;
  materialName: string | null;
  materialDescription: string | null;
  fileHash: string;
  assetUrl: string;
  storageRef: string | null;
  previewUrl: string | null;
  tagsJson: string | null;
  auditStatus: MaterialAuditStatus | string;
  publishStatus: MaterialPublishStatus | string;
  materialCategoryId: string | null;
  materialCategoryName: string | null;
  ownerPrincipalId: string | null;
  merchantId: string | null;
  storeId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type ModelMaterialUploadResult = {
  model: ModelMaterial;
  existed: boolean;
};

export async function listModelMaterials(params: {
  categoryType?: string;
  categoryTypes?: string[];
  auditStatus?: string;
  publishStatus?: string;
  keyword?: string;
  tagId?: string;
  tagName?: string;
  categoryId?: string;
  pageNo: number;
  pageSize: number;
  total?: number;
}): Promise<{ page: PageResult; items: ModelMaterial[] }> {
  const qs = buildPageSearchParams(params);
  if (params.categoryType) qs.set("categoryType", params.categoryType);
  if (params.categoryTypes?.length) {
    params.categoryTypes.forEach((v) => {
      if (v) qs.append("categoryTypes", v);
    });
  }
  if (params.auditStatus) qs.set("auditStatus", params.auditStatus);
  if (params.publishStatus) qs.set("publishStatus", params.publishStatus);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.tagId) qs.set("tagId", params.tagId);
  if (params.tagName) qs.set("tagName", params.tagName);
  if (params.categoryId) qs.set("categoryId", params.categoryId);

  return apiFetch<{ page: PageResult; items: ModelMaterial[] }>(`/api/admin/material/modelMaterail?${qs.toString()}`, { method: "GET" });
}

export async function uploadModelMaterial(payload: {
  categoryType: MaterialCategoryType;
  materialName: string;
  materialDescription?: string;
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
}): Promise<ModelMaterialUploadResult> {
  return apiFetch<ModelMaterialUploadResult>(`/api/admin/material/modelMaterail/upload`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadModelMaterialForm(payload: {
  file: File;
  categoryType: MaterialCategoryType;
  materialName: string;
  materialDescription?: string;
  fileHash: string;
  tags?: string[];
  auditStatus?: MaterialAuditStatus;
  ownerPrincipalId?: string;
  merchantId?: string;
  storeId?: string;
  materialCategoryId?: string;
}): Promise<ModelMaterialUploadResult> {
  const form = new FormData();
  form.set("file", payload.file);
  form.set("categoryType", payload.categoryType);
  form.set("materialName", payload.materialName);
  if (payload.materialDescription) form.set("materialDescription", payload.materialDescription);
  form.set("fileHash", payload.fileHash);
  payload.tags?.forEach((tag) => {
    if (tag) form.append("tags", tag);
  });
  if (payload.auditStatus) form.set("auditStatus", payload.auditStatus);
  if (payload.ownerPrincipalId) form.set("ownerPrincipalId", payload.ownerPrincipalId);
  if (payload.merchantId) form.set("merchantId", payload.merchantId);
  if (payload.storeId) form.set("storeId", payload.storeId);
  if (payload.materialCategoryId) form.set("materialCategoryId", payload.materialCategoryId);

  return apiFetch<ModelMaterialUploadResult>(`/api/admin/material/modelMaterail/upload-file`, {
    method: "POST",
    body: form,
  });
}

export async function getModelMaterialByHash(params: {
  fileHash: string;
  merchantId?: string;
  storeId?: string;
}): Promise<ModelMaterial | null> {
  const qs = new URLSearchParams({
    fileHash: params.fileHash,
  });
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.storeId) qs.set("storeId", params.storeId);
  return apiFetch<ModelMaterial | null>(`/api/admin/material/modelMaterail/by-hash?${qs.toString()}`, { method: "GET" });
}

export async function auditModelMaterial(id: string, payload: { status: "approved" | "rejected"; reason?: string }): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/modelMaterail/${encodeURIComponent(id)}/audit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function publishModelMaterial(id: string, status: "online" | "offline"): Promise<boolean> {
  const qs = new URLSearchParams({ status });
  return apiFetch<boolean>(`/api/admin/material/modelMaterail/${encodeURIComponent(id)}/publish?${qs.toString()}`, { method: "POST" });
}

export async function deleteModelMaterials(ids: string[]): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/material/modelMaterail`, {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
}

export async function updateModelMaterialMetadata(
  id: string,
  payload: { materialName: string; materialDescription?: string },
): Promise<void> {
  return apiFetch<void>(`/api/admin/material/modelMaterail/${encodeURIComponent(id)}/metadata`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
