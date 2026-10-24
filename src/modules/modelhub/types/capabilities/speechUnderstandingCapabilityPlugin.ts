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
    description: "维护语音理解的支持模式。",
    fields: [
      { key: "supportIntent", label: "支持意图识别", type: "boolean", defaultValue: true },
      { key: "supportMultiTurn", label: "支持多轮对话", type: "boolean", defaultValue: false },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护语音理解的默认参数。",
    fields: [
      {
        key: "defaultTaskType",
        label: "默认任务类型",
        type: "select",
        defaultValue: "intent",
        options: [
          { label: "意图识别", value: "intent" },
          { label: "自由对话", value: "chat" },
        ],
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_audio_understanding",
    label: "标准语音理解",
    scenario: "语音意图分析",
    pricingFocus: "基础按秒计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.06,
    unit: "second",
    currency: "CNY",
    rules: [
      { id: `${templateId}-intent`, metric: "task_type", operator: "eq", value: "intent", multiplier: 1, description: "Intent recognition" },
      { id: `${templateId}-chat`, metric: "task_type", operator: "eq", value: "chat", multiplier: 1.15, description: "Multi-turn audio conversation" },
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

function getTaskOptions(config: ModelCapabilityConfig, currentValue?: string) {
  const options: Array<{ label: string; value: string }> = [];
  if (getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportIntent"))) {
    options.push({ label: "意图识别", value: "intent" });
  }
  if (getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportMultiTurn"))) {
    options.push({ label: "自由对话", value: "chat" });
  }
  if (options.length === 0) {
    options.push({ label: "意图识别", value: "intent" });
  }
  if (currentValue && !options.some((item) => item.value === currentValue)) {
    options.push({ label: currentValue, value: currentValue });
  }
  return options;
}

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  const defaultTaskType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultTaskType") || "").trim();

  return [
    { key: "durationSeconds", label: "音频时长(秒)", type: "number", defaultValue: 30, min: 1, step: 1 },
    {
      key: "taskType",
      label: "任务类型",
      type: "select",
      defaultValue: defaultTaskType || getTaskOptions(config)[0]?.value || "intent",
      options: getTaskOptions(config, defaultTaskType),
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.durationSeconds, 30));
  const basePrice = Number(config.pricing.basePrice || 0);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "second");
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, "second");
  const baseAmount = basePrice * billedQuantity;
  const hitRules: CapabilityPricingSimulationMatchedRule[] = [];
  let totalMultiplier = 1;

  for (const rule of config.pricing.rules) {
    const actualValue = getBillingMetricSimulationValue(rule.metric, input, {
      duration: quantity,
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
  const formulaParts = [buildScaledPricingFormula(basePrice, quantity, config.pricing.unit, "second")];
  if (hitRules.length > 0) {
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" x "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "sec",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" x "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const supportIntent = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportIntent"));
  const supportMultiTurn = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportMultiTurn"));
  const defaultTaskType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultTaskType") || "").trim();

  if (defaultTaskType === "intent" && !supportIntent) {
    issues.push("默认任务为 intent 时，能力边界必须支持意图识别。");
  }

  if (defaultTaskType === "chat" && !supportMultiTurn) {
    issues.push("默认任务为 chat 时，能力边界必须支持多轮对话。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "second");
  const supportIntent = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportIntent"));
  const supportMultiTurn = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportMultiTurn"));
  const defaultTaskType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultTaskType") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "second") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      supportIntent ? "支持意图识别" : "",
      supportMultiTurn ? "支持多轮对话" : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultTaskType ? `默认任务 ${defaultTaskType}` : ""].filter(Boolean).join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 x 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 x 任务倍率`,
  };
}

export function buildSpeechUnderstandingCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按音频时长 / 任务类型计费",
  };
}
export const speechUnderstandingCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "speech_understanding",
    label: "语音理解",
    bucket: "speech",
    category: "audio",
    schemaLevel: "full",
    description: "语义理解、语音 Agent",
    keywords: [/语音理解/i, /音频理解/i, /语音分析/i],
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
      basePlugin.buildPricingSummary(config) || "priced by audio duration and task type",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：second / minute / hour",
    ruleValuePlaceholder: "例如：intent / chat",
    simulationQuantityLabel: "音频时长",
    simulationQuantityUnitLabel: "秒",
  },
};
