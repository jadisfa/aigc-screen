import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type ScopeLevel = "global" | "merchant" | "store" | string;

export type TicketAttachment = {
  fileId?: string | null;
  name: string;
  url: string;
  mimeType?: string | null;
  size?: number | null;
  fileHash?: string | null;
};

export type TicketOption = {
  value: string;
  label: string;
};

export type TicketDictionaryResponse = {
  ticketTypes: TicketOption[];
  ticketStatuses: TicketOption[];
  priorities: TicketOption[];
  ticketSources: TicketOption[];
};

export type TicketSummary = {
  id: string;
  source: string;
  customerId?: string | null;
  customerName?: string | null;
  storeId?: string | null;
  merchantId?: string | null;
  ticketType: string;
  ticketStatus: string;
  priority: string;
  title: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  replyCount: number;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type TicketDetailApiRow = {
  id: string;
  scopeLevel?: ScopeLevel | null;
  source: string;
  customerId?: string | null;
  storeId?: string | null;
  merchantId?: string | null;
  ticketType: string;
  ticketStatus: string;
  priority: string;
  title: string;
  description: string;
  attachments: TicketAttachment[];
  assigneeId?: string | null;
  replyCount: number;
  createdBy: string;
  updatedBy: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketDetail = TicketDetailApiRow & {
  scopeLevel: ScopeLevel;
  scopeTenantId: string | null;
};

export type TicketReply = {
  id: string;
  ticketId: string;
  replyContent: string;
  attachments: TicketAttachment[];
  replierId: string;
  replierAvatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListTicketsParams = {
  ticketId?: string;
  customerId?: string;
  storeId?: string;
  merchantId?: string;
  ticketType?: string;
  ticketStatus?: string;
  priority?: string;
  assigneeId?: string;
  keyword?: string;
  createdStart?: string;
  createdEnd?: string;
  pageNo: number;
  pageSize: number;
  total?: number;
};

export type TicketMutationPayload = {
  customerId?: string | null;
  storeId?: string | null;
  merchantId?: string | null;
  ticketType: string;
  priority: string;
  title: string;
  description: string;
  attachments?: TicketAttachment[];
  assigneeId?: string | null;
};

export type AddTicketReplyPayload = {
  replyContent: string;
  attachments?: TicketAttachment[];
};

export type TicketAssignPayload = {
  ticketIds: string[];
  assigneeId?: string | null;
  remark?: string | null;
};

export type TicketAssignItemResult = {
  ticketId?: string | null;
  success: boolean;
  message?: string | null;
};

export type BatchAssignResult = {
  successCount: number;
  failureCount: number;
  items: TicketAssignItemResult[];
};

export type TicketNotificationTemplate = {
  enabled: boolean;
  stageSettings: {
    newEnabled: boolean;
    progressEnabled: boolean;
    doneEnabled: boolean;
  };
  templateCodes: {
    newTemplateCode: string;
    progressTemplateCode: string;
    doneTemplateCode: string;
  };
  variableMappings: Array<{
    targetKey: string;
    sourceKey: string;
  }>;
};

export type TicketDisposalCandidatePrincipal = {
  principalId: string;
  displayName?: string | null;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
};

type TicketDisposalConfigApiRow = {
  autoAssignEnabled: boolean;
  autoAssignScope: string[];
  autoAssignTargetType?: string | null;
  autoAssignTargetId?: string | null;
  autoAssignTargetName?: string | null;
  autoAssignCandidateMode?: string | null;
  autoAssignMerchantId?: string | null;
  autoAssignPrincipalIds?: string[];
  slaHours: number;
  smsTemplate: TicketNotificationTemplate;
  emailTemplate: TicketNotificationTemplate;
  inboxTemplate: TicketNotificationTemplate;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export type TicketDisposalConfig = Omit<TicketDisposalConfigApiRow, "autoAssignTargetId" | "autoAssignMerchantId" | "autoAssignCandidateMode"> & {
  autoAssignScopeLevel?: "merchant" | null;
  autoAssignTargetMerchantId?: string | null;
  autoAssignCandidateMode?: "MERCHANT_ALL" | "PRINCIPAL_LIST" | null;
};

export type TicketDisposalDictionaryResponse = {
  templateStages: TicketOption[];
  templateCodes: TicketOption[];
  sourceVariables: TicketOption[];
};

export const OPS_TICKET_DELETE_CONFIRM_TEXT = "DELETE";

function normalizeTicketScopeLevel(input: ScopeLevel | null | undefined, merchantId: string | null | undefined, storeId: string | null | undefined): ScopeLevel {
  const normalized = (input || "").trim().toLowerCase();
  if (normalized === "global" || normalized === "merchant" || normalized === "store") {
    return normalized;
  }
  if (storeId) return "store";
  if (merchantId) return "merchant";
  return "global";
}

function normalizeTicketDetail(row: TicketDetailApiRow): TicketDetail {
  const scopeLevel = normalizeTicketScopeLevel(row.scopeLevel, row.merchantId, row.storeId);
  const scopeTenantId =
    scopeLevel === "store"
      ? row.storeId ?? null
      : scopeLevel === "merchant"
        ? row.merchantId ?? null
        : null;
  return {
    ...row,
    scopeLevel,
    scopeTenantId,
  };
}

function normalizeTicketDisposalCandidateMode(
  rawMode: string | null | undefined,
  enabled: boolean,
  principalIds?: string[] | null,
): TicketDisposalConfig["autoAssignCandidateMode"] {
  if (!enabled) return null;
  const normalized = (rawMode || "").trim();
  if (normalized === "PRINCIPAL_LIST" || normalized === "principalIds") {
    return "PRINCIPAL_LIST";
  }
  if (normalized === "MERCHANT_ALL" || normalized === "merchant") {
    return "MERCHANT_ALL";
  }
  if (Array.isArray(principalIds) && principalIds.some((id) => Boolean(id))) {
    return "PRINCIPAL_LIST";
  }
  return "MERCHANT_ALL";
}

function toBackendTicketDisposalCandidateMode(mode: TicketDisposalConfig["autoAssignCandidateMode"]): string | null {
  if (mode === "PRINCIPAL_LIST") return "principalIds";
  if (mode === "MERCHANT_ALL") return "merchant";
  return null;
}

function normalizeTicketDisposalConfig(row: TicketDisposalConfigApiRow): TicketDisposalConfig {
  const autoAssignEnabled = Boolean(row.autoAssignEnabled);
  return {
    ...row,
    autoAssignScopeLevel: (row.autoAssignScope ?? []).includes("merchant") ? "merchant" : null,
    autoAssignTargetMerchantId: row.autoAssignMerchantId ?? row.autoAssignTargetId ?? null,
    autoAssignCandidateMode: normalizeTicketDisposalCandidateMode(
      row.autoAssignCandidateMode,
      autoAssignEnabled,
      row.autoAssignPrincipalIds,
    ),
  };
}

function toLegacyTicketDisposalConfigPayload(payload: TicketDisposalConfig): TicketDisposalConfigApiRow {
  const autoAssignEnabled = Boolean(payload.autoAssignEnabled);
  const mode = normalizeTicketDisposalCandidateMode(
    payload.autoAssignCandidateMode,
    autoAssignEnabled,
    payload.autoAssignPrincipalIds,
  );
  const autoAssignTargetMerchantId =
    autoAssignEnabled && mode === "MERCHANT_ALL" ? payload.autoAssignTargetMerchantId ?? null : null;
  const autoAssignPrincipalIds =
    autoAssignEnabled && mode === "PRINCIPAL_LIST"
      ? (payload.autoAssignPrincipalIds ?? []).filter(Boolean)
      : [];
  return {
    ...payload,
    autoAssignEnabled,
    autoAssignScope: autoAssignEnabled && payload.autoAssignScopeLevel ? [payload.autoAssignScopeLevel] : [],
    autoAssignTargetType: autoAssignEnabled && payload.autoAssignScopeLevel ? payload.autoAssignScopeLevel : null,
    autoAssignTargetId: autoAssignTargetMerchantId,
    autoAssignMerchantId: autoAssignTargetMerchantId,
    autoAssignCandidateMode: autoAssignEnabled ? toBackendTicketDisposalCandidateMode(mode) : null,
    autoAssignPrincipalIds,
    autoAssignTargetName: autoAssignEnabled && mode === "MERCHANT_ALL" ? payload.autoAssignTargetName ?? null : null,
  };
}

export async function listTicketDictionaries(): Promise<TicketDictionaryResponse> {
  return apiFetch<TicketDictionaryResponse>("/api/admin/ops/tickets/dictionaries", { method: "GET" });
}

export async function listTickets(params: ListTicketsParams): Promise<{ page: PageResult; items: TicketSummary[] }> {
  const qs = buildPageSearchParams(params);

  if (params.ticketId) qs.set("ticketId", params.ticketId);
  if (params.customerId) qs.set("customerId", params.customerId);
  if (params.storeId) qs.set("storeId", params.storeId);
  if (params.merchantId) qs.set("merchantId", params.merchantId);
  if (params.ticketType) qs.set("ticketType", params.ticketType);
  if (params.ticketStatus) qs.set("ticketStatus", params.ticketStatus);
  if (params.priority) qs.set("priority", params.priority);
  if (params.assigneeId) qs.set("assigneeId", params.assigneeId);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.createdStart) qs.set("createdStart", params.createdStart);
  if (params.createdEnd) qs.set("createdEnd", params.createdEnd);

  return apiFetch<{ page: PageResult; items: TicketSummary[] }>(`/api/admin/ops/tickets?${qs.toString()}`, {
    method: "GET",
  });
}

export async function getTicket(ticketId: string): Promise<TicketDetail> {
  const data = await apiFetch<TicketDetailApiRow>(`/api/admin/ops/tickets/${encodeURIComponent(ticketId)}`, { method: "GET" });
  return normalizeTicketDetail(data);
}

export async function listTicketReplies(ticketId: string): Promise<TicketReply[]> {
  return apiFetch<TicketReply[]>(`/api/admin/ops/tickets/${encodeURIComponent(ticketId)}/replies`, { method: "GET" });
}

export async function createTicket(payload: TicketMutationPayload): Promise<{ ticketId: string }> {
  return apiFetch<{ ticketId: string }>("/api/admin/ops/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTicket(ticketId: string, payload: TicketMutationPayload): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function closeTicket(ticketId: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/ops/tickets/${encodeURIComponent(ticketId)}/close`, {
    method: "POST",
  });
}

export async function deleteTicket(ticketId: string, confirmText: string): Promise<boolean> {
  const qs = new URLSearchParams({ confirmText });
  return apiFetch<boolean>(`/api/admin/ops/tickets/${encodeURIComponent(ticketId)}?${qs.toString()}`, {
    method: "DELETE",
  });
}

export async function addTicketReply(ticketId: string, payload: AddTicketReplyPayload): Promise<{ replyId: string }> {
  return apiFetch<{ replyId: string }>(`/api/admin/ops/tickets/${encodeURIComponent(ticketId)}/replies`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function assignTickets(payload: TicketAssignPayload): Promise<BatchAssignResult> {
  return apiFetch<BatchAssignResult>("/api/admin/ops/tickets/assignment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTicketDisposalConfig(): Promise<TicketDisposalConfig> {
  const data = await apiFetch<TicketDisposalConfigApiRow>("/api/admin/ops/tickets/disposal-config", {
    method: "GET",
  });
  return normalizeTicketDisposalConfig(data);
}

export async function getTicketDisposalDictionaries(): Promise<TicketDisposalDictionaryResponse> {
  return apiFetch<TicketDisposalDictionaryResponse>("/api/admin/ops/tickets/disposal-config/dictionaries", {
    method: "GET",
  });
}

export async function updateTicketDisposalConfig(payload: TicketDisposalConfig): Promise<boolean> {
  return apiFetch<boolean>("/api/admin/ops/tickets/disposal-config", {
    method: "PUT",
    body: JSON.stringify(toLegacyTicketDisposalConfigPayload(payload)),
  });
}

export async function listTicketDisposalCandidatePrincipals(params: {
  autoAssignScope?: string;
  autoAssignTargetType?: string;
  autoAssignTargetId?: string;
  autoAssignCandidateMode?: string;
  autoAssignMerchantId?: string;
  autoAssignPrincipalIds?: string[];
  limit?: number;
}): Promise<TicketDisposalCandidatePrincipal[]> {
  const qs = new URLSearchParams();
  if (params.autoAssignScope) qs.set("autoAssignScope", params.autoAssignScope);
  if (params.autoAssignTargetType) qs.set("autoAssignTargetType", params.autoAssignTargetType);
  if (params.autoAssignTargetId) qs.set("autoAssignTargetId", params.autoAssignTargetId);
  if (params.autoAssignCandidateMode) qs.set("autoAssignCandidateMode", params.autoAssignCandidateMode);
  if (params.autoAssignMerchantId) qs.set("autoAssignMerchantId", params.autoAssignMerchantId);
  (params.autoAssignPrincipalIds ?? []).forEach((id) => {
    if (id) qs.append("autoAssignPrincipalIds", id);
  });
  if (params.limit) qs.set("limit", String(params.limit));
  return apiFetch<TicketDisposalCandidatePrincipal[]>(`/api/admin/ops/tickets/disposal-config/candidate-principals?${qs.toString()}`, {
    method: "GET",
  });
}

export async function deleteTicketReply(ticketId: string, replyId: string, confirmText: string): Promise<boolean> {
  const qs = new URLSearchParams({ confirmText });
  return apiFetch<boolean>(
    `/api/admin/ops/tickets/${encodeURIComponent(ticketId)}/replies/${encodeURIComponent(replyId)}?${qs.toString()}`,
    {
      method: "DELETE",
    }
  );
}
