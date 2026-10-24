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
    description: "维护工具调用的并发与步数限制。",
    fields: [
      { key: "supportFunctionCalling", label: "支持函数调用", type: "boolean", defaultValue: true },
      { key: "supportParallel", label: "支持并行调用", type: "boolean", defaultValue: false },
      { key: "maxSteps", label: "最大执行步数", type: "number", defaultValue: 10 },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护工具调用的默认参数。",
    fields: [
      { key: "defaultParallel", label: "默认开启并行", type: "boolean", defaultValue: false },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_tool",
    label: "标准工具调用",
    scenario: "常规 Agent 编排",
    pricingFocus: "基础按次计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.2,
    unit: "request",
    unitKind: "request",
    currency: "CNY",
    rules: [
      { id: `${templateId}-parallel`, metric: "parallel", operator: "eq", value: "yes", multiplier: 1.25, description: "Parallel execution" },
    ],
  };
}

function getBooleanValue(value: unknown) {
  return value === true;
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

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  const defaultParallel = getBooleanValue(getCapabilityConfigFieldValue(config, "defaults", "defaultParallel"));

  return [
    { key: "requestCount", label: "调用次数", type: "number", defaultValue: 1, min: 1, step: 1 },
    {
      key: "isParallel",
      label: "是否并行",
      type: "select",
      defaultValue: defaultParallel ? "yes" : "no",
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
  const quantity = Math.max(1, getNumberValue(input.requestCount, 1));
  const basePrice = Number(config.pricing.basePrice || 0);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "request");
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, "request");
  const baseAmount = basePrice * billedQuantity;
  const hitRules: CapabilityPricingSimulationMatchedRule[] = [];
  let totalMultiplier = 1;

  for (const rule of config.pricing.rules) {
    const actualValue = getBillingMetricSimulationValue(rule.metric, input, {
      step: quantity,
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
  const formulaParts = [buildScaledPricingFormula(basePrice, quantity, config.pricing.unit, "request")];
  if (hitRules.length > 0) {
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" x "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "requests",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" x "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const supportFunctionCalling = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportFunctionCalling"));
  const supportParallel = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportParallel"));
  const maxSteps = getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxSteps"), 0);
  const defaultParallel = getBooleanValue(getCapabilityConfigFieldValue(config, "defaults", "defaultParallel"));

  if (!supportFunctionCalling) {
    issues.push("工具调用能力未开启函数调用支持，无法承接实际工具编排。");
  }

  if (!(maxSteps > 0)) {
    issues.push("工具调用的最大执行步数必须大于 0。");
  }

  if (defaultParallel && !supportParallel) {
    issues.push("默认开启并行时，能力边界必须支持并行调用。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "request");
  const supportFunctionCalling = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportFunctionCalling"));
  const supportParallel = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportParallel"));
  const maxSteps = String(getCapabilityConfigFieldValue(config, "boundary", "maxSteps") || "").trim();
  const defaultParallel = getBooleanValue(getCapabilityConfigFieldValue(config, "defaults", "defaultParallel"));
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "request") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      supportFunctionCalling ? "支持函数调用" : "",
      supportParallel ? "支持并行调用" : "",
      maxSteps ? `最大步数 ${maxSteps}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultParallel ? "默认开启并行" : "默认串行执行"].filter(Boolean).join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 x 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 x 并行倍率`,
  };
}

export function buildToolCallingCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按请求 / 步骤 / 并行批次计费",
  };
}
export const toolCallingCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "tool_calling",
    label: "工具调用",
    bucket: "tool",
    category: "agent",
    schemaLevel: "full",
    description: "函数调用、工作流、Agent 编排",
    keywords: [/函数调用/i, /工具调用/i, /workflow/i, /agent/i, /工具编排/i],
    sections,
    templatePresets,
  },
  templates: {
    ruleMetricSuggestions: ["parallel"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by requests, steps, and parallel mode",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：step / 10 steps / 100 steps",
    ruleValuePlaceholder: "例如：yes",
    simulationQuantityLabel: "执行步数",
    simulationQuantityUnitLabel: "步",
  },
};
