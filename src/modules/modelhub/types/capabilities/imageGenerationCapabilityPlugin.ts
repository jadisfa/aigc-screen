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
  matchBasicBillingRule,
  getCapabilityConfigFieldValue,
  getImageCapabilityResolutions,
} from "../modelCapabilityMetadata";
import { getBillingMetricSimulationValue } from "../billingMetricRegistry";
import { formatCapabilityTemplateText } from "../capabilityDisplayText";
import {
  buildPricingRateLabel,
  buildScaledPricingFormula,
  convertToBillingQuantity,
  resolvePricingUnitDescriptor,
} from "../pricingUnit";
import type {
  CapabilityFieldUiConfig,
  CapabilityFieldUiContext,
  CapabilityOverviewContext,
  CapabilityPackage,
  CapabilityPlugin,
} from "../capabilityPluginTypes";

const resolutionOptions = [
  "512x512",
  "768x768",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "2048x2048",
  "1K",
  "2K",
  "3K",
  "4K",
  "1080p",
];

const sections: CapabilitySectionDefinition[] = [
  {
    id: "capability",
    target: "boundary",
    title: "能力边界",
    description: "只维护真正支持的能力边界，不包含价格和默认值。",
    fields: [
      { key: "supportTextToImage", label: "支持文生图", type: "boolean", defaultValue: true },
      { key: "supportImageToImage", label: "支持图生图", type: "boolean", defaultValue: false },
      {
        key: "supportedResolutions",
        label: "支持分辨率",
        type: "multiselect",
        defaultValue: ["512x512", "768x768", "1024x1024"],
        options: resolutionOptions.map((value) => ({ label: value, value })),
      },
      { key: "maxImages", label: "最大图片数", type: "number", defaultValue: 1, placeholder: "例如：4" },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护图像生成的默认 API 参数。",
    fields: [
      {
        key: "defaultResolution",
        label: "默认分辨率",
        type: "select",
        defaultValue: "1024x1024",
        options: resolutionOptions.map((value) => ({ label: value, value })),
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_image",
    label: "标准出图",
    scenario: "常规文生图、应用默认出图、活动配图",
    pricingFocus: "按张数 + 分辨率倍率",
    recommended: true,
  },
  {
    templateId: "marketing_hd",
    label: "高清营销图",
    scenario: "电商主图、品牌海报、活动 Banner",
    pricingFocus: "高分辨率主价 + 营销图倍率",
  },
  {
    templateId: "creative_pro",
    label: "高阶创意图",
    scenario: "角色设定、风格延展、创意探索",
    pricingFocus: "创意出图基础价 + 高分辨率倍率 + 迭代轮次附加价",
  },
];

function buildPricing(templateId: string, index: number): CapabilityPricing {
  const normalizedIndex = index + 1;
  return {
    templateId,
    isCustomized: false,
    basePrice: normalizedIndex === 1 ? 0.35 : normalizedIndex === 2 ? 0.58 : 0.68,
    unit: "image",
    currency: "CNY",
    rules: [
      {
        id: `${templateId}-resolution`,
        metric: "resolution",
        operator: "eq",
        value: normalizedIndex === 1 ? "1024x1024" : normalizedIndex === 2 ? "1536x1024" : "2048x2048",
        multiplier: normalizedIndex === 1 ? 1 : normalizedIndex === 2 ? 1.35 : 1.55,
        description: normalizedIndex === 1 ? "标准分辨率" : normalizedIndex === 2 ? "营销高分辨率" : "高阶创意分辨率",
      },
      {
        id: `${templateId}-image-count`,
        metric: "image_count",
        operator: "eq",
        value: normalizedIndex === 1 ? 4 : normalizedIndex === 2 ? 2 : 4,
        multiplier: normalizedIndex === 1 ? 1.1 : normalizedIndex === 2 ? 1.2 : 1.25,
        description: normalizedIndex === 1 ? "批量出图" : normalizedIndex === 2 ? "双图营销出图" : "高阶批量出图",
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

function getStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFieldUiConfig(context: CapabilityFieldUiContext): CapabilityFieldUiConfig | null {
  const { field, value, config } = context;

  if (field.key === "supportedResolutions") {
    return {
      rendererKey: "option_grid",
      layout: {
        colSpan: 2,
      },
      props: {
        draftPlaceholder: "例如 1344x768，回车添加",
      },
    };
  }

  if (field.key === "defaultResolution") {
    return {
      rendererKey: "supported_value_select",
      options: Array.from(new Set([...getImageCapabilityResolutions(config), String(value || "").trim()].filter(Boolean))).map((item) => ({
        label: item,
        value: item,
      })),
      //helperText: "Default resolution is constrained by the enabled boundary resolutions.",
      props: {
        placeholder: "Select a default resolution",
      },
    };
  }

  return null;
}

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  const supportedResolutions = getImageCapabilityResolutions(config);
  const maxImages = Math.max(1, getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxImages"), 1));
  const defaultResolution =
    getStringValue(getCapabilityConfigFieldValue(config, "defaults", "defaultResolution")) || supportedResolutions[0] || "1024x1024";

  return [
    {
      key: "imageCount",
      label: "Image Count",
      type: "number",
      defaultValue: 1,
      min: 1,
      max: maxImages,
      step: 1,
      unit: "image",
     // helperText: `Single run supports up to ${maxImages} images.`,
    },
    {
      key: "resolution",
      label: "Resolution",
      type: "select",
      defaultValue: defaultResolution,
      options: supportedResolutions.map((item) => ({ label: item, value: item })),
      // helperText: "Only enabled boundary resolutions are available here.",
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.imageCount, 1));
  const basePrice = Number(config.pricing.basePrice || 0);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "image");
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, "image");
  const baseAmount = basePrice * billedQuantity;
  const hitRules: CapabilityPricingSimulationMatchedRule[] = [];
  let totalMultiplier = 1;

  for (const rule of config.pricing.rules) {
    const actualValue = getBillingMetricSimulationValue(rule.metric, input, {
      image_count: quantity,
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
  const formulaParts = [buildScaledPricingFormula(basePrice, quantity, config.pricing.unit, "image")];
  if (hitRules.length > 0) {
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" x "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "image",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" x "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const supportedResolutions = getImageCapabilityResolutions(config);
  const defaultResolution = String(getCapabilityConfigFieldValue(config, "defaults", "defaultResolution") || "").trim();

  if (defaultResolution && supportedResolutions.length > 0 && !supportedResolutions.includes(defaultResolution)) {
    issues.push("Default resolution must be included in supported resolutions.");
  }

  return issues;
}

function normalizeFields(config: ModelCapabilityConfig): ModelCapabilityConfig {
  const {
    extendedCapabilityParams: _extendedCapabilityParams,
    ...boundary
  } = config.boundary;
  const {
    extendedDefaultParams: _extendedDefaultParams,
    ...defaults
  } = config.defaults;
  return {
    ...config,
    boundary,
    defaults,
  };
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "image");
  const supportedResolutions = getImageCapabilityResolutions(config);
  const maxImages = String(getCapabilityConfigFieldValue(config, "boundary", "maxImages") || "").trim();
  const defaultResolution = String(getCapabilityConfigFieldValue(config, "defaults", "defaultResolution") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "image") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      maxImages ? `max ${maxImages} image` : "",
      supportedResolutions.length > 0 ? supportedResolutions.join(" / ") : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultResolution].filter(Boolean).join(" | "),
    template: matchedTemplate ? formatCapabilityTemplateText(matchedTemplate.template.label, matchedTemplate.isExactMatch) : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充定价",
    formula: `总价 = 基础单价 × 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 × 命中规则倍率（无规则则按基础单价）`,
  };
}

export function buildImageGenerationCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getFieldUiConfig,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "priced by image count and resolution",
  };
}

export const imageGenerationCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "image_generation",
    label: "图片生成",
    bucket: "image",
    category: "image",
    schemaLevel: "full",
    description: "文生图、图生图、扩图、重绘",
    keywords: [/图像生成/i, /文生图/i, /图生图/i, /扩图/i, /重绘/i, /高清出图/i],
    sections,
    templatePresets,
    getFieldUiConfig,
  },
  templates: {
    ruleMetricSuggestions: ["resolution", "image_count"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by image count and resolution",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：image / 10 images / 100 images",
    ruleValuePlaceholder: "例如：1536x1024 / 4",
    simulationQuantityLabel: "张图片",
    simulationQuantityUnitLabel: "张",
  },
  normalizeFields,
};
