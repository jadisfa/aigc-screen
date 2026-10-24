import type { CapabilityConfigSectionKey, CapabilitySectionDefinition, ModelCapabilityConfig } from "./modelCapabilityMetadata";
import {
  getCapabilityConfigFieldValue,
  parseDelimitedValues,
} from "./modelCapabilityMetadata";

export function getCapabilityFieldValue(
  config: ModelCapabilityConfig,
  sectionKey: CapabilityConfigSectionKey,
  fieldKey: string,
) {
  return getCapabilityConfigFieldValue(config, sectionKey, fieldKey);
}

export function resolveCapabilitySectionKey(section: Pick<CapabilitySectionDefinition, "target">): CapabilityConfigSectionKey {
  return section.target;
}

export function parseCapabilityDelimitedValues(value: string) {
  return parseDelimitedValues(value);
}

export function buildHiddenCapabilityCode(prefix: string, rawValue: string, index: number) {
  return `${prefix}_${rawValue}_${index}`;
}
