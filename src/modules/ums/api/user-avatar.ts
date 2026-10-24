import { getAccessToken } from "@/shared/api/auth/auth";
import { getApiBaseUrl } from "@/shared/api/sys/api-base";
import { apiFetch } from "@/shared/api/sys/http";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type UserAvatar = {
  id: string;
  userId?: string;
  avatarHash: string;
  storageProviderCode: string;
  storagePath: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

export type UserAvatarUploadResult = {
  avatar: UserAvatar;
  existed: boolean;
};

export async function listUserAvatarHistory(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
}): Promise<{ page: PageResult; items: UserAvatar[] }> {
  const qs = new URLSearchParams({
    pageNo: String(params.pageNo),
    pageSize: String(params.pageSize),
  });
  if (typeof params.total === "number") qs.set("total", String(params.total));
  return apiFetch<{ page: PageResult; items: UserAvatar[] }>(`/api/admin/ums/users/avatar-history?${qs.toString()}`, {
    method: "GET",
  });
}

export async function uploadUserAvatar(payload: {
  userId: string;
  file: File;
  fileHash: string;
}): Promise<UserAvatarUploadResult> {
  const form = new FormData();
  form.set("file", payload.file);
  form.set("fileHash", payload.fileHash);
  return apiFetch<UserAvatarUploadResult>(`/api/admin/ums/users/${encodeURIComponent(payload.userId)}/avatar/upload`, {
    method: "POST",
    body: form,
  });
}

export async function selectUserAvatar(payload: {
  userId: string;
  avatarId: string;
}): Promise<UserAvatar> {
  return apiFetch<UserAvatar>(`/api/admin/ums/users/${encodeURIComponent(payload.userId)}/avatar`, {
    method: "PUT",
    body: JSON.stringify({ avatarId: payload.avatarId }),
  });
}

function getBaseUrl(): string {
  return getApiBaseUrl();
}

export async function downloadUserAvatarCropSource(avatarUrl: string): Promise<Blob> {
  const headers = new Headers();
  headers.set("Accept", "image/*");
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
  }
  const qs = new URLSearchParams({ avatarUrl });
  const response = await fetch(`${getBaseUrl()}/api/admin/ums/users/avatar-source?${qs.toString()}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    throw new Error("头像裁剪源加载失败");
  }
  return response.blob();
}
