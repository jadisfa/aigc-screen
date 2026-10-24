import type {
  CapabilityFilterValue,
  CapabilityPricing,
  CapabilityPricingTemplate,
  ModelCapabilityCode,
  ModelCapabilityConfig,
  ModelCapabilityConfigInput,
  ModelCapabilityConfigs,
} from "./modelCapabilityMetadata";
import type {
  CapabilityMatchedSceneTemplate,
  ModelCapabilityDetailState,
  ModelCapabilitySnapshot,
} from "./capabilityPluginTypes";
import { formatCapabilitySummary, toChineseBusinessLabel } from "./capabilityDisplayText";
import { getCapabilityPlugin, getCapabilityRegistryCatalog } from "./capabilityRegistryStore";

type CapabilityConfigInputs = Partial<Record<ModelCapabilityCode, ModelCapabilityConfigInput | ModelCapabilityConfig>>;

function buildPricingComparisonPayload(pricing: CapabilityPricing) {
  return {
    templateId: pricing.templateId || "",
    pricingMode: pricing.pricingMode || "metered",
    basePrice: Number(pricing.basePrice || 0),
    unit: pricing.unit || "",
    currency: pricing.currency || "",
    notes: pricing.notes || "",
    rules: pricing.rules.map((rule) => ({
      metric: rule.metric || "",
      operator: rule.operator,
      value: rule.value,
      multiplier: Number(rule.multiplier || 0),
      description: rule.description || "",
    })),
    rateCard: (pricing.rateCard || []).map((row) => ({
      resolution: String(row.resolution || "").trim(),
      unitPrice: Number(row.unitPrice || 0),
      isDefault: Boolean(row.isDefault),
    })),
  };
}

function buildMissingTemplatePlaceholder(
  templateId: string,
  pricing: CapabilityPricing,
  label: string,
  description: string,
): CapabilityPricingTemplate {
  return {
    id: templateId,
    label: toChineseBusinessLabel(label),
    description: toChineseBusinessLabel(description),
    useCase: toChineseBusinessLabel(description),
    priceStyle: "请从当前能力包中重新选择模板",
    pricing,
  };
}

function getCapabilityDomain(code: ModelCapabilityCode) {
  if (code === "text_embedding" || code === "multimodal_embedding") return "vector";
  if (code === "deep_thinking" || code === "translation" || code === "role_play" || code.startsWith("text_")) return "text";
  if (code === "three_d_generation" || code.startsWith("three_d_")) return "three_d";
  if (code.startsWith("image_")) return "image";
  if (code.startsWith("speech_") || code === "ai_dubbing" || code === "music_generation") return "audio";
  if (code.startsWith("video_")) return "video";
  if (code.startsWith("tool_")) return "tool";
  if (code.startsWith("resource_")) return "resource";
  return "other";
}

export function normalizeCapabilityCodes(codes: ModelCapabilityCode[]) {
  const uniqueCodes = new Set(codes);
  return getCapabilityRegistryCatalog()
    .map((item) => item.code)
    .filter((code) => uniqueCodes.has(code));
}

export function getCapabilityLabels(codes: ModelCapabilityCode[]) {
  return normalizeCapabilityCodes(codes).map((code) => getCapabilityPlugin(code).getCatalogItem().label);
}

export function summarizeCapabilities(codes: ModelCapabilityCode[], maxVisible = 3) {
  const normalizedCodes = normalizeCapabilityCodes(codes);

  if (normalizedCodes.length === 0) return "";

  const labels = getCapabilityLabels(normalizedCodes);
  return formatCapabilitySummary(labels, maxVisible);
}

export function matchCapabilityPricingTemplate(
  code: ModelCapabilityCode,
  config?: ModelCapabilityConfigInput,
): CapabilityMatchedSceneTemplate | null {
  const plugin = getCapabilityPlugin(code);
  const normalizedConfig = plugin.toConfigOutput(config);
  const templates = plugin.listTemplates();
  const explicitTemplateId = String(normalizedConfig.pricing.templateId || "").trim();
  const exactTemplate = explicitTemplateId ? templates.find((template) => template.id === explicitTemplateId) : null;
  const pricingFingerprint = buildPricingComparisonPayload(normalizedConfig.pricing);

  if (templates.length === 0) {
    return {
      template: buildMissingTemplatePlaceholder(
        explicitTemplateId || `${code}__missing_template_catalog`,
        normalizedConfig.pricing,
        "missing template catalog",
        "capability package does not provide templates for this capability",
      ),
      isExactMatch: false,
    };
  }

  if (explicitTemplateId && !exactTemplate) {
    return null;
  }

  if (exactTemplate) {
    return {
      template: exactTemplate,
      isExactMatch: JSON.stringify(buildPricingComparisonPayload(exactTemplate.pricing)) === JSON.stringify(pricingFingerprint),
    };
  }

  const fallbackTemplate = templates.find(
    (template) =>
      JSON.stringify(buildPricingComparisonPayload(template.pricing)) === JSON.stringify(pricingFingerprint),
  );

  return fallbackTemplate ? { template: fallbackTemplate, isExactMatch: true } : null;
}

export function applyCapabilityPricingTemplate(
  code: ModelCapabilityCode,
  templateId: string,
  current?: ModelCapabilityConfigInput,
) {
  return getCapabilityPlugin(code).applyTemplate(templateId, current);
}

export function deriveStreamingEnabled(codes: ModelCapabilityCode[], configs?: CapabilityConfigInputs) {
  return normalizeCapabilityCodes(codes).some((code) => {
    const config = getCapabilityPlugin(code).toConfigOutput(configs?.[code]);
    return config?.boundary?.supportStreaming === true;
  });
}

export function deriveMultimodalEnabled(codes: ModelCapabilityCode[]) {
  const normalizedCodes = normalizeCapabilityCodes(codes);
  const contentDomains = new Set(
    normalizedCodes
      .map((code) => getCapabilityDomain(code))
      .filter((domain) => !["tool", "resource", "other"].includes(domain)),
  );

  return contentDomains.size >= 2;
}

function getCapabilityFilterDomains(filterValue: CapabilityFilterValue) {
  if (filterValue === "语言模型") return ["text"];
  if (filterValue === "视觉模型") return ["image", "video"];
  if (filterValue === "3D模型") return ["three_d"];
  if (filterValue === "语音模型") return ["audio"];
  if (filterValue === "向量模型") return ["vector"];
  return [];
}

export function matchesCapabilityFilter(
  codes: ModelCapabilityCode[],
  filterValue: CapabilityFilterValue | "all",
  multimodalEnabled = false,
) {
  if (filterValue === "all") return true;

  const normalizedCodes = normalizeCapabilityCodes(codes);
  const filterDomains = getCapabilityFilterDomains(filterValue);
  if (filterDomains.length > 0) {
    return normalizedCodes.some((code) => filterDomains.includes(getCapabilityDomain(code)));
  }

  if (filterValue === "多模态模型") {
    return multimodalEnabled || deriveMultimodalEnabled(normalizedCodes);
  }

  return false;
}

export function buildPricingSummary(codes: ModelCapabilityCode[], configs?: CapabilityConfigInputs) {
  const normalizedCodes = normalizeCapabilityCodes(codes);
  if (normalizedCodes.length === 0) return "待补充定价摘要";

  const fragments = normalizedCodes
    .map((code) => getCapabilityPlugin(code).buildPricingSummary(configs?.[code]))
    .filter(Boolean);

  if (fragments.length <= 2) return fragments.join(" + ");
  return `${fragments.slice(0, 2).join(" + ")} + more`;
}

export function deriveCapabilityDraftState(
  codes: ModelCapabilityCode[],
  configs?: CapabilityConfigInputs,
) {
  const normalizedCodes = normalizeCapabilityCodes(codes);
  const capabilityConfigs = normalizedCodes.reduce<ModelCapabilityConfigs>((accumulator, code) => {
    accumulator[code] = getCapabilityPlugin(code).toConfigOutput(configs?.[code]);
    return accumulator;
  }, {});
  const multimodalEnabled = deriveMultimodalEnabled(normalizedCodes);
  const streamingEnabled = deriveStreamingEnabled(normalizedCodes, capabilityConfigs);

  return {
    capabilities: normalizedCodes,
    capabilityConfigs,
    multimodalEnabled,
    streamingEnabled,
    pricingSummary: buildPricingSummary(normalizedCodes, capabilityConfigs),
  };
}

export function deriveModelCapabilitySnapshot(
  codes: ModelCapabilityCode[],
  configs?: CapabilityConfigInputs,
): ModelCapabilitySnapshot {
  const draftState = deriveCapabilityDraftState(codes, configs);
  const capabilityLabels = getCapabilityLabels(draftState.capabilities);
  const validationIssues: Partial<Record<ModelCapabilityCode, string[]>> = {};
  const details: Partial<Record<ModelCapabilityCode, ModelCapabilityDetailState>> = {};

  draftState.capabilities.forEach((code) => {
    const plugin = getCapabilityPlugin(code);
    const config = draftState.capabilityConfigs[code];
    const pricingSummary = plugin.buildPricingSummary(config);
    const matchedTemplate = matchCapabilityPricingTemplate(code, config);
    const overview = plugin.buildOverview({
      config,
      matchedTemplate,
      billingSummary: pricingSummary || null,
    });
    const issues = plugin.getValidationIssues(config);

    validationIssues[code] = issues;
    details[code] = {
      code,
      config,
      matchedTemplate,
      overview,
      pricingSummary,
      validationIssues: issues,
    };
  });

  return {
    ...draftState,
    capabilitySummary: summarizeCapabilities(draftState.capabilities, 99),
    capabilityLabels,
    validationIssues,
    totalValidationIssueCount: draftState.capabilities.reduce(
      (count, code) => count + (validationIssues[code]?.length || 0),
      0,
    ),
    details,
  };
}
