import { CapabilityStageOnePricingPanel } from "@/modules/modelhub/components/ModelCapabilityPricingEditors";
import type {
  CapabilityPricing,
  CapabilityPricingSimulationResult,
  CapabilityPricingSimulatorFieldDefinition,
  CapabilityPricingTemplate,
  ModelCapabilityConfig,
  ModelCapabilityCode,
} from "@/modules/modelhub/types/modelCapabilityMetadata";
import type { CapabilityMatchedSceneTemplate } from "@/modules/modelhub/types/capabilityRegistryFactory";

export function PricingWorkbench(props: {
  activeCapabilityMeta: { code: ModelCapabilityCode; label: string };
  activeCapabilityConfig: ModelCapabilityConfig;
  activeCapabilitySceneTemplates: CapabilityPricingTemplate[];
  activePricingSimulatorFields: CapabilityPricingSimulatorFieldDefinition[];
  activePricingSimulatorInput: Record<string, string | number | boolean>;
  activePricingSimulation: CapabilityPricingSimulationResult | null;
  ruleMetricSuggestions: string[];
  activeMatchedSceneTemplate: CapabilityMatchedSceneTemplate | null;
  hasCustomizedRulePricing: boolean;
  onChangePricing: (pricing: CapabilityPricing) => void;
  onUpdateSimulatorInput: (
    code: ModelCapabilityCode,
    field: CapabilityPricingSimulatorFieldDefinition,
    value: string,
  ) => void;
  onApplySceneTemplate: (code: ModelCapabilityCode, templateId: string) => void;
}) {
  return <CapabilityStageOnePricingPanel {...props} />;
}
