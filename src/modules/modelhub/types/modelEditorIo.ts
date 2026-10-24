import type {
  ModelCapabilityCode,
  ModelCapabilityConfig,
  ModelCapabilityConfigInput,
  ModelCapabilityConfigs,
} from "./modelCapabilityMetadata";
import { sanitizeCapabilityPricingRule } from "./billingMetricRegistry";
import { getCapabilityPlugin } from "./capabilityRegistryFactory";
import { normalizeCapabilityPricingWithProjection } from "./pricingProjection";

export function normalizeCapabilityConfigAtBoundary(
  code: ModelCapabilityCode,
  rawConfig?: ModelCapabilityConfig | ModelCapabilityConfigInput,
): ModelCapabilityConfig {
  const plugin = getCapabilityPlugin(code);

  if (!rawConfig) {
    return plugin.createDefaultConfig();
  }

  return plugin.normalizeConfig({
    boundary: {
      ...(rawConfig.boundary || {}),
    },
    defaults: {
      ...(rawConfig.defaults || {}),
    },
    pricing: rawConfig.pricing
      ? normalizeCapabilityPricingWithProjection(code, {
          ...rawConfig.pricing,
          isCustomized: Boolean(rawConfig.pricing.isCustomized),
          basePrice: Number(rawConfig.pricing.basePrice || 0),
          unit: String(rawConfig.pricing.unit || "unit"),
          currency: String(rawConfig.pricing.currency || "CNY"),
          rules: Array.isArray(rawConfig.pricing.rules)
            ? rawConfig.pricing.rules.map((rule, index) => sanitizeCapabilityPricingRule(rule, index))
            : [],
        } as ModelCapabilityConfig["pricing"])
      : undefined,
  });
}

export function normalizeCapabilityConfigsAtBoundary(
  codes: ModelCapabilityCode[],
  configs?: Partial<Record<ModelCapabilityCode, ModelCapabilityConfig | ModelCapabilityConfigInput>>,
): ModelCapabilityConfigs {
  return codes.reduce<ModelCapabilityConfigs>((accumulator, code) => {
    accumulator[code] = normalizeCapabilityConfigAtBoundary(code, configs?.[code]);
    return accumulator;
  }, {});
}
