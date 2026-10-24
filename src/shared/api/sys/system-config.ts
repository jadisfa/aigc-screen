import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type Paged<T> = {
  page: PageResult;
  items: T[];
};

export type StorageConfig = {
  id: string;
  providerCode: string;
  name: string;
  enabled: boolean;
  accessKey: string | null;
  hasSecretKey: boolean;
  secretKeyMasked: string | null;
  bucket: string | null;
  region: string | null;
  domain: string | null;
  cdnEnabled: boolean;
  cdnDomain: string | null;
  configJson: string | null;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type PaymentGatewayConfig = {
  id: string;
  gatewayCode: string;
  name: string;
  enabled: boolean;
  notifyUrl: string | null;
  gatewayUrl: string | null;
  configJson: string | null;
  hasSecretJson: boolean;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type WechatMpConfig = {
  id: string;
  appId: string;
  enabled: boolean;
  hasSecret: boolean;
  qaPrompt: string | null;
  kwTxt2img: string | null;
  kwImg2img: string | null;
  kwImg2video: string | null;
  wfTxt2img: string | null;
  wfImg2img: string | null;
  wfImg2video: string | null;
  msgUploadImage: string | null;
  msgTaskWait: string | null;
  msgChatWait: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type MiniprogramConfig = {
  id: string;
  appId: string;
  enabled: boolean;
  hasSecret: boolean;
  homeBanners: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type LegalDocumentSummary = {
  id: string;
  docType: "privacy_policy" | "user_agreement" | string;
  title: string;
  version: string;
  status: "online" | "offline" | string;
  editor: string | null;
  editedAt: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type LegalDocument = LegalDocumentSummary & {
  content: string;
};

export type LegalDocumentPublic = {
  id: string;
  docType: "privacy_policy" | "user_agreement" | string;
  title: string;
  version: string;
  status: "online" | "offline" | string;
  content: string;
  editor: string | null;
  editedAt: string | null;
  publishedAt: string | null;
};

export type WatermarkSettings = {
  id: string;
  mode: "none" | "light" | "dark" | string;
  lightAsset: string | null;
  darkAlgorithm?: string | null;
  darkKeyVersion?: string | null;
  darkPayloadTemplate?: string | null;
  darkPayloadTemplateSummary?: string | null;
  darkSupportedFormats?: string[] | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function listStorageConfigs(): Promise<StorageConfig[]> {
  return apiFetch<StorageConfig[]>("/api/admin/ops/system-config/storage-configs", { method: "GET" });
}

export async function getStorageConfig(providerCode: string): Promise<StorageConfig> {
  return apiFetch<StorageConfig>(`/api/admin/ops/system-config/storage-configs/${encodeURIComponent(providerCode)}`, { method: "GET" });
}

export async function createStorageConfig(cmd: {
  providerCode: string;
  name: string;
  enabled?: boolean;
  accessKey?: string;
  secretKeyEnc?: string;
  bucket?: string;
  region?: string;
  domain?: string;
  cdnEnabled?: boolean;
  cdnDomain?: string;
  configJson?: string;
  description?: string;
}): Promise<string> {
  return apiFetch<string>("/api/admin/ops/system-config/storage-configs", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateStorageConfig(providerCode: string, cmd: {
  name?: string;
  enabled?: boolean;
  accessKey?: string;
  secretKeyEnc?: string;
  clearSecretKey?: boolean;
  bucket?: string;
  region?: string;
  domain?: string;
  cdnEnabled?: boolean;
  cdnDomain?: string;
  configJson?: string;
  description?: string;
}): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/system-config/storage-configs/${encodeURIComponent(providerCode)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function setStorageConfigEnabled(providerCode: string, enabled: boolean): Promise<boolean> {
  const qs = new URLSearchParams({ enabled: String(enabled) });
  return apiFetch<boolean>(`/api/admin/ops/system-config/storage-configs/${encodeURIComponent(providerCode)}/enabled?${qs.toString()}`, { method: "POST" });
}

export async function listPaymentGatewayConfigs(): Promise<PaymentGatewayConfig[]> {
  return apiFetch<PaymentGatewayConfig[]>("/api/admin/ops/system-config/payment-gateway-configs", { method: "GET" });
}

export async function getPaymentGatewayConfig(gatewayCode: string): Promise<PaymentGatewayConfig> {
  return apiFetch<PaymentGatewayConfig>(`/api/admin/ops/system-config/payment-gateway-configs/${encodeURIComponent(gatewayCode)}`, { method: "GET" });
}

export async function createPaymentGatewayConfig(cmd: {
  gatewayCode: string;
  name: string;
  enabled?: boolean;
  notifyUrl?: string;
  gatewayUrl?: string;
  configJson?: string;
  secretJsonEnc?: string;
  description?: string;
}): Promise<string> {
  return apiFetch<string>("/api/admin/ops/system-config/payment-gateway-configs", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updatePaymentGatewayConfig(gatewayCode: string, cmd: {
  name?: string;
  enabled?: boolean;
  notifyUrl?: string;
  gatewayUrl?: string;
  configJson?: string;
  secretJsonEnc?: string;
  clearSecretJson?: boolean;
  description?: string;
}): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/system-config/payment-gateway-configs/${encodeURIComponent(gatewayCode)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function setPaymentGatewayConfigEnabled(gatewayCode: string, enabled: boolean): Promise<boolean> {
  const qs = new URLSearchParams({ enabled: String(enabled) });
  return apiFetch<boolean>(`/api/admin/ops/system-config/payment-gateway-configs/${encodeURIComponent(gatewayCode)}/enabled?${qs.toString()}`, { method: "POST" });
}

export async function listWechatMpConfigs(): Promise<WechatMpConfig[]> {
  return apiFetch<WechatMpConfig[]>("/api/admin/ops/system-config/wechat-mp-configs", { method: "GET" });
}

export async function getWechatMpConfig(appId: string): Promise<WechatMpConfig> {
  return apiFetch<WechatMpConfig>(`/api/admin/ops/system-config/wechat-mp-configs/${encodeURIComponent(appId)}`, { method: "GET" });
}

export async function createWechatMpConfig(cmd: {
  appId: string;
  secretEnc?: string;
  enabled?: boolean;
  qaPrompt?: string;
  kwTxt2img?: string;
  kwImg2img?: string;
  kwImg2video?: string;
  wfTxt2img?: string;
  wfImg2img?: string;
  wfImg2video?: string;
  msgUploadImage?: string;
  msgTaskWait?: string;
  msgChatWait?: string;
}): Promise<string> {
  return apiFetch<string>("/api/admin/ops/system-config/wechat-mp-configs", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateWechatMpConfig(appId: string, cmd: {
  secretEnc?: string;
  clearSecret?: boolean;
  enabled?: boolean;
  qaPrompt?: string;
  kwTxt2img?: string;
  kwImg2img?: string;
  kwImg2video?: string;
  wfTxt2img?: string;
  wfImg2img?: string;
  wfImg2video?: string;
  msgUploadImage?: string;
  msgTaskWait?: string;
  msgChatWait?: string;
}): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/system-config/wechat-mp-configs/${encodeURIComponent(appId)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function setWechatMpConfigEnabled(appId: string, enabled: boolean): Promise<boolean> {
  const qs = new URLSearchParams({ enabled: String(enabled) });
  return apiFetch<boolean>(`/api/admin/ops/system-config/wechat-mp-configs/${encodeURIComponent(appId)}/enabled?${qs.toString()}`, { method: "POST" });
}

export async function listMiniprogramConfigs(): Promise<MiniprogramConfig[]> {
  return apiFetch<MiniprogramConfig[]>("/api/admin/ops/system-config/miniprogram-configs", { method: "GET" });
}

export async function getMiniprogramConfig(appId: string): Promise<MiniprogramConfig> {
  return apiFetch<MiniprogramConfig>(`/api/admin/ops/system-config/miniprogram-configs/${encodeURIComponent(appId)}`, { method: "GET" });
}

export async function createMiniprogramConfig(cmd: {
  appId: string;
  appSecretEnc?: string;
  enabled?: boolean;
  homeBanners?: string;
}): Promise<string> {
  return apiFetch<string>("/api/admin/ops/system-config/miniprogram-configs", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateMiniprogramConfig(appId: string, cmd: {
  appSecretEnc?: string;
  clearSecret?: boolean;
  enabled?: boolean;
  homeBanners?: string;
}): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/system-config/miniprogram-configs/${encodeURIComponent(appId)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function setMiniprogramConfigEnabled(appId: string, enabled: boolean): Promise<boolean> {
  const qs = new URLSearchParams({ enabled: String(enabled) });
  return apiFetch<boolean>(`/api/admin/ops/system-config/miniprogram-configs/${encodeURIComponent(appId)}/enabled?${qs.toString()}`, { method: "POST" });
}

export async function listLegalDocuments(params: { docType?: string; pageNo: number; pageSize: number; total?: number }): Promise<Paged<LegalDocumentSummary>> {
  const qs = buildPageSearchParams(params);
  if (params.docType) qs.set("docType", params.docType);
  return apiFetch<Paged<LegalDocumentSummary>>(`/api/admin/ops/system-config/legal-documents?${qs.toString()}`, { method: "GET" });
}

export async function getLegalDocument(id: string): Promise<LegalDocument> {
  return apiFetch<LegalDocument>(`/api/admin/ops/system-config/legal-documents/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createLegalDocument(cmd: {
  docType: string;
  title: string;
  version: string;
  status?: string;
  content: string;
  editedAt?: string;
}): Promise<string> {
  return apiFetch<string>("/api/admin/ops/system-config/legal-documents", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateLegalDocument(id: string, cmd: {
  title?: string;
  version?: string;
  content?: string;
}): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/system-config/legal-documents/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function deleteLegalDocument(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/system-config/legal-documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function publishLegalDocument(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/system-config/legal-documents/${encodeURIComponent(id)}/publish`, { method: "POST" });
}

export async function getWatermarkSettings(): Promise<WatermarkSettings> {
  return apiFetch<WatermarkSettings>("/api/admin/ops/system-config/watermark", { method: "GET" });
}

export async function updateWatermarkSettings(cmd: {
  mode: string;
  lightAsset?: string | null;
  darkAlgorithm?: string | null;
  darkKeyVersion?: string | null;
  darkPayloadTemplate?: string | null;
}): Promise<boolean> {
  return apiFetch<boolean>("/api/admin/ops/system-config/watermark", { method: "PUT", body: JSON.stringify(cmd) });
}

export async function getPublicPrivacyPolicy(): Promise<LegalDocumentPublic> {
  return apiFetch<LegalDocumentPublic>("/api/admin/open/legal/privacy-policy", { method: "GET", withAuth: false });
}

export async function getPublicUserAgreement(): Promise<LegalDocumentPublic> {
  return apiFetch<LegalDocumentPublic>("/api/admin/open/legal/user-agreement", { method: "GET", withAuth: false });
}

export async function getPublicWatermarkSettings(): Promise<WatermarkSettings> {
  return apiFetch<WatermarkSettings>("/api/admin/open/watermark", { method: "GET", withAuth: false });
}

export type DarkWatermarkVerifyResult = {
  detected: boolean;
  signatureValid: boolean;
  algorithm: string | null;
  payloadSummary: string | null;
  protocolVersion: string | null;
  keyVersion: string | null;
  failureReason: string | null;
};

export async function verifyDarkWatermark(params: {
  file?: File | null;
  imageUrl?: string | null;
}): Promise<DarkWatermarkVerifyResult> {
  const form = new FormData();
  if (params.file) form.set("file", params.file);
  if (params.imageUrl) form.set("imageUrl", params.imageUrl);
  return apiFetch<DarkWatermarkVerifyResult>("/api/admin/ops/system-config/watermark/dark/verify", {
    method: "POST",
    body: form,
  });
}

export type LoginProviderConfig = {
  providerCode: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  configJson: string | null;
  hasSecret: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export async function listLoginProviders(): Promise<LoginProviderConfig[]> {
  return apiFetch<LoginProviderConfig[]>("/api/admin/ops/system-config/login-providers", { method: "GET" });
}

export async function setLoginProviderEnabled(providerCode: string, enabled: boolean): Promise<boolean> {
  const qs = new URLSearchParams({ enabled: String(enabled) });
  return apiFetch<boolean>(
    `/api/admin/ops/system-config/login-providers/${encodeURIComponent(providerCode)}/enabled?${qs.toString()}`,
    { method: "POST" }
  );
}

export async function setLoginProviderDefault(providerCode: string): Promise<boolean> {
  return apiFetch<boolean>(
    `/api/admin/ops/system-config/login-providers/${encodeURIComponent(providerCode)}/default`,
    { method: "POST" }
  );
}

export async function updateLoginProviderConfig(
  providerCode: string,
  cmd: { configJson: string; secretEnc?: string; clearSecret?: boolean }
): Promise<boolean> {
  return apiFetch<boolean>(
    `/api/admin/ops/system-config/login-providers/${encodeURIComponent(providerCode)}/config`,
    { method: "PUT", body: JSON.stringify(cmd) }
  );
}
