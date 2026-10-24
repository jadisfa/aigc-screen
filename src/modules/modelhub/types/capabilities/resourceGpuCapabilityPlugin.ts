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

const gpuTypes = ["L20", "A10", "A100", "H100"];

const sections: CapabilitySectionDefinition[] = [
  {
    id: "capability",
    target: "boundary",
    title: "能力边界",
    description: "维护可用 GPU 型号与最大显存。",
    fields: [
      {
        key: "supportedGpuTypes",
        label: "支持的型号",
        type: "multiselect",
        defaultValue: ["A10", "A100"],
        options: gpuTypes.map((value) => ({ label: value, value })),
      },
      { key: "maxMemoryGb", label: "最大显存(GB)", type: "number", defaultValue: 80 },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护默认使用的 GPU 资源。",
    fields: [
      {
        key: "defaultGpuType",
        label: "默认型号",
        type: "select",
        defaultValue: "A10",
        options: gpuTypes.map((value) => ({ label: value, value })),
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "standard_gpu",
    label: "标准算力",
    scenario: "通用推理任务挂载算力",
    pricingFocus: "按机型分档计费",
    recommended: true,
  },
];

function buildPricing(templateId: string): CapabilityPricing {
  return {
    templateId,
    isCustomized: false,
    basePrice: 0.9,
    unit: "minute",
    currency: "CNY",
    rules: [
      { id: `${templateId}-gpu`, metric: "gpu_type", operator: "eq", value: "A100", multiplier: 1.5, description: "A100 GPU" },
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

function getFieldUiConfig(context: CapabilityFieldUiContext): CapabilityFieldUiConfig | null {
  const { field, value, config } = context;

  if (field.key === "supportedGpuTypes") {
    return {
      rendererKey: "option_grid",
      layout: {
        colSpan: 2,
      },
      props: {
        draftPlaceholder: "Enter a GPU type and press Enter",
      },
    };
  }

  if (field.key !== "defaultGpuType") return null;

  const options = Array.from(
    new Set([...getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedGpuTypes")), String(value || "").trim()].filter(Boolean)),
  ).map((item) => ({
    label: item,
    value: item,
  }));

  return {
    hidden: options.length <= 1,
    rendererKey: "supported_value_select",
    options,
    helperText: "Default GPU type is constrained by the enabled boundary GPU types.",
    props: {
      placeholder: "Select a default GPU type",
    },
  };
}

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  const supportedGpuTypes = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedGpuTypes"));
  const defaultGpuType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultGpuType") || "").trim() || supportedGpuTypes[0] || "A10";

  return [
    { key: "durationHours", label: "Duration", type: "number", defaultValue: 1, min: 1, step: 1, unit: "hour" },
    {
      key: "gpuType",
      label: "GPU Type",
      type: "select",
      defaultValue: defaultGpuType,
      options: (supportedGpuTypes.length > 0 ? supportedGpuTypes : ["A10", "A100"]).map((value) => ({ label: value, value })),
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.durationHours, 1));
  const basePrice = Number(config.pricing.basePrice || 0);
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "hour");
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, "hour");
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
  const formulaParts = [buildScaledPricingFormula(basePrice, quantity, config.pricing.unit, "hour")];
  if (hitRules.length > 0) {
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" x "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "hour",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" x "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const supportedGpuTypes = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedGpuTypes"));
  const maxMemoryGb = getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxMemoryGb"), 0);
  const defaultGpuType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultGpuType") || "").trim();

  if (supportedGpuTypes.length === 0) {
    issues.push("At least one supported GPU type is required.");
  }

  if (!(maxMemoryGb > 0)) {
    issues.push("Max GPU memory must be greater than 0.");
  }

  if (defaultGpuType && supportedGpuTypes.length > 0 && !supportedGpuTypes.includes(defaultGpuType)) {
    issues.push("Default GPU type must be included in supported GPU types.");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "hour");
  const supportedGpuTypes = getStringArrayValue(getCapabilityConfigFieldValue(config, "boundary", "supportedGpuTypes"));
  const maxMemoryGb = String(getCapabilityConfigFieldValue(config, "boundary", "maxMemoryGb") || "").trim();
  const defaultGpuType = String(getCapabilityConfigFieldValue(config, "defaults", "defaultGpuType") || "").trim();
  const pricingRules = config.pricing.rules.slice(0, 2);
  const pricingLabel = [
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit, "hour") : "",
    ...pricingRules.map((rule) => `${rule.metric}:${rule.multiplier}x`),
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    boundary: [
      supportedGpuTypes.length > 0 ? supportedGpuTypes.join(" / ") : "",
      maxMemoryGb ? `max ${maxMemoryGb}GB` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultGpuType ? `default ${defaultGpuType}` : ""].filter(Boolean).join(" | "),
    template: matchedTemplate ? formatCapabilityTemplateText(matchedTemplate.template.label, matchedTemplate.isExactMatch) : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充定价",
    formula: `总价 = 基础单价 × 折算后的 ${pricingUnitDescriptor.displayLabel} 数量 × 命中规则倍率（无规则则按基础单价）`,
  };
}

export function buildResourceGpuCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getFieldUiConfig,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
    buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "priced by GPU duration and model type",
  };
}

export const resourceGpuCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "resource_gpu",
    label: "GPU 资源计费",
    bucket: "resource",
    category: "resource",
    schemaLevel: "full",
    description: "基于 GPU 时长、显存等资源计量",
    keywords: [/GPU/i, /显存/i, /算力/i, /资源计费/i],
    sections,
    templatePresets,
    getFieldUiConfig,
  },
  templates: {
    ruleMetricSuggestions: ["gpu_type"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
      basePlugin.buildPricingSummary(config) || "priced by GPU duration and model type",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：minute / hour",
    ruleValuePlaceholder: "例如：A100",
    simulationQuantityLabel: "GPU 时长",
    simulationQuantityUnitLabel: "小时",
  },
};
