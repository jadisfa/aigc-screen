import { apiFetch } from "@/shared/api/sys/http";

export type OpsTicketFileScopeLevel = "global" | "merchant" | "store" | string;

export type OpsTicketFile = {
  id: string;
  scopeLevel: OpsTicketFileScopeLevel;
  merchantId?: string | null;
  storeId?: string | null;
  fileName: string;
  mimeType?: string | null;
  fileSize: number;
  fileHash: string;
  storageProviderCode: string;
  storagePath: string;
  accessUrl: string;
  ownerPrincipalId?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type OpsTicketFileUploadResult = {
  file: OpsTicketFile;
  existed: boolean;
};

export async function getOpsTicketFileByHash(fileHash: string): Promise<OpsTicketFile | null> {
  const qs = new URLSearchParams({ fileHash });
  return apiFetch<OpsTicketFile | null>(`/api/admin/ops/ticket-files/by-hash?${qs.toString()}`, { method: "GET" });
}

export async function uploadOpsTicketFileForm(payload: {
  file: File;
  fileHash: string;
  ownerPrincipalId?: string;
}): Promise<OpsTicketFileUploadResult> {
  const form = new FormData();
  form.set("file", payload.file);
  form.set("fileHash", payload.fileHash);
  if (payload.ownerPrincipalId) form.set("ownerPrincipalId", payload.ownerPrincipalId);
  return apiFetch<OpsTicketFileUploadResult>("/api/admin/ops/ticket-files/upload", {
    method: "POST",
    body: form,
  });
}
