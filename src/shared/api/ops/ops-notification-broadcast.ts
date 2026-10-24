import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type BroadcastAudienceType = "ALL" | "MERCHANT" | "STORE" | "USERS";

export type BroadcastJob = {
  id: string;
  audienceType: string;
  audienceJson?: string | null;
  channels: string[];
  subject?: string | null;
  content?: string | null;
  smsTemplateCode?: string | null;
  smsRegion?: string | null;
  smsVariables?: Record<string, string> | null;
  emailTemplateCode?: string | null;
  emailRegion?: string | null;
  emailVariables?: Record<string, string> | null;
  status: string;
  totalRecipients: number;
  inboxQueued: number;
  inboxSent: number;
  inboxFailed: number;
  smsQueued: number;
  smsSent: number;
  smsFailed: number;
  emailQueued: number;
  emailSent: number;
  emailFailed: number;
  createdBy?: string | null;
  scopeLevel?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  finishedAt?: string | null;
};

export type BroadcastPreviewResult = {
  estimatedCount: number;
  missingPhoneCount: number;
  missingEmailCount: number;
};

export type CreateBroadcastCommand = {
  audienceType: BroadcastAudienceType;
  merchantIds?: string[];
  storeIds?: string[];
  principalIds?: string[];
  channels: string[];
  subject?: string;
  content?: string;
  smsTemplateCode?: string;
  smsRegion?: string;
  smsVariables?: Record<string, string>;
  emailTemplateCode?: string;
  emailRegion?: string;
  emailVariables?: Record<string, string>;
};

export const opsBroadcastQueryKeys = {
  all: ["ops", "broadcasts"] as const,
  list: (scopeKey: string, params: Record<string, unknown>) => [...opsBroadcastQueryKeys.all, "list", scopeKey, params] as const,
  detail: (scopeKey: string, jobId: string) => [...opsBroadcastQueryKeys.all, "detail", scopeKey, jobId] as const,
};

export async function previewNotificationBroadcast(cmd: CreateBroadcastCommand): Promise<BroadcastPreviewResult> {
  return apiFetch<BroadcastPreviewResult>("/api/admin/ops/notifications/broadcasts/preview", {
    method: "POST",
    body: JSON.stringify(cmd),
  });
}

export async function createNotificationBroadcast(cmd: CreateBroadcastCommand): Promise<BroadcastJob> {
  return apiFetch<BroadcastJob>("/api/admin/ops/notifications/broadcasts", {
    method: "POST",
    body: JSON.stringify(cmd),
  });
}

export async function listNotificationBroadcasts(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
}): Promise<{ page: PageResult; items: BroadcastJob[] }> {
  const qs = buildPageSearchParams(params);
  return apiFetch<{ page: PageResult; items: BroadcastJob[] }>(`/api/admin/ops/notifications/broadcasts?${qs.toString()}`, {
    method: "GET",
  });
}

export async function getNotificationBroadcast(jobId: string): Promise<BroadcastJob> {
  return apiFetch<BroadcastJob>(`/api/admin/ops/notifications/broadcasts/${encodeURIComponent(jobId)}`, { method: "GET" });
}

export type BroadcastMessageTemplate = {
  id: string;
  templateCode: string;
  templateName: string;
  templateType?: string;
  region?: string;
  content?: string | null;
  variablesJson?: string | string[] | null;
  variables?: string[] | null;
};

/** @deprecated 使用 BroadcastMessageTemplate */
export type BroadcastSmsTemplate = BroadcastMessageTemplate;

/** 群发专用短信模板列表（仅需 ops.notification.broadcast）。 */
export async function listBroadcastSmsTemplates(params: {
  region?: string;
  pageNo?: number;
  pageSize?: number;
  total?: number;
}): Promise<{ page: PageResult; items: BroadcastMessageTemplate[] }> {
  const qs = buildPageSearchParams({
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 100,
    total: params.total,
  });
  if (params.region) qs.set("region", params.region);
  return apiFetch<{ page: PageResult; items: BroadcastMessageTemplate[] }>(
    `/api/admin/ops/notifications/broadcasts/sms-templates?${qs.toString()}`,
    { method: "GET" },
  );
}

/** 群发专用邮件模板列表（仅需 ops.notification.broadcast）。 */
export async function listBroadcastEmailTemplates(params: {
  region?: string;
  pageNo?: number;
  pageSize?: number;
  total?: number;
}): Promise<{ page: PageResult; items: BroadcastMessageTemplate[] }> {
  const qs = buildPageSearchParams({
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 100,
    total: params.total,
  });
  if (params.region) qs.set("region", params.region);
  return apiFetch<{ page: PageResult; items: BroadcastMessageTemplate[] }>(
    `/api/admin/ops/notifications/broadcasts/email-templates?${qs.toString()}`,
    { method: "GET" },
  );
}
