import type {
  BillingRuleOperator,
  BillingRuleValue,
  CapabilityConfigMap,
  CapabilityPricing,
  CapabilityPricingRule,
  ModelCapabilityCode,
  ModelCapabilityConfig,
  ModelCapabilityConfigInput,
} from "./modelCapabilityMetadata";
import type { CapabilityCatalogItem } from "./modelCapabilitySchemas";
import {
  resolveBillingMetricDefinition,
  sanitizeCapabilityPricingRule,
  summarizeBillingRuleMetrics,
} from "./billingMetricRegistry";
import {
  formatCapabilityTemplateText,
  toChineseBusinessLabel,
} from "./capabilityDisplayText";
import { normalizeCapabilityPricingWithProjection } from "./pricingProjection";
import { buildPricingRateLabel } from "./pricingUnit";
import type {
  CapabilityOverview,
  CapabilityOverviewContext,
  CapabilityPackage,
  CapabilityPlugin,
} from "./capabilityPluginTypes";

function normalizePricing(
  capabilityCode: ModelCapabilityCode,
  basePricing: CapabilityPricing,
  rawPricing?: Partial<CapabilityPricing> | null,
): CapabilityPricing {
  const rawRules = Array.isArray(rawPricing?.rules) ? rawPricing.rules : [];

  return normalizeCapabilityPricingWithProjection(capabilityCode, {
    ...basePricing,
    ...rawPricing,
    templateId: String(rawPricing?.templateId || basePricing.templateId || "").trim() || undefined,
    pricingMode: rawPricing?.pricingMode || basePricing.pricingMode || "metered",
    isCustomized: rawPricing?.isCustomized ?? basePricing.isCustomized,
    basePrice: Number(rawPricing?.basePrice ?? basePricing.basePrice ?? 0),
    unit: String(rawPricing?.unit ?? basePricing.unit ?? "unit").trim() || "unit",
    unitKind: String(rawPricing?.unitKind ?? basePricing.unitKind ?? "").trim() || undefined,
    currency: String(rawPricing?.currency ?? basePricing.currency ?? "CNY").trim() || "CNY",
    notes: String(rawPricing?.notes ?? basePricing.notes ?? "").trim() || undefined,
    rules: rawRules.map((rule, index) => sanitizeCapabilityPricingRule(rule, index)),
    rateCard: Array.isArray(rawPricing?.rateCard)
      ? rawPricing.rateCard
      : Array.isArray(basePricing.rateCard)
        ? basePricing.rateCard
        : undefined,
    formalBilling: rawPricing?.formalBilling ?? basePricing.formalBilling ?? null,
    projection: rawPricing?.projection ?? basePricing.projection ?? null,
  });
}

export function buildDefaultCapabilityConfig(capabilityPackage: CapabilityPackage): ModelCapabilityConfig {
  const sections = capabilityPackage.manifest.sections;
  const boundary: CapabilityConfigMap = {};
  const defaults: CapabilityConfigMap = {};

  sections.forEach((section) => {
    const target = section.target === "boundary" ? boundary : defaults;
    section.fields.forEach((field) => {
      if (Array.isArray(field.defaultValue)) {
        target[field.key] = [...field.defaultValue];
        return;
      }
      if (field.defaultValue && typeof field.defaultValue === "object") {
        target[field.key] = { ...field.defaultValue };
        return;
      }
      target[field.key] = field.defaultValue;
    });
  });

  return {
    boundary,
    defaults,
    pricing: normalizeCapabilityPricingWithProjection(capabilityPackage.manifest.code, {
      pricingMode: "metered",
      isCustomized: false,
      basePrice: 0,
      unit: "unit",
      currency: "CNY",
      rules: [],
    }),
  };
}

export function normalizeCapabilityConfigOutput(
  capabilityPackage: CapabilityPackage,
  config?: ModelCapabilityConfigInput,
): ModelCapabilityConfig {
  const defaultConfig = buildDefaultCapabilityConfig(capabilityPackage);
  if (!config) return defaultConfig;

  return {
    boundary: {
      ...defaultConfig.boundary,
      ...(config.boundary || {}),
    },
    defaults: {
      ...defaultConfig.defaults,
      ...(config.defaults || {}),
    },
    pricing: normalizePricing(capabilityPackage.manifest.code, defaultConfig.pricing, config.pricing),
  };
}

function isValidBillingRuleValue(operator: BillingRuleOperator | undefined, value: BillingRuleValue | undefined) {
  if (!operator) return false;

  if (operator === "in") {
    return Array.isArray(value) && value.length > 0;
  }

  if (operator === "range") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const min = "min" in value ? Number(value.min) : NaN;
    const max = "max" in value ? Number(value.max) : NaN;
    return Number.isFinite(min) || Number.isFinite(max);
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return String(value || "").trim().length > 0;
}

function getDefaultCapabilityValidationIssues(config: ModelCapabilityConfig, plugin: CapabilityPlugin) {
  const issues: string[] = [];
  const templates = plugin.listTemplates();
  const templateId = String(config.pricing.templateId || "").trim();
  const basePrice = Number(config.pricing.basePrice || 0);
  const unit = String(config.pricing.unit || "").trim();
  const currency = String(config.pricing.currency || "").trim();
  const rules = Array.isArray(config.pricing.rules) ? config.pricing.rules : [];

    if (templates.length === 0) {
    issues.push("Current capability package does not provide pricing templates.");
  }

  if (!(basePrice > 0)) {
    issues.push("Base price must be greater than 0.");
  }

  if (!unit) {
    issues.push("Pricing unit is required.");
  }

  if (!currency) {
    issues.push("Currency is required.");
  }

  rules.forEach((rule, index) => {
    const metric = String(rule.metric || "").trim();
    if (!metric) {
      issues.push(`Rule ${index + 1} is missing a billing metric.`);
    } else if (!resolveBillingMetricDefinition(metric)) {
      issues.push(`Rule ${index + 1} uses an unregistered billing metric: ${metric}.`);
    }
    if (!rule.operator) {
      issues.push(`Rule ${index + 1} is missing an operator.`);
    }
    if (!isValidBillingRuleValue(rule.operator, rule.value)) {
      issues.push(`Rule ${index + 1} is missing a valid rule value.`);
    }
    if (!(Number(rule.multiplier || 0) > 0)) {
      issues.push(`Rule ${index + 1} multiplier must be greater than 0.`);
    }
  });

  return issues;
}

function buildDefaultCapabilityOverview(capabilityPackage: CapabilityPackage, context: CapabilityOverviewContext): CapabilityOverview {
  const { config, matchedTemplate, billingSummary } = context;
  const defaultFields = Object.entries(config.defaults || {})
    .filter(([, value]) => String(value || "").trim().length > 0)
    .slice(0, 3)
    .map(([, value]) => String(value).trim());

  return {
    boundary: capabilityPackage.manifest.label,
        defaults: defaultFields.length > 0 ? defaultFields.join(" | ") : "使用默认模板值",
        template: matchedTemplate ? formatCapabilityTemplateText(matchedTemplate.template.label, matchedTemplate.isExactMatch) : "未选择模板",
    pricing:
      config.pricing.basePrice > 0
        ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit)
            : billingSummary || "待补充定价",
        formula: "总价 = 基础单价 × 计费数量 × 命中规则倍率（无规则则按基础单价）",
  };
}

function buildDefaultCapabilityPricingSummary(capabilityPackage: CapabilityPackage, rawConfig?: ModelCapabilityConfigInput) {
  const config = normalizeCapabilityConfigOutput(capabilityPackage, rawConfig);
  const basePriceLabel =
    config.pricing.basePrice > 0 ? buildPricingRateLabel(config.pricing.basePrice, config.pricing.unit) : "";
  const ruleSummary = summarizeBillingRuleMetrics(config.pricing.rules);
  return [basePriceLabel, ruleSummary].filter(Boolean).join(" + ");
}

export function createCapabilityPlugin(capabilityPackage: CapabilityPackage): CapabilityPlugin {
  const { code, templatePresets = [] } = capabilityPackage.manifest;
  const catalogItem: CapabilityCatalogItem = {
    code,
    label: capabilityPackage.manifest.label,
    bucket: capabilityPackage.manifest.bucket,
    category: capabilityPackage.manifest.category,
    schemaLevel: capabilityPackage.manifest.schemaLevel,
    description: capabilityPackage.manifest.description,
    keywords: capabilityPackage.manifest.keywords,
  };

  const listTemplates = () =>
    templatePresets.map((preset, index) => ({
      id: preset.templateId,
      label: preset.label,
          description: `${toChineseBusinessLabel(preset.scenario)}；${toChineseBusinessLabel(preset.pricingFocus)}`,
          useCase: toChineseBusinessLabel(preset.scenario),
          priceStyle: toChineseBusinessLabel(preset.pricingFocus),
      pricing: capabilityPackage.templates.buildPricing(preset.templateId, index),
    }));
  const normalizeConfig = (config?: ModelCapabilityConfigInput) => {
    const merged = normalizeCapabilityConfigOutput(capabilityPackage, config);
    const normalized = capabilityPackage.normalizeFields ? capabilityPackage.normalizeFields(merged) : merged;
    const templateId = String(normalized.pricing.templateId || "").trim();

    if (!templateId) {
      return normalized;
    }

    const matchedTemplate = listTemplates().find((item) => item.id === templateId);
    if (matchedTemplate) {
      return normalized;
    }

    return {
      ...normalized,
      pricing: {
        ...normalized.pricing,
        // Historical template ids may no longer exist in the current capability package.
        // Keep the user's pricing/rule data, but fall back to plain custom pricing.
        templateId: undefined,
        isCustomized: true,
      },
    };
  };

  const basePlugin: CapabilityPlugin = {
    code,
    getCatalogItem: () => catalogItem,
    getDescription: () => capabilityPackage.manifest.description,
    getSections: () => capabilityPackage.manifest.sections,
    getTemplatePresets: () => templatePresets,
    createDefaultConfig: () => buildDefaultCapabilityConfig(capabilityPackage),
    normalizeConfig,
    toConfigOutput: normalizeConfig,
    listTemplates,
    getPricingTemplates: listTemplates,
    applyTemplate: (templateId, current) => {
      const normalizedCurrent = normalizeConfig(current);
      const template = listTemplates().find((item) => item.id === templateId);
      if (!template) {
        return normalizedCurrent;
      }

      return normalizeConfig({
        ...normalizedCurrent,
        pricing: {
          ...template.pricing,
          isCustomized: false,
        },
      });
    },
    getPricingSimulatorFields: () => [],
    simulatePricing: () => null,
    getRuleMetricSuggestions: () => capabilityPackage.templates.ruleMetricSuggestions,
    getValidationIssues: () => [],
    buildOverview: (context) => buildDefaultCapabilityOverview(capabilityPackage, context),
    buildPricingSummary: (config) => buildDefaultCapabilityPricingSummary(capabilityPackage, config),
    getPricingEditorCopy: () => capabilityPackage.pricingEditor || null,
  };

  return {
    ...basePlugin,
    getPricingSimulatorFields: capabilityPackage.simulator?.getFields || basePlugin.getPricingSimulatorFields,
    simulatePricing: capabilityPackage.simulator?.simulate || basePlugin.simulatePricing,
    getValidationIssues: (config) => [
      ...getDefaultCapabilityValidationIssues(config, basePlugin),
      ...(capabilityPackage.validators?.getIssues(basePlugin, config) || []),
    ],
    buildOverview: (context) => capabilityPackage.overview?.build(context) || basePlugin.buildOverview(context),
    buildPricingSummary: (config) =>
      capabilityPackage.overview?.buildPricingSummary?.(basePlugin, config) || basePlugin.buildPricingSummary(config),
    getFieldUiConfig: capabilityPackage.manifest.getFieldUiConfig,
  };
}

export function createCapabilityPluginMap(capabilityPackages: CapabilityPackage[]) {
  return capabilityPackages.reduce<Record<ModelCapabilityCode, CapabilityPlugin>>((accumulator, capabilityPackage) => {
    accumulator[capabilityPackage.manifest.code] = createCapabilityPlugin(capabilityPackage);
    return accumulator;
  }, {} as Record<ModelCapabilityCode, CapabilityPlugin>);
}

export {
  createCapabilityRegistryCatalogFromPackages,
  getCapabilityPlugin,
  getCapabilityPricingTemplates,
  getCapabilityRegistryCatalog,
  getCapabilityRuleMetricSuggestions,
  normalizeCapabilityConfig,
} from "./capabilityRegistryStore";

export * from "./capabilityRuntime";
export type {
  CapabilityFieldUiConfig,
  CapabilityFieldUiContext,
  CapabilityMatchedSceneTemplate,
  CapabilityOverview,
  CapabilityOverviewContext,
  CapabilityPackage,
  CapabilityPlugin,
  ModelCapabilityDetailState,
  ModelCapabilitySnapshot,
} from "./capabilityPluginTypes";
