import { CapabilityWorkbench } from "@/modules/modelhub/components/model-editor/CapabilityWorkbench";
import { PricingWorkbench } from "@/modules/modelhub/components/model-editor/PricingWorkbench";
import type { CapabilityWorkbenchViewModel } from "@/modules/modelhub/hooks/useCapabilityWorkbench";

export function CapabilityEditorSection(props: {
  capabilityWorkbench: CapabilityWorkbenchViewModel;
}) {
  const { capabilityWorkbench } = props;

  const pricingWorkbench =
    capabilityWorkbench.activeCapabilityMeta && capabilityWorkbench.activeCapabilityConfig ? (
      <PricingWorkbench
        activeCapabilityMeta={capabilityWorkbench.activeCapabilityMeta}
        activeCapabilityConfig={capabilityWorkbench.activeCapabilityConfig}
        activeCapabilitySceneTemplates={capabilityWorkbench.activeCapabilitySceneTemplates}
        activePricingSimulatorFields={capabilityWorkbench.activePricingSimulatorFields}
        activePricingSimulatorInput={capabilityWorkbench.activePricingSimulatorInput}
        activePricingSimulation={capabilityWorkbench.activePricingSimulation}
        ruleMetricSuggestions={capabilityWorkbench.ruleMetricSuggestions}
        activeMatchedSceneTemplate={capabilityWorkbench.activeMatchedSceneTemplate}
        hasCustomizedRulePricing={capabilityWorkbench.hasCustomizedRulePricing}
        onChangePricing={capabilityWorkbench.handleChangeActivePricing}
        onUpdateSimulatorInput={capabilityWorkbench.handleUpdatePricingSimulatorInput}
        onApplySceneTemplate={capabilityWorkbench.handleApplySceneTemplate}
      />
    ) : null;

  return (
    <CapabilityWorkbench
      sidebar={{
        capabilityItems: capabilityWorkbench.capabilityItems,
        capabilitySummary: capabilityWorkbench.capabilitySummary,
        totalCapabilityIssueCount: capabilityWorkbench.totalCapabilityIssueCount,
        availableCapabilities: capabilityWorkbench.availableCapabilities,
        pendingCapabilityCode: capabilityWorkbench.pendingCapabilityCode,
        onPendingCapabilityCodeChange: capabilityWorkbench.setPendingCapabilityCode,
        onAddCapability: capabilityWorkbench.handleAddCapability,
        onSelectCapability: capabilityWorkbench.setActiveCapabilityCode,
        onRemoveCapability: capabilityWorkbench.handleRemoveCapability,
      }}
      detail={{
        activeCapabilityCode: capabilityWorkbench.activeCapabilityCode,
        activeCapabilityMeta: capabilityWorkbench.activeCapabilityMeta,
        activeCapabilityConfig: capabilityWorkbench.activeCapabilityConfig,
        activeCapabilityValidationIssues: capabilityWorkbench.activeCapabilityValidationIssues,
        activeCapabilityOverview: capabilityWorkbench.activeCapabilityOverview,
        activeCapabilityTab: capabilityWorkbench.activeCapabilityTab,
        activeCapabilityTabs: capabilityWorkbench.activeCapabilityTabs,
        onCapabilityTabChange: capabilityWorkbench.setActiveCapabilityTab,
        activeCapabilitySection: capabilityWorkbench.activeCapabilitySection,
        activeCapabilityDefaultSection: capabilityWorkbench.activeCapabilityDefaultSection,
        onUpdateActiveCapabilityField: capabilityWorkbench.handleUpdateActiveCapabilityField,
      }}
      pricingWorkbench={pricingWorkbench}
    />
  );
}
