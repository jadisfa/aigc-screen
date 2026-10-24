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
    description: "维护视频理解的分析能力限制。",
    fields: [
      { key: "supportFrameAnalysis", label: "支持抽帧分析", type: "boolean", defaultValue: true },
      { key: "maxDurationSeconds", label: "最大时长(秒)", type: "number", defaultValue: 600 },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护视频理解的默认参数。",
    fields: [
      {
        key: "defaultFrameInterval",
        label: "默认抽帧间隔(秒)",
        type: "number",
        defaultValue: 1,
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_video_understanding",
    label: "标准视频理解",
    scenario: "常规视频内容分析",
    pricingFocus: "基础按秒计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.12,
    unit: "minute",
    currency: "CNY",
    rules: [
      { id: `${templateId}-complexity`, metric: "complexity", operator: "eq", value: "deep", multiplier: 1.3, description: "Deep complexity analysis" },
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

function getPricingSimulatorFields(): CapabilityPricingSimulatorFieldDefinition[] {
  return [
    { key: "durationSeconds", label: "视频时长(秒)", type: "number", defaultValue: 60, min: 1, step: 1 },
    {
      key: "complexity",
      label: "分析复杂度",
      type: "select",
      defaultValue: "standard",
      options: [
        { label: "标准", value: "standard" },
        { label: "深度", value: "deep" },
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
  const supportFrameAnalysis = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportFrameAnalysis"));
  const maxDurationSeconds = getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxDurationSeconds"), 0);
  const defaultFrameInterval = getNumberValue(getCapabilityConfigFieldValue(config, "defaults", "defaultFrameInterval"), 0);

  if (!(maxDurationSeconds > 0)) {
    issues.push("视频理解的最大时长必须大于 0。");
  }

  if (!(defaultFrameInterval > 0)) {
    issues.push("默认抽帧间隔必须大于 0。");
  }

  if (defaultFrameInterval > 0 && maxDurationSeconds > 0 && defaultFrameInterval > maxDurationSeconds) {
    issues.push("默认抽帧间隔不能超过最大视频时长。");
  }

  if (!supportFrameAnalysis && defaultFrameInterval > 0) {
    issues.push("未开启抽帧分析时，不应配置默认抽帧间隔。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "second");
  const supportFrameAnalysis = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportFrameAnalysis"));
  const maxDurationSeconds = String(getCapabilityConfigFieldValue(config, "boundary", "maxDurationSeconds") || "").trim();
  const defaultFrameInterval = String(getCapabilityConfigFieldValue(config, "defaults", "defaultFrameInterval") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "second") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      supportFrameAnalysis ? "支持抽帧分析" : "",
      maxDurationSeconds ? `最大时长 ${maxDurationSeconds} 秒` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultFrameInterval ? `默认抽帧间隔 ${defaultFrameInterval} 秒` : ""].filter(Boolean).join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 x 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 x 复杂度倍率`,
  };
}

export function buildVideoUnderstandingCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按视频时长 / 分析复杂度计费",
  };
}
export const videoUnderstandingCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "video_understanding",
    label: "视频理解",
    bucket: "video",
    category: "video",
    schemaLevel: "full",
    description: "视频解析、抽帧理解、多模态视频理解",
    keywords: [/视频理解/i, /视频分析/i],
    sections,
    templatePresets,
  },
  templates: {
    ruleMetricSuggestions: ["complexity"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by video duration and complexity",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：second / minute / hour",
    ruleValuePlaceholder: "例如：deep",
    simulationQuantityLabel: "视频时长",
    simulationQuantityUnitLabel: "秒",
  },
};
