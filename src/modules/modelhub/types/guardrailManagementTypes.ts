import type {
  ModelHubGuardrailAction,
  ModelHubGuardrailRiskLevel,
  ModelHubGuardrailStatus,
} from "@/shared/api/model-hub/model-hub";

export type GuardrailRiskLevel = ModelHubGuardrailRiskLevel;
export type GuardrailStatus = ModelHubGuardrailStatus;
export type GuardrailAction = ModelHubGuardrailAction;
export type GuardrailBaselineSelectValue = "false" | "true";

export type GuardrailRuleDetail = {
  id: string;
  name: string;
  riskLevel: GuardrailRiskLevel;
  status: GuardrailStatus;
  isSystemBaseline: boolean;
  matchItems: string[];
  action: GuardrailAction;
  referenceCount: number;
};

export type GuardrailReferenceSummary = {
  explicitCount: number;
  explicitBindings: string[];
  fallbackCount: number;
  fallbackBindings: string[];
};

export type GuardrailListItem = {
  id: string;
  name: string;
  riskLevel: GuardrailRiskLevel;
  riskLabel: string;
  matchSummary: string;
  actionLabel: string;
  action: GuardrailAction;
  status: GuardrailStatus;
  statusLabel: string;
  isSystemBaseline: boolean;
  referenceCount: number;
  hitCount24h: number;
  updatedAt: string | null;
  updatedAtLabel: string;
  referenceSummary: GuardrailReferenceSummary;
};

export const GUARDRAIL_RISK_LABEL: Record<GuardrailRiskLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

export const GUARDRAIL_RISK_OPTIONS: Array<{ value: GuardrailRiskLevel; label: string }> = [
  { value: "high", label: GUARDRAIL_RISK_LABEL.high },
  { value: "medium", label: GUARDRAIL_RISK_LABEL.medium },
  { value: "low", label: GUARDRAIL_RISK_LABEL.low },
];

export const GUARDRAIL_STATUS_LABEL: Record<GuardrailStatus, string> = {
  draft: "草稿",
  enabled: "启用",
  disabled: "停用",
};

export const GUARDRAIL_STATUS_OPTIONS: Array<{ value: GuardrailStatus; label: string }> = [
  { value: "draft", label: GUARDRAIL_STATUS_LABEL.draft },
  { value: "enabled", label: GUARDRAIL_STATUS_LABEL.enabled },
  { value: "disabled", label: GUARDRAIL_STATUS_LABEL.disabled },
];

export const GUARDRAIL_BASELINE_OPTIONS: Array<{ value: GuardrailBaselineSelectValue; label: string }> = [
  { value: "false", label: "否" },
  { value: "true", label: "是" },
];

export const GUARDRAIL_ACTION_OPTIONS: Array<{ value: GuardrailAction; label: string }> = [
  { value: "block", label: "拦截" },
  { value: "review", label: "人工复核" },
  { value: "alert", label: "仅告警" },
];

export const GUARDRAIL_ACTION_LABEL: Record<GuardrailAction, string> = {
  block: "拦截",
  review: "人工复核",
  alert: "仅告警",
};
