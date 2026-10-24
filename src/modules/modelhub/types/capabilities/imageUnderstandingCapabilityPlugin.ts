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

function getBooleanValue(value: unknown) {
  return value === true;
}

const sections: CapabilitySectionDefinition[] = [
  {
    id: "capability",
    target: "boundary",
    title: "能力边界",
    description: "OCR、检测等能力开关与分辨率档位。",
    fields: [
      { key: "supportOcr", label: "支持 OCR", type: "boolean", defaultValue: true },
      { key: "supportDetection", label: "支持目标检测", type: "boolean", defaultValue: false },
      {
        key: "supportedResolutions",
        label: "支持分辨率",
        type: "multiselect",
        defaultValue: ["512x512", "1024x1024"],
        options: ["512x512", "1024x1024", "2048x2048"].map((value) => ({ label: value, value })),
      },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护图像理解的默认参数。",
    fields: [
      {
        key: "defaultTaskType",
        label: "默认任务类型",
        type: "select",
        defaultValue: "general",
        options: [
          { label: "通用识别", value: "general" },
          { label: "OCR 文字识别", value: "ocr" },
          { label: "目标检测", value: "detection" },
        ],
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_vision",
    label: "标准视觉",
    scenario: "通用图片内容理解",
    pricingFocus: "基础按张计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.18,
    unit: "image",
    currency: "CNY",
    rules: [
      { id: `${templateId}-resolution`, metric: "resolution", operator: "eq", value: "high", multiplier: 1.25, description: "High resolution analysis" },
      { id: `${templateId}-ocr`, metric: "task_type", operator: "eq", value: "ocr", multiplier: 1.2, description: "OCR" },
    ],
  };
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

function getTaskOptions(config: ModelCapabilityConfig, currentValue?: string) {
  const options = [{ label: "通用识别", value: "general" }];
  if (getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportOcr"))) {
    options.push({ label: "OCR", value: "ocr" });
  }
  if (getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportDetection"))) {
    options.push({ label: "目标检测", value: "detection" });
  }
  if (currentValue && !options.some((item) => item.value === currentValue)) {
    options.push({ label: currentValue, value: currentValue });
  }
  return options;
}

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  const supportedResolutions = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedResolutions"));
  const defaultTaskType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultTaskType") || "").trim();

  return [
    { key: "imageCount", label: "图片张数", type: "number", defaultValue: 1, min: 1, step: 1 },
    {
      key: "resolution",
      label: "分辨率",
      type: "select",
      defaultValue: supportedResolutions[0] || "1024x1024",
      options: (supportedResolutions.length > 0 ? supportedResolutions : ["512x512", "1024x1024"]).map((value) => ({
        label: value,
        value,
      })),
    },
    {
      key: "taskType",
      label: "任务类型",
      type: "select",
      defaultValue: defaultTaskType || "general",
      options: getTaskOptions(config, defaultTaskType),
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
    const actualValue = getBillingMetricSimulationValue(rule.metric, input);
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
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" × "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "张",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" × "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const defaultTaskType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultTaskType") || "").trim();
  const supportOcr = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportOcr"));
  const supportDetection = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportDetection"));

  if (defaultTaskType === "ocr" && !supportOcr) {
    issues.push("默认任务为 OCR 时，能力边界必须支持 OCR。");
  }

  if (defaultTaskType === "detection" && !supportDetection) {
    issues.push("默认任务为目标检测时，能力边界必须支持目标检测。");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "image");
  const supportOcr = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportOcr"));
  const supportDetection = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportDetection"));
  const supportedResolutions = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedResolutions"));
  const defaultTaskType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultTaskType") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "image") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  const defaultTaskLabel =
    defaultTaskType === "ocr" ? "OCR" : defaultTaskType === "detection" ? "目标检测" : defaultTaskType === "general" ? "通用识别" : defaultTaskType;

  return {
    boundary: [
      supportOcr ? "支持 OCR" : "",
      supportDetection ? "支持目标检测" : "",
      supportedResolutions.length > 0 ? supportedResolutions.join(" / ") : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultTaskLabel ? `默认任务 ${defaultTaskLabel}` : ""].filter(Boolean).join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 × 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 × 分辨率/任务倍率`,
  };
}

export function buildImageUnderstandingCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按张数 / 分辨率 / 任务类型计费",
  };
}
export const imageUnderstandingCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "image_understanding",
    label: "视觉理解",
    bucket: "image",
    category: "image",
    schemaLevel: "full",
    description: "视觉识别、OCR、检测、理解",
    keywords: [/图像理解/i, /视觉理解/i, /看图/i, /OCR/i, /图片理解/i],
    sections,
    templatePresets,
  },
  templates: {
    ruleMetricSuggestions: ["resolution", "task_type"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by image count, resolution, and task type",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：image / 10 images / 100 images",
    ruleValuePlaceholder: "例如：ocr / 1024x1024",
    simulationQuantityLabel: "图片张数",
    simulationQuantityUnitLabel: "张",
  },
};
