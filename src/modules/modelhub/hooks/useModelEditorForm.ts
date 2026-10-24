import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CapabilityConfigSectionKey,
  CapabilityPricing,
  ModelCapabilityConfig,
  ModelCapabilityCode,
  ModelCapabilityConfigs,
} from "@/modules/modelhub/types/modelCapabilityMetadata";
import {
  deriveModelCapabilitySnapshot,
  getCapabilityPlugin,
  normalizeCapabilityCodes,
} from "@/modules/modelhub/types/capabilityRegistryFactory";
import {
  EMPTY_MODEL_EDITOR_FORM,
  type ModelEditorValue,
  type ProviderOption,
} from "@/modules/modelhub/components/model-editor/modelEditorTypes";

type ModelEditorMode = "create" | "edit";

export interface ModelEditorInvalidSubmitState {
  capabilityValidationIssues: Partial<Record<ModelCapabilityCode, string[]>>;
  validationIssues: string[];
}

function pickCapabilityConfigs(
  capabilityCodes: ModelCapabilityCode[],
  capabilityConfigs: ModelCapabilityConfigs,
): ModelCapabilityConfigs {
  return capabilityCodes.reduce<ModelCapabilityConfigs>((accumulator, code) => {
    const config = capabilityConfigs[code];
    if (config) {
      accumulator[code] = config;
    }
    return accumulator;
  }, {});
}

function buildInitialFormValue(
  mode: ModelEditorMode,
  initialModel: ModelEditorValue | null | undefined,
  providers: ProviderOption[],
): ModelEditorValue {
  if (mode === "edit" && initialModel) {
    const normalizedCapabilities = normalizeCapabilityCodes(initialModel.capabilities);
    const capabilitySnapshot = deriveModelCapabilitySnapshot(
      normalizedCapabilities,
      pickCapabilityConfigs(normalizedCapabilities, initialModel.capabilityConfigs),
    );

    return {
      id: initialModel.id,
      code: initialModel.code,
      name: initialModel.name,
      providerId: initialModel.providerId,
      capabilities: capabilitySnapshot.capabilities,
      capabilityConfigs: capabilitySnapshot.capabilityConfigs,
      modelType: initialModel.modelType,
      contextWindow: initialModel.contextWindow,
      maxInputTokens: initialModel.maxInputTokens,
      maxOutputTokens: initialModel.maxOutputTokens,
      description: initialModel.description,
      status: initialModel.status,
    };
  }

  return {
    ...EMPTY_MODEL_EDITOR_FORM,
    providerId: providers[0]?.id || "",
  };
}

function areModelEditorValuesEqual(left: ModelEditorValue, right: ModelEditorValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useModelEditorForm(props: {
  mode: ModelEditorMode;
  providers: ProviderOption[];
  initialModel?: ModelEditorValue | null;
  onSuccess: (value: ModelEditorValue) => void;
}) {
  const initialFormValue = useMemo(
    () => buildInitialFormValue(props.mode, props.initialModel, props.providers),
    [props.initialModel, props.mode, props.providers],
  );

  const [form, setForm] = useState<ModelEditorValue>(() =>
    initialFormValue,
  );

  useEffect(() => {
    setForm((prev) => (areModelEditorValuesEqual(prev, initialFormValue) ? prev : initialFormValue));
  }, [initialFormValue]);

  const capabilitySnapshot = useMemo(
    () => deriveModelCapabilitySnapshot(form.capabilities, form.capabilityConfigs),
    [form.capabilities, form.capabilityConfigs],
  );

  const capabilityCodes = capabilitySnapshot.capabilities;
  const capabilityValidationIssues = capabilitySnapshot.validationIssues;

  const updateForm = useCallback((updates: Partial<ModelEditorValue>) => {
    setForm((prev) => {
      const nextModelType = updates.modelType || prev.modelType;
      const nextCapabilities = normalizeCapabilityCodes(updates.capabilities || prev.capabilities);

      return {
        ...prev,
        ...updates,
        modelType: nextModelType,
        capabilities: nextCapabilities,
        capabilityConfigs: pickCapabilityConfigs(nextCapabilities, prev.capabilityConfigs),
      };
    });
  }, []);

  const replaceCapabilityConfig = useCallback((code: ModelCapabilityCode, nextConfig: ModelCapabilityConfig) => {
    const plugin = getCapabilityPlugin(code);
    setForm((prev) => ({
      ...prev,
      capabilityConfigs: {
        ...prev.capabilityConfigs,
        [code]: plugin.toConfigOutput(nextConfig),
      },
    }));
  }, []);

  const updateCapabilityConfig = useCallback(
    (
      code: ModelCapabilityCode,
      sectionKey: CapabilityConfigSectionKey | "pricing",
      key: string,
      value: unknown,
    ) => {
      setForm((prev) => {
        const plugin = getCapabilityPlugin(code);
        const currentConfig = plugin.toConfigOutput(prev.capabilityConfigs[code]);

        if (sectionKey === "pricing") {
          const nextPricing = value as CapabilityPricing;
          const nextTemplateId = String(
            nextPricing.templateId ?? currentConfig.pricing.templateId ?? "",
          ).trim() || undefined;
          return {
            ...prev,
            capabilityConfigs: {
              ...prev.capabilityConfigs,
              [code]: plugin.toConfigOutput({
                ...currentConfig,
                pricing: {
                  ...nextPricing,
                  templateId: nextTemplateId,
                  // Any manual edit in the pricing panel should be treated as custom pricing.
                  isCustomized: nextPricing.isCustomized ?? true,
                },
              }),
            },
          };
        }

        return {
          ...prev,
          capabilityConfigs: {
            ...prev.capabilityConfigs,
            [code]: plugin.toConfigOutput({
              ...currentConfig,
              [sectionKey]: {
                ...currentConfig[sectionKey],
                [key]: value,
              },
            }),
          },
        };
      });
    },
    [],
  );

  const addCapability = useCallback((code: ModelCapabilityCode) => {
    setForm((prev) => {
      const nextCapabilities = normalizeCapabilityCodes([...prev.capabilities, code]);
      return {
        ...prev,
        capabilities: nextCapabilities,
        capabilityConfigs: {
          ...prev.capabilityConfigs,
          [code]: getCapabilityPlugin(code).toConfigOutput(prev.capabilityConfigs[code]),
        },
      };
    });
  }, []);

  const removeCapability = useCallback((code: ModelCapabilityCode) => {
    setForm((prev) => {
      const nextConfigs: ModelCapabilityConfigs = { ...prev.capabilityConfigs };
      delete nextConfigs[code];
      return {
        ...prev,
        capabilities: prev.capabilities.filter((item) => item !== code),
        capabilityConfigs: nextConfigs,
      };
    });
  }, []);

  const formValidationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!form.providerId) issues.push("请选择模型厂商。");
    if (!form.name.trim()) issues.push("请输入模型名称。");
    if (capabilityCodes.length === 0) issues.push("请至少启用一个能力。");

    return issues;
  }, [capabilityCodes, form.name, form.providerId]);

  const submitValidationIssues = useMemo(
    () => [
      ...formValidationIssues,
      ...capabilityCodes.flatMap((code) =>
        (capabilityValidationIssues[code] || []).map((issue) => {
          const capabilityLabel = capabilitySnapshot.details[code]?.overview.boundary || code;
          const label = capabilitySnapshot.details[code]?.code
            ? capabilitySnapshot.capabilityLabels[capabilityCodes.indexOf(code)] || capabilityLabel
            : capabilityLabel;
          return `${label}: ${issue}`;
        }),
      ),
    ],
    [
      capabilityCodes,
      capabilitySnapshot.capabilityLabels,
      capabilitySnapshot.details,
      capabilityValidationIssues,
      formValidationIssues,
    ],
  );

  const submit = useCallback(
    (onInvalid?: (state: ModelEditorInvalidSubmitState) => void) => {
      if (submitValidationIssues.length > 0) {
        onInvalid?.({
          capabilityValidationIssues,
          validationIssues: submitValidationIssues,
        });
        return false;
      }

      const nextSnapshot = deriveModelCapabilitySnapshot(
        normalizeCapabilityCodes(form.capabilities),
        form.capabilityConfigs,
      );

      props.onSuccess({
        ...form,
        capabilities: nextSnapshot.capabilities,
        capabilityConfigs: nextSnapshot.capabilityConfigs,
        code: form.code.trim(),
        name: form.name.trim(),
        contextWindow: form.contextWindow.trim(),
        maxInputTokens: form.maxInputTokens.trim(),
        maxOutputTokens: form.maxOutputTokens.trim(),
        description: form.description.trim(),
      });

      return true;
    },
    [capabilityValidationIssues, form, props, submitValidationIssues],
  );

  return {
    form,
    updateForm,
    addCapability,
    removeCapability,
    replaceCapabilityConfig,
    updateCapabilityConfig,
    capabilitySnapshot,
    capabilityCodes,
    capabilityValidationIssues,
    formValidationIssues,
    submitValidationIssues,
    submit,
  };
}
