import type {
  CapabilityPricing,
  CapabilityPricingSimulationMatchedRule,
  CapabilityPricingSimulationResult,
  CapabilityPricingSimulatorFieldDefinition,
  CapabilityPricingSimulatorInput,
  CapabilitySectionDefinition,
  CapabilityTemplatePresetDefinition,
  ModelCapabilityConfig,
} from "../modelCapabilityMetadata";
import {
  formatBillingRuleSummary,
  getCapabilityConfigFieldValue,
  matchBasicBillingRule,
} from "../modelCapabilityMetadata";
import type { CapabilityOverviewContext, CapabilityPackage, CapabilityPlugin } from "../capabilityPluginTypes";
import { getBillingMetricSimulationValue } from "../billingMetricRegistry";
import {
  buildPricingRateLabel,
  buildScaledPricingFormula,
  convertToBillingQuantity,
  resolvePricingUnitDescriptor,
} from "../pricingUnit";

const sections: CapabilitySectionDefinition[] = [
  {
    id: "capability",
    target: "boundary",
    title: "能力边界",
    description: "维护文本理解的能力开关。",
    fields: [
      { key: "maxInputTokens", label: "最大输入 Token", type: "number", defaultValue: 128000 },
      { key: "supportSummarization", label: "支持摘要", type: "boolean", defaultValue: true },
      { key: "supportClassification", label: "支持分类", type: "boolean", defaultValue: true },
      { key: "supportModeration", label: "支持审核", type: "boolean", defaultValue: false },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护文本理解的默认参数。",
    fields: [
      {
        key: "defaultTaskType",
        label: "默认任务类型",
        type: "select",
        defaultValue: "summarization",
        options: [
          { label: "摘要", value: "summarization" },
          { label: "分类", value: "classification" },
          { label: "审核", value: "moderation" },
        ],
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_understanding",
    label: "标准理解",
    scenario: "通用摘要、信息抽取",
    pricingFocus: "基础输入 Token 计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.08,
    unit: "1M tokens",
    unitKind: "token",
    currency: "CNY",
    rules: [
      {
        id: `${templateId}-summary`,
        metric: "task_type",
        operator: "eq",
        value: "summarization",
        multiplier: 1,
        description: "Summarization",
      },
      {
        id: `${templateId}-classify`,
        metric: "task_type",
        operator: "eq",
        value: "classification",
        multiplier: 1.2,
        description: "Classification",
      },
      {
        id: `${templateId}-moderation`,
        metric: "task_type",
        operator: "eq",
        value: "moderation",
        multiplier: 1.4,
        description: "Moderation",
      },
    ],
  };
}

function getNumberValue(value: unknown, fallback: number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const normalized = Number(value.trim());
    return Number.isFinite(normalized) ? normalized : fallback;
  }

  return fallback;
}

function getBooleanValue(value: unknown) {
  return value === true;
}

function getPricingSimulatorFields(): CapabilityPricingSimulatorFieldDefinition[] {
  return [
    { key: "inputTokens", label: "输入 Tokens", type: "number", defaultValue: 2000, min: 1, step: 100 },
    {
      key: "taskType",
      label: "任务类型",
      type: "select",
      defaultValue: "summarization",
      options: [
        { label: "摘要", value: "summarization" },
        { label: "分类", value: "classification" },
        { label: "审核", value: "moderation" },
      ],
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.inputTokens, 2000));
  const basePrice = Number(config.pricing.basePrice || 0);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "token");
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, "token");
  const baseAmount = basePrice * billedQuantity;
  const hitRules: CapabilityPricingSimulationMatchedRule[] = [];
  let totalMultiplier = 1;

  for (const rule of config.pricing.rules) {
    const actualValue = getBillingMetricSimulationValue(rule.metric, input, {
      input_token: quantity,
    });
    const isHit = matchBasicBillingRule(rule, actualValue);

    if (!isHit) continue;

    hitRules.push({
      id: rule.id,
      label: rule.description || formatBillingRuleSummary(rule),
      multiplier: rule.multiplier,
    });
    totalMultiplier *= rule.multiplier;
  }

  const total = baseAmount * totalMultiplier;
  const formulaParts = [buildScaledPricingFormula(basePrice, quantity, config.pricing.unit, "token")];
  if (hitRules.length > 0) {
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" × "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "tokens",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" × "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const defaultTaskType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultTaskType") || "").trim();
  const supportSummarization = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportSummarization"));
  const supportClassification = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportClassification"));
  const supportModeration = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportModeration"));

  if (defaultTaskType === "summarization" && !supportSummarization) {
    issues.push("默认任务为摘要时，能力边界必须支持摘要。");
  }

  if (defaultTaskType === "classification" && !supportClassification) {
    issues.push("默认任务为分类时，能力边界必须支持分类。");
  }

  if (defaultTaskType === "moderation" && !supportModeration) {
    issues.push("默认任务为审核时，能力边界必须支持审核。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "token");
  const maxInputTokens = String(getCapabilityConfigFieldValue(config, "boundary", "maxInputTokens") || "").trim();
  const supportSummarization = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportSummarization"));
  const supportClassification = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportClassification"));
  const supportModeration = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportModeration"));
  const defaultTaskType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultTaskType") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "token") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  const defaultTaskLabel =
    defaultTaskType === "classification"
      ? "分类"
      : defaultTaskType === "moderation"
        ? "审核"
        : defaultTaskType === "summarization"
          ? "摘要"
          : defaultTaskType;

  return {
    boundary: [
      maxInputTokens ? `最大输入 ${maxInputTokens}` : "",
      supportSummarization ? "支持摘要" : "",
      supportClassification ? "支持分类" : "",
      supportModeration ? "支持审核" : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultTaskLabel ? `默认任务 ${defaultTaskLabel}` : ""].filter(Boolean).join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 × 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 × 任务倍率`,
  };
}

export function buildTextUnderstandingCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按输入 Token / 任务类型计费",
  };
}

export const textUnderstandingCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "text_understanding",
    label: "文本理解",
    bucket: "text",
    category: "text",
    schemaLevel: "full",
    description: "摘要、分类、抽取、审核",
    keywords: [/文本理解/i, /理解/i, /摘要/i, /分类/i, /抽取/i, /审核/i, /问答/i, /推理/i],
    sections,
    templatePresets,
  },
  templates: {
    ruleMetricSuggestions: ["task_type"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by input tokens and task type",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：1M tokens",
    ruleValuePlaceholder: "例如：2000",
    simulationQuantityLabel: "输入 Tokens",
    simulationQuantityUnitLabel: "Tokens",
  },
};
