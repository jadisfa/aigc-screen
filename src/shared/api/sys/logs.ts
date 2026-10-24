import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type AuditLog = {
  auditId: string;
  operationType: string;
  operationTypeLabel: string;
  principalId?: string | null;
  operator: string;
  operatorNickname?: string | null;
  operatorAvatarUrl?: string | null;
  source: string;
  sourceLabel: string;
  sourceIp?: string | null;
  traceId?: string | null;
  requestUrl: string;
  requestAt: string;
  requestDurationMs?: number | null;
};

export type AuditLogOption = {
  value: string;
  label: string;
};

export type ListAuditsParams = {
  principalId?: string;
  operationType?: string;
  source?: string;
  requestStart?: string;
  requestEnd?: string;
  keyword?: string;
  pageNo: number;
  pageSize: number;
  total?: number;
};

export const AUDIT_OPERATION_OPTIONS: AuditLogOption[] = [
  { value: "create", label: "新增" },
  { value: "update", label: "修改" },
  { value: "delete", label: "删除" },
];

export const AUDIT_SOURCE_OPTIONS: AuditLogOption[] = [
  { value: "ai_admin", label: "AI中台" },
  { value: "ai_portal", label: "AI应用门户" },
  { value: "store_ops", label: "门店运营系统" },
  { value: "store_screen", label: "门店电子屏" },
];

const AUDIT_SOURCE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  AUDIT_SOURCE_OPTIONS.map((option) => [option.value, option.label]),
);

export function getAuditSourceLabel(source: string): string {
  return AUDIT_SOURCE_LABEL_MAP[source] ?? source;
}

export async function listAudits(params: ListAuditsParams): Promise<{ page: PageResult; items: AuditLog[] }> {
  const qs = buildPageSearchParams(params);
  if (params.principalId) qs.set("principalId", params.principalId);
  if (params.operationType) qs.set("operationType", params.operationType);
  if (params.source) qs.set("source", params.source);
  if (params.requestStart) qs.set("requestStart", params.requestStart);
  if (params.requestEnd) qs.set("requestEnd", params.requestEnd);
  if (params.keyword) qs.set("keyword", params.keyword);
  return apiFetch<{ page: PageResult; items: AuditLog[] }>(`/api/admin/ops/audits?${qs.toString()}`, { method: "GET" });
}
