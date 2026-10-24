import type { CapabilityCatalogItem } from "./modelCapabilitySchemas";
import type {
  CapabilityConfigSectionKey,
  CapabilityFieldDefinition,
  CapabilityPricing,
  CapabilityPricingSimulationResult,
  CapabilityPricingSimulatorFieldDefinition,
  CapabilityPricingSimulatorInput,
  CapabilityPricingTemplate,
  CapabilityTemplatePresetDefinition,
  ModelCapabilityCode,
  ModelCapabilityConfig,
  ModelCapabilityConfigInput,
  ModelCapabilityConfigs,
  CapabilitySectionDefinition,
} from "./modelCapabilityMetadata";

export interface CapabilityFieldUiContext {
  config: ModelCapabilityConfig;
  sectionKey: CapabilityConfigSectionKey;
  field: CapabilityFieldDefinition;
  value: unknown;
}

export interface CapabilityFieldLayoutSchema {
  colSpan?: 1 | 2;
  className?: string;
}

export interface CapabilityFieldUiConfig {
  hidden?: boolean;
  rendererKey?: string;
  options?: Array<{ label: string; value: string }>;
  helperText?: string;
  layout?: CapabilityFieldLayoutSchema;
  props?: Record<string, unknown>;
}

export interface CapabilityPricingEditorCopy {
  unitPlaceholder?: string;
  ruleValuePlaceholder?: string;
  simulationQuantityLabel?: string;
  simulationQuantityUnitLabel?: string;
}

export interface CapabilityMatchedSceneTemplate {
  template: CapabilityPricingTemplate;
  isExactMatch: boolean;
}

export interface CapabilityOverview {
  boundary: string;
  defaults: string;
  template: string;
  pricing: string;
  formula: string;
}

export interface CapabilityOverviewContext {
  config: ModelCapabilityConfig;
  matchedTemplate: CapabilityMatchedSceneTemplate | null;
  billingSummary: string | null;
}

export interface ModelCapabilityDetailState {
  code: ModelCapabilityCode;
  config: ModelCapabilityConfig;
  matchedTemplate: CapabilityMatchedSceneTemplate | null;
  overview: CapabilityOverview;
  pricingSummary: string;
  validationIssues: string[];
}

export interface ModelCapabilitySnapshot {
  capabilities: ModelCapabilityCode[];
  capabilityConfigs: ModelCapabilityConfigs;
  pricingSummary: string;
  multimodalEnabled: boolean;
  streamingEnabled: boolean;
  capabilitySummary: string;
  capabilityLabels: string[];
  validationIssues: Partial<Record<ModelCapabilityCode, string[]>>;
  totalValidationIssueCount: number;
  details: Partial<Record<ModelCapabilityCode, ModelCapabilityDetailState>>;
}

export interface CapabilityPluginManifest extends CapabilityCatalogItem {
  sections: CapabilitySectionDefinition[];
  templatePresets?: CapabilityTemplatePresetDefinition[];
  getFieldUiConfig?: (context: CapabilityFieldUiContext) => CapabilityFieldUiConfig | null;
}

export interface CapabilityPlugin {
  code: ModelCapabilityCode;
  getCatalogItem: () => CapabilityCatalogItem;
  getDescription: () => string;
  getSections: () => CapabilitySectionDefinition[];
  getTemplatePresets: () => CapabilityTemplatePresetDefinition[];
  createDefaultConfig: () => ModelCapabilityConfig;
  normalizeConfig: (config?: ModelCapabilityConfigInput) => ModelCapabilityConfig;
  toConfigOutput: (config?: ModelCapabilityConfigInput) => ModelCapabilityConfig;
  listTemplates: () => CapabilityPricingTemplate[];
  getPricingTemplates: () => CapabilityPricingTemplate[];
  applyTemplate: (templateId: string, current?: ModelCapabilityConfigInput) => ModelCapabilityConfig;
  getPricingSimulatorFields: (config: ModelCapabilityConfig) => CapabilityPricingSimulatorFieldDefinition[];
  simulatePricing: (
    config: ModelCapabilityConfig,
    input: CapabilityPricingSimulatorInput,
  ) => CapabilityPricingSimulationResult | null;
  getRuleMetricSuggestions: () => string[];
  getValidationIssues: (config: ModelCapabilityConfig) => string[];
  buildOverview: (context: CapabilityOverviewContext) => CapabilityOverview;
  buildPricingSummary: (config?: ModelCapabilityConfigInput) => string;
  getPricingEditorCopy: () => CapabilityPricingEditorCopy | null;
  getFieldUiConfig?: (context: CapabilityFieldUiContext) => CapabilityFieldUiConfig | null;
}

export interface CapabilityPackage {
  manifest: CapabilityPluginManifest;
  templates: {
    buildPricing: (templateId: string, index: number) => CapabilityPricing;
    ruleMetricSuggestions: string[];
  };
  validators?: {
    getIssues: (basePlugin: CapabilityPlugin, config: ModelCapabilityConfig) => string[];
  };
  overview?: {
    build: (context: CapabilityOverviewContext) => CapabilityOverview;
    buildPricingSummary?: (basePlugin: CapabilityPlugin, config?: ModelCapabilityConfigInput) => string;
  };
  simulator?: {
    getFields: (config: ModelCapabilityConfig) => CapabilityPricingSimulatorFieldDefinition[];
    simulate: (
      config: ModelCapabilityConfig,
      input: CapabilityPricingSimulatorInput,
    ) => CapabilityPricingSimulationResult | null;
  };
  pricingEditor?: CapabilityPricingEditorCopy;
  normalizeFields?: (config: ModelCapabilityConfig) => ModelCapabilityConfig;
}
