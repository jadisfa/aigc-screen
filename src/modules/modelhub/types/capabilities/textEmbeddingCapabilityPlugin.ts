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

const dimensions = ["256", "384", "512", "768", "1024", "1536", "2048", "3072"];

const sections: CapabilitySectionDefinition[] = [
  {
    id: "capability",
    target: "boundary",
    title: "能力边界",
    description: "维护维度档位与批量限制。",
    fields: [
      {
        key: "supportedDimensions",
        label: "支持维度",
        type: "multiselect",
        defaultValue: ["1024", "1536"],
        options: dimensions.map((value) => ({ label: value, value })),
      },
      { key: "maxBatchSize", label: "最大 Batch Size", type: "number", defaultValue: 16 },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护文本向量的默认参数。",
    fields: [
      {
        key: "defaultDimension",
        label: "默认维度",
        type: "select",
        defaultValue: "1024",
        options: dimensions.map((value) => ({ label: value, value })),
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_embedding",
    label: "标准向量",
    scenario: "通用知识库检索、语义匹配",
    pricingFocus: "基础输入 Token 计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.05,
    unit: "1M tokens",
    unitKind: "token",
    currency: "CNY",
    rules: [
      {
        id: `${templateId}-1024`,
        metric: "dimension",
        operator: "eq",
        value: 1024,
        multiplier: 1,
        description: "1024 dimensions",
      },
      {
        id: `${templateId}-1536`,
        metric: "dimension",
        operator: "eq",
        value: 1536,
        multiplier: 1.25,
        description: "1536 dimensions",
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

function getStringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  const supportedDimensions = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedDimensions"));
  const defaultDimension = String(getCapabilityConfigFieldValue(config, "defaults", "defaultDimension") || "").trim() || supportedDimensions[0] || "1024";

  return [
    { key: "inputTokens", label: "输入 Tokens", type: "number", defaultValue: 1000, min: 1, step: 100 },
    {
      key: "dimension",
      label: "维度",
      type: "select",
      defaultValue: defaultDimension,
      options: (supportedDimensions.length > 0 ? supportedDimensions : ["1024", "1536"]).map((value) => ({ label: value, value })),
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.inputTokens, 1000));
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
  const supportedDimensions = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedDimensions"));
  const defaultDimension = String(getCapabilityConfigFieldValue(config, "defaults", "defaultDimension") || "").trim();

  if (defaultDimension && supportedDimensions.length > 0 && !supportedDimensions.includes(defaultDimension)) {
    issues.push("默认维度必须属于能力边界中已启用的维度。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "token");
  const supportedDimensions = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedDimensions"));
  const maxBatchSize = String(getCapabilityConfigFieldValue(config, "boundary", "maxBatchSize") || "").trim();
  const defaultDimension = String(getCapabilityConfigFieldValue(config, "defaults", "defaultDimension") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "token") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      supportedDimensions.length > 0 ? supportedDimensions.join(" / ") : "",
      maxBatchSize ? `最大批量 ${maxBatchSize}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultDimension ? `默认维度 ${defaultDimension}` : ""].filter(Boolean).join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 × 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 × 维度倍率`,
  };
}

export function buildTextEmbeddingCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按输入 Token / 维度计费",
  };
}

export const textEmbeddingCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "text_embedding",
    label: "文本向量",
    bucket: "text",
    category: "vector",
    schemaLevel: "full",
    description: "检索、召回、相似度",
    keywords: [/向量/i, /embedding/i, /召回/i, /检索/i],
    sections,
    templatePresets,
  },
  templates: {
    ruleMetricSuggestions: ["dimension"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by input tokens and dimension",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：1M tokens",
    ruleValuePlaceholder: "例如：1536",
    simulationQuantityLabel: "输入 Tokens",
    simulationQuantityUnitLabel: "Tokens",
  },
};
