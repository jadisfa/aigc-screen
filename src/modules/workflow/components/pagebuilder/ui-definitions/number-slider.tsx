import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Input } from "@/shared/ui/input";
import { Slider } from "@/shared/ui/slider";
import { SlidersHorizontal } from "lucide-react";
import type { NumberSliderExt, NumberSliderValueMode, UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";

function normalizeNumberish(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function isTransientNumberInput(value: string): boolean {
  return value === "-" || value === "." || value === "-." || value.endsWith(".");
}

function parseCommittedNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || isTransientNumberInput(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSafeStep(ext: NumberSliderExt): number {
  const fallback = ext.mode === "float" ? 0.1 : 1;
  return ext.step > 0 ? ext.step : fallback;
}

function normalizeSliderBounds(ext: NumberSliderExt): NumberSliderExt {
  const mode: NumberSliderValueMode = ext.mode === "float" ? "float" : "integer";
  let min = Number.isFinite(ext.min) ? ext.min : 0;
  let max = Number.isFinite(ext.max) ? ext.max : min + 1;
  let step = getSafeStep({ ...ext, mode });

  if (mode === "integer") {
    min = Math.round(min);
    max = Math.round(max);
    step = Math.max(1, Math.round(step));
  }

  if (max < min) {
    const nextMax = min;
    min = Math.min(min, nextMax);
    max = Math.max(min, nextMax);
  }

  return { mode, min, max, step };
}

function getSliderValue(ext: NumberSliderExt, value: unknown): number {
  const normalized = normalizeSliderBounds(ext);
  const parsed = normalizeNumberish(value, normalized.min);
  const clamped = Math.min(normalized.max, Math.max(normalized.min, parsed));
  if (normalized.mode === "integer") {
    return Math.round(clamped);
  }
  return clamped;
}

function formatNumberValue(value: number, mode: NumberSliderValueMode): string {
  return mode === "integer" ? String(Math.round(value)) : String(value);
}

function commitSliderValue(ext: NumberSliderExt, value: number): number {
  const normalized = normalizeSliderBounds(ext);
  const clamped = Math.min(normalized.max, Math.max(normalized.min, value));
  if (normalized.mode === "integer") {
    return Math.round(clamped);
  }
  return clamped;
}

function NumberSliderRuntimeField(props: {
  component: Extract<UiComponent, { type: "NumberSlider" }>;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp: () => ReactNode;
}) {
  const ext = normalizeSliderBounds(props.component.ext);
  const sliderValue = getSliderValue(ext, props.value);
  const [draftValue, setDraftValue] = useState(() => formatNumberValue(sliderValue, ext.mode));

  useEffect(() => {
    setDraftValue(formatNumberValue(sliderValue, ext.mode));
  }, [ext.mode, sliderValue]);

  const commitInputValue = (raw: string) => {
    const parsed = parseCommittedNumber(raw);
    const nextValue = commitSliderValue(ext, parsed == null ? ext.min : parsed);
    props.onChange(nextValue);
    setDraftValue(formatNumberValue(nextValue, ext.mode));
  };

  return (
    <div className="space-y-3">
      <props.LabelComp />
      <div className="flex items-center gap-4">
        <Slider
          value={[sliderValue]}
          min={ext.min}
          max={ext.max}
          step={getSafeStep(ext)}
          onValueChange={(values) => {
            const nextValue = commitSliderValue(ext, values[0] ?? ext.min);
            props.onChange(nextValue);
            setDraftValue(formatNumberValue(nextValue, ext.mode));
          }}
          className="flex-1"
        />
        <Input
          type="text"
          inputMode={ext.mode === "float" ? "decimal" : "numeric"}
          className="w-[88px] !h-8 workflow-form-input text-center px-1"
          value={draftValue}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setDraftValue(nextDraft);
            const parsed = parseCommittedNumber(nextDraft);
            if (parsed != null) {
              props.onChange(commitSliderValue(ext, parsed));
            }
          }}
          onBlur={(event) => commitInputValue(event.target.value)}
          min={ext.min}
          max={ext.max}
          step={getSafeStep(ext)}
        />
      </div>
    </div>
  );
}

function NumberSliderExtEditor(props: {
  component: Extract<UiComponent, { type: "NumberSlider" }>;
  onChange: (next: UiComponent) => void;
}) {
  const normalizedExt = useMemo(() => normalizeSliderBounds(props.component.ext), [props.component.ext]);
  const [draftValues, setDraftValues] = useState(() => ({
    min: formatNumberValue(normalizedExt.min, normalizedExt.mode),
    max: formatNumberValue(normalizedExt.max, normalizedExt.mode),
    step: formatNumberValue(normalizedExt.step, normalizedExt.mode),
  }));

  useEffect(() => {
    setDraftValues({
      min: formatNumberValue(normalizedExt.min, normalizedExt.mode),
      max: formatNumberValue(normalizedExt.max, normalizedExt.mode),
      step: formatNumberValue(normalizedExt.step, normalizedExt.mode),
    });
  }, [normalizedExt.max, normalizedExt.min, normalizedExt.mode, normalizedExt.step]);

  const commitExt = (patch: Partial<NumberSliderExt>) => {
    props.onChange({
      ...props.component,
      ext: normalizeSliderBounds({ ...props.component.ext, ...patch }),
    });
  };

  const commitDraftField = (field: "min" | "max" | "step", fallback: number) => {
    const parsed = parseCommittedNumber(draftValues[field]);
    const nextValue = parsed == null ? fallback : parsed;
    commitExt({ [field]: nextValue } as Pick<NumberSliderExt, "min" | "max" | "step">);
  };

  return (
    <div className="space-y-3 mt-4 mx-2">
      <div className="text-sm font-medium text-foreground">滑块设置</div>
      <div className="space-y-1.5">
        <label className="text-sm text-muted-foreground">数值模式</label>
        <select
          value={normalizedExt.mode}
          onChange={(event) => {
            const nextMode = event.target.value === "float" ? "float" : "integer";
            commitExt({ mode: nextMode });
          }}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="integer">整数</option>
          <option value="float">浮点</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">最小值</label>
          <Input
            type="text"
            inputMode={normalizedExt.mode === "float" ? "decimal" : "numeric"}
            value={draftValues.min}
            onChange={(event) => setDraftValues((current) => ({ ...current, min: event.target.value }))}
            onBlur={() => commitDraftField("min", normalizedExt.min)}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">最大值</label>
          <Input
            type="text"
            inputMode={normalizedExt.mode === "float" ? "decimal" : "numeric"}
            value={draftValues.max}
            onChange={(event) => setDraftValues((current) => ({ ...current, max: event.target.value }))}
            onBlur={() => commitDraftField("max", normalizedExt.max)}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">步长 (Step)</label>
          <Input
            type="text"
            inputMode={normalizedExt.mode === "float" ? "decimal" : "numeric"}
            value={draftValues.step}
            onChange={(event) => setDraftValues((current) => ({ ...current, step: event.target.value }))}
            onBlur={() => commitDraftField("step", normalizedExt.step)}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}

export const numberSliderDefinition: UiComponentDefinition = {
  type: "NumberSlider",
  iconName: "sliders-horizontal",
  palette: { id: "number-slider", label: "数字滑块", category: "基础", order: 25 },
  renderPaletteHoverPreview: () => {
    return (
      <div className="w-[260px]">
        <div className="mb-3 flex items-center gap-1.5">
          <SlidersHorizontal className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">数字滑块</span>
        </div>
        <div className="flex items-center gap-4">
          <Slider value={[5]} min={1} max={10} step={1} className="flex-1" />
          <div className="flex h-8 w-[60px] items-center justify-center rounded-md border border-input bg-background text-sm">5</div>
        </div>
      </div>
    );
  },
  createInitialRuntimeValue: (component) => {
    const current = component as Extract<UiComponent, { type: "NumberSlider" }>;
    const ext = normalizeSliderBounds(current.ext);
    const defaultValue = current.basic?.params?.[0]?.defaultValue;
    if (typeof defaultValue === "string" && defaultValue.trim()) {
      const parsed = Number(defaultValue.trim());
      if (Number.isFinite(parsed)) {
        return commitSliderValue(ext, parsed);
      }
    }
    return ext.min;
  },
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  renderCanvasPreview: (component): ReactNode => {
    const current = component as Extract<UiComponent, { type: "NumberSlider" }>;
    const ext = normalizeSliderBounds(current.ext);
    const defaultValue = current.basic?.params?.[0]?.defaultValue;
    const displayValue = (() => {
      if (typeof defaultValue === "string" && defaultValue.trim()) {
        const parsed = Number(defaultValue.trim());
        if (Number.isFinite(parsed)) {
          return commitSliderValue(ext, parsed);
        }
      }
      return ext.min;
    })();

    return (
      <div className="flex items-center gap-4">
        <Slider value={[displayValue]} min={ext.min} max={ext.max} step={getSafeStep(ext)} className="flex-1" />
        <Input className="w-[88px] !h-8 workflow-form-input text-center px-1" value={formatNumberValue(displayValue, ext.mode)} readOnly />
      </div>
    );
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    return (
      <NumberSliderRuntimeField
        component={comp as Extract<UiComponent, { type: "NumberSlider" }>}
        value={value}
        onChange={onChange}
        LabelComp={LabelComp}
      />
    );
  },
  renderExtEditor: (component, onChange) => {
    return (
      <NumberSliderExtEditor
        component={component as Extract<UiComponent, { type: "NumberSlider" }>}
        onChange={onChange}
      />
    );
  },
};
