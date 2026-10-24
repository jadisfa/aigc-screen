import { useEffect, useMemo, useState } from "react";
import { CapabilityFieldRendererProps } from "@/modules/modelhub/components/ModelCapabilityFieldRegistry";
import { CapabilityOptionGridEditor } from "@/modules/modelhub/components/ModelCapabilityCollectionEditors";

type SelectableOption = {
  label: string;
  value: string;
  isCustom?: boolean;
};

function buildCustomOptions(
  selectedValues: string[],
  defaultOptions: Array<{ label: string; value: string }>,
) {
  const defaultValueSet = new Set(defaultOptions.map((option) => option.value));
  return selectedValues
    .filter((item) => !defaultValueSet.has(item))
    .map((item) => ({
      label: item,
      value: item,
      isCustom: true,
    }));
}

export function MultiSelectField(props: CapabilityFieldRendererProps) {
  const { field, value, onChange, uiSchema } = props;
  const [draftValue, setDraftValue] = useState("");
  const rendererProps = (uiSchema.props || {}) as {
    draftPlaceholder?: string;
    allowCustomValues?: boolean;
  };

  const selectedValues = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const defaultOptions = useMemo(() => uiSchema.options || field.options || [], [field.options, uiSchema.options]);
  const allowCustomValues = rendererProps.allowCustomValues !== false;
  const [customOptions, setCustomOptions] = useState<SelectableOption[]>(() =>
    allowCustomValues ? buildCustomOptions(selectedValues, defaultOptions) : [],
  );

  useEffect(() => {
    if (!allowCustomValues) {
      setCustomOptions([]);
      return;
    }

    const selectedCustomOptions = buildCustomOptions(selectedValues, defaultOptions);
    setCustomOptions((prev) => {
      const optionMap = new Map(prev.map((option) => [option.value, option]));
      selectedCustomOptions.forEach((option) => {
        optionMap.set(option.value, option);
      });
      return Array.from(optionMap.values());
    });
  }, [allowCustomValues, defaultOptions, selectedValues]);

  const handleToggle = (optionValue: string, checked: boolean) => {
    let nextValues = [...selectedValues];
    if (checked) {
      if (!nextValues.includes(optionValue)) nextValues.push(optionValue);
    } else {
      nextValues = nextValues.filter((item) => item !== optionValue);
    }
    onChange(nextValues);
  };

  const handleAdd = () => {
    if (!allowCustomValues) return;
    if (!draftValue?.trim()) return;
    const items = draftValue
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const nextValues = [...selectedValues];
    for (const item of items) {
      if (!nextValues.includes(item)) nextValues.push(item);
    }
    setCustomOptions((prev) => {
      const optionMap = new Map(prev.map((option) => [option.value, option]));
      items.forEach((item) => {
        optionMap.set(item, { label: item, value: item, isCustom: true });
      });
      return Array.from(optionMap.values());
    });
    onChange(nextValues);
    setDraftValue("");
  };

  const handleRemove = (optionValue: string) => {
    setCustomOptions((prev) => prev.filter((option) => option.value !== optionValue));
    const nextValues = selectedValues.filter((item) => item !== optionValue);
    onChange(nextValues);
  };

  const optionsMap = useMemo(() => {
    const map = new Map<string, SelectableOption>();
    for (const option of defaultOptions) {
      map.set(option.value, { ...option });
    }
    for (const option of customOptions) {
      if (!map.has(option.value)) {
        map.set(option.value, option);
      }
    }
    return map;
  }, [customOptions, defaultOptions]);

  return (
    <CapabilityOptionGridEditor
      label={field.label}
      options={Array.from(optionsMap.values())}
      selectedValues={selectedValues}
      draftValue={draftValue || ""}
      draftPlaceholder={rendererProps.draftPlaceholder || field.placeholder || "支持添加自定义选项"}
      showCustomAdd={allowCustomValues}
      onDraftChange={setDraftValue}
      onAdd={handleAdd}
      onToggle={handleToggle}
      onRemove={allowCustomValues ? handleRemove : undefined}
      helperText={uiSchema.helperText}
    />
  );
}
