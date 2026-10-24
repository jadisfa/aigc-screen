import { getBillingMetricDisplayLabel, normalizeBillingMetricId } from "./billingMetricRegistry";
import { resolveFormalBillingCapabilityType } from "./modelCapabilityMetadata";
import {
  buildVideoRateCardAdjustments,
  defaultVideoRateCardUnitPrice,
  excludeVideoAxisRules,
} from "./videoRateCard";
import type {
  CapabilityPricing,
  CapabilityPricingFieldMapping,
  CapabilityPricingLegacyPageBoundary,
  CapabilityPricingMigrationSource,
  CapabilityPricingProjection,
  CapabilityPricingProjectionBase,
  CapabilityPricingProjectionFieldGroup,
  CapabilityPricingRule,
  FormalBillingAdjustment,
  FormalBillingCapabilityType,
  FormalBillingFx,
  FormalBillingLineItem,
  FormalBillingMeterCategory,
  FormalBillingModel,
  FormalBillingRateTier,
  ModelCapabilityCode,
} from "./modelCapabilityMetadata";

const LEGACY_EDITOR_FIELD_KEYS = ["basePrice", "unit", "currency", "rules"] as const;
const FORMAL_EXTENSION_MAPPING_KEYS = [
  "pricingMode",
  "settlementCurrency",
  "lineItems",
  "fixedSurcharges",
  "minimumCharge",
  "maximumCharge",
  "floorCharge",
  "fx",
] as const;

const TOKEN_METERS = new Set(["input_token", "output_token", "reasoning_token", "cache_hit_token"]);
const IMAGE_METERS = new Set(["image_count", "resolution", "quality"]);
const AUDIO_METERS = new Set(["duration", "char_count", "voice_type", "emotion", "mode"]);
const VIDEO_METERS = new Set(["duration", "frame_rate", "resolution", "quality"]);
const THREE_D_METERS = new Set(["format", "complexity", "step", "quality"]);
const GPU_METERS = new Set(["gpu_type", "duration"]);
const MULTIMODAL_MODALITY_METERS = new Set([
  "image_count",
  "resolution",
  "quality",
  "duration",
  "frame_rate",
  "char_count",
  "voice_type",
  "emotion",
  "mode",
  "task_type",
  "format",
  "complexity",
  "step",
]);

type LegacyPricingSnapshot = Pick<CapabilityPricing, "pricingMode" | "basePrice" | "unit" | "currency" | "rules">;

type ResolvedCapabilityPricingState = {
  source: CapabilityPricingMigrationSource;
  formalBilling: FormalBillingModel;
  legacyPricing: LegacyPricingSnapshot;
  projection: CapabilityPricingProjection;
};

type ProjectionBuildContext = {
  capabilityType: FormalBillingCapabilityType;
  source: CapabilityPricingMigrationSource;
  formalBilling: FormalBillingModel;
  legacyPricing: LegacyPricingSnapshot;
  primaryMeter: string;
  primaryUnit: string;
  primaryCurrency: string;
  supportedMeters: readonly string[];
  fieldMappings: readonly CapabilityPricingFieldMapping[];
  fieldGroups: readonly CapabilityPricingProjectionFieldGroup[];
  legacyPage: CapabilityPricingLegacyPageBoundary;
};

type ProjectionCapabilityType = CapabilityPricingProjection["capabilityType"];
type CapabilityPricingProjectionByType = {
  [K in ProjectionCapabilityType]: Extract<CapabilityPricingProjection, { capabilityType: K }>;
};

function toFiniteNumber(value: unknown) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function normalizeCapabilityType(code: ModelCapabilityCode): FormalBillingCapabilityType {
  return resolveFormalBillingCapabilityType(code);
}

function normalizeMeterKey(metric: unknown) {
  return normalizeBillingMetricId(String(metric ?? "").trim());
}

function inferMeterCategory(metric: string, capabilityType: FormalBillingCapabilityType): FormalBillingMeterCategory {
  const normalizedMetric = normalizeMeterKey(metric);
  if (TOKEN_METERS.has(normalizedMetric)) return "token";
  if (IMAGE_METERS.has(normalizedMetric)) return "image";
  if (AUDIO_METERS.has(normalizedMetric)) return "audio";
  if (VIDEO_METERS.has(normalizedMetric)) return "video";
  if (GPU_METERS.has(normalizedMetric) || capabilityType === "gpu_resource") return "gpu";
  if (normalizedMetric === "request") return "request";
  return "custom";
}

function inferPrimaryMeter(capabilityType: FormalBillingCapabilityType, pricing: Pick<CapabilityPricing, "rules" | "unit" | "unitKind">) {
  const firstRuleMetric = pricing.rules.find((rule) => {
    const metric = normalizeMeterKey(rule.metric);
    return (
      TOKEN_METERS.has(metric) ||
      metric === "image_count" ||
      metric === "duration" ||
      metric === "char_count" ||
      metric === "request"
    );
  })?.metric;
  if (firstRuleMetric) return normalizeMeterKey(firstRuleMetric);

  const unitHint = `${pricing.unitKind || ""} ${pricing.unit || ""}`.toLowerCase();
  if (unitHint.includes("token")) return "input_token";
  if (unitHint.includes("image") || unitHint.includes("张")) return "image_count";
  if (unitHint.includes("char") || unitHint.includes("字符")) return "char_count";
  if (unitHint.includes("request") || unitHint.includes("次") || unitHint.includes("task") || unitHint.includes("step")) {
    return "request";
  }
  if (unitHint.includes("second") || unitHint.includes("minute") || unitHint.includes("hour") || unitHint.includes("秒")) {
    return "duration";
  }

  if (capabilityType === "text") return "input_token";
  if (capabilityType === "vector") return "input_token";
  if (capabilityType === "multimodal") return "input_token";
  if (capabilityType === "image") return "image_count";
  if (capabilityType === "audio") return "duration";
  if (capabilityType === "video") return "duration";
  if (capabilityType === "gpu_resource") return "duration";
  if (capabilityType === "three_d") return "input_token";
  return "request";
}

function normalizeLegacyRules(rules: CapabilityPricingRule[]) {
  return rules.map((rule, index) => ({
    id: String(rule.id || `rule-${index + 1}`),
    metric: normalizeMeterKey(rule.metric),
    operator: rule.operator,
    value: rule.value,
    multiplier: Number(rule.multiplier || 0),
    description: String(rule.description || "").trim() || undefined,
  }));
}

function buildLegacyAdjustments(
  capabilityType: FormalBillingCapabilityType,
  pricing: CapabilityPricing,
): FormalBillingAdjustment[] {
  const useRateCard = capabilityType === "video" && Array.isArray(pricing.rateCard) && pricing.rateCard.length > 0;
  const rateCardAdjustments = useRateCard
    ? buildVideoRateCardAdjustments(pricing.rateCard || []).map((item) => ({
        metric: item.metric,
        operator: item.operator,
        value: item.value,
        multiplier: item.multiplier,
        description: item.description,
      }))
    : [];
  const sourceRules = useRateCard ? excludeVideoAxisRules(pricing.rules || []) : pricing.rules || [];
  const addonAdjustments = sourceRules.map((rule) => ({
    metric: normalizeMeterKey(rule.metric),
    operator: rule.operator,
    value: rule.value,
    multiplier: Number(rule.multiplier || 0) || 1,
    description: String(rule.description || "").trim() || undefined,
  }));
  return [...rateCardAdjustments, ...addonAdjustments];
}

function normalizeRateTier(tier: FormalBillingRateTier) {
  return {
    ...(toFiniteNumber(tier.start) !== undefined ? { start: Number(tier.start) } : {}),
    ...(toFiniteNumber(tier.end) !== undefined ? { end: Number(tier.end) } : {}),
    ...(toFiniteNumber(tier.unitPrice) !== undefined ? { unitPrice: Number(tier.unitPrice) } : {}),
    ...(toFiniteNumber(tier.flatFee) !== undefined ? { flatFee: Number(tier.flatFee) } : {}),
    ...(toFiniteNumber(tier.multiplier) !== undefined ? { multiplier: Number(tier.multiplier) } : {}),
    ...(String(tier.currency || "").trim() ? { currency: String(tier.currency).trim() } : {}),
  };
}

function normalizeAdjustment(adjustment: FormalBillingAdjustment): FormalBillingAdjustment {
  return {
    metric: normalizeMeterKey(adjustment.metric),
    operator: adjustment.operator || "eq",
    value: adjustment.value,
    ...(toFiniteNumber(adjustment.multiplier) !== undefined ? { multiplier: Number(adjustment.multiplier) } : {}),
    ...(toFiniteNumber(adjustment.fixedFee) !== undefined ? { fixedFee: Number(adjustment.fixedFee) } : {}),
    ...(String(adjustment.description || "").trim() ? { description: String(adjustment.description).trim() } : {}),
  };
}

function normalizeLineItem(
  item: FormalBillingLineItem,
  index: number,
  capabilityType: FormalBillingCapabilityType,
  fallbackMeterKey: string,
  fallbackUnit: string,
  fallbackCurrency: string,
): FormalBillingLineItem {
  const meterKey = normalizeMeterKey(item.meterKey || fallbackMeterKey || "request");
  const tiers = Array.isArray(item.tiers) ? item.tiers.map((tier) => normalizeRateTier(tier)) : undefined;
  const type =
    item.type ||
    (tiers && tiers.length > 0 ? "tiered" : toFiniteNumber(item.fixedFee) !== undefined ? "fixed" : "metered");

  return {
    ...item,
    code: String(item.code || `line-${index + 1}`),
    label: String(item.label || item.code || `计费项 ${index + 1}`),
    type,
    meterKey,
    meterCategory: item.meterCategory || inferMeterCategory(meterKey, capabilityType),
    unit: String(item.unit || fallbackUnit || "unit").trim() || "unit",
    currency: String(item.currency || fallbackCurrency || "CNY").trim() || "CNY",
    ...(toFiniteNumber(item.unitPrice) !== undefined ? { unitPrice: Number(item.unitPrice) } : {}),
    ...(tiers && tiers.length > 0 ? { tiers } : {}),
    ...(toFiniteNumber(item.fixedFee) !== undefined ? { fixedFee: Number(item.fixedFee) } : {}),
    ...(toFiniteNumber(item.minimumCharge) !== undefined ? { minimumCharge: Number(item.minimumCharge) } : {}),
    ...(toFiniteNumber(item.maximumCharge) !== undefined ? { maximumCharge: Number(item.maximumCharge) } : {}),
    ...(toFiniteNumber(item.floorCharge) !== undefined ? { floorCharge: Number(item.floorCharge) } : {}),
    ...(Array.isArray(item.adjustments) && item.adjustments.length > 0
      ? { adjustments: item.adjustments.map((adjustment) => normalizeAdjustment(adjustment)) }
      : {}),
  };
}

function normalizeFx(fx: FormalBillingFx | null | undefined): FormalBillingFx | null {
  if (!fx) return null;
  const exchangeRate = Number(fx.exchangeRate || 0);
  if (!fx.sourceCurrency || !fx.settlementCurrency || !(exchangeRate > 0)) {
    return null;
  }

  return {
    sourceCurrency: String(fx.sourceCurrency).trim(),
    settlementCurrency: String(fx.settlementCurrency).trim(),
    exchangeRate,
    ...(String(fx.rateSource || "").trim() ? { rateSource: String(fx.rateSource).trim() } : {}),
  };
}

function normalizeFormalBillingInput(
  capabilityType: FormalBillingCapabilityType,
  pricing: CapabilityPricing,
  formalBilling: FormalBillingModel,
): FormalBillingModel {
  const fallbackMeter = inferPrimaryMeter(capabilityType, pricing);
  const settlementCurrency =
    String(formalBilling.settlementCurrency || pricing.currency || "CNY").trim() || "CNY";
  const fallbackUnit = String(pricing.unit || "unit").trim() || "unit";
  const fallbackCurrency = String(pricing.currency || settlementCurrency).trim() || settlementCurrency;

  return {
    ...formalBilling,
    version: String(formalBilling.version || "1.0"),
    capabilityType,
    pricingMode: formalBilling.pricingMode || pricing.pricingMode || "metered",
    settlementCurrency,
    ...(toFiniteNumber(formalBilling.minimumCharge) !== undefined
      ? { minimumCharge: Number(formalBilling.minimumCharge) }
      : {}),
    ...(toFiniteNumber(formalBilling.maximumCharge) !== undefined
      ? { maximumCharge: Number(formalBilling.maximumCharge) }
      : {}),
    ...(toFiniteNumber(formalBilling.floorCharge) !== undefined ? { floorCharge: Number(formalBilling.floorCharge) } : {}),
    lineItems: (formalBilling.lineItems || []).map((item, index) =>
      normalizeLineItem(item, index, capabilityType, fallbackMeter, fallbackUnit, fallbackCurrency),
    ),
    fixedSurcharges: (formalBilling.fixedSurcharges || []).map((item, index) =>
      normalizeLineItem(item, index, capabilityType, "request", item.unit || "request", settlementCurrency),
    ),
    fx: normalizeFx(formalBilling.fx),
  };
}

function buildLegacyBaseLineItem(
  capabilityType: FormalBillingCapabilityType,
  pricing: CapabilityPricing,
  primaryMeter: string,
): FormalBillingLineItem {
  const type = pricing.pricingMode === "flat" ? "fixed" : "metered";
  const unitPrice = defaultVideoRateCardUnitPrice(pricing.rateCard || [], Number(pricing.basePrice || 0));

  return {
    code: "base",
    label: "基础计费项",
    type,
    meterKey: primaryMeter,
    meterCategory: inferMeterCategory(primaryMeter, capabilityType),
    unit: String(pricing.unit || "unit").trim() || "unit",
    currency: String(pricing.currency || "CNY").trim() || "CNY",
    ...(type === "fixed"
      ? { fixedFee: Number(pricing.basePrice || 0) }
      : { unitPrice }),
    adjustments: buildLegacyAdjustments(capabilityType, pricing),
    ...(Array.isArray(pricing.rateCard) && pricing.rateCard.length > 0
      ? { metadata: { rateCard: pricing.rateCard } }
      : {}),
  };
}

function buildFormalBillingFromLegacy(
  capabilityType: FormalBillingCapabilityType,
  pricing: CapabilityPricing,
): FormalBillingModel {
  const primaryMeter = inferPrimaryMeter(capabilityType, pricing);

  return {
    version: "1.0",
    capabilityType,
    pricingMode: pricing.pricingMode || "metered",
    settlementCurrency: String(pricing.currency || "CNY").trim() || "CNY",
    lineItems: [buildLegacyBaseLineItem(capabilityType, pricing, primaryMeter)],
    fixedSurcharges: [],
    fx: null,
  };
}

function adjustmentToLegacyRule(adjustment: FormalBillingAdjustment, index: number): CapabilityPricingRule | null {
  if (!(Number(adjustment.multiplier || 0) > 0)) {
    return null;
  }

  return {
    id: `rule-${index + 1}`,
    metric: normalizeMeterKey(adjustment.metric),
    operator: adjustment.operator || "eq",
    value: adjustment.value ?? "",
    multiplier: Number(adjustment.multiplier),
    description: String(adjustment.description || "").trim(),
  };
}

function buildLegacyPricingSnapshotFromFormalBilling(formalBilling: FormalBillingModel): LegacyPricingSnapshot {
  const primaryLineItem = formalBilling.lineItems[0];
  const basePrice =
    Number(primaryLineItem?.unitPrice) ||
    Number(primaryLineItem?.fixedFee) ||
    Number(primaryLineItem?.tiers?.[0]?.unitPrice) ||
    Number(primaryLineItem?.tiers?.[0]?.flatFee) ||
    0;

  return {
    pricingMode:
      formalBilling.pricingMode ||
      (primaryLineItem?.type === "fixed" ? "flat" : "metered"),
    basePrice,
    unit: String(primaryLineItem?.unit || "unit").trim() || "unit",
    currency: String(primaryLineItem?.currency || formalBilling.settlementCurrency || "CNY").trim() || "CNY",
    rules: (primaryLineItem?.adjustments || [])
      .map((adjustment, index) => adjustmentToLegacyRule(adjustment, index))
      .filter((rule): rule is CapabilityPricingRule => Boolean(rule)),
  };
}

function normalizeLegacyPricingSnapshot(pricing: CapabilityPricing): LegacyPricingSnapshot {
  return {
    pricingMode: pricing.pricingMode || "metered",
    basePrice: Number(pricing.basePrice || 0),
    unit: String(pricing.unit || "unit").trim() || "unit",
    currency: String(pricing.currency || "CNY").trim() || "CNY",
    rules: normalizeLegacyRules(Array.isArray(pricing.rules) ? pricing.rules : []),
  };
}

function serializeRuleForComparison(rule: CapabilityPricingRule) {
  return {
    metric: normalizeMeterKey(rule.metric),
    operator: rule.operator,
    value: rule.value,
    multiplier: Number(rule.multiplier || 0),
    description: String(rule.description || "").trim(),
  };
}

function hasLegacyPricingOverrides(pricing: CapabilityPricing, legacyPricing: LegacyPricingSnapshot) {
  const currentLegacy = normalizeLegacyPricingSnapshot(pricing);
  return (
    currentLegacy.pricingMode !== legacyPricing.pricingMode ||
    currentLegacy.basePrice !== legacyPricing.basePrice ||
    currentLegacy.unit !== legacyPricing.unit ||
    currentLegacy.currency !== legacyPricing.currency ||
    JSON.stringify(currentLegacy.rules.map((rule) => serializeRuleForComparison(rule))) !==
      JSON.stringify(legacyPricing.rules.map((rule) => serializeRuleForComparison(rule)))
  );
}

function buildCompatibilityIssues(formalBilling: FormalBillingModel) {
  const issues: string[] = [];
  const primaryLineItem = formalBilling.lineItems[0];

  if (formalBilling.lineItems.length > 1) {
    issues.push("存在多个正式计费项");
  }
  if ((formalBilling.fixedSurcharges || []).length > 0) {
    issues.push("存在固定附加费");
  }
  if (
    formalBilling.lineItems.some((item) => item.type === "tiered" || (Array.isArray(item.tiers) && item.tiers.length > 0))
  ) {
    issues.push("存在分段价");
  }
  if (
    Number(formalBilling.minimumCharge || 0) > 0 ||
    Number(formalBilling.maximumCharge || 0) > 0 ||
    Number(formalBilling.floorCharge || 0) > 0 ||
    formalBilling.lineItems.some(
      (item) =>
        Number(item.minimumCharge || 0) > 0 ||
        Number(item.maximumCharge || 0) > 0 ||
        Number(item.floorCharge || 0) > 0,
    )
  ) {
    issues.push("存在最小消费/封顶/保底");
  }
  if (formalBilling.fx) {
    issues.push("存在汇率换算");
  }
  if ((primaryLineItem?.adjustments || []).some((adjustment) => Number(adjustment.fixedFee || 0) > 0)) {
    issues.push("规则中存在固定费用调整");
  }

  return issues;
}

function buildLegacyPageBoundary(
  source: CapabilityPricingMigrationSource,
  formalBilling: FormalBillingModel,
): CapabilityPricingLegacyPageBoundary {
  if (source === "legacy_pricing") {
    return {
      source,
      mode: "editable",
      reason: "当前仍以 legacy pricing 页面为录入入口，保存时自动编译为 formalBilling。",
      disabledFieldKeys: [],
      migrationSummary: "基础单价、计费单位、币种和规则倍率会同步写入 formalBilling.lineItems[0] 与 adjustments。",
    };
  }

  const compatibilityIssues = buildCompatibilityIssues(formalBilling);
  if (compatibilityIssues.length === 0) {
    return {
      source,
      mode: "editable",
      reason: "当前 formalBilling 仍可无损投影到旧版定价页面。",
      disabledFieldKeys: [],
      migrationSummary: "旧版页面继续可编辑，变更会回写到 formalBilling.lineItems[0] 与 adjustments。",
    };
  }

  return {
    source,
    mode: "readonly",
    reason: `当前 formalBilling 已使用旧版页面无法无损表达的结构：${compatibilityIssues.join("、")}。`,
    disabledFieldKeys: [...LEGACY_EDITOR_FIELD_KEYS],
    migrationSummary: "旧版基础价/规则仅保留兼容回填，前端需按 formalBilling 只读展示并等待新编辑器接管。",
  };
}

function collectSupportedMeters(formalBilling: FormalBillingModel, legacyPricing: LegacyPricingSnapshot) {
  return Array.from(
    new Set(
      formalBilling.lineItems
        .flatMap((item) => [item.meterKey, ...(item.adjustments || []).map((adjustment) => adjustment.metric)])
        .concat((formalBilling.fixedSurcharges || []).map((item) => item.meterKey))
        .concat(legacyPricing.rules.map((rule) => normalizeMeterKey(rule.metric)))
        .map((meter) => normalizeMeterKey(meter))
        .filter(Boolean),
    ),
  );
}

function findKnownMeter(supportedMeters: readonly string[], candidates: readonly string[]) {
  return candidates.find((candidate) => supportedMeters.includes(candidate));
}

function buildTextMeterKeys(
  supportedMeters: readonly string[],
): CapabilityPricingProjectionByType["text"]["meterKeys"] {
  const knownMeters = ["input_token", "output_token", "cache_hit_token", "reasoning_token"];
  return {
    inputToken: findKnownMeter(supportedMeters, ["input_token"]),
    outputToken: findKnownMeter(supportedMeters, ["output_token"]),
    cacheHitToken: findKnownMeter(supportedMeters, ["cache_hit_token"]),
    reasoningToken: findKnownMeter(supportedMeters, ["reasoning_token"]),
    auxiliaryMeters: supportedMeters.filter((meter) => !knownMeters.includes(meter)),
  };
}

function buildVectorMeterKeys(
  supportedMeters: readonly string[],
): CapabilityPricingProjectionByType["vector"]["meterKeys"] {
  const knownMeters = ["input_token", "dimension"];
  return {
    inputToken: findKnownMeter(supportedMeters, ["input_token"]),
    dimension: findKnownMeter(supportedMeters, ["dimension"]),
    auxiliaryMeters: supportedMeters.filter((meter) => !knownMeters.includes(meter)),
  };
}

function buildMultimodalMeterKeys(
  supportedMeters: readonly string[],
): CapabilityPricingProjectionByType["multimodal"]["meterKeys"] {
  const tokenMeters = ["input_token", "output_token", "cache_hit_token", "reasoning_token"];
  const modalityMeters = supportedMeters.filter(
    (meter) => !tokenMeters.includes(meter) && MULTIMODAL_MODALITY_METERS.has(meter),
  );
  const knownMeters = [...tokenMeters, ...modalityMeters];
  return {
    inputToken: findKnownMeter(supportedMeters, ["input_token"]),
    outputToken: findKnownMeter(supportedMeters, ["output_token"]),
    cacheHitToken: findKnownMeter(supportedMeters, ["cache_hit_token"]),
    reasoningToken: findKnownMeter(supportedMeters, ["reasoning_token"]),
    modalityMeters,
    auxiliaryMeters: supportedMeters.filter((meter) => !knownMeters.includes(meter)),
  };
}

function buildImageMeterKeys(
  supportedMeters: readonly string[],
): CapabilityPricingProjectionByType["image"]["meterKeys"] {
  const knownMeters = ["image_count", "resolution", "quality"];
  return {
    imageCount: findKnownMeter(supportedMeters, ["image_count"]),
    resolution: findKnownMeter(supportedMeters, ["resolution"]),
    quality: findKnownMeter(supportedMeters, ["quality"]),
    auxiliaryMeters: supportedMeters.filter((meter) => !knownMeters.includes(meter)),
  };
}

function buildAudioMeterKeys(
  supportedMeters: readonly string[],
): CapabilityPricingProjectionByType["audio"]["meterKeys"] {
  const knownMeters = ["duration", "char_count", "voice_type", "emotion", "mode"];
  return {
    duration: findKnownMeter(supportedMeters, ["duration"]),
    charCount: findKnownMeter(supportedMeters, ["char_count"]),
    voiceType: findKnownMeter(supportedMeters, ["voice_type"]),
    emotion: findKnownMeter(supportedMeters, ["emotion"]),
    mode: findKnownMeter(supportedMeters, ["mode"]),
    auxiliaryMeters: supportedMeters.filter((meter) => !knownMeters.includes(meter)),
  };
}

function buildVideoMeterKeys(
  supportedMeters: readonly string[],
): CapabilityPricingProjectionByType["video"]["meterKeys"] {
  const knownMeters = ["duration", "frame_rate", "resolution", "quality"];
  return {
    duration: findKnownMeter(supportedMeters, ["duration"]),
    frameRate: findKnownMeter(supportedMeters, ["frame_rate"]),
    resolution: findKnownMeter(supportedMeters, ["resolution"]),
    quality: findKnownMeter(supportedMeters, ["quality"]),
    auxiliaryMeters: supportedMeters.filter((meter) => !knownMeters.includes(meter)),
  };
}

function buildThreeDMeterKeys(
  supportedMeters: readonly string[],
): CapabilityPricingProjectionByType["three_d"]["meterKeys"] {
  const knownMeters = ["format", "complexity", "step", "quality"];
  return {
    format: findKnownMeter(supportedMeters, ["format"]),
    complexity: findKnownMeter(supportedMeters, ["complexity"]),
    step: findKnownMeter(supportedMeters, ["step"]),
    quality: findKnownMeter(supportedMeters, ["quality"]),
    auxiliaryMeters: supportedMeters.filter((meter) => !knownMeters.includes(meter)),
  };
}

function buildGpuResourceMeterKeys(
  supportedMeters: readonly string[],
): CapabilityPricingProjectionByType["gpu_resource"]["meterKeys"] {
  return {
    duration: findKnownMeter(supportedMeters, ["duration"]),
    gpuType: findKnownMeter(supportedMeters, ["gpu_type"]),
    auxiliaryMeters: supportedMeters.filter((meter) => !["duration", "gpu_type"].includes(meter)),
  };
}

const CAPABILITY_PROJECTION_BUILDERS: {
  [K in ProjectionCapabilityType]: (
    base: CapabilityPricingProjectionBase,
    supportedMeters: readonly string[],
  ) => CapabilityPricingProjectionByType[K];
} = {
  text: (base, supportedMeters) => ({
    ...base,
    capabilityType: "text",
    meterKeys: buildTextMeterKeys(supportedMeters),
  }),
  vector: (base, supportedMeters) => ({
    ...base,
    capabilityType: "vector",
    meterKeys: buildVectorMeterKeys(supportedMeters),
  }),
  multimodal: (base, supportedMeters) => ({
    ...base,
    capabilityType: "multimodal",
    meterKeys: buildMultimodalMeterKeys(supportedMeters),
  }),
  image: (base, supportedMeters) => ({
    ...base,
    capabilityType: "image",
    meterKeys: buildImageMeterKeys(supportedMeters),
  }),
  audio: (base, supportedMeters) => ({
    ...base,
    capabilityType: "audio",
    meterKeys: buildAudioMeterKeys(supportedMeters),
  }),
  video: (base, supportedMeters) => ({
    ...base,
    capabilityType: "video",
    meterKeys: buildVideoMeterKeys(supportedMeters),
  }),
  three_d: (base, supportedMeters) => ({
    ...base,
    capabilityType: "three_d",
    meterKeys: buildThreeDMeterKeys(supportedMeters),
  }),
  gpu_resource: (base, supportedMeters) => ({
    ...base,
    capabilityType: "gpu_resource",
    meterKeys: buildGpuResourceMeterKeys(supportedMeters),
  }),
};

function buildFieldMappings(context: {
  source: CapabilityPricingMigrationSource;
  formalBilling: FormalBillingModel;
  legacyPricing: LegacyPricingSnapshot;
  legacyPage: CapabilityPricingLegacyPageBoundary;
}) {
  const primaryLineItem = context.formalBilling.lineItems[0];
  const settlementCurrency = context.formalBilling.settlementCurrency;
  const isLegacySource = context.source === "legacy_pricing";
  const isLegacyEditable = context.legacyPage.mode === "editable";
  const mode = isLegacySource ? "direct" : "derived";

  const mappings: CapabilityPricingFieldMapping[] = [
    {
      key: "basePrice",
      formPath: "pricing.basePrice",
      formLabel: "基础单价",
      backendPath:
        primaryLineItem?.type === "fixed"
          ? "pricing.formalBilling.lineItems[0].fixedFee"
          : "pricing.formalBilling.lineItems[0].unitPrice",
      valueType: "number",
      mode,
      editable: isLegacyEditable && !context.legacyPage.disabledFieldKeys.includes("basePrice"),
      description: `${isLegacySource ? "直接写入" : "从"} ${getBillingMetricDisplayLabel(primaryLineItem?.meterKey || "request")} 主计量映射。`,
    },
    {
      key: "unit",
      formPath: "pricing.unit",
      formLabel: "计费单位",
      backendPath: "pricing.formalBilling.lineItems[0].unit",
      valueType: "string",
      mode,
      editable: isLegacyEditable && !context.legacyPage.disabledFieldKeys.includes("unit"),
      description: "旧版页面的计费单位会对齐到正式计费主项单位。",
    },
    {
      key: "currency",
      formPath: "pricing.currency",
      formLabel: "结算币种",
      backendPath: "pricing.formalBilling.settlementCurrency",
      valueType: "string",
      mode,
      editable: isLegacyEditable && !context.legacyPage.disabledFieldKeys.includes("currency"),
      description: `旧版币种字段映射到 settlementCurrency，当前正式结算币种为 ${settlementCurrency}。`,
    },
    {
      key: "rules",
      formPath: "pricing.rules",
      formLabel: "规则列表",
      backendPath: "pricing.formalBilling.lineItems[0].adjustments",
      valueType: "array",
      mode,
      editable: isLegacyEditable && !context.legacyPage.disabledFieldKeys.includes("rules"),
      description: "旧版规则会投影为主计费项 adjustments，多条规则按 metric/operator/value/multiplier 结构写入。",
    },
    {
      key: "pricingMode",
      formPath: "pricing.pricingMode",
      formLabel: "计费模式",
      backendPath: "pricing.formalBilling.pricingMode",
      valueType: "string",
      mode: "readonly",
      editable: false,
      description: `当前正式计费模式为 ${context.formalBilling.pricingMode || "metered"}。`,
    },
    {
      key: "settlementCurrency",
      formPath: "pricing.currency",
      formLabel: "正式结算币种",
      backendPath: "pricing.formalBilling.settlementCurrency",
      valueType: "string",
      mode: "readonly",
      editable: false,
      description: "正式计费以 settlementCurrency 为准。",
    },
    {
      key: "lineItems",
      formPath: "pricing.projection.fieldGroups",
      formLabel: "正式计费项",
      backendPath: "pricing.formalBilling.lineItems",
      valueType: "array",
      mode: "readonly",
      editable: false,
      description: "正式计费项是后端结算真值，旧版页面仅能覆盖其中的简化子集。",
    },
    {
      key: "fixedSurcharges",
      formPath: "pricing.projection.fieldGroups",
      formLabel: "固定附加费",
      backendPath: "pricing.formalBilling.fixedSurcharges",
      valueType: "array",
      mode: "readonly",
      editable: false,
      description: "固定附加费当前仅通过 projection 暴露，不进入旧版编辑器。",
    },
    {
      key: "minimumCharge",
      formPath: "pricing.projection.legacyPage",
      formLabel: "最小消费",
      backendPath: "pricing.formalBilling.minimumCharge",
      valueType: "number",
      mode: "readonly",
      editable: false,
      description: "最小消费由正式计费模型承载。",
    },
    {
      key: "maximumCharge",
      formPath: "pricing.projection.legacyPage",
      formLabel: "封顶金额",
      backendPath: "pricing.formalBilling.maximumCharge",
      valueType: "number",
      mode: "readonly",
      editable: false,
      description: "封顶金额由正式计费模型承载。",
    },
    {
      key: "floorCharge",
      formPath: "pricing.projection.legacyPage",
      formLabel: "保底金额",
      backendPath: "pricing.formalBilling.floorCharge",
      valueType: "number",
      mode: "readonly",
      editable: false,
      description: "保底金额由正式计费模型承载。",
    },
    {
      key: "fx",
      formPath: "pricing.projection.legacyPage",
      formLabel: "汇率换算",
      backendPath: "pricing.formalBilling.fx",
      valueType: "object",
      mode: "readonly",
      editable: false,
      description: "异币种结算和汇率来源当前仅通过 projection 做只读暴露。",
    },
  ];

  return mappings;
}

function createFieldGroup(
  id: string,
  label: string,
  summary: string,
  meters: string[],
  mappingsByKey: Map<string, CapabilityPricingFieldMapping>,
  fieldKeys: string[],
): CapabilityPricingProjectionFieldGroup {
  return {
    id,
    label,
    summary,
    meters: Array.from(new Set(meters.filter(Boolean))),
    fields: fieldKeys
      .map((key) => mappingsByKey.get(key))
      .filter((item): item is CapabilityPricingFieldMapping => Boolean(item)),
  };
}

function getCapabilityGroupCopy(capabilityType: FormalBillingCapabilityType) {
  if (capabilityType === "text") {
    return {
      label: "文本 Token 投影",
      summary: "围绕输入/输出/推理/缓存 Token 建立旧版页面到正式计费的映射。",
    };
  }
  if (capabilityType === "vector") {
    return {
      label: "向量投影",
      summary: "围绕输入 Token 与向量维度建立投影。",
    };
  }
  if (capabilityType === "multimodal") {
    return {
      label: "多模态投影",
      summary: "同时覆盖文本主计量与图片/音频/视频等模态维度。",
    };
  }
  if (capabilityType === "image") {
    return {
      label: "图像投影",
      summary: "围绕张数、分辨率和质量档位建立投影。",
    };
  }
  if (capabilityType === "audio") {
    return {
      label: "音频投影",
      summary: "围绕时长、字符数、音色、情感、模式建立投影。",
    };
  }
  if (capabilityType === "video") {
    return {
      label: "视频投影",
      summary: "围绕时长、帧率、分辨率和质量建立投影。",
    };
  }
  if (capabilityType === "three_d") {
    return {
      label: "3D 投影",
      summary: "围绕格式、复杂度、步数与质量建立投影。",
    };
  }
  return {
    label: "GPU/资源投影",
    summary: "围绕 GPU 型号与时长建立资源计费投影。",
  };
}

function buildFieldGroups(context: ProjectionBuildContext) {
  const mappingsByKey = new Map(context.fieldMappings.map((mapping) => [mapping.key, mapping]));
  const groupCopy = getCapabilityGroupCopy(context.capabilityType);

  return [
    createFieldGroup(
      "legacy-core",
      groupCopy.label,
      `${groupCopy.summary} 主计量当前为 ${getBillingMetricDisplayLabel(context.primaryMeter)}。`,
      context.supportedMeters,
      mappingsByKey,
      ["basePrice", "unit", "currency", "rules"],
    ),
    createFieldGroup(
      "migration-boundary",
      "迁移边界",
      context.legacyPage.reason,
      context.supportedMeters,
      mappingsByKey,
      ["pricingMode", "settlementCurrency"],
    ),
    createFieldGroup(
      "formal-billing",
      "正式计费扩展",
      context.legacyPage.migrationSummary,
      context.supportedMeters,
      mappingsByKey,
      [...FORMAL_EXTENSION_MAPPING_KEYS],
    ),
  ];
}

function buildProjectionBase(context: Omit<ProjectionBuildContext, "fieldGroups">): CapabilityPricingProjectionBase {
  const hasTieredPricing = context.formalBilling.lineItems.some(
    (item) => item.type === "tiered" || (Array.isArray(item.tiers) && item.tiers.length > 0),
  );
  const hasFixedSurcharges = (context.formalBilling.fixedSurcharges || []).length > 0;
  const hasMinimumCharge =
    Number(context.formalBilling.minimumCharge || 0) > 0 ||
    context.formalBilling.lineItems.some((item) => Number(item.minimumCharge || 0) > 0);
  const hasMaximumCharge =
    Number(context.formalBilling.maximumCharge || 0) > 0 ||
    context.formalBilling.lineItems.some((item) => Number(item.maximumCharge || 0) > 0);
  const hasFloorCharge =
    Number(context.formalBilling.floorCharge || 0) > 0 ||
    context.formalBilling.lineItems.some((item) => Number(item.floorCharge || 0) > 0);
  const hasFx = Boolean(context.formalBilling.fx);

  return {
    capabilityType: context.capabilityType,
    primaryMeter: context.primaryMeter,
    primaryUnit: context.primaryUnit,
    primaryCurrency: context.primaryCurrency,
    supportedMeters: context.supportedMeters,
    settlementCurrency: context.formalBilling.settlementCurrency,
    hasTieredPricing,
    hasFixedSurcharges,
    hasMinimumCharge,
    hasMaximumCharge,
    hasFloorCharge,
    hasFx,
    fieldGroups: buildFieldGroups({ ...context, fieldGroups: [] }),
    fieldMappings: context.fieldMappings,
    legacyPage: context.legacyPage,
  };
}

function buildProjection(context: Omit<ProjectionBuildContext, "fieldGroups">): CapabilityPricingProjection {
  const base = buildProjectionBase(context);
  return CAPABILITY_PROJECTION_BUILDERS[context.capabilityType](base, context.supportedMeters);
}

function resolveCapabilityPricingState(
  capabilityCode: ModelCapabilityCode,
  pricing: CapabilityPricing,
): ResolvedCapabilityPricingState {
  const capabilityType = normalizeCapabilityType(capabilityCode);
  const explicitFormalBilling =
    pricing.formalBilling && Array.isArray(pricing.formalBilling.lineItems) && pricing.formalBilling.lineItems.length > 0
      ? normalizeFormalBillingInput(capabilityType, pricing, pricing.formalBilling)
      : null;

  const legacyPricing = normalizeLegacyPricingSnapshot(pricing);
  let source: CapabilityPricingMigrationSource = "legacy_pricing";
  let formalBilling = buildFormalBillingFromLegacy(capabilityType, {
    ...pricing,
    ...legacyPricing,
    rateCard: pricing.rateCard,
  });
  const rateCardPresent = Array.isArray(pricing.rateCard) && pricing.rateCard.length > 0;

  if (explicitFormalBilling && !rateCardPresent) {
    const adaptedLegacyPricing = buildLegacyPricingSnapshotFromFormalBilling(explicitFormalBilling);
    const legacyPage = buildLegacyPageBoundary("formal_billing", explicitFormalBilling);
    const shouldRebuildFromLegacy = legacyPage.mode === "editable" && hasLegacyPricingOverrides(pricing, adaptedLegacyPricing);

    if (!shouldRebuildFromLegacy) {
      source = "formal_billing";
      formalBilling = explicitFormalBilling;
    }
  }

  const compatibleLegacyPricing =
    source === "formal_billing"
      ? buildLegacyPricingSnapshotFromFormalBilling(formalBilling)
      : {
          ...legacyPricing,
          rules: rateCardPresent ? excludeVideoAxisRules(legacyPricing.rules) : legacyPricing.rules,
        };
  const supportedMeters = collectSupportedMeters(formalBilling, compatibleLegacyPricing);
  const primaryLineItem = formalBilling.lineItems[0];
  const primaryMeter = normalizeMeterKey(primaryLineItem?.meterKey || inferPrimaryMeter(capabilityType, compatibleLegacyPricing));
  const primaryUnit = String(primaryLineItem?.unit || compatibleLegacyPricing.unit || "unit").trim() || "unit";
  const primaryCurrency =
    String(primaryLineItem?.currency || compatibleLegacyPricing.currency || formalBilling.settlementCurrency || "CNY").trim() || "CNY";
  const legacyPage = buildLegacyPageBoundary(source, formalBilling);
  const fieldMappings = buildFieldMappings({
    source,
    formalBilling,
    legacyPricing: compatibleLegacyPricing,
    legacyPage,
  });

  const projection = buildProjection({
    capabilityType,
    source,
    formalBilling,
    legacyPricing: compatibleLegacyPricing,
    primaryMeter,
    primaryUnit,
    primaryCurrency,
    supportedMeters,
    fieldMappings,
    legacyPage,
  });

  return {
    source,
    formalBilling,
    legacyPricing: compatibleLegacyPricing,
    projection,
  };
}

export function buildCapabilityPricingProjection(
  capabilityCode: ModelCapabilityCode,
  pricing: CapabilityPricing,
): CapabilityPricingProjection {
  return resolveCapabilityPricingState(capabilityCode, pricing).projection;
}

export function buildFormalBillingModel(
  capabilityCode: ModelCapabilityCode,
  pricing: CapabilityPricing,
): FormalBillingModel {
  return resolveCapabilityPricingState(capabilityCode, pricing).formalBilling;
}

export function normalizeCapabilityPricingWithProjection(
  capabilityCode: ModelCapabilityCode,
  pricing: CapabilityPricing,
): CapabilityPricing {
  const resolved = resolveCapabilityPricingState(capabilityCode, pricing);

  return {
    ...pricing,
    pricingMode: resolved.legacyPricing.pricingMode,
    basePrice: resolved.legacyPricing.basePrice,
    unit: resolved.legacyPricing.unit,
    currency: resolved.legacyPricing.currency,
    rules: resolved.legacyPricing.rules,
    formalBilling: resolved.formalBilling,
    projection: resolved.projection,
  };
}

export function getCapabilityPricingProjection(
  capabilityCode: ModelCapabilityCode,
  pricing: CapabilityPricing,
): CapabilityPricingProjection {
  return buildCapabilityPricingProjection(capabilityCode, pricing);
}
