export type CapabilityFilterValue = "语言模型" | "视觉模型" | "3D模型" | "多模态模型" | "向量模型" | "语音模型";

export const MODEL_CAPABILITY_CODES = [
  "text_generation",
  "deep_thinking",
  "translation",
  "role_play",
  "text_understanding",
  "text_embedding",
  "multimodal_embedding",
  "image_generation",
  "image_understanding",
  "video_generation",
  "video_understanding",
  "three_d_generation",
  "speech_recognition",
  "speech_synthesis",
  "ai_dubbing",
  "music_generation",
  "speech_understanding",
  "tool_calling",
  "resource_gpu",
] as const;

export type ModelCapabilityCode = (typeof MODEL_CAPABILITY_CODES)[number];

export const MODEL_CAPABILITY_CATEGORIES = ["text", "vector", "image", "audio", "video", "3d", "agent", "resource"] as const;
export type ModelCapabilityCategory = (typeof MODEL_CAPABILITY_CATEGORIES)[number];

export const MODEL_CAPABILITY_BUCKETS = ["text", "image", "speech", "video", "three_d", "tool", "resource"] as const;
export type ModelCapabilityBucket = (typeof MODEL_CAPABILITY_BUCKETS)[number];

export type CapabilityFieldType = "boolean" | "text" | "number" | "textarea" | "select" | "multiselect";
export type CapabilitySchemaLevel = "full" | "minimal";

export type CapabilityFieldDefinition = {
  key: string;
  label: string;
  type: CapabilityFieldType;
  defaultValue: string | number | boolean | string[] | Record<string, unknown>;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

export type CapabilitySectionDefinition = {
  id: string;
  target: CapabilityConfigSectionKey;
  title: string;
  description: string;
  fields: CapabilityFieldDefinition[];
};

export type CapabilityTemplatePresetDefinition = {
  templateId: string;
  label: string;
  scenario: string;
  pricingFocus: string;
  recommended?: boolean;
};

export type CapabilityConfigValue = string | number | boolean | string[] | Record<string, unknown>;

export type CapabilityConfigMap = Record<string, CapabilityConfigValue>;
export type CapabilityConfigSectionKey = "boundary" | "defaults";

export type CapabilityPricingTemplate = {
  id: string;
  label: string;
  description: string;
  useCase: string;
  priceStyle: string;
  pricing: CapabilityPricing;
};

export type BillingRuleOperator = "eq" | "gt" | "gte" | "lt" | "lte" | "in" | "range";

export type BillingRuleValue = string | number | string[] | { min?: number; max?: number };

export type CapabilityPricingRule = {
  id: string;
  metric: string;
  operator: BillingRuleOperator;
  value: BillingRuleValue;
  multiplier: number;
  description?: string;
};

export type CapabilityPricingMode = "flat" | "metered";

export type CapabilityPricingRateCardRow = {
  resolution: string;
  unitPrice: number;
  isDefault?: boolean;
};

export const MODEL_CAPABILITY_BILLING_TYPES = {
  text_generation: "text",
  deep_thinking: "text",
  translation: "text",
  role_play: "text",
  text_understanding: "text",
  text_embedding: "vector",
  multimodal_embedding: "vector",
  image_generation: "image",
  image_understanding: "multimodal",
  speech_recognition: "audio",
  speech_synthesis: "audio",
  ai_dubbing: "audio",
  music_generation: "audio",
  speech_understanding: "multimodal",
  video_generation: "video",
  video_understanding: "multimodal",
  three_d_generation: "three_d",
  tool_calling: "multimodal",
  resource_gpu: "gpu_resource",
} as const satisfies Record<ModelCapabilityCode, string>;

export type FormalBillingCapabilityType = (typeof MODEL_CAPABILITY_BILLING_TYPES)[ModelCapabilityCode];
export type FormalBillingLineItemType = "metered" | "tiered" | "fixed";
export type FormalBillingMeterCategory = "token" | "image" | "audio" | "video" | "gpu" | "request" | "custom";

export function resolveFormalBillingCapabilityType(code: ModelCapabilityCode): FormalBillingCapabilityType {
  return MODEL_CAPABILITY_BILLING_TYPES[code];
}

export type FormalBillingRateTier = {
  start?: number;
  end?: number;
  unitPrice?: number;
  flatFee?: number;
  multiplier?: number;
  currency?: string;
};

export type FormalBillingAdjustment = {
  metric: string;
  operator: BillingRuleOperator;
  value?: BillingRuleValue;
  multiplier?: number;
  fixedFee?: number;
  description?: string;
};

export type FormalBillingLineItem = {
  code: string;
  label: string;
  type: FormalBillingLineItemType;
  meterKey: string;
  meterCategory: FormalBillingMeterCategory;
  unit: string;
  currency: string;
  unitPrice?: number;
  tiers?: FormalBillingRateTier[];
  fixedFee?: number;
  minimumCharge?: number;
  maximumCharge?: number;
  floorCharge?: number;
  adjustments?: FormalBillingAdjustment[];
  metadata?: Record<string, unknown>;
};

export type FormalBillingFx = {
  sourceCurrency: string;
  settlementCurrency: string;
  exchangeRate: number;
  rateSource?: string;
};

export type FormalBillingModel = {
  version: string;
  capabilityType: FormalBillingCapabilityType;
  pricingMode: CapabilityPricingMode;
  settlementCurrency: string;
  minimumCharge?: number;
  maximumCharge?: number;
  floorCharge?: number;
  lineItems: FormalBillingLineItem[];
  fixedSurcharges?: FormalBillingLineItem[];
  fx?: FormalBillingFx | null;
  metadata?: Record<string, unknown>;
};

export type CapabilityPricingFieldMappingValueType = "string" | "number" | "boolean" | "array" | "object";
export type CapabilityPricingFieldMappingMode = "direct" | "derived" | "readonly";
export type CapabilityPricingLegacyPageMode = "editable" | "readonly";
export type CapabilityPricingMigrationSource = "legacy_pricing" | "formal_billing";

export type CapabilityPricingFieldMapping = {
  key: string;
  formPath: string;
  formLabel: string;
  backendPath: string;
  valueType: CapabilityPricingFieldMappingValueType;
  mode: CapabilityPricingFieldMappingMode;
  editable: boolean;
  description?: string;
};

export type CapabilityPricingProjectionFieldGroup = {
  id: string;
  label: string;
  summary: string;
  meters: readonly string[];
  fields: readonly CapabilityPricingFieldMapping[];
};

export type CapabilityPricingLegacyPageBoundary = {
  source: CapabilityPricingMigrationSource;
  mode: CapabilityPricingLegacyPageMode;
  reason: string;
  disabledFieldKeys: readonly string[];
  migrationSummary: string;
};

export type CapabilityPricingProjectionBase = {
  capabilityType: FormalBillingCapabilityType;
  primaryMeter: string;
  primaryUnit: string;
  primaryCurrency: string;
  supportedMeters: readonly string[];
  settlementCurrency: string;
  hasTieredPricing: boolean;
  hasFixedSurcharges: boolean;
  hasMinimumCharge: boolean;
  hasMaximumCharge: boolean;
  hasFloorCharge: boolean;
  hasFx: boolean;
  fieldGroups: readonly CapabilityPricingProjectionFieldGroup[];
  fieldMappings: readonly CapabilityPricingFieldMapping[];
  legacyPage: Readonly<CapabilityPricingLegacyPageBoundary>;
};

export type CapabilityPricingProjectionReadonlyBoundary = Readonly<
  Pick<CapabilityPricingProjectionBase, "fieldGroups" | "fieldMappings" | "legacyPage">
>;

export type TextCapabilityPricingProjection = CapabilityPricingProjectionBase & {
  capabilityType: "text";
  meterKeys: {
    inputToken?: string;
    outputToken?: string;
    cacheHitToken?: string;
    reasoningToken?: string;
    auxiliaryMeters: string[];
  };
};

export type VectorCapabilityPricingProjection = CapabilityPricingProjectionBase & {
  capabilityType: "vector";
  meterKeys: {
    inputToken?: string;
    dimension?: string;
    auxiliaryMeters: string[];
  };
};

export type MultimodalCapabilityPricingProjection = CapabilityPricingProjectionBase & {
  capabilityType: "multimodal";
  meterKeys: {
    inputToken?: string;
    outputToken?: string;
    cacheHitToken?: string;
    reasoningToken?: string;
    modalityMeters: string[];
    auxiliaryMeters: string[];
  };
};

export type ImageCapabilityPricingProjection = CapabilityPricingProjectionBase & {
  capabilityType: "image";
  meterKeys: {
    imageCount?: string;
    resolution?: string;
    quality?: string;
    auxiliaryMeters: string[];
  };
};

export type AudioCapabilityPricingProjection = CapabilityPricingProjectionBase & {
  capabilityType: "audio";
  meterKeys: {
    duration?: string;
    charCount?: string;
    voiceType?: string;
    emotion?: string;
    mode?: string;
    auxiliaryMeters: string[];
  };
};

export type VideoCapabilityPricingProjection = CapabilityPricingProjectionBase & {
  capabilityType: "video";
  meterKeys: {
    duration?: string;
    frameRate?: string;
    resolution?: string;
    quality?: string;
    auxiliaryMeters: string[];
  };
};

export type ThreeDCapabilityPricingProjection = CapabilityPricingProjectionBase & {
  capabilityType: "three_d";
  meterKeys: {
    format?: string;
    complexity?: string;
    step?: string;
    quality?: string;
    auxiliaryMeters: string[];
  };
};

export type GpuResourceCapabilityPricingProjection = CapabilityPricingProjectionBase & {
  capabilityType: "gpu_resource";
  meterKeys: {
    duration?: string;
    gpuType?: string;
    auxiliaryMeters: string[];
  };
};

export type CapabilityPricingProjection =
  | TextCapabilityPricingProjection
  | VectorCapabilityPricingProjection
  | MultimodalCapabilityPricingProjection
  | ImageCapabilityPricingProjection
  | AudioCapabilityPricingProjection
  | VideoCapabilityPricingProjection
  | ThreeDCapabilityPricingProjection
  | GpuResourceCapabilityPricingProjection;

export type CapabilityPricing = {
  templateId?: string;
  pricingMode?: CapabilityPricingMode;
  isCustomized: boolean;
  basePrice: number;
  unit: string;
  unitKind?: string;
  currency: string;
  rules: CapabilityPricingRule[];
  rateCard?: CapabilityPricingRateCardRow[];
  notes?: string;
  formalBilling?: FormalBillingModel | null;
  projection?: CapabilityPricingProjection | null;
};

export type CapabilityPricingSimulatorFieldType = "number" | "select";

export type CapabilityPricingSimulatorFieldDefinition = {
  key: string;
  label: string;
  type: CapabilityPricingSimulatorFieldType;
  defaultValue: string | number;
  helperText?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
};

export type CapabilityPricingSimulatorInput = Record<string, string | number | undefined>;

export type CapabilityPricingSimulationMatchedRule = {
  id: string;
  label: string;
  multiplier: number;
};

export type CapabilityPricingSimulationResult = {
  quantity: number;
  baseAmount: number;
  total: number;
  currency: string;
  unit: string;
  billedQuantity?: number;
  billedUnitLabel?: string;
  formula: string;
  hitRules: CapabilityPricingSimulationMatchedRule[];
};

export type ModelCapabilityConfig = {
  boundary: CapabilityConfigMap;
  defaults: CapabilityConfigMap;
  pricing: CapabilityPricing;
};

export type ModelCapabilityConfigInput = {
  boundary?: CapabilityConfigMap;
  defaults?: CapabilityConfigMap;
  pricing?: Partial<CapabilityPricing> | null;
};

export type ModelCapabilityConfigs = Partial<Record<ModelCapabilityCode, ModelCapabilityConfig>>;

function normalizeBooleanBillingToken(value: unknown) {
  const normalized = normalizeBillingRuleToken(value);
  if (["yes", "true", "1", "on"].includes(normalized)) return "yes";
  if (["no", "false", "0", "off"].includes(normalized)) return "no";
  return "";
}

function toComparableBillingNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = Number(value.trim().replace(/[a-zA-Z%]+$/g, ""));
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function isGeneralBillingValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;

  const booleanToken = normalizeBooleanBillingToken(value);
  if (booleanToken) return booleanToken === "yes";

  return normalizeBillingRuleToken(value).length > 0;
}

function matchBasicBillingEquality(actualValue: unknown, expectedValue: Exclude<BillingRuleValue, string[] | { min?: number; max?: number }>) {
  if (typeof expectedValue === "number") {
    const actualNumber = toComparableBillingNumber(actualValue);
    return actualNumber !== null && actualNumber === expectedValue;
  }

  const normalizedExpected = normalizeBillingRuleToken(expectedValue);
  if (!normalizedExpected) return false;
  if (normalizedExpected === "general") return isGeneralBillingValue(actualValue);

  const actualBoolean = normalizeBooleanBillingToken(actualValue);
  const expectedBoolean = normalizeBooleanBillingToken(expectedValue);
  if (actualBoolean || expectedBoolean) {
    return actualBoolean !== "" && actualBoolean === expectedBoolean;
  }

  return normalizeBillingRuleToken(actualValue) === normalizedExpected;
}

export function normalizeBillingRuleToken(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export function getBillingRuleMetric(rule: CapabilityPricingRule) {
  return String(rule.metric || "").trim();
}

export function formatBillingRuleValue(value: BillingRuleValue) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value && typeof value === "object") {
    const min = "min" in value && value.min !== undefined ? String(value.min) : "";
    const max = "max" in value && value.max !== undefined ? String(value.max) : "";
    return [min, max].filter(Boolean).join(", ");
  }

  return String(value ?? "").trim();
}

export function formatBillingRuleSummary(rule: CapabilityPricingRule) {
  const metric = getBillingRuleMetric(rule);
  const value = formatBillingRuleValue(rule.value);
  return value ? `${metric}:${value}` : metric;
}

export function matchBasicBillingRule(rule: CapabilityPricingRule, actualValue: unknown) {
  const operator = rule.operator;
  const ruleValue = rule.value;

  if (ruleValue === undefined || ruleValue === null) return false;

  if (operator === "in") {
    const expectedValues = Array.isArray(ruleValue) ? ruleValue : [String(ruleValue)];
    return expectedValues.some((item) => matchBasicBillingEquality(actualValue, item));
  }

  if (operator === "range") {
    if (!ruleValue || typeof ruleValue !== "object" || Array.isArray(ruleValue)) return false;
    const actualNumber = toComparableBillingNumber(actualValue);
    if (actualNumber === null) return false;
    const min = "min" in ruleValue ? toComparableBillingNumber(ruleValue.min) : null;
    const max = "max" in ruleValue ? toComparableBillingNumber(ruleValue.max) : null;
    if (min !== null && actualNumber < min) return false;
    if (max !== null && actualNumber > max) return false;
    return min !== null || max !== null;
  }

  if (operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte") {
    const actualNumber = toComparableBillingNumber(actualValue);
    const expectedNumber = toComparableBillingNumber(ruleValue);
    if (actualNumber === null || expectedNumber === null) return false;
    if (operator === "gt") return actualNumber > expectedNumber;
    if (operator === "gte") return actualNumber >= expectedNumber;
    if (operator === "lt") return actualNumber < expectedNumber;
    return actualNumber <= expectedNumber;
  }

  if (Array.isArray(ruleValue) || (ruleValue && typeof ruleValue === "object")) {
    return false;
  }

  return matchBasicBillingEquality(actualValue, ruleValue);
}

export function getCapabilityConfigFieldValue(
  config: ModelCapabilityConfig,
  sectionKey: CapabilityConfigSectionKey,
  fieldKey: string,
): CapabilityConfigMap[string] | undefined {
  return config[sectionKey]?.[fieldKey];
}

export function parseDelimitedValues(value: string) {
  return value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getImageCapabilityResolutions(config: ModelCapabilityConfig) {
  return Array.from(
    new Set(
      (Array.isArray(getCapabilityConfigFieldValue(config, "boundary", "supportedResolutions"))
        ? (getCapabilityConfigFieldValue(config, "boundary", "supportedResolutions") as string[])
        : []
      ).map((value) => String(value).trim()).filter(Boolean),
    ),
  );
}

export function getVideoCapabilityFrameRates(config: ModelCapabilityConfig) {
  const frameRates = getCapabilityConfigFieldValue(config, "boundary", "frameRates");
  return Array.from(new Set((Array.isArray(frameRates) ? frameRates : []).map((value) => String(value).trim()).filter(Boolean)));
}

export function getVideoCapabilityResolutions(config: ModelCapabilityConfig) {
  return Array.from(
    new Set(
      (Array.isArray(getCapabilityConfigFieldValue(config, "boundary", "resolutions"))
        ? (getCapabilityConfigFieldValue(config, "boundary", "resolutions") as string[])
        : []
      ).map((value) => String(value).trim()).filter(Boolean),
    ),
  );
}
