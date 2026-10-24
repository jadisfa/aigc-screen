import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/shared/ui/hover-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";
import { toChineseBusinessLabel } from "../types/capabilityDisplayText";
import { getCapabilityPlugin } from "../types/capabilityRegistryFactory";
import { getCapabilityPricingProjection } from "../types/pricingProjection";
import {
  buildPricingUnitHint,
  getBillingUnitKindLabel,
  getCapabilityBillingUnitKinds,
  getDefaultUnitForKind,
  getPricingUnitOptionsForContext,
  getSuggestedBasePriceStep,
  resolveCapabilityUnitKind,
  type PricingUnitKind,
} from "../types/pricingUnit";
import {
  getBillingMetricAllowedOperators,
  getBillingMetricDisplayLabel,
  normalizeBillingMetricId,
  getBillingMetricPlaceholder,
  isNumericBillingMetric,
  resolveBillingMetricDefinition,
} from "../types/billingMetricRegistry";
import type {
  BillingRuleOperator,
  BillingRuleValue,
  ModelCapabilityCode,
  ModelCapabilityConfig,
  CapabilityPricingTemplate,
  CapabilityPricing,
  CapabilityPricingRateCardRow,
  CapabilityPricingRule,
  CapabilityPricingProjectionReadonlyBoundary,
  CapabilityPricingSimulatorFieldDefinition,
  CapabilityPricingSimulationResult,
} from "../types/modelCapabilityMetadata";
import type { CapabilityMatchedSceneTemplate } from "../types/capabilityRegistryFactory";
import {
  hydrateVideoRateCard,
  roundVideoUnitPrice,
  syncVideoRateCardBasePrice,
} from "../types/videoRateCard";

export const BILLING_CURRENCY_OPTIONS = ["CNY", "USD"];
const RULE_OPERATOR_LABELS: Record<BillingRuleOperator, string> = {
  eq: "等于",
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
  in: "属于",
  range: "区间",
};

function getStringArrayValues(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function buildRuleConditionOptions(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).map((value) => ({
    label: value,
    value,
  }));
}

function getRuleValueOptions(
  metric: string,
  config: ModelCapabilityConfig,
  simulatorFields: CapabilityPricingSimulatorFieldDefinition[],
) {
  const definition = resolveBillingMetricDefinition(metric);
  if (!definition) return [];

  const simulatorFieldKeys = definition.simulatorFieldKeys || [definition.id];
  const matchedField = simulatorFields.find((field) =>
    simulatorFieldKeys.some((alias) => normalizeBillingMetricId(field.key) === normalizeBillingMetricId(alias)),
  );
  if (matchedField?.type === "select" && matchedField.options?.length) {
    return matchedField.options.map((option) => ({
      label: option.label,
      value: option.value,
    }));
  }

  if (definition.boundaryFieldKeys?.length) {
    return buildRuleConditionOptions(
      definition.boundaryFieldKeys.flatMap((fieldKey) => getStringArrayValues(config.boundary[fieldKey])),
    );
  }

  return [];
}

function getRuleValuePlaceholder(metric: string, fallback: string) {
  return getBillingMetricPlaceholder(metric, fallback);
}

function parseNumericInput(value: string, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function formatPricingAmount(value: number, maxFractionDigits = 8) {
  const normalized = Number(value || 0);
  if (Number.isInteger(normalized)) return String(normalized);
  return normalized.toFixed(maxFractionDigits).replace(/0+$/g, "").replace(/\.$/, "");
}

function getRuleMetric(rule: CapabilityPricingRule) {
  return String(rule.metric || "").trim();
}

function getRuleOperator(rule: CapabilityPricingRule) {
  return rule.operator;
}

function formatRuleValueForInput(value: BillingRuleValue | undefined) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value && typeof value === "object") {
    const min = "min" in value && value.min !== undefined ? String(value.min) : "";
    const max = "max" in value && value.max !== undefined ? String(value.max) : "";
    return [min, max].filter(Boolean).join(", ");
  }

  return value === undefined || value === null ? "" : String(value);
}

function formatRuleValueSummary(operator: BillingRuleOperator, value: BillingRuleValue) {
  const normalized = formatRuleValueForInput(value).trim();
  if (!normalized) return "";

  if (operator === "gt") return `>${normalized}`;
  if (operator === "gte") return `>=${normalized}`;
  if (operator === "lt") return `<${normalized}`;
  if (operator === "lte") return `<=${normalized}`;
  if (operator === "in") return normalized;
  if (operator === "range") return normalized;
  return normalized;
}

function formatRuleConditionText(metric: string, operator: BillingRuleOperator, value: BillingRuleValue) {
  const metricLabel = getBillingMetricDisplayLabel(metric || "input_token");
  const valueSummary = formatRuleValueSummary(operator, value);
  if (!valueSummary) {
    return metricLabel;
  }
  return `${metricLabel} ${RULE_OPERATOR_LABELS[operator]} ${valueSummary}`;
}

function formatRuleMultiplierText(multiplier: number | undefined) {
  const normalized = Number(multiplier || 0);
  if (!(normalized > 0)) {
    return "未设置倍率";
  }
  if (normalized === 1) {
    return "命中后按基础单价计费";
  }
  if (normalized > 1) {
    return `命中后按基础单价的 ${formatPricingAmount(normalized)}x 计费`;
  }
  return `命中后按基础单价的 ${formatPricingAmount(normalized)}x 计费`;
}

function normalizeStructuredRuleValue(
  metric: string,
  operator: BillingRuleOperator,
  rawValue: string,
): BillingRuleValue | undefined {
  const normalized = rawValue.trim();
  if (!normalized) return undefined;

  if (operator === "in") {
    return normalized
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (operator === "range") {
    const [minRaw = "", maxRaw = ""] = normalized.split(",").map((item) => item.trim());
    const min = minRaw ? Number(minRaw) : undefined;
    const max = maxRaw ? Number(maxRaw) : undefined;
    return {
      ...(Number.isFinite(min) ? { min } : {}),
      ...(Number.isFinite(max) ? { max } : {}),
    };
  }

  if (isNumericBillingMetric(metric)) {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : normalized;
  }

  return normalized;
}

function buildCompatiblePricingRule(
  rule: CapabilityPricingRule,
  updates: Partial<Omit<CapabilityPricingRule, "id">>,
): CapabilityPricingRule {
  const metric = String(updates.metric ?? rule.metric ?? "").trim();
  const operator = (updates.operator ?? rule.operator ?? "eq") as BillingRuleOperator;
  const value = updates.value ?? rule.value;

  return {
    ...rule,
    ...updates,
    metric,
    operator,
    value,
  };
}

function getRuleOperatorOptions(
  metric: string,
  currentOperator: BillingRuleOperator,
) {
  const operators = [...getBillingMetricAllowedOperators(metric)];

  if (!operators.includes(currentOperator)) {
    operators.push(currentOperator);
  }

  return operators.map((value) => ({
    value,
    label: RULE_OPERATOR_LABELS[value],
  }));
}

export function summarizeBusinessLabels(values: string[], emptyLabel: string, limit = 2) {
  const normalized = Array.from(
    new Set(
      values
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

  if (normalized.length === 0) return emptyLabel;
  if (normalized.length <= limit) return normalized.join("、");
  return `${normalized.slice(0, limit).join("、")} 等 ${normalized.length} 项`;
}

export interface CapabilityStageOnePricingPanelProps {
  activeCapabilityMeta: { code: ModelCapabilityCode; label: string };
  activeCapabilityConfig: ModelCapabilityConfig;
  activeCapabilitySceneTemplates: CapabilityPricingTemplate[];
  activePricingSimulatorFields: CapabilityPricingSimulatorFieldDefinition[];
  activePricingSimulatorInput: Record<string, string | number | boolean>;
  activePricingSimulation: CapabilityPricingSimulationResult | null;
  ruleMetricSuggestions: string[];
  activeMatchedSceneTemplate: CapabilityMatchedSceneTemplate | null;
  hasCustomizedRulePricing: boolean;

  onChangePricing: (pricing: CapabilityPricing) => void;
  onUpdateSimulatorInput: (
    code: ModelCapabilityCode,
    field: CapabilityPricingSimulatorFieldDefinition,
    value: string,
  ) => void;
  onApplySceneTemplate: (code: ModelCapabilityCode, templateId: string) => void;
}

export function CapabilityStageOnePricingPanel(props: CapabilityStageOnePricingPanelProps) {
  const {
    activeCapabilityMeta,
    activeCapabilityConfig,
    activeCapabilitySceneTemplates,
    activePricingSimulatorFields,
    activePricingSimulatorInput,
    activePricingSimulation,
    ruleMetricSuggestions,
    activeMatchedSceneTemplate,
    hasCustomizedRulePricing,
    onChangePricing,
    onUpdateSimulatorInput,
    onApplySceneTemplate,
  } = props;
  const pricingEditorCopy = getCapabilityPlugin(activeCapabilityMeta.code).getPricingEditorCopy() || {};
  const simulationQuantityLabel = pricingEditorCopy.simulationQuantityLabel || activePricingSimulation?.unit || "单位";
  const simulationQuantityUnitLabel = pricingEditorCopy.simulationQuantityUnitLabel || activePricingSimulation?.unit || "单位";
  const simulationBilledQuantity = activePricingSimulation?.billedQuantity ?? activePricingSimulation?.quantity ?? 0;
  const simulationBilledUnitLabel = activePricingSimulation?.billedUnitLabel || simulationQuantityUnitLabel;
  const simulationUsesScaledUnit =
    activePricingSimulation !== null &&
    activePricingSimulation.billedQuantity !== undefined &&
    Math.abs(activePricingSimulation.billedQuantity - activePricingSimulation.quantity) > 1e-9;
  const pricingProjection = getCapabilityPricingProjection(activeCapabilityMeta.code, activeCapabilityConfig.pricing);
  const pricingProjectionBoundary: CapabilityPricingProjectionReadonlyBoundary = pricingProjection;
  const pricingFieldMappingByKey = new Map(
    pricingProjectionBoundary.fieldMappings.map((mapping) => [mapping.key, mapping]),
  );
  const billingUnitKinds = getCapabilityBillingUnitKinds(activeCapabilityMeta.code);
  const currentBillingUnitKind = resolveCapabilityUnitKind(
    activeCapabilityMeta.code,
    activeCapabilityConfig.pricing.unit,
    activeCapabilityConfig.pricing.unitKind,
  );
  const pricingUnitOptions = getPricingUnitOptionsForContext(
    activeCapabilityMeta.code,
    pricingProjection.capabilityType,
    pricingProjection.primaryMeter,
    activeCapabilityConfig.pricing.unit,
    activeCapabilityConfig.pricing.unitKind,
  );
  const usePresetPricingUnit = pricingUnitOptions.length > 0;
  const basePriceStep = getSuggestedBasePriceStep(
    activeCapabilityMeta.code,
    pricingProjection.capabilityType,
    pricingProjection.primaryMeter,
    activeCapabilityConfig.pricing.unit,
  );
  const pricingUnitHint = buildPricingUnitHint(
    activeCapabilityMeta.code,
    pricingProjection.capabilityType,
    pricingProjection.primaryMeter,
    activeCapabilityConfig.pricing.unit,
  );
  const isLegacyBasePriceEditable = pricingFieldMappingByKey.get("basePrice")?.editable ?? true;
  const isLegacyUnitEditable = pricingFieldMappingByKey.get("unit")?.editable ?? true;
  const isLegacyCurrencyEditable = pricingFieldMappingByKey.get("currency")?.editable ?? true;
  const isLegacyRulesEditable = pricingFieldMappingByKey.get("rules")?.editable ?? true;
  const isVideoPricing = activeCapabilityMeta.code === "video_generation";
  const videoRateCardRows = isVideoPricing ? hydrateVideoRateCard(activeCapabilityConfig) : [];
  const [simulationExpanded, setSimulationExpanded] = useState(false);
  const isCustomPricing = Boolean(activeCapabilityConfig.pricing.isCustomized);
  const pricingTemplateStatus = activeMatchedSceneTemplate
    ? hasCustomizedRulePricing
      ? "已微调"
      : "已套用"
    : isCustomPricing
      ? "自定义配置"
      : "待套用";
  const pricingTemplateStatusVariant =
    activeMatchedSceneTemplate && !hasCustomizedRulePricing ? "secondary" : "outline";

  const handleChangeBillingUnitKind = (kind: PricingUnitKind) => {
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      unitKind: kind,
      unit: getDefaultUnitForKind(kind),
    });
  };

  const handleUpdatePricingField = (key: keyof Pick<CapabilityPricing, "basePrice" | "unit" | "currency">, value: string) => {
    if (key === "basePrice" && isVideoPricing) {
      const nextBasePrice = parseNumericInput(value, 0);
      onChangePricing({
        ...activeCapabilityConfig.pricing,
        basePrice: nextBasePrice,
        rateCard: syncVideoRateCardBasePrice(videoRateCardRows, nextBasePrice),
      });
      return;
    }
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      [key]: key === "basePrice" ? parseNumericInput(value, 0) : value,
    });
  };

  const handleUpdateRateCardPrice = (resolution: string, value: string) => {
    if (!isLegacyBasePriceEditable) return;
    const nextPrice = roundVideoUnitPrice(parseNumericInput(value, 0));
    const nextRows: CapabilityPricingRateCardRow[] = videoRateCardRows.map((row) =>
      row.resolution === resolution ? { ...row, unitPrice: nextPrice } : row,
    );
    const defaultRow = nextRows.find((row) => row.isDefault);
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      isCustomized: true,
      rateCard: nextRows,
      basePrice: defaultRow ? defaultRow.unitPrice : activeCapabilityConfig.pricing.basePrice,
    });
  };

  const handleAddPricingRule = () => {
    if (!isLegacyRulesEditable) return;
    const metric = ruleMetricSuggestions[0] || "input_token";
    const newRule: CapabilityPricingRule = {
      id: `rule-${Date.now()}`,
      metric,
      operator: "eq",
      value: "",
      multiplier: 1,
      description: "",
    };
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      rules: [...activeCapabilityConfig.pricing.rules, newRule],
    });
  };

  const handleRemovePricingRule = (ruleId: string) => {
    if (!isLegacyRulesEditable) return;
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      rules: activeCapabilityConfig.pricing.rules.filter((rule) => rule.id !== ruleId),
    });
  };

  const handleUpdatePricingRule = (ruleId: string, key: keyof Omit<CapabilityPricingRule, "id">, value: string) => {
    if (!isLegacyRulesEditable) return;
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      rules: activeCapabilityConfig.pricing.rules.map((rule) =>
        rule.id === ruleId
          ? buildCompatiblePricingRule(rule, {
              [key]: key === "multiplier" ? parseNumericInput(value, 0) : value,
            })
          : rule
      ),
    });
  };

  const handleUpdateRuleMetric = (ruleId: string, metric: string) => {
    if (!isLegacyRulesEditable) return;
    const nextValueOptions = getRuleValueOptions(metric, activeCapabilityConfig, activePricingSimulatorFields);
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      rules: activeCapabilityConfig.pricing.rules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        return buildCompatiblePricingRule(rule, {
          metric,
          operator: "eq",
          value: nextValueOptions[0]?.value || "",
        });
      }),
    });
  };

  const handleUpdateRuleOperator = (ruleId: string, operator: BillingRuleOperator) => {
    if (!isLegacyRulesEditable) return;
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      rules: activeCapabilityConfig.pricing.rules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const metric = getRuleMetric(rule);
        const valueOptions = getRuleValueOptions(metric, activeCapabilityConfig, activePricingSimulatorFields);
        const currentValue = rule.value;

        if (operator === "range") {
          const nextValue =
            currentValue && typeof currentValue === "object" && !Array.isArray(currentValue)
              ? currentValue
              : {};
          return buildCompatiblePricingRule(rule, { operator, value: nextValue });
        }

        if (operator === "in") {
          const nextValue = Array.isArray(currentValue)
            ? currentValue
            : formatRuleValueForInput(currentValue)
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
          return buildCompatiblePricingRule(rule, { operator, value: nextValue });
        }

        if (valueOptions.length > 0) {
          const normalizedValue = formatRuleValueForInput(currentValue);
          const nextValue =
            valueOptions.some((option) => option.value === normalizedValue)
              ? normalizedValue
              : valueOptions[0]?.value || "";
          return buildCompatiblePricingRule(rule, { operator, value: nextValue });
        }

        if (currentValue && typeof currentValue === "object") {
          return buildCompatiblePricingRule(rule, { operator, value: "" });
        }

        return buildCompatiblePricingRule(rule, { operator });
      }),
    });
  };

  const handleUpdateRuleValue = (ruleId: string, rawValue: string) => {
    if (!isLegacyRulesEditable) return;
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      rules: activeCapabilityConfig.pricing.rules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const metric = getRuleMetric(rule);
        const operator = getRuleOperator(rule);
        return buildCompatiblePricingRule(rule, {
          value: normalizeStructuredRuleValue(metric, operator, rawValue),
        });
      }),
    });
  };

  const handleUpdateRuleRangeValue = (ruleId: string, key: "min" | "max", rawValue: string) => {
    if (!isLegacyRulesEditable) return;
    onChangePricing({
      ...activeCapabilityConfig.pricing,
      rules: activeCapabilityConfig.pricing.rules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const nextValue =
          rule.value && typeof rule.value === "object" && !Array.isArray(rule.value)
            ? { ...rule.value }
            : {};
        const numeric = rawValue.trim() ? Number(rawValue.trim()) : undefined;
        if (numeric === undefined || !Number.isFinite(numeric)) {
          delete nextValue[key];
        } else {
          nextValue[key] = numeric;
        }
        return buildCompatiblePricingRule(rule, { value: nextValue });
      }),
    });
  };

  const renderSceneTemplateSection = (
    templates: CapabilityPricingTemplate[],
    code: ModelCapabilityCode,
  ) => {
    if (templates.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          当前能力插件未提供模板列表，保存会被拦截，需先补齐 capability plugin 模板定义。
        </div>
      );
    }

    const activeTemplateId = activeCapabilityConfig.pricing.templateId;

    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {templates.map((template, index) => {
            const templatePricing = template.pricing;
            const isMatchedTemplate = activeTemplateId === template.id;
            const isSelected = isMatchedTemplate;

            return (
              <div
                key={template.id}
                className={cn(
                  "rounded-xl border px-4 py-3 transition-colors",
                  isSelected
                    ? "border-primary/25 bg-primary/5"
                    : index === 0
                      ? "border-primary/15 bg-primary/5"
                      : index === 1
                        ? "border-violet-200/70 bg-violet-500/5"
                        : "border-border/50 bg-background/70",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h6 className="text-sm font-semibold text-foreground">{template.label}</h6>
                      {index === 0 ? <Badge variant="secondary">推荐</Badge> : null}
                      {isMatchedTemplate ? (
                        <Badge variant="secondary">已套用</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-muted/15 px-1 py-1">
                        基础价 {templatePricing?.basePrice || 0}/{templatePricing?.unit || "unit"}
                      </span>
                      <span className="rounded-full bg-muted/15 px-1 py-1">{(templatePricing?.rules || []).length} 条规则</span>
                      <span className="rounded-full bg-muted/15 px-1 py-1">{templatePricing?.currency || "CNY"}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <HoverCard openDelay={120} closeDelay={120}>
                      <HoverCardTrigger asChild>
                        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground">
                          查看详情
                        </Button>
                      </HoverCardTrigger>
                      <HoverCardContent align="end" side="bottom" className="w-[320px] rounded-xl p-0">
                        <div className="space-y-3 p-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-foreground">{template.label}</div>
                              {index === 0 ? <Badge variant="secondary">推荐</Badge> : null}
                              {isMatchedTemplate ? (
                                <Badge variant={activeMatchedSceneTemplate?.isExactMatch ? "secondary" : "outline"}>
                                  {activeMatchedSceneTemplate?.isExactMatch ? "已套用" : "最接近"}
                                </Badge>
                              ) : null}
                            </div>
                                <p className="text-xs text-muted-foreground">{toChineseBusinessLabel(template.description)}</p>
                          </div>

                          <div className="grid gap-2">
                            <div className="rounded-lg bg-muted/15 px-3 py-2.5">
                              <div className="text-[11px] text-muted-foreground">场景</div>
                                  <div className="mt-1 text-sm text-foreground">{toChineseBusinessLabel(template.useCase)}</div>
                            </div>
                            <div className="rounded-lg bg-muted/15 px-3 py-2.5">
                              <div className="text-[11px] text-muted-foreground">价格</div>
                              <div className="mt-1 text-sm text-foreground">
                                {`${templatePricing?.basePrice || 0}/${templatePricing?.unit || "unit"}，${(templatePricing?.rules || []).length} 条规则`}
                              </div>
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>

                    <Button
                      type="button"
                      size="sm"
                      variant={activeMatchedSceneTemplate?.isExactMatch && isMatchedTemplate ? "secondary" : "outline"}
                      className="h-8 shrink-0"
                      onClick={() => onApplySceneTemplate(code, template.id)}
                    >
                      {activeMatchedSceneTemplate?.isExactMatch && isMatchedTemplate ? "已套用" : "套用"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 rounded-xl bg-background/75 px-4 py-2">
      <div className="rounded-xl bg-primary/5 px-4 py-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium text-foreground">推荐模板</h4>
                <Badge variant={pricingTemplateStatusVariant}>
                  {pricingTemplateStatus}
            </Badge>
          </div>
              {!activeMatchedSceneTemplate && isCustomPricing ? (
                <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  当前使用自定义定价配置，可按需套用下方推荐模板覆盖现有价格与规则。
                </div>
              ) : null}
          {renderSceneTemplateSection(
            activeCapabilitySceneTemplates,
            activeCapabilityMeta.code,
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-xl bg-background/70 px-4 py-4">
        <div className="space-y-1">
          <h5 className="text-sm font-medium text-foreground">基础定价</h5>
        </div>

        {/* <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          当前按 <span className="font-medium text-foreground">{pricingProjection.capabilityType}</span> 能力投影；
          主计量为 <span className="font-medium text-foreground">{getBillingMetricDisplayLabel(pricingProjection.primaryMeter)}</span>，
          结算币种 <span className="font-medium text-foreground">{pricingProjection.settlementCurrency}</span>
          {pricingProjection.hasTieredPricing ? "，含分段价" : ""}
          {pricingProjection.hasFixedSurcharges ? "，含固定附加费" : ""}
          {pricingProjection.hasMinimumCharge ? "，含最小消费" : ""}
          {pricingProjection.hasMaximumCharge ? "，含封顶" : ""}
          {pricingProjection.hasFloorCharge ? "，含保底" : ""}
          {pricingProjection.hasFx ? "，含汇率换算" : ""}
          。
        </div> */}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {/* <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-foreground">旧版页面边界</div>
              <Badge variant={pricingProjectionBoundary.legacyPage.mode === "editable" ? "secondary" : "outline"}>
                {pricingProjectionBoundary.legacyPage.mode === "editable" ? "兼容可编辑" : "只读投影"}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{pricingProjectionBoundary.legacyPage.reason}</div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              {pricingProjectionBoundary.legacyPage.migrationSummary}
            </div>
          </div> */}

          {/* <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-foreground">投影字段映射</div>
              <div className="text-[11px] text-muted-foreground">
                {pricingProjectionBoundary.fieldGroups.length} 组 / {pricingProjectionBoundary.fieldMappings.length} 项
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {pricingProjectionBoundary.fieldGroups.map((group) => (
                <span key={group.id} className="rounded-full bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                  {group.label} · {group.fields.length}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {pricingProjectionBoundary.fieldMappings.slice(0, 4).map((mapping) => (
                <div key={mapping.key} className="text-[11px] text-muted-foreground">
                  {mapping.formLabel} ({mapping.mode}) {"->"} {mapping.backendPath}
                </div>
              ))}
              {pricingProjectionBoundary.fieldMappings.length > 4 ? (
                <div className="text-[11px] text-muted-foreground">
                  其余 {pricingProjectionBoundary.fieldMappings.length - 4} 项继续按 projection 只读暴露。
                </div>
              ) : null}
            </div>
          </div> */}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {billingUnitKinds.length > 1 ? (
            <div className="space-y-2">
              <Label className="workflow-form-label">计费口径</Label>
              <Select
                value={currentBillingUnitKind}
                onValueChange={(value) => handleChangeBillingUnitKind(value as PricingUnitKind)}
                disabled={!isLegacyUnitEditable}
              >
                <SelectTrigger className="subpage-native-select w-full h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {billingUnitKinds.map((kind) => (
                    <SelectItem key={kind} className="subpage-select-item" value={kind}>
                      {getBillingUnitKindLabel(kind)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label className="workflow-form-label">基础单价</Label>
            <Input
              value={String(activeCapabilityConfig.pricing.basePrice || 0)}
              onChange={(event) => handleUpdatePricingField("basePrice", event.target.value)}
              className="workflow-form-input"
              placeholder="例如：0.18"
              type="number"
              min="0"
              step={basePriceStep}
              disabled={!isLegacyBasePriceEditable}
            />
          </div>

          <div className="space-y-2">
            <Label className="workflow-form-label">计费单位</Label>
            {usePresetPricingUnit ? (
              <Select
                value={activeCapabilityConfig.pricing.unit}
                onValueChange={(value) => handleUpdatePricingField("unit", value)}
                disabled={!isLegacyUnitEditable}
              >
                <SelectTrigger className="subpage-native-select w-full h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {pricingUnitOptions.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={activeCapabilityConfig.pricing.unit}
                onChange={(event) => handleUpdatePricingField("unit", event.target.value)}
                className="workflow-form-input"
                placeholder={pricingEditorCopy.unitPlaceholder || "例如：unit"}
                disabled={!isLegacyUnitEditable}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label className="workflow-form-label">结算币种</Label>
            <Select
              value={activeCapabilityConfig.pricing.currency}
              onValueChange={(value) => handleUpdatePricingField("currency", value)}
              disabled={!isLegacyCurrencyEditable}
            >
              <SelectTrigger className="subpage-native-select w-full h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {BILLING_CURRENCY_OPTIONS.map((option) => (
                  <SelectItem key={option} className="subpage-select-item" value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        {pricingUnitHint ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {pricingUnitHint}
          </div>
        ) : null}

        {isVideoPricing ? (
          <div className="space-y-3 rounded-xl bg-muted/20 px-4 py-4">
            <div className="space-y-1">
              <h5 className="text-sm font-medium text-foreground">分辨率价目表</h5>
              <p className="text-xs text-muted-foreground">
                按分辨率填写每秒单价。请求未带分辨率时用默认档；帧率不参与计价。
              </p>
            </div>
            {videoRateCardRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">请先在能力边界中启用至少一种分辨率。</div>
            ) : (
              <div className="space-y-2">
                {videoRateCardRows.map((row) => (
                  <div key={row.resolution} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3">
                    <div className="text-sm text-foreground">{row.resolution}</div>
                    <Input
                      value={String(row.unitPrice ?? 0)}
                      onChange={(event) => handleUpdateRateCardPrice(row.resolution, event.target.value)}
                      className="workflow-form-input"
                      type="number"
                      min="0"
                      step={basePriceStep}
                      disabled={!isLegacyBasePriceEditable}
                    />
                    {row.isDefault ? (
                      <Badge variant="secondary" className="justify-self-end">
                        默认档
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">CNY/秒</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 rounded-xl bg-background/70 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h5 className="text-sm font-medium text-foreground">条件倍率规则</h5>
            <p className="text-xs text-muted-foreground">
              {isVideoPricing
                ? "可选加价项，例如开声音或超长时长。分辨率请改上方价目表；帧率不参与计价。"
                : "可选。基础单价始终生效；规则只在命中时调整价格。缺分辨率/帧率视为未命中，不加价也不拦截保存。"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-sm text-muted-foreground"
            onClick={() => handleAddPricingRule()}
            disabled={!isLegacyRulesEditable}
          >
            <Plus className="mr-1 h-4 w-4" />
            新增规则
          </Button>
        </div>

        {/* <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          基础单价始终生效；下面的规则用于在命中条件时调整价格，不代表“只有命中才计费”。
          总价 = 基础单价 x 计费数量 x 命中规则倍率。
          其中倍率 `1` 表示按基础单价计费，`1.5` 表示在基础单价上上浮 50%，`0.8` 表示按 8 折计费。
        </div> */}

        {activeCapabilityConfig.pricing.rules.length === 0 ? (
          <div className="rounded-xl bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
            {isVideoPricing
              ? "未配置加价规则，将按价目表秒价 × 时长结算。"
              : "未配置条件倍率规则，将按基础单价结算。需要按分辨率等加价时再新增规则。"}
          </div>
        ) : (
          <div className="space-y-3">
            {activeCapabilityConfig.pricing.rules.map((rule, index) => (
              <div key={rule.id} className="rounded-xl bg-muted/20 px-4 py-4">
                {(() => {
                  const metric = getRuleMetric(rule);
                  const operator = getRuleOperator(rule);
                  const valueOptions = getRuleValueOptions(metric, activeCapabilityConfig, activePricingSimulatorFields);
                  const hasValueOptions = valueOptions.length > 0;
                  const operatorOptions = getRuleOperatorOptions(metric, operator);
                  const useSelectValue = hasValueOptions && operator === "eq";
                  const valueText = formatRuleValueForInput(rule.value);

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium text-foreground">
                          {toChineseBusinessLabel(rule.description?.trim() || "") ||
                          `当${formatRuleConditionText(metric, operator, rule.value)}时，${formatRuleMultiplierText(rule.multiplier)}`.trim() ||
                          `规则 ${index + 1}`}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-sm text-muted-foreground"
                          onClick={() => handleRemovePricingRule(rule.id)}
                          disabled={!isLegacyRulesEditable}
                        >
                          移除
                        </Button>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                          <Label className="workflow-form-label">计费指标</Label>
                          <Select
                            value={metric}
                            onValueChange={(value) => handleUpdateRuleMetric(rule.id, value)}
                            disabled={!isLegacyRulesEditable}
                          >
                            <SelectTrigger className="subpage-native-select w-full h-10">
                              <SelectValue placeholder="选择计费指标" />
                            </SelectTrigger>
                            <SelectContent className="subpage-select-content">
                              {ruleMetricSuggestions.map((option) => (
                                <SelectItem key={option} className="subpage-select-item" value={option}>
                                  {getBillingMetricDisplayLabel(option)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="workflow-form-label">命中条件</Label>
                          <Select
                            value={operator}
                            onValueChange={(value) => handleUpdateRuleOperator(rule.id, value as BillingRuleOperator)}
                            disabled={!isLegacyRulesEditable}
                          >
                            <SelectTrigger className="subpage-native-select w-full h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="subpage-select-content">
                              {operatorOptions.map((option) => (
                                <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="workflow-form-label">条件值</Label>
                          {useSelectValue ? (
                            <Select
                              value={valueText || undefined}
                              onValueChange={(value) => handleUpdateRuleValue(rule.id, value)}
                              disabled={!isLegacyRulesEditable}
                            >
                              <SelectTrigger className="subpage-native-select w-full h-10">
                                <SelectValue placeholder="选择规则值" />
                              </SelectTrigger>
                              <SelectContent className="subpage-select-content">
                                {valueOptions.map((option) => (
                                  <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={valueText}
                              onChange={(event) => handleUpdateRuleValue(rule.id, event.target.value)}
                              className="workflow-form-input"
                              placeholder={
                                operator === "in"
                                  ? "多个值请用英文逗号分隔"
                                  : operator === "range"
                                    ? "请输入min,max"
                                    : getRuleValuePlaceholder(
                                        metric,
                                        pricingEditorCopy.ruleValuePlaceholder || "例如：规则值",
                                      )
                              }
                              type={isNumericBillingMetric(metric) && operator !== "in" && operator !== "range" ? "number" : "text"}
                              disabled={!isLegacyRulesEditable}
                            />
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="workflow-form-label">命中倍率</Label>
                          <Input
                            value={String(rule.multiplier)}
                            onChange={(event) => handleUpdatePricingRule(rule.id, "multiplier", event.target.value)}
                            className="workflow-form-input"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="例如：1.40"
                            disabled={!isLegacyRulesEditable}
                          />
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                        当
                        <span className="mx-1 font-medium text-foreground">
                          {formatRuleConditionText(metric, operator, rule.value)}
                        </span>
                        命中时，
                        <span className="mx-1 font-medium text-foreground">
                          {formatRuleMultiplierText(rule.multiplier)}
                        </span>
                        ；未命中时仍按基础单价计费，不会变成不收费。
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl bg-background/70 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h5 className="text-sm font-medium text-foreground">实时定价模拟器</h5>
          </div>
          <Badge variant="outline">受边界约束</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {activePricingSimulatorFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label className="workflow-form-label">{toChineseBusinessLabel(field.label)}</Label>
              {field.type === "select" ? (
                <Select
                  value={String(activePricingSimulatorInput[field.key] ?? field.defaultValue ?? "")}
                  onValueChange={(value) =>
                    onUpdateSimulatorInput(activeCapabilityMeta.code, field, value)
                  }
                >
                  <SelectTrigger className="subpage-native-select w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    {(field.options || []).map((option) => (
                      <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={String(activePricingSimulatorInput[field.key] ?? field.defaultValue ?? "")}
                  onChange={(event) =>
                    onUpdateSimulatorInput(activeCapabilityMeta.code, field, event.target.value)
                  }
                  className="workflow-form-input"
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step || 1}
                />
              )}
              {field.helperText ? (
                <p className="text-[11px] text-muted-foreground">{toChineseBusinessLabel(field.helperText)}</p>
              ) : null}
            </div>
          ))}
        </div>

            {activePricingSimulation ? (
              <Collapsible open={simulationExpanded} onOpenChange={setSimulationExpanded} className="space-y-3">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex h-auto w-full items-center justify-between gap-4 rounded-xl border-border/60 bg-background/70 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-medium text-foreground">模拟结果</div>
                      <div className="text-[11px] text-muted-foreground">
                        预计总价 {formatPricingAmount(activePricingSimulation.total)}{" "}
                        {activePricingSimulation.currency}
                        {" · "}
                        命中规则 {activePricingSimulation.hitRules.length} 条
                        {" · "}
                        按 {activePricingSimulation.quantity} {simulationQuantityLabel} 估算
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {simulationExpanded ? "收起详情" : "展开详情"}
                      <ChevronDown className={`h-4 w-4 transition-transform ${simulationExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg bg-primary/5 px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">预计总价</div>
                      <div className="mt-1 text-lg font-semibold text-foreground">
                        {formatPricingAmount(activePricingSimulation.total)}{" "}
                        {activePricingSimulation.currency}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {`按 ${activePricingSimulation.quantity} ${simulationQuantityLabel}估算`}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/15 px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">基础金额</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {formatPricingAmount(activePricingSimulation.baseAmount)}{" "}
                        {activePricingSimulation.currency}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        基础单价 × {formatPricingAmount(simulationBilledQuantity)} {simulationBilledUnitLabel}
                        {simulationUsesScaledUnit
                          ? `（由 ${formatPricingAmount(activePricingSimulation.quantity)} ${simulationQuantityUnitLabel} 折算）`
                          : ""}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/15 px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">命中规则</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {activePricingSimulation.hitRules.length} 条
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {activePricingSimulation.hitRules.length > 0
                          ? summarizeBusinessLabels(
                              activePricingSimulation.hitRules.map((rule) => toChineseBusinessLabel(rule.label)),
                              "已命中规则",
                              2,
                            )
                          : "当前按基础单价计算"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-primary/5 px-4 py-3">
                    <div className="text-[11px] text-muted-foreground">公式拆解</div>
                    <div className="mt-1 text-sm font-medium text-foreground">{activePricingSimulation.formula}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] text-muted-foreground">命中规则列表</div>
                    {activePricingSimulation.hitRules.length === 0 ? (
                      <div className="rounded-xl bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        当前未命中额外规则，模拟结果仅基于基础单价。
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activePricingSimulation.hitRules.map((rule) => (
                          <div key={rule.id} className="rounded-xl bg-muted/20 px-4 py-3">
                            <div className="text-sm font-medium text-foreground">{toChineseBusinessLabel(rule.label)}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">命中倍率 {rule.multiplier}x</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
      </div>
    </div>
  );
}
