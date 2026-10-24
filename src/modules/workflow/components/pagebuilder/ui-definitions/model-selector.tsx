import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { listWorkflowLoraModels } from "@/shared/api/workflow/workflow";
import type { ModelSelectorFixedOption, UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";
import { getCanvasPreviewFocusOptionEventName, type CanvasPreviewFocusOptionDetail } from "./canvas-preview-focus-link";

type ResolvedModelOption = {
  label: string;
  value: string;
  source: "fixed" | "dynamic";
};

const MODEL_SELECTOR_FOCUS_EVENT = getCanvasPreviewFocusOptionEventName("ModelSelector");

function dedupeModelOptions(options: ResolvedModelOption[]): ResolvedModelOption[] {
  const seen = new Set<string>();
  return options.filter((item) => {
    const key = `${item.value}::${item.label}`;
    if (!item.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function useDynamicModelOptions() {
  const workflowId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const segments = window.location.pathname.split("/").filter(Boolean);
    const previewIndex = segments.findIndex((segment) => segment === "app-preview");
    if (previewIndex >= 0) return segments[previewIndex + 1] ?? "";
    const editIndex = segments.findIndex((segment) => segment === "workflows");
    if (editIndex >= 0) return segments[editIndex + 1] ?? "";
    return "";
  }, []);

  return useQuery({
    queryKey: ["pagebuilder-model-selector", "lora-models", workflowId],
    enabled: !!workflowId,
    queryFn: async () =>
      dedupeModelOptions(
        (await listWorkflowLoraModels(workflowId)).map((model) => ({
          label: model,
          value: model,
          source: "dynamic" as const,
        })),
      ),
  });
}

function resolveModelOptions(component: Extract<UiComponent, { type: "ModelSelector" }>, dynamicOptions: ResolvedModelOption[]): ResolvedModelOption[] {
  if (component.ext.sourceMode === "dynamic") {
    return dynamicOptions;
  }
  return dedupeModelOptions(
    (component.ext.fixedOptions ?? []).map((item) => ({
      label: item.label || item.modelId,
      value: item.modelId,
      source: "fixed" as const,
    })),
  );
}

function readConfiguredDefault(component: Extract<UiComponent, { type: "ModelSelector" }>): string {
  return (component.basic?.params?.[0]?.defaultValue ?? "").trim();
}

function withConfiguredDefault(
  component: Extract<UiComponent, { type: "ModelSelector" }>,
  modelId: string,
): Extract<UiComponent, { type: "ModelSelector" }> {
  const existing = component.basic?.params ?? [];
  const params =
    existing.length === 0
      ? [{ name: "model", inputKey: "model", nodeId: "", required: false, defaultValue: modelId, marks: {} }]
      : existing.map((param, index) => (index === 0 ? { ...param, defaultValue: modelId } : param));
  return {
    ...component,
    basic: { ...component.basic, params },
  };
}

function resolveInitialModelId(
  component: Extract<UiComponent, { type: "ModelSelector" }>,
  options: ResolvedModelOption[],
): string {
  const configured = readConfiguredDefault(component);
  if (configured && options.some((item) => item.value === configured)) {
    return configured;
  }
  return options[0]?.value || "";
}

const UNSET_DEFAULT_MODEL = "__unset_default_model__";

function renderModelSelectControl(props: {
  options: ResolvedModelOption[];
  emptyText: string;
  value: string;
  onChange: (next: string) => void;
  LabelComp?: () => ReactNode;
}) {
  return (
    <div className="space-y-2">
      {props.LabelComp ? <props.LabelComp /> : null}
      <Select value={props.value} onValueChange={props.onChange}>
        <SelectTrigger className="workflow-form-input">
          <SelectValue placeholder="请选择LORA模型" />
        </SelectTrigger>
        <SelectContent>
          {props.options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{props.emptyText}</div>
          ) : (
            props.options.map((option) => (
              <SelectItem key={`${option.source}:${option.value}`} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function FixedModelSelectorField(props: {
  component: Extract<UiComponent, { type: "ModelSelector" }>;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp?: () => ReactNode;
}) {
  const options = useMemo(
    () => resolveModelOptions(props.component, []),
    [props.component],
  );
  const fallbackValue = resolveInitialModelId(props.component, options);
  const selectedValue = typeof props.value === "string" && props.value.trim() ? props.value : fallbackValue;

  useEffect(() => {
    if ((props.value == null || props.value === "") && fallbackValue) {
      props.onChange(fallbackValue);
    }
  }, [fallbackValue, props.onChange, props.value]);

  return renderModelSelectControl({
    options,
    emptyText: "请先配置固定模型列表",
    value: selectedValue,
    onChange: (next) => props.onChange(next),
    LabelComp: props.LabelComp,
  });
}

function DynamicModelSelectorField(props: {
  component: Extract<UiComponent, { type: "ModelSelector" }>;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp?: () => ReactNode;
}) {
  const dynamicOptionsQuery = useDynamicModelOptions();
  const options = useMemo(
    () => resolveModelOptions(props.component, dynamicOptionsQuery.data ?? []),
    [dynamicOptionsQuery.data, props.component],
  );
  const fallbackValue = resolveInitialModelId(props.component, options);
  const selectedValue = typeof props.value === "string" && props.value.trim() ? props.value : fallbackValue;

  useEffect(() => {
    if ((props.value == null || props.value === "") && fallbackValue) {
      props.onChange(fallbackValue);
    }
  }, [fallbackValue, props.onChange, props.value]);

  return renderModelSelectControl({
    options,
    emptyText: dynamicOptionsQuery.isLoading ? "加载模型中..." : "当前工作流未解析到动态模型",
    value: selectedValue,
    onChange: (next) => props.onChange(next),
    LabelComp: props.LabelComp,
  });
}

function ModelSelectorField(props: {
  component: Extract<UiComponent, { type: "ModelSelector" }>;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp?: () => ReactNode;
}) {
  if (props.component.ext.sourceMode === "dynamic") {
    return <DynamicModelSelectorField {...props} />;
  }
  return <FixedModelSelectorField {...props} />;
}

function ModelSelectorCanvasPreview({ comp }: { comp: Extract<UiComponent, { type: "ModelSelector" }> }) {
  return <ModelSelectorField component={comp} value={comp.basic?.params?.[0]?.defaultValue} onChange={() => undefined} />;
}

function ModelSelectorExtEditor(props: {
  component: Extract<UiComponent, { type: "ModelSelector" }>;
  onChange: (next: UiComponent) => void;
}) {
  const options = props.component.ext.fixedOptions ?? [];
  const dynamicOptionsQuery = useDynamicModelOptions();
  const selectableDefaults = useMemo(() => {
    if (props.component.ext.sourceMode === "dynamic") {
      return (dynamicOptionsQuery.data ?? []).filter((item) => item.value.trim());
    }
    return options
      .filter((item) => item.modelId.trim())
      .map((item) => ({ label: item.label || item.modelId, value: item.modelId }));
  }, [dynamicOptionsQuery.data, options, props.component.ext.sourceMode]);
  const duplicateLabelSet = useMemo(() => {
    const counts = new Map<string, number>();
    options.forEach((item) => {
      const key = item.label.trim();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
  }, [options]);
  const duplicateModelIdSet = useMemo(() => {
    const counts = new Map<string, number>();
    options.forEach((item) => {
      const key = item.modelId.trim();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
  }, [options]);
  const optionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const highlightTimerRef = useRef<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleFocusOption = (event: Event) => {
      const detail = (event as CustomEvent<CanvasPreviewFocusOptionDetail>).detail;
      if (!detail || detail.componentId !== props.component.id) return;
      const target = optionRefs.current[detail.optionIndex];
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightedIndex(detail.optionIndex);
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedIndex((current) => (current === detail.optionIndex ? null : current));
      }, 1200);
    };

    window.addEventListener(MODEL_SELECTOR_FOCUS_EVENT, handleFocusOption as EventListener);
    return () => {
      window.removeEventListener(MODEL_SELECTOR_FOCUS_EVENT, handleFocusOption as EventListener);
    };
  }, [props.component.id]);

  const configuredDefault = readConfiguredDefault(props.component);
  const defaultSelectValue = selectableDefaults.some((item) => item.value === configuredDefault)
    ? configuredDefault
    : UNSET_DEFAULT_MODEL;

  const setDefaultModelId = (modelId: string) => {
    props.onChange(withConfiguredDefault(props.component, modelId));
  };

  const updateFixedOption = (index: number, patch: Partial<ModelSelectorFixedOption>) => {
    const current = options[index];
    const nextOptions = options.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item));
    let next = { ...props.component, ext: { ...props.component.ext, fixedOptions: nextOptions } };
    if (patch.modelId != null && current?.modelId && current.modelId === configuredDefault) {
      next = withConfiguredDefault(next, patch.modelId.trim());
    }
    props.onChange(next);
  };

  const removeFixedOption = (index: number) => {
    const removed = options[index];
    const nextOptions = options.filter((_, currentIndex) => currentIndex !== index);
    let next = { ...props.component, ext: { ...props.component.ext, fixedOptions: nextOptions } };
    if (removed?.modelId && removed.modelId === configuredDefault) {
      next = withConfiguredDefault(next, "");
    }
    props.onChange(next);
  };

  return (
    <div className="space-y-3 mt-4 mx-2">
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">数据源模式</label>
        <RadioGroup
          value={props.component.ext.sourceMode}
          onValueChange={(nextValue) => {
            const sourceMode = nextValue === "dynamic" ? "dynamic" : "fixed";
            props.onChange({ ...props.component, ext: { ...props.component.ext, sourceMode } });
          }}
          className="flex flex-row items-center gap-6"
        >
          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <RadioGroupItem value="fixed" />
            <span>固定列表</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <RadioGroupItem value="dynamic" />
            <span>动态拉取</span>
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">默认模型</label>
        <Select
          value={defaultSelectValue}
          onValueChange={(nextValue) => setDefaultModelId(nextValue === UNSET_DEFAULT_MODEL ? "" : nextValue)}
          disabled={selectableDefaults.length === 0}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={
              props.component.ext.sourceMode === "dynamic"
                ? (dynamicOptionsQuery.isLoading ? "加载模型中..." : "未设置（使用列表第一项）")
                : (selectableDefaults.length === 0 ? "请先添加模型" : "未设置（使用列表第一项）")
            } />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSET_DEFAULT_MODEL}>未设置（使用列表第一项）</SelectItem>
            {selectableDefaults.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label || option.value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">运行时未选择时使用该默认模型；未设置则回退到列表第一项。</p>
      </div>

      {props.component.ext.sourceMode === "fixed" ? (
        <>
          <div className="sticky top-0 z-10 -mx-2 bg-background px-3 pt-3 pb-3 border-b border-border/60 shadow-[0_1px_0_0_hsl(var(--background))]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">固定模型</span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  props.onChange({
                    ...props.component,
                    ext: {
                      ...props.component.ext,
                      fixedOptions: [...options, { label: "新模型", modelId: "" }],
                    },
                  });
                }}
              >
                <Plus className="w-4 h-4" />
                添加
              </Button>
            </div>
            {(duplicateLabelSet.size > 0 || duplicateModelIdSet.size > 0) && (
              <div className="mt-2 text-xs text-destructive">
                固定模型的显示名称和模型 ID 都必须唯一。
              </div>
            )}
          </div>

          {options.map((option, index) => (
            <div
              key={`${index}:${option.modelId}`}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              className={`scroll-mt-20 rounded-lg border border-border p-3 space-y-2 transition-shadow ${
                highlightedIndex === index ? "ring-1 ring-primary/50 shadow-sm" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  模型 {index + 1}
                  {option.modelId && option.modelId === configuredDefault ? (
                    <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-normal text-primary">默认</span>
                  ) : null}
                </span>
                <div className="flex items-center gap-1">
                  {option.modelId.trim() && option.modelId !== configuredDefault ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setDefaultModelId(option.modelId.trim())}
                    >
                      设为默认
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeFixedOption(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">显示名称</label>
                  <Input value={option.label} onChange={(event) => updateFixedOption(index, { label: event.target.value })} className="h-9" />
                  {duplicateLabelSet.has(option.label.trim()) && option.label.trim() ? (
                    <div className="text-xs text-destructive">显示名称重复</div>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-muted-foreground">模型 ID</label>
                  <Input value={option.modelId} onChange={(event) => updateFixedOption(index, { modelId: event.target.value })} className="h-9" />
                  {duplicateModelIdSet.has(option.modelId.trim()) && option.modelId.trim() ? (
                    <div className="text-xs text-destructive">模型 ID 重复</div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

export const modelSelectorDefinition: UiComponentDefinition = {
  type: "ModelSelector",
  iconName: "sparkles",
  palette: { id: "model-selector", label: "LORA选择", category: "选择", order: 40 },
  createInitialRuntimeValue: (component) => {
    const current = component as Extract<UiComponent, { type: "ModelSelector" }>;
    return resolveInitialModelId(
      current,
      resolveModelOptions(current, []),
    );
  },
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  renderCanvasPreview: (component): ReactNode => {
    return <ModelSelectorCanvasPreview comp={component as Extract<UiComponent, { type: "ModelSelector" }>} />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    return (
      <ModelSelectorField
        component={comp as Extract<UiComponent, { type: "ModelSelector" }>}
        value={value}
        onChange={onChange}
        LabelComp={LabelComp}
      />
    );
  },
  renderExtEditor: (component, onChange) => {
    return (
      <ModelSelectorExtEditor
        component={component as Extract<UiComponent, { type: "ModelSelector" }>}
        onChange={onChange}
      />
    );
  },
  renderCanvasCard: undefined,
};
