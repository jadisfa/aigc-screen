import type {
  GuardrailAction,
  GuardrailReferenceSummary,
  GuardrailListItem,
  GuardrailRiskLevel,
  GuardrailStatus,
} from "@/modules/modelhub/types/guardrailManagementTypes";

export function normalizeGuardrailMatchItems(matchItems: string[]) {
  return matchItems.map((item) => item.trim()).filter(Boolean);
}

export function buildGuardrailImpactBadges(input: {
  isSystemBaseline: boolean;
  referenceCount: number;
}) {
  return [
    input.isSystemBaseline ? "系统默认基线" : null,
    input.referenceCount > 0 ? "已被引用" : "尚未引用",
  ].filter(Boolean) as string[];
}

export function buildGuardrailImpactDescriptions(input: {
  isSystemBaseline: boolean;
  referenceCount: number;
}) {
  return [
    input.isSystemBaseline
      ? "当前规则为系统默认安全基线，未单独配置安全规则的 API Key 将默认使用该规则。"
      : null,
    input.referenceCount > 0
      ? `当前规则已被 ${input.referenceCount} 个 API Key 使用，保存后将影响其后续请求。`
      : "当前规则尚未被任何 API Key 使用，可以先按草稿继续完善。",
  ].filter(Boolean) as string[];
}

export function buildGuardrailValidationIssues(input: {
  name: string;
  normalizedMatchItems: string[];
  action: GuardrailAction;
  isSystemBaseline: boolean;
  status: GuardrailStatus;
}) {
  return [
    !input.name.trim() ? "规则名称不能为空。" : null,
    input.normalizedMatchItems.length === 0 ? "匹配项至少保留一条有效关键词。" : null,
    !input.action ? "处置动作不能为空。" : null,
    input.isSystemBaseline && input.status !== "enabled" ? "系统默认基线必须保持启用。" : null,
  ].filter(Boolean) as string[];
}

export function buildGuardrailSummaryCards(items: GuardrailListItem[]) {
  const totalCount = items.length;
  const enabledCount = items.filter((item) => item.status === "enabled").length;
  const highRiskCount = items.filter((item) => item.riskLevel === "high").length;
  const hitCount24h = items.reduce((sum, item) => sum + item.hitCount24h, 0);

  return [
    { value: totalCount, label: "规则总数", hint: "当前配置数量", badge: "GD", badgeClassName: "bg-violet-50 text-violet-600" },
    { value: enabledCount, label: "启用规则", hint: "参与预检查看", badge: "ON", badgeClassName: "bg-emerald-50 text-emerald-600" },
    { value: highRiskCount, label: "高危规则", hint: "critical 风险", badge: "CR", badgeClassName: "bg-rose-50 text-rose-500" },
    { value: hitCount24h, label: "命中事件", hint: "来自调用事实", badge: "HT", badgeClassName: "bg-amber-50 text-amber-500" },
  ];
}

export function filterGuardrailItems(items: GuardrailListItem[], input: {
  keyword: string;
  risk: "all" | GuardrailRiskLevel;
}) {
  return items.filter((item) => {
    const normalizedKeyword = input.keyword.trim();
    const matchesKeyword = normalizedKeyword.length === 0 || item.name.includes(normalizedKeyword);
    const matchesRisk = input.risk === "all" || item.riskLevel === input.risk;
    return matchesKeyword && matchesRisk;
  });
}

export function buildGuardrailReferenceDescriptions(referenceSummary: GuardrailReferenceSummary) {
  const lines: string[] = [];

  if (referenceSummary.explicitCount > 0) {
    const explicitExamples =
      referenceSummary.explicitBindings.length > 0 ? `，例如 ${referenceSummary.explicitBindings.join(" / ")}` : "";
    lines.push(`显式挂载：当前有 ${referenceSummary.explicitCount} 个 API Key 直接挂载该规则${explicitExamples}。`);
  } else {
    lines.push("显式挂载：当前没有 API Key 直接挂载该规则。");
  }

  if (referenceSummary.fallbackCount > 0) {
    const fallbackExamples =
      referenceSummary.fallbackBindings.length > 0 ? `，主要来自 ${referenceSummary.fallbackBindings.join(" / ")}` : "";
    lines.push(`默认回落：当前有 ${referenceSummary.fallbackCount} 个 API Key 通过系统默认基线回落到该规则${fallbackExamples}。`);
  } else {
    lines.push("默认回落：当前没有 API Key 通过系统默认基线回落到该规则。");
  }

  return lines;
}
