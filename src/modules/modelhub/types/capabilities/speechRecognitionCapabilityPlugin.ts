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
    description: "维护语音识别的支持模式和语言范围。",
    fields: [
      { key: "supportRealtime", label: "支持实时识别", type: "boolean", defaultValue: true },
      { key: "maxDurationSeconds", label: "最大时长(秒)", type: "number", defaultValue: 3600 },
      {
        key: "supportedLanguages",
        label: "支持语言",
        type: "multiselect",
        defaultValue: ["zh", "en"],
        options: [
          { label: "中文", value: "zh" },
          { label: "英文", value: "en" },
          { label: "多语种", value: "multi" },
        ],
      },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护语音识别的默认参数。",
    fields: [
      {
        key: "defaultMode",
        label: "默认模式",
        type: "select",
        defaultValue: "batch",
        options: [
          { label: "批量转写", value: "batch" },
          { label: "实时流式", value: "realtime" },
        ],
      },
      {
        key: "defaultLanguage",
        label: "默认语言",
        type: "select",
        defaultValue: "zh",
        options: [
          { label: "中文", value: "zh" },
          { label: "英文", value: "en" },
          { label: "自动识别", value: "auto" },
        ],
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_asr",
    label: "标准识别",
    scenario: "通用音频文件转写",
    pricingFocus: "基础按秒计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.03,
    unit: "second",
    unitKind: "second",
    currency: "CNY",
    rules: [
      {
        id: `${templateId}-realtime`,
        metric: "mode",
        operator: "eq",
        value: "realtime",
        multiplier: 1.2,
        description: "Realtime mode",
      },
      {
        id: `${templateId}-batch`,
        metric: "mode",
        operator: "eq",
        value: "batch",
        multiplier: 1,
        description: "Batch mode",
      },
    ],
  };
}

function getBooleanValue(value: unknown) {
  return value === true;
}

function getStringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
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

function getPricingSimulatorFields(): CapabilityPricingSimulatorFieldDefinition[] {
  return [
    { key: "durationSeconds", label: "音频时长(秒)", type: "number", defaultValue: 60, min: 1, step: 1 },
    {
      key: "mode",
      label: "识别模式",
      type: "select",
      defaultValue: "batch",
      options: [
        { label: "批量", value: "batch" },
        { label: "实时", value: "realtime" },
      ],
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.durationSeconds, 60));
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
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" × "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "秒",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" × "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const supportRealtime = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportRealtime"));
  const maxDurationSeconds = getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxDurationSeconds"), 0);
  const supportedLanguages = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedLanguages"));
  const defaultMode = String(getCapabilityConfigFieldValue(config, "defaults", "defaultMode") || "").trim();
  const defaultLanguage = String(getCapabilityConfigFieldValue(config, "defaults", "defaultLanguage") || "").trim();

  if (defaultMode === "realtime" && !supportRealtime) {
    issues.push("默认模式为实时流式时，能力边界必须支持实时识别。");
  }

  if (defaultLanguage && defaultLanguage !== "auto" && supportedLanguages.length > 0 && !supportedLanguages.includes(defaultLanguage)) {
    issues.push("默认语言必须属于能力边界支持的语种。");
  }

  if (!(maxDurationSeconds > 0)) {
    issues.push("语音识别的最大时长必须大于 0。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "second");
  const supportRealtime = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportRealtime"));
  const maxDurationSeconds = String(getCapabilityConfigFieldValue(config, "boundary", "maxDurationSeconds") || "").trim();
  const supportedLanguages = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedLanguages"));
  const defaultMode = String(getCapabilityConfigFieldValue(config, "defaults", "defaultMode") || "").trim();
  const defaultLanguage = String(getCapabilityConfigFieldValue(config, "defaults", "defaultLanguage") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "second") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      supportRealtime ? "支持实时识别" : "",
      maxDurationSeconds ? `最大时长 ${maxDurationSeconds} 秒` : "",
      supportedLanguages.length > 0 ? supportedLanguages.join(" / ") : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [
      defaultMode ? `默认模式 ${defaultMode === "realtime" ? "实时" : "批量"}` : "",
      defaultLanguage ? `默认语言 ${defaultLanguage}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 × 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 × 模式倍率`,
  };
}

export function buildSpeechRecognitionCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按音频时长 / 模式计费",
  };
}
export const speechRecognitionCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "speech_recognition",
    label: "语音识别",
    bucket: "speech",
    category: "audio",
    schemaLevel: "full",
    description: "ASR、实时识别、批量转写",
    keywords: [/语音识别/i, /ASR/i, /转写/i, /听写/i],
    sections,
    templatePresets,
  },
  templates: {
    ruleMetricSuggestions: ["mode"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by audio duration and mode",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：second / minute / hour",
    ruleValuePlaceholder: "例如：realtime",
    simulationQuantityLabel: "音频时长",
    simulationQuantityUnitLabel: "秒",
  },
};
