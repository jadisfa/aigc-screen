import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CapabilityConfigSectionKey,
  CapabilityPricing,
  CapabilityPricingSimulatorFieldDefinition,
  ModelCapabilityConfig,
  ModelCapabilityCode,
  ModelCapabilityConfigs,
} from "@/modules/modelhub/types/modelCapabilityMetadata";
import {
  applyCapabilityPricingTemplate,
  getCapabilityRegistryCatalog,
} from "@/modules/modelhub/types/capabilityRegistryFactory";
import type { ModelCapabilitySnapshot } from "@/modules/modelhub/types/capabilityRegistryFactory";
import type { CapabilityDetailTabId } from "@/modules/modelhub/components/model-editor/modelEditorTypes";

const CAPABILITY_CATALOG = getCapabilityRegistryCatalog();
const CAPABILITY_CATALOG_BY_CODE = CAPABILITY_CATALOG.reduce<
  Partial<Record<ModelCapabilityCode, (typeof CAPABILITY_CATALOG)[number]>>
>((accumulator, item) => {
  accumulator[item.code] = item;
  return accumulator;
}, {});

function normalizePricingSimulatorInputValue(
  field: CapabilityPricingSimulatorFieldDefinition,
  rawValue: string | undefined,
) {
  if (field.type === "number") {
    const fallback = Number(field.defaultValue || field.min || 0);
    let nextValue = Number(rawValue ?? fallback);
    if (!Number.isFinite(nextValue)) nextValue = fallback;
    if (field.min !== undefined) nextValue = Math.max(field.min, nextValue);
    if (field.max !== undefined) nextValue = Math.min(field.max, nextValue);
    return String(nextValue);
  }

  const options = field.options || [];
  const candidate = String(rawValue ?? field.defaultValue ?? "").trim();
  if (options.length === 0) return candidate;
  return options.some((option) => option.value === candidate) ? candidate : options[0].value;
}

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
  };
}

function getValidationFocusTab(issues: string[]): CapabilityDetailTabId {
  if (
    issues.some((issue) =>
      ["规则", "单价", "模板", "计费单位", "结算币种"].some((keyword) => issue.includes(keyword)),
    )
  ) {
    return "pricing";
  }

  if (issues.some((issue) => issue.includes("默认"))) {
    return "default";
  }

  return "capability";
}

export function useCapabilityWorkbench(props: {
  capabilityCodes: ModelCapabilityCode[];
  capabilityConfigs: ModelCapabilityConfigs;
  capabilitySnapshot: ModelCapabilitySnapshot;
  onAddCapability: (code: ModelCapabilityCode) => void;
  onRemoveCapability: (code: ModelCapabilityCode) => void;
  onReplaceCapabilityConfig: (code: ModelCapabilityCode, nextConfig: ModelCapabilityConfig) => void;
  onUpdateCapabilityConfig: (
    code: ModelCapabilityCode,
    sectionKey: CapabilityConfigSectionKey | "pricing",
    key: string,
    value: unknown,
  ) => void;
}) {
  const [activeCapabilityCode, setActiveCapabilityCode] = useState<ModelCapabilityCode | "">("");
  const [activeCapabilityTab, setActiveCapabilityTab] = useState<CapabilityDetailTabId>("default");
  const [pendingCapabilityCode, setPendingCapabilityCode] = useState<ModelCapabilityCode | "">("");
  const [pricingSimulatorInputs, setPricingSimulatorInputs] = useState<
    Partial<Record<ModelCapabilityCode, Record<string, string>>>
  >({});

  const availableCapabilities = useMemo(
    () => CAPABILITY_CATALOG.filter((item) => !props.capabilityCodes.includes(item.code)),
    [props.capabilityCodes],
  );

  useEffect(() => {
    if (props.capabilityCodes.length === 0) {
      setActiveCapabilityCode("");
      return;
    }

    if (!activeCapabilityCode || !props.capabilityCodes.includes(activeCapabilityCode)) {
      setActiveCapabilityCode(props.capabilityCodes[0]);
    }
  }, [activeCapabilityCode, props.capabilityCodes]);

  useEffect(() => {
    if (availableCapabilities.length === 0) {
      setPendingCapabilityCode("");
      return;
    }

    if (!pendingCapabilityCode || !availableCapabilities.some((item) => item.code === pendingCapabilityCode)) {
      setPendingCapabilityCode(availableCapabilities[0].code);
    }
  }, [availableCapabilities, pendingCapabilityCode]);

  const activeCapabilityMeta = useMemo(
    () => (activeCapabilityCode ? CAPABILITY_CATALOG_BY_CODE[activeCapabilityCode] || null : null),
    [activeCapabilityCode],
  );

  const activeCapabilityConfig = activeCapabilityCode
    ? props.capabilitySnapshot.capabilityConfigs[activeCapabilityCode] || null
    : null;
  const activeCapabilityDetail = activeCapabilityCode
    ? props.capabilitySnapshot.details[activeCapabilityCode] || null
    : null;
  const activeCapabilityOverview = activeCapabilityDetail?.overview || null;
  const activeMatchedSceneTemplate = activeCapabilityDetail?.matchedTemplate || null;
  const activeCapabilityValidationIssues = activeCapabilityCode
    ? props.capabilitySnapshot.validationIssues[activeCapabilityCode] || []
    : [];

  const activeCapabilityTabs = useMemo(() => {
    const tabs: Array<{ id: CapabilityDetailTabId; label: string }> = [];
    if (activeCapabilityMeta?.plugin.getSections().some((section) => section.target === "defaults")) {
      tabs.push({ id: "default", label: "默认配置" });
    }
    tabs.push({ id: "capability", label: "能力配置" });
    tabs.push({ id: "pricing", label: "定价配置" });
    return tabs;
  }, [activeCapabilityMeta]);

  useEffect(() => {
    if (activeCapabilityTabs.length === 0) {
      setActiveCapabilityTab("capability");
      return;
    }

    if (!activeCapabilityTabs.some((tab) => tab.id === activeCapabilityTab)) {
      setActiveCapabilityTab(activeCapabilityTabs[0].id);
    }
  }, [activeCapabilityTab, activeCapabilityTabs]);

  const activePricingSimulatorFields = useMemo(
    () =>
      activeCapabilityMeta && activeCapabilityConfig
        ? activeCapabilityMeta.plugin.getPricingSimulatorFields(activeCapabilityConfig)
        : [],
    [activeCapabilityConfig, activeCapabilityMeta],
  );

  const activePricingSimulatorInput = useMemo(
    () => (activeCapabilityCode ? pricingSimulatorInputs[activeCapabilityCode] || {} : {}),
    [activeCapabilityCode, pricingSimulatorInputs],
  );

  const activePricingSimulation = useMemo(
    () =>
      activeCapabilityMeta && activeCapabilityConfig
        ? activeCapabilityMeta.plugin.simulatePricing(activeCapabilityConfig, activePricingSimulatorInput)
        : null,
    [activeCapabilityConfig, activeCapabilityMeta, activePricingSimulatorInput],
  );

  useEffect(() => {
    if (!activeCapabilityCode || activePricingSimulatorFields.length === 0) {
      return;
    }

    setPricingSimulatorInputs((prev) => {
      const currentInput = prev[activeCapabilityCode] || {};
      const nextInput = { ...currentInput };
      let changed = false;

      activePricingSimulatorFields.forEach((field) => {
        const normalizedValue = normalizePricingSimulatorInputValue(field, currentInput[field.key]);
        if (nextInput[field.key] !== normalizedValue) {
          nextInput[field.key] = normalizedValue;
          changed = true;
        }
      });

      return changed ? { ...prev, [activeCapabilityCode]: nextInput } : prev;
    });
  }, [activeCapabilityCode, activePricingSimulatorFields]);

  const activeCapabilitySections = activeCapabilityMeta?.plugin.getSections() || [];
  const activeCapabilitySection = activeCapabilitySections.find((section) => section.target === "boundary") || null;
  const activeCapabilityDefaultSection = activeCapabilitySections.find((section) => section.target === "defaults") || null;

  const capabilityItems = useMemo(
    () =>
      props.capabilityCodes.map((code) => ({
        code,
        label: CAPABILITY_CATALOG_BY_CODE[code]?.label || code,
        issueCount: props.capabilitySnapshot.validationIssues[code]?.length || 0,
        selected: activeCapabilityCode === code,
      })),
    [activeCapabilityCode, props.capabilityCodes, props.capabilitySnapshot.validationIssues],
  );

  const hasCustomizedRulePricing =
    !!activeCapabilityConfig &&
    !!activeMatchedSceneTemplate &&
    JSON.stringify(buildPricingComparisonPayload(activeCapabilityConfig.pricing)) !==
      JSON.stringify(buildPricingComparisonPayload(activeMatchedSceneTemplate.template.pricing));

  const handleAddCapability = useCallback(() => {
    if (!pendingCapabilityCode) return;
    props.onAddCapability(pendingCapabilityCode);
    setActiveCapabilityCode(pendingCapabilityCode);
  }, [pendingCapabilityCode, props]);

  const handleRemoveCapability = useCallback(
    (code: ModelCapabilityCode) => {
      setPricingSimulatorInputs((prev) => {
        if (!(code in prev)) return prev;
        const next = { ...prev };
        delete next[code];
        return next;
      });
      props.onRemoveCapability(code);
    },
    [props],
  );

  const handleUpdateActiveCapabilityField = useCallback(
    (sectionKey: CapabilityConfigSectionKey, key: string, value: unknown) => {
      if (!activeCapabilityCode) return;
      props.onUpdateCapabilityConfig(activeCapabilityCode, sectionKey, key, value);
    },
    [activeCapabilityCode, props],
  );

  const handleChangeActivePricing = useCallback(
    (pricing: CapabilityPricing) => {
      if (!activeCapabilityCode) return;
      props.onUpdateCapabilityConfig(activeCapabilityCode, "pricing", "pricing", pricing);
    },
    [activeCapabilityCode, props],
  );

  const handleUpdatePricingSimulatorInput = useCallback(
    (code: ModelCapabilityCode, field: CapabilityPricingSimulatorFieldDefinition, value: string) => {
      setPricingSimulatorInputs((prev) => ({
        ...prev,
        [code]: {
          ...prev[code],
          [field.key]: normalizePricingSimulatorInputValue(field, value),
        },
      }));
    },
    [],
  );

  const handleApplySceneTemplate = useCallback(
    (code: ModelCapabilityCode, templateId: string) => {
      props.onReplaceCapabilityConfig(
        code,
        applyCapabilityPricingTemplate(code, templateId, props.capabilityConfigs[code]),
      );
      setActiveCapabilityCode(code);
      setActiveCapabilityTab("pricing");
    },
    [props],
  );

  const focusFirstInvalidCapability = useCallback(
    (validationIssues: Partial<Record<ModelCapabilityCode, string[]>>) => {
      const firstInvalidCapability = props.capabilityCodes.find((code) => (validationIssues[code] || []).length > 0);
      if (!firstInvalidCapability) return;

      const firstIssues = validationIssues[firstInvalidCapability] || [];
      setActiveCapabilityCode(firstInvalidCapability);
      setActiveCapabilityTab(getValidationFocusTab(firstIssues));
    },
    [props.capabilityCodes],
  );

  return {
    capabilityItems,
    capabilitySummary: props.capabilitySnapshot.capabilitySummary,
    totalCapabilityIssueCount: props.capabilitySnapshot.totalValidationIssueCount,
    availableCapabilities: availableCapabilities.map((item) => ({ code: item.code, label: item.label })),
    pendingCapabilityCode,
    setPendingCapabilityCode,
    handleAddCapability,
    activeCapabilityCode,
    setActiveCapabilityCode,
    handleRemoveCapability,
    activeCapabilityMeta: activeCapabilityMeta
      ? {
          code: activeCapabilityMeta.code,
          label: activeCapabilityMeta.label,
          description: activeCapabilityMeta.description,
        }
      : null,
    activeCapabilityConfig,
    activeCapabilityValidationIssues,
    activeCapabilityOverview,
    activeCapabilityTab,
    setActiveCapabilityTab,
    activeCapabilityTabs,
    activeCapabilitySection,
    activeCapabilityDefaultSection,
    handleUpdateActiveCapabilityField,
    handleChangeActivePricing,
    activeMatchedSceneTemplate,
    activePricingSimulatorFields,
    activePricingSimulatorInput,
    activePricingSimulation,
    handleUpdatePricingSimulatorInput,
    handleApplySceneTemplate,
    activeCapabilitySceneTemplates: activeCapabilityMeta?.plugin.listTemplates() || [],
    ruleMetricSuggestions: activeCapabilityMeta?.plugin.getRuleMetricSuggestions() || [],
    hasCustomizedRulePricing,
    focusFirstInvalidCapability,
  };
}

export type CapabilityWorkbenchViewModel = ReturnType<typeof useCapabilityWorkbench>;
