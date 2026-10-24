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
  resolveCapabilityUnitKind,
  resolvePricingUnitDescriptor,
} from "../pricingUnit";
import type { PricingUnitKind } from "../pricingUnit";
import type {
  CapabilityFieldUiConfig,
  CapabilityFieldUiContext,
  CapabilityOverviewContext,
  CapabilityPackage,
  CapabilityPlugin,
} from "../capabilityPluginTypes";

const formatOptions = ["obj", "glb", "fbx", "stl", "usd", "usdz"];

const sections: CapabilitySectionDefinition[] = [
  {
    id: "capability",
    target: "boundary",
    title: "能力边界",
    description: "维护 3D 生成的格式与输出选项。",
    fields: [
      { key: "supportTextTo3d", label: "支持文生3D", type: "boolean", defaultValue: true },
      { key: "supportImageTo3d", label: "支持图生3D", type: "boolean", defaultValue: true },
      { key: "supportMesh", label: "支持网格输出", type: "boolean", defaultValue: true },
      { key: "supportTexture", label: "支持贴图输出", type: "boolean", defaultValue: true },
      {
        key: "supportedFormats",
        label: "支持格式",
        type: "multiselect",
        defaultValue: ["obj", "glb"],
        options: formatOptions.map((value) => ({ label: value, value })),
      },
      { key: "maxReferenceImages", label: "最大参考图数", type: "number", defaultValue: 1, placeholder: "例如：1" },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护 3D 生成的默认参数。",
    fields: [
      {
        key: "defaultFormat",
        label: "默认格式",
        type: "select",
        defaultValue: "glb",
        options: formatOptions.map((value) => ({ label: value, value })),
      },
      {
        key: "defaultQuality",
        label: "默认精度",
        type: "select",
        defaultValue: "standard",
        options: [
          { label: "标准", value: "standard" },
          { label: "高精度", value: "high" },
        ],
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_3d",
    label: "标准 3D 生成",
    scenario: "通用 3D 模型资产生成",
    pricingFocus: "基础按百万 Tokens 计费",
    recommended: true,
  },
  {
    templateId: "per_request_3d",
    label: "按次 3D 生成",
    scenario: "混元等按次结算的 3D 接口",
    pricingFocus: "按次请求计费",
  },
];

function buildPricing(templateId: string, _index: number = 0): CapabilityPricing {
  if (templateId === "per_request_3d") {
    return {
      templateId,
      isCustomized: false,
      basePrice: 3.6,
      unit: "request",
      unitKind: "request",
      currency: "CNY",
      rules: [],
    };
  }
  return {
    templateId,
    isCustomized: false,
    basePrice: 4.5,
    unit: "1M tokens",
    unitKind: "token",
    currency: "CNY",
    rules: [
      { id: `${templateId}-quality`, metric: "quality", operator: "eq", value: "high", multiplier: 1.4, description: "High quality mesh" },
      { id: `${templateId}-format`, metric: "format", operator: "eq", value: "glb", multiplier: 1.1, description: "GLB export" },
    ],
  };
}

function getBooleanValue(value: unknown, defaultWhenMissing = false) {
  if (value === true) return true;
  if (value === false) return false;
  return defaultWhenMissing;
}

function pricingFallbackKind(config: ModelCapabilityConfig): PricingUnitKind {
  return resolveCapabilityUnitKind(
    "three_d_generation",
    String(config.pricing.unit || ""),
    config.pricing.unitKind,
  );
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

function formatQualityLabel(value: string) {
  if (value === "standard") return "标准";
  if (value === "high") return "高精度";
  if (value === "ultra") return "超高精度";
  return value;
}

function getFieldUiConfig(context: CapabilityFieldUiContext): CapabilityFieldUiConfig | null {
  const { field, value, config } = context;
  if (field.key !== "defaultFormat") return null;

  return {
    options: Array.from(new Set([...getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedFormats")), String(value || "").trim()].filter(Boolean))).map((item) => ({
      label: item,
      value: item,
    })),
    helperText: "默认格式应直接继承能力边界中已启用的 3D 输出格式。",
  };
}

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  const supportedFormats = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedFormats"));
  const defaultFormat = String(getCapabilityConfigFieldValue(config, "defaults", "defaultFormat") || "").trim() || supportedFormats[0] || "glb";
  const defaultQuality = String(getCapabilityConfigFieldValue(config, "defaults", "defaultQuality") || "").trim() || "standard";

  return [
    { key: "taskCount", label: "任务数", type: "number", defaultValue: 1, min: 1, step: 1 },
    {
      key: "quality",
      label: "精度",
      type: "select",
      defaultValue: defaultQuality,
      options: [
        { label: "标准", value: "standard" },
        { label: "高精度", value: "high" },
      ],
    },
    {
      key: "format",
      label: "输出格式",
      type: "select",
      defaultValue: defaultFormat,
      options: (supportedFormats.length > 0 ? supportedFormats : ["obj", "glb"]).map((value) => ({ label: value, value })),
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.taskCount, 1));
  const basePrice = Number(config.pricing.basePrice || 0);
  const fallbackKind = pricingFallbackKind(config);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, fallbackKind);
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, fallbackKind);
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
  const formulaParts = [buildScaledPricingFormula(basePrice, quantity, config.pricing.unit, fallbackKind)];
  if (hitRules.length > 0) {
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" x "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "tokens",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" x "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const supportImageTo3d = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportImageTo3d"), true);
  const supportMesh = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportMesh"));
  const supportTexture = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportTexture"));
  const supportedFormats = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedFormats"));
  const defaultFormat = String(getCapabilityConfigFieldValue(config, "defaults", "defaultFormat") || "").trim();
  const maxReferenceImages = getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxReferenceImages"), 0);

  if (!supportMesh && !supportTexture) {
    issues.push("3D 生成至少需要支持网格输出或贴图输出中的一种。");
  }

  if (supportedFormats.length === 0) {
    issues.push("3D 生成至少需要配置一个支持格式。");
  }

  if (defaultFormat && supportedFormats.length > 0 && !supportedFormats.includes(defaultFormat)) {
    issues.push("默认格式必须属于能力边界中已启用的支持格式。");
  }

  if (supportImageTo3d && maxReferenceImages < 1) {
    issues.push("图生3D至少需要允许 1 张参考图。");
  }

  return issues;
}

function normalizeFields(config: ModelCapabilityConfig): ModelCapabilityConfig {
  const templateId = String(config.pricing.templateId || "").trim();
  const basePrice = Number(config.pricing.basePrice || 0);
  if (templateId || basePrice > 0) {
    return config;
  }
  return {
    ...config,
    pricing: {
      ...buildPricing("standard_3d"),
      isCustomized: false,
    },
  };
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const fallbackKind = pricingFallbackKind(config);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, fallbackKind);
  const supportTextTo3d = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportTextTo3d"), true);
  const supportImageTo3d = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportImageTo3d"), true);
  const supportMesh = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportMesh"));
  const supportTexture = getBooleanValue(getCapabilityConfigFieldValue(config, "boundary", "supportTexture"));
  const supportedFormats = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedFormats"));
  const maxReferenceImages = getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxReferenceImages"), 0);
  const defaultFormat = String(getCapabilityConfigFieldValue(config, "defaults", "defaultFormat") || "").trim();
  const defaultQuality = formatQualityLabel(String(getCapabilityConfigFieldValue(config, "defaults", "defaultQuality") || "").trim());
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, fallbackKind) : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      supportTextTo3d ? "文生3D" : "",
      supportImageTo3d ? (maxReferenceImages > 1 ? `图生3D x${maxReferenceImages}` : "图生3D") : "",
      supportMesh ? "支持网格输出" : "",
      supportTexture ? "支持贴图输出" : "",
      supportedFormats.length > 0 ? supportedFormats.join(" / ") : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultFormat, defaultQuality].filter(Boolean).join(" | "),
    template: matchedTemplate ? `${matchedTemplate.template.label}${matchedTemplate.isExactMatch ? "" : "（已微调）"}` : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充",
    formula: `总价 = 基础单价 x 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 x 精度倍率 x 格式倍率`,
  };
}

export function buildThreeDGenerationCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getFieldUiConfig,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按任务数 / 格式 / 精度计费",
  };
}
export const threeDGenerationCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "three_d_generation",
    label: "3D 内容生成",
    bucket: "three_d",
    category: "3d",
    schemaLevel: "full",
    description: "3D 资产生成、贴图与网格输出",
    keywords: [/3D/i, /三维/i, /模型生成/i],
    sections,
    templatePresets,
    getFieldUiConfig,
  },
  templates: {
    ruleMetricSuggestions: ["quality", "format"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by task count, format, and quality",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  normalizeFields,
  pricingEditor: {
    unitPlaceholder: "例如：1M tokens / request",
    ruleValuePlaceholder: "例如：high / glb",
    simulationQuantityLabel: "任务数",
    simulationQuantityUnitLabel: "次",
  },
};
