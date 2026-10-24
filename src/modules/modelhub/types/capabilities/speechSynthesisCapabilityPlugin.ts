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
    description: "维护语音合成的支持模式和字符限制。",
    fields: [
      { key: "supportEmotion", label: "支持情感音色", type: "boolean", defaultValue: true },
      { key: "supportCloning", label: "支持克隆音色", type: "boolean", defaultValue: false },
      { key: "maxChars", label: "最大字符数", type: "number", defaultValue: 5000 },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护语音合成的默认参数。",
    fields: [
      {
        key: "defaultVoice",
        label: "默认音色",
        type: "select",
        defaultValue: "standard_female",
        options: [
          { label: "标准女声", value: "standard_female" },
          { label: "标准男声", value: "standard_male" },
        ],
      },
      {
        key: "defaultEmotion",
        label: "默认情感",
        type: "select",
        defaultValue: "neutral",
        options: [
          { label: "中性", value: "neutral" },
          { label: "开心", value: "happy" },
          { label: "悲伤", value: "sad" },
        ],
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_tts",
    label: "标准合成",
    scenario: "通用文本朗读、基础配音",
    pricingFocus: "基础按字符计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.015,
    unit: "1K chars",
    unitKind: "char",
    currency: "CNY",
    rules: [
      { id: `${templateId}-voice-emotion`, metric: "voice_type", operator: "eq", value: "emotion", multiplier: 1.2, description: "Emotion voice" },
      { id: `${templateId}-voice-clone`, metric: "voice_type", operator: "eq", value: "clone", multiplier: 1.4, description: "Cloned voice" },
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

function getVoiceTypeOptions(config: ModelCapabilityConfig) {
  const options = [{ label: "标准", value: "standard" }];
  if (getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportEmotion"))) {
    options.push({ label: "情感", value: "emotion" });
  }
  if (getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportCloning"))) {
    options.push({ label: "克隆", value: "clone" });
  }
  return options;
}

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  return [
    { key: "charCount", label: "合成字符数", type: "number", defaultValue: 100, min: 1, step: 10 },
    {
      key: "voiceType",
      label: "音色类型",
      type: "select",
      defaultValue: getVoiceTypeOptions(config)[0]?.value || "standard",
      options: getVoiceTypeOptions(config),
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.charCount, 100));
  const basePrice = Number(config.pricing.basePrice || 0);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "char");
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, "char");
  const baseAmount = basePrice * billedQuantity;
  const hitRules: CapabilityPricingSimulationMatchedRule[] = [];
  let totalMultiplier = 1;

  for (const rule of config.pricing.rules) {
    const actualValue = getBillingMetricSimulationValue(rule.metric, input, {
      char_count: quantity,
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
  const formulaParts = [buildScaledPricingFormula(basePrice, quantity, config.pricing.unit, "char")];
  if (hitRules.length > 0) {
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" x "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "chars",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" x "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const supportEmotion = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportEmotion"));
  const maxChars = getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxChars"), 0);
  const defaultEmotion = String(getCapabilityConfigFieldValue(config, "defaults", "defaultEmotion") || "").trim();

  if (!(maxChars > 0)) {
    issues.push("语音合成的最大字符数必须大于 0。");
  }

  if (defaultEmotion && defaultEmotion !== "neutral" && !supportEmotion) {
    issues.push("默认情感不是 neutral 时，能力边界必须开启情感音色。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "char");
  const supportEmotion = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportEmotion"));
  const supportCloning = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportCloning"));
  const maxChars = String(getCapabilityConfigFieldValue(config, "boundary", "maxChars") || "").trim();
  const defaultVoice = String(getCapabilityConfigFieldValue(config, "defaults", "defaultVoice") || "").trim();
  const defaultEmotion = String(getCapabilityConfigFieldValue(config, "defaults", "defaultEmotion") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "char") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      supportEmotion ? "支持情感音色" : "",
      supportCloning ? "支持克隆音色" : "",
      maxChars ? `最大字符 ${maxChars}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [
      defaultVoice ? `默认音色 ${defaultVoice}` : "",
      defaultEmotion ? `默认情感 ${defaultEmotion}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 x 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 x 音色倍率`,
  };
}

export function buildSpeechSynthesisCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按字符数 / 音色类型计费",
  };
}
export const speechSynthesisCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "speech_synthesis",
    label: "语音合成",
    bucket: "speech",
    category: "audio",
    schemaLevel: "full",
    description: "TTS、情感音色、克隆音色",
    keywords: [/语音合成/i, /TTS/i, /配音/i, /朗读/i],
    sections,
    templatePresets,
  },
  templates: {
    ruleMetricSuggestions: ["voice_type"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by character count and voice type",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：1K chars",
    ruleValuePlaceholder: "例如：emotion / clone",
    simulationQuantityLabel: "字符",
    simulationQuantityUnitLabel: "字符",
  },
};
