import type { ModelCapabilityCode, ModelCapabilityConfigInput } from "./modelCapabilityMetadata";
import type { CapabilityCatalogItem } from "./modelCapabilitySchemas";
import type { CapabilityPackage, CapabilityPlugin } from "./capabilityPluginTypes";
import { capabilityPackages } from "./capabilities";
import {
  createCapabilityPlugin,
  createCapabilityPluginMap,
} from "./capabilityRegistryFactory";

export type CapabilityRegistryCatalogItem = CapabilityCatalogItem & {
  plugin: CapabilityPlugin;
};

export function createCapabilityRegistryCatalogFromPackages(packages: CapabilityPackage[]): CapabilityRegistryCatalogItem[] {
  const pluginMap = createCapabilityPluginMap(packages);
  return packages.map((capabilityPackage) => ({
    ...capabilityPackage.manifest,
    plugin: pluginMap[capabilityPackage.manifest.code],
  }));
}

const capabilityPlugins = createCapabilityPluginMap(capabilityPackages);
const capabilityRegistryCatalog = createCapabilityRegistryCatalogFromPackages(capabilityPackages);

export function getCapabilityRegistryCatalog() {
  return capabilityRegistryCatalog;
}

export function getCapabilityPlugin(code: ModelCapabilityCode) {
  return capabilityPlugins[code];
}

export function getCapabilityPricingTemplates(code: ModelCapabilityCode) {
  return getCapabilityPlugin(code).getPricingTemplates();
}

export function getCapabilityRuleMetricSuggestions(code: ModelCapabilityCode) {
  return getCapabilityPlugin(code).getRuleMetricSuggestions();
}

export function normalizeCapabilityConfig(code: ModelCapabilityCode, config?: ModelCapabilityConfigInput) {
  return getCapabilityPlugin(code).normalizeConfig(config);
}

export { createCapabilityPlugin };
