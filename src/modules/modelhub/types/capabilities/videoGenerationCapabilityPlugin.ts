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
  getVideoCapabilityFrameRates,
  getVideoCapabilityResolutions,
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
import {
  buildDefaultVideoRateCard,
  excludeVideoAxisRules,
  hydrateVideoRateCard,
  selectVideoRateCardUnitPrice,
} from "../videoRateCard";

const resolutionOptions = ["480p", "540p", "720p", "768p", "1080p", "2K", "4K"];
const frameRateOptions = ["24", "30", "60"];
const aspectRatioOptions = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"];

const sections: CapabilitySectionDefinition[] = [
  {
    id: "capability",
    target: "boundary",
    title: "能力边界",
    description: "只维护真正支持的能力边界，不包含价格和默认值。",
    fields: [
      { key: "supportTextToVideo", label: "支持文生视频", type: "boolean", defaultValue: true },
      { key: "supportImageToVideo", label: "支持图生视频", type: "boolean", defaultValue: false },
      { key: "supportGenerateAudio", label: "支持原生音频", type: "boolean", defaultValue: true },
      { key: "supportVideoEdit", label: "支持视频编辑", type: "boolean", defaultValue: false },
      { key: "supportVideoExtend", label: "支持视频延长", type: "boolean", defaultValue: false },
      { key: "allowAudioOnly", label: "允许纯音频参考", type: "boolean", defaultValue: false },
      { key: "audioRequiresVisual", label: "音频须搭配画面", type: "boolean", defaultValue: false },
      { key: "maxReferenceImages", label: "参考图上限", type: "number", defaultValue: 0, placeholder: "0 表示不支持" },
      { key: "maxReferenceVideos", label: "参考视频上限", type: "number", defaultValue: 0, placeholder: "0 表示不支持" },
      { key: "maxReferenceAudios", label: "参考音频上限", type: "number", defaultValue: 0, placeholder: "0 表示不支持" },
      { key: "minDurationSeconds", label: "最短时长(秒)", type: "number", defaultValue: 4, placeholder: "例如：4" },
      { key: "maxDurationSeconds", label: "最大时长(秒)", type: "number", defaultValue: 5, placeholder: "例如：10" },
      {
        key: "resolutions",
        label: "支持分辨率",
        type: "multiselect",
        defaultValue: ["480p", "720p", "1080p"],
        options: resolutionOptions.map((value) => ({ label: value, value })),
      },
      {
        key: "frameRates",
        label: "支持帧率",
        type: "multiselect",
        defaultValue: ["24", "30"],
        options: frameRateOptions.map((value) => ({ label: `${value}fps`, value })),
      },
      {
        key: "aspectRatios",
        label: "支持画幅",
        type: "multiselect",
        defaultValue: ["16:9", "9:16", "adaptive"],
        options: aspectRatioOptions.map((value) => ({ label: value, value })),
      },
    ],
  },
  {
    id: "default",
    target: "defaults",
    title: "默认参数",
    description: "维护视频生成的默认 API 参数。",
    fields: [
      {
        key: "defaultResolution",
        label: "默认分辨率",
        type: "select",
        defaultValue: "720p",
        options: resolutionOptions.map((value) => ({ label: value, value })),
      },
      {
        key: "defaultFrameRate",
        label: "默认帧率",
        type: "select",
        defaultValue: "24",
        options: frameRateOptions.map((value) => ({ label: `${value}fps`, value })),
      },
      { key: "defaultDurationSeconds", label: "默认时长(秒)", type: "number", defaultValue: 5, placeholder: "例如：5" },
      {
        key: "defaultAspectRatio",
        label: "默认画幅",
        type: "select",
        defaultValue: "16:9",
        options: aspectRatioOptions.map((value) => ({ label: value, value })),
      },
    ],
  },
];

const templatePresets: CapabilityTemplatePresetDefinition[] = [
  {
    templateId: "short_video_standard",
    label: "短视频标准版",
    scenario: "常规 5-10 秒短视频、应用默认视频生成",
    pricingFocus: "分辨率秒价表，条件倍率仅作加价",
    recommended: true,
  },
  {
    templateId: "marketing_hd",
    label: "高清营销版",
    scenario: "品牌宣传片、商品短片、活动预告",
    pricingFocus: "高清分辨率秒价表，条件倍率仅作加价",
  },
];

function buildPricing(templateId: string, index: number): CapabilityPricing {
  const basePrice = index === 0 ? 1.2 : 1.8;
  const rateCard = buildDefaultVideoRateCard(basePrice);
  return {
    templateId,
    isCustomized: false,
    basePrice,
    unit: "second",
    currency: "CNY",
    rateCard,
    rules: [],
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

function normalizeFields(config: ModelCapabilityConfig): ModelCapabilityConfig {
  const {
    extendedCapabilityParams: _extendedCapabilityParams,
    fieldMappings: _fieldMappings, // 出站映射只属于协议 submit.body，不保存在基础模型
    ...boundary
  } = config.boundary;
  const {
    extendedDefaultParams: _extendedDefaultParams,
    ...defaults
  } = config.defaults;

  const rateCard = hydrateVideoRateCard({
    ...config,
    boundary,
    defaults,
  });
  const defaultRow = rateCard.find((row) => row.isDefault);

  return {
    ...config,
    boundary: {
      ...boundary,
    },
    defaults,
    pricing: {
      ...config.pricing,
      rateCard,
      rules: excludeVideoAxisRules(config.pricing.rules),
      basePrice: defaultRow && defaultRow.unitPrice > 0 ? defaultRow.unitPrice : config.pricing.basePrice,
    },
  };
}

function getStringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFieldUiConfig(context: CapabilityFieldUiContext): CapabilityFieldUiConfig | null {
  const { field, value, config } = context;

  if (field.key === "resolutions" || field.key === "frameRates") {
    return {
      rendererKey: "option_grid",
      layout: {
        colSpan: 2,
      },
      props: {
        draftPlaceholder: field.key === "resolutions" ? "例如 1440p，回车添加" : "例如 48，回车添加",
      },
    };
  }

  if (field.key === "defaultResolution") {
    return {
      rendererKey: "supported_value_select",
      options: Array.from(new Set([...getVideoCapabilityResolutions(config), String(value || "").trim()].filter(Boolean))).map((item) => ({
        label: item,
        value: item,
      })),
      //  helperText: "Default resolution is constrained by the enabled boundary resolutions.",
      props: {
        placeholder: "Select a default resolution",
      },
    };
  }

  if (field.key === "defaultAspectRatio") {
    const supported = Array.from(
      new Set(
        [
          ...((Array.isArray(getCapabilityConfigFieldValue(config, "boundary", "aspectRatios"))
            ? (getCapabilityConfigFieldValue(config, "boundary", "aspectRatios") as string[])
            : []
          )
            .map((item) => String(item).trim())
            .filter(Boolean)),
          String(value || "").trim(),
        ].filter(Boolean),
      ),
    );
    return {
      rendererKey: "supported_value_select",
      options: supported.map((item) => ({ label: item, value: item })),
      // helperText: "Default aspect ratio is constrained by the enabled boundary aspect ratios.",
      props: {
        placeholder: "Select a default aspect ratio",
      },
    };
  }

  if (field.key === "defaultFrameRate") {
    const options = Array.from(new Set([...getVideoCapabilityFrameRates(config), String(value || "").trim()].filter(Boolean))).map((item) => ({
      label: `${item}fps`,
      value: item,
    }));

    return {
      hidden: options.length <= 1,
      rendererKey: "supported_value_select",
      options,
      // helperText: "Default frame rate is constrained by the enabled boundary frame rates.",
      props: {
        placeholder: "Select a default frame rate",
      },
    };
  }

  return null;
}

function getPricingSimulatorFields(config: ModelCapabilityConfig): CapabilityPricingSimulatorFieldDefinition[] {
  const supportedResolutions = getVideoCapabilityResolutions(config);
  const minDurationSeconds = Math.max(1, getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "minDurationSeconds"), 1));
  const maxDurationSeconds = Math.max(minDurationSeconds, getNumberValue(getCapabilityConfigFieldValue(config, "boundary", "maxDurationSeconds"), 5));
  const defaultResolution =
    getStringValue(getCapabilityConfigFieldValue(config, "defaults", "defaultResolution")) || supportedResolutions[0] || "720p";
  const defaultDurationSeconds = Math.min(
    Math.max(minDurationSeconds, getNumberValue(getCapabilityConfigFieldValue(config, "defaults", "defaultDurationSeconds"), 5)),
    maxDurationSeconds,
  );

  return [
    {
      key: "durationSeconds",
      label: "时长",
      type: "number",
      defaultValue: defaultDurationSeconds,
      min: minDurationSeconds,
      max: maxDurationSeconds,
      step: 1,
      unit: "second",
      helperText: `单次最长 ${maxDurationSeconds} 秒。`,
    },
    {
      key: "resolution",
      label: "分辨率",
      type: "select",
      defaultValue: defaultResolution,
      options: supportedResolutions.map((item) => ({ label: item, value: item })),
      helperText: "仅可选择能力边界中已启用的分辨率。",
    },
  ];
}

function simulatePricing(
  config: ModelCapabilityConfig,
  input: CapabilityPricingSimulatorInput,
): CapabilityPricingSimulationResult | null {
  const quantity = Math.max(1, getNumberValue(input.durationSeconds, 1));
  const rateCard = hydrateVideoRateCard(config);
  const unitPrice = selectVideoRateCardUnitPrice(
    rateCard,
    input.resolution,
    Number(config.pricing.basePrice || 0),
  );
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "second");
  const billedQuantity = convertToBillingQuantity(quantity, config.pricing.unit, "second");
  const baseAmount = unitPrice * billedQuantity;
  const hitRules: CapabilityPricingSimulationMatchedRule[] = [];
  let totalMultiplier = 1;

  for (const rule of excludeVideoAxisRules(config.pricing.rules)) {
    const actualValue = getBillingMetricSimulationValue(rule.metric, input, {
      frame_rate: `${String(input.frameRate || "").replace(/fps$/gi, "")}fps`,
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
  const formulaParts = [buildScaledPricingFormula(unitPrice, quantity, config.pricing.unit, "second")];
  if (hitRules.length > 0) {
    formulaParts.push(hitRules.map((item) => item.multiplier).join(" x "));
  }

  return {
    quantity,
    baseAmount,
    total,
    currency: config.pricing.currency || "CNY",
    unit: "second",
    billedQuantity,
    billedUnitLabel: pricingUnitDescriptor.displayLabel,
    formula: formulaParts.join(" x "),
    hitRules,
  };
}

function getValidationIssues(basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) {
  const issues = [...basePlugin.getValidationIssues(config)];
  const supportedResolutions = getVideoCapabilityResolutions(config);
  const supportedFrameRates = getVideoCapabilityFrameRates(config);
  const defaultResolution = String(getCapabilityConfigFieldValue(config, "defaults", "defaultResolution") || "").trim();
  const defaultFrameRate = String(getCapabilityConfigFieldValue(config, "defaults", "defaultFrameRate") || "").trim();
  const defaultAspectRatio = String(getCapabilityConfigFieldValue(config, "defaults", "defaultAspectRatio") || "").trim();
  const supportedAspectRatios = Array.isArray(getCapabilityConfigFieldValue(config, "boundary", "aspectRatios"))
    ? (getCapabilityConfigFieldValue(config, "boundary", "aspectRatios") as string[]).map((item) => String(item).trim()).filter(Boolean)
    : [];
  const maxDuration = Number(getCapabilityConfigFieldValue(config, "boundary", "maxDurationSeconds") || 0);
  const defaultDuration = Number(getCapabilityConfigFieldValue(config, "defaults", "defaultDurationSeconds") || 0);

  if (defaultResolution && supportedResolutions.length > 0 && !supportedResolutions.includes(defaultResolution)) {
    issues.push("Default resolution must be included in supported resolutions.");
  }

  if (defaultAspectRatio && supportedAspectRatios.length > 0 && !supportedAspectRatios.includes(defaultAspectRatio)) {
    issues.push("Default aspect ratio must be included in supported aspect ratios.");
  }

  if (defaultFrameRate && supportedFrameRates.length > 0 && !supportedFrameRates.includes(defaultFrameRate)) {
    issues.push("Default frame rate must be included in supported frame rates.");
  }

  if (maxDuration > 0 && defaultDuration > maxDuration) {
    issues.push("Default duration cannot exceed the boundary max duration.");
  }

  return issues;
}

function buildOverview(context: CapabilityOverviewContext) {
  const { config, matchedTemplate, billingSummary } = context;
  const pricingUnitDescriptor = resolvePricingUnitDescriptor(config.pricing.unit, "second");
  const supportedResolutions = getVideoCapabilityResolutions(config);
  const supportedFrameRates = getVideoCapabilityFrameRates(config).map((value) => `${value}fps`);
  const maxDuration = String(getCapabilityConfigFieldValue(config, "boundary", "maxDurationSeconds") || "").trim();
  const defaultResolution = String(getCapabilityConfigFieldValue(config, "defaults", "defaultResolution") || "").trim();
  const defaultFrameRate = String(getCapabilityConfigFieldValue(config, "defaults", "defaultFrameRate") || "").trim();
  const defaultDuration = String(getCapabilityConfigFieldValue(config, "defaults", "defaultDurationSeconds") || "").trim();
  const rateCard = hydrateVideoRateCard(config);
  const pricingLabel = [
    ...rateCard.map((row) => `${row.resolution} ${buildPricingRateLabel(row.unitPrice, config.pricing.unit, "second")}`),
  ]
    .filter(Boolean)
    .join(" / ");

  return {
    boundary: [
      maxDuration ? `${maxDuration}s` : "",
      supportedResolutions.length > 0 ? supportedResolutions.join(" / ") : "",
      supportedFrameRates.length > 0 ? supportedFrameRates.join(" / ") : "",
    ]
      .filter(Boolean)
      .join(" | "),
    defaults: [defaultDuration ? `${defaultDuration}s` : "", defaultResolution, defaultFrameRate ? `${defaultFrameRate}fps` : ""]
      .filter(Boolean)
      .join(" | "),
    template: matchedTemplate ? formatCapabilityTemplateText(matchedTemplate.template.label, matchedTemplate.isExactMatch) : "未选择模板",
    pricing: pricingLabel || billingSummary || "待补充定价",
    formula: `总价 = 分辨率秒价 × 折算后的 ${pricingUnitDescriptor.displayLabel} 数量（条件倍率仅作加价）`,
  };
}

export function buildVideoGenerationCapabilityPlugin(basePlugin: CapabilityPlugin): CapabilityPlugin {
  return {
    ...basePlugin,
    getFieldUiConfig,
    getPricingSimulatorFields,
    simulatePricing,
    getValidationIssues: (config) => getValidationIssues(basePlugin, config),
    buildOverview,
        buildPricingSummary: (config) => basePlugin.buildPricingSummary(config) || "按分辨率秒价 × 时长计费",
  };
}

export const videoGenerationCapabilityPackage: CapabilityPackage = {
  manifest: {
    code: "video_generation",
    label: "视频生成",
    bucket: "video",
    category: "video",
    schemaLevel: "full",
    description: "文生视频、图生视频、视频增强",
    keywords: [/视频生成/i, /文生视频/i, /图生视频/i, /视频增强/i],
    sections,
    templatePresets,
    getFieldUiConfig,
  },
  templates: {
    ruleMetricSuggestions: ["quality", "duration"],
    buildPricing,
  },
  validators: {
    getIssues: getValidationIssues,
  },
  overview: {
    build: buildOverview,
    buildPricingSummary: (basePlugin, config) =>
          basePlugin.buildPricingSummary(config) || "按分辨率秒价 × 时长计费",
  },
  simulator: {
    getFields: getPricingSimulatorFields,
    simulate: simulatePricing,
  },
  pricingEditor: {
    unitPlaceholder: "例如：second / minute / hour",
    ruleValuePlaceholder: "例如：audio_on / >10s",
    simulationQuantityLabel: "秒视频",
    simulationQuantityUnitLabel: "秒",
  },
  normalizeFields,
};
