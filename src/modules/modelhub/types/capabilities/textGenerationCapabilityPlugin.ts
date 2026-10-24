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
import { getBillingMetricSimulationValue } from "../billingMetricRegistry";
import {
  buildPricingRateLabel,
  buildScaledPricingFormula,
  convertToBillingQuantity,
  resolvePricingUnitDescriptor,
} from "../pricingUnit";
import type { CapabilityOverviewContext, CapabilityPackage, CapabilityPlugin } from "../capabilityPluginTypes";

const sections: CapabilitySectionDefinition[] = [
  {
    id: "capability",
    target: "boundary",
    title: "能力边界",
    description: "维护文本生成的主要能力开关与限制参数。",
    fields: [
      { key: "maxPromptTokens", label: "最大输入 Token", type: "number", defaultValue: 128000, placeholder: "例如：128000" },
      { key: "supportStreaming", label: "支持流式输出", type: "boolean", defaultValue: true },
      { key: "supportReasoning", label: "支持推理输出", type: "boolean", defaultValue: false },
      { key: "supportVisionInput", label: "支持视觉输入", type: "boolean", defaultValue: false },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护文本生成的默认 API 参数。",
    fields: [
      { key: "defaultStreaming", label: "默认流式输出", type: "boolean", defaultValue: true },
      { key: "defaultReasoning", label: "默认开启推理", type: "boolean", defaultValue: false },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_chat",
    label: "标准对话",
    scenario: "常规问答、文本创作",
    pricingFocus: "输入/输出 Token 基础单价",
    recommended: true,
  },
  {
    templateId: "reasoning_pro",
    label: "深度推理",
    scenario: "复杂逻辑、代码编写、深度思考",
    pricingFocus: "附加推理 Token 倍率",
  },
];

function buildPricing(templateId: string, index: number): CapabilityPricing {
  const normalizedIndex = index + 1;
  return {
    templateId,
    isCustomized: false,
    basePrice: normalizedIndex === 1 ? 0.12 : 0.2,
    unit: "1M tokens",
    unitKind: "token",
    currency: "CNY",
    rules: [
      {
        id: `${templateId}-input`,
        metric: "input_token",
        operator: "gte",
        value: 1,
        multiplier: 1,
        description: "Input tokens",
      },
      {
        id: `${templateId}-output`,
        metric: "output_token",
        operator: "gte",
        value: 1,
        multiplier: normalizedIndex === 1 ? 1.5 : 1.8,
        description: "Output tokens",
      },
      {
        id: `${templateId}-reasoning`,
        metric: "reasoning_token",
        operator: "eq",
        value: "yes",
        multiplier: normalizedIndex === 1 ? 1.8 : 2.4,
        description: "Reasoning tokens",
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
    { key: "inputTokens", label: "输入 Tokens", type: "number", defaultValue: 1000, min: 1, step: 100 },
    { key: "outputTokens", label: "输出 Tokens", type: "number", defaultValue: 500, min: 1, step: 100 },
    {
      key: "isReasoning",
      label: "是否包含推理",
      type: "select",
      defaultValue: "no",
      options: [
        { label: "否", value: "no" },
        { label: "是", value: "yes" },
      ],
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const inputTokens = Math.max(1, getNumberValue(input.inputTokens, 1000));
  const outputTokens = Math.max(0, getNumberValue(input.outputTokens, 500));
  const quantity = inputTokens + outputTokens;
  const basePrice = Number(config.pricing.basePrice || 0);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "token");
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, "token");
  const baseAmount = basePrice * billedQuantity;
  const hitRules: CapabilityPricingSimulationMatchedRule[] = [];
  let totalMultiplier = 1;

  for (const rule of config.pricing.rules) {
    const actualValue = getBillingMetricSimulationValue(rule.metric, input, {
      input_token: inputTokens,
      output_token: outputTokens,
      reasoning_token: input.isReasoning,
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
  const supportStreaming = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportStreaming"));
  const supportReasoning = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportReasoning"));
  const defaultStreaming = getBooleanValue(getCapabilityConfigFieldValue(config, "defaults", "defaultStreaming"));
  const defaultReasoning = getBooleanValue(getCapabilityConfigFieldValue(config, "defaults", "defaultReasoning"));

  if (defaultStreaming && !supportStreaming) {
    issues.push("默认流式输出开启时，能力边界必须支持流式输出。");
  }

  if (defaultReasoning && !supportReasoning) {
    issues.push("默认推理开启时，能力边界必须支持推理输出。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "token");
  const maxPromptTokens = String(getCapabilityConfigFieldValue(config, "boundary", "maxPromptTokens") || "").trim();
  const supportStreaming = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportStreaming"));
  const supportReasoning = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportReasoning"));
  const supportVisionInput = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportVisionInput"));
  const defaultStreaming = getBooleanValue(getCapabilityConfigFieldValue(config, "defaults", "defaultStreaming"));
  const defaultReasoning = getBooleanValue(getCapabilityConfigFieldValue(config, "defaults", "defaultReasoning"));
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "token") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      maxPromptTokens ? `最大输入 ${maxPromptTokens}` : "",
      supportStreaming ? "支持流式" : "",
      supportReasoning ? "支持推理" : "",
      supportVisionInput ? "支持视觉输入" : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [
      defaultStreaming ? "默认流式开启" : "默认流式关闭",
      defaultReasoning ? "默认推理开启" : "默认推理关闭",
    ]
      .filter(Boolean)
      .join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 × 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 × 输入/输出/推理倍率`,
  };
}

export function buildTextGenerationCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按输入 / 输出 / 推理 Token 计费",
  };
}

export const textGenerationCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "text_generation",
    label: "文本生成",
    bucket: "text",
    category: "text",
    schemaLevel: "full",
    description: "对话、补全、创作、生成",
    keywords: [/文本生成/i, /生成/i, /创作/i, /对话/i, /补全/i],
    sections,
    templatePresets,
  },
  templates: {
    ruleMetricSuggestions: ["input_token", "output_token", "reasoning_token"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by input / output / reasoning tokens",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：1M tokens",
    ruleValuePlaceholder: "例如：1000",
    simulationQuantityLabel: "Tokens",
    simulationQuantityUnitLabel: "Tokens",
  },
};
