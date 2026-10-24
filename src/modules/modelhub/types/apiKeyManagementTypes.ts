import type {
  ModelHubApiKey,
  ModelHubApiKeyBindingType,
  ModelHubApiKeyEditorOptions,
  ModelHubApiKeyGuardrailSummary,
  ModelHubApiKeyRoutingProfileSummary,
  ModelHubApiKeySecret,
  RotateModelHubApiKeyCommand,
  UpsertModelHubApiKeyCommand,
} from "@/shared/api/model-hub/model-hub";

export type ApiKeyBindingType = ModelHubApiKeyBindingType;
export type ApiKeyStatus = ModelHubApiKey["status"];
export type ApiKeyRoutingProfileSummary = ModelHubApiKeyRoutingProfileSummary;
export type ApiKeyGuardrailSummary = ModelHubApiKeyGuardrailSummary;
export type ApiKeyListItem = ModelHubApiKey;
export type ApiKeyEditorOptions = ModelHubApiKeyEditorOptions;
export type ApiKeySecret = ModelHubApiKeySecret;

export type ApiKeyScopeSelection = {
  merchantId?: string | null;
  merchantName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  principalId?: string | null;
  principalName?: string | null;
};

/** 列表用分行；编辑页可 join 成一行。 */
export function buildScopeSummaryLines(item: ApiKeyScopeSelection): string[] {
  const lines: string[] = [];
  const merchantId = item.merchantId?.trim();
  const storeId = item.storeId?.trim();
  const principalId = item.principalId?.trim();
  if (merchantId) {
    lines.push(`商户 ${item.merchantName?.trim() || merchantId}`);
  }
  if (storeId) {
    lines.push(`门店 ${item.storeName?.trim() || storeId}`);
  }
  if (principalId) {
    lines.push(`主体 ${item.principalName?.trim() || principalId}`);
  }
  return lines;
}

export function formatScopeSummary(item: ApiKeyScopeSelection, emptyLabel = "未设置"): string {
  const lines = buildScopeSummaryLines(item);
  return lines.length > 0 ? lines.join(" / ") : emptyLabel;
}

export type ApiKeyUpsertPayload = UpsertModelHubApiKeyCommand;
export type RotateApiKeyPayload = RotateModelHubApiKeyCommand;

export const API_KEY_BINDING_LABEL: Record<ApiKeyBindingType, string> = {
  platform: "平台",
  merchant: "商户",
  store: "门店",
  user: "用户",
};

export const API_KEY_STATUS_META: Record<ApiKeyStatus, {
  label: string;
  badgeVariant: "secondary" | "outline" | "destructive";
}> = {
  active: {
    label: "生效中",
    badgeVariant: "secondary",
  },
  disabled: {
    label: "已停用",
    badgeVariant: "outline",
  },
  revoked: {
    label: "已撤销",
    badgeVariant: "destructive",
  },
  expired: {
    label: "已过期",
    badgeVariant: "outline",
  },
};

export function getApiKeyStatusMeta(status: ApiKeyStatus) {
  return API_KEY_STATUS_META[status];
}

export function formatApiKeyDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}
