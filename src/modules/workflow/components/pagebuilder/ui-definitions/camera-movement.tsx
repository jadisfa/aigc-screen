import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Slider } from "@/shared/ui/slider";
import { Switch } from "@/shared/ui/switch";
import { Camera, Plus, Trash2 } from "lucide-react";
import type { CameraMovementExt, CameraMovementIntensityLabel, CameraMovementOption, UiComponent, UiParam } from "../ui-schema";
import { getParamAlias } from "../param-utils";
import { readRuntimeComponentValue } from "./shared";
import type { UiComponentDefinition } from "./types";
import { dispatchCanvasPreviewFocusOption, getCanvasPreviewFocusOptionEventName, type CanvasPreviewFocusOptionDetail } from "./canvas-preview-focus-link";

const CAMERA_MOVEMENT_FOCUS_EVENT = getCanvasPreviewFocusOptionEventName("CameraMovement");
const STATIC_MOVEMENT_VALUES = new Set(["static", "still", "静止"]);

type CameraMovementValue = {
  movements: string[];
  intensity: number;
};

function normalizeNumberish(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeIntensityBounds(ext: CameraMovementExt): { min: number; max: number; step: number } {
  let min = Number.isFinite(ext.intensityMin) ? Math.round(ext.intensityMin) : 1;
  let max = Number.isFinite(ext.intensityMax) ? Math.round(ext.intensityMax) : 5;
  const step = Math.max(1, Number.isFinite(ext.intensityStep) ? Math.round(ext.intensityStep) : 1);
  if (max < min) {
    const swapped = min;
    min = max;
    max = swapped;
  }
  return { min, max, step };
}

function clampIntensity(ext: CameraMovementExt, value: unknown, fallback = 3): number {
  const bounds = normalizeIntensityBounds(ext);
  const parsed = normalizeNumberish(value, fallback);
  const clamped = Math.min(bounds.max, Math.max(bounds.min, parsed));
  return Math.round(clamped);
}

function parseMovementList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter((item) => item);
  }
  return [];
}

function normalizeCameraMovementValue(ext: CameraMovementExt, value: unknown, intensityFallback = 3): CameraMovementValue {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return {
      movements: parseMovementList(record.movements ?? record.camera_movement),
      intensity: clampIntensity(ext, record.intensity ?? record.camera_movement_intensity, intensityFallback),
    };
  }
  return {
    movements: parseMovementList(value),
    intensity: clampIntensity(ext, intensityFallback, intensityFallback),
  };
}

function intensityLabelOf(ext: CameraMovementExt, intensity: number): string {
  const match = (ext.intensityLabels ?? []).find((item) => item.value === intensity);
  return match?.label?.trim() || String(intensity);
}

function intensityTicks(ext: CameraMovementExt): number[] {
  const bounds = normalizeIntensityBounds(ext);
  const ticks: number[] = [];
  for (let value = bounds.min; value <= bounds.max; value += bounds.step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== bounds.max) ticks.push(bounds.max);
  return ticks;
}

function isExclusiveOption(option: CameraMovementOption): boolean {
  if (option.exclusive === false) return false;
  if (option.exclusive === true) return true;
  return STATIC_MOVEMENT_VALUES.has(option.value.trim());
}

function toggleMovement(current: string[], option: CameraMovementOption, options: CameraMovementOption[]): string[] {
  const selected = current.includes(option.value);
  if (selected) return current.filter((value) => value !== option.value);
  if (isExclusiveOption(option)) return [option.value];
  const exclusiveValues = new Set(options.filter((item) => isExclusiveOption(item)).map((item) => item.value));
  return [...current.filter((value) => !exclusiveValues.has(value)), option.value];
}

function isStillSelected(movements: string[], options: CameraMovementOption[]): boolean {
  return movements.some((value) => {
    const option = options.find((item) => item.value === value);
    return option ? isExclusiveOption(option) : STATIC_MOVEMENT_VALUES.has(value);
  });
}

function chipClassName(active: boolean): string {
  return `px-3 py-1.5 text-sm rounded-md border transition-colors ${
    active
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
  }`;
}

function CameraMovementControl(props: {
  ext: CameraMovementExt;
  value: CameraMovementValue;
  onChange: (next: CameraMovementValue) => void;
  onFocusOption?: (index: number) => void;
  interactive?: boolean;
}) {
  const options = props.ext.options ?? [];
  const bounds = normalizeIntensityBounds(props.ext);
  const ticks = intensityTicks(props.ext);
  const label = intensityLabelOf(props.ext, props.value.intensity);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">镜头运动</span>
          <button
            type="button"
            disabled={props.interactive === false || props.value.movements.length === 0}
            onClick={(event) => {
              event.stopPropagation();
              props.onChange({ ...props.value, movements: [] });
            }}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            清除
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((option, index) => {
            const active = props.value.movements.includes(option.value);
            return (
              <button
                key={`${index}:${option.value}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onFocusOption?.(index);
                  if (props.interactive === false) return;
                  props.onChange({
                    ...props.value,
                    movements: toggleMovement(props.value.movements, option, options),
                  });
                }}
                className={chipClassName(active)}
              >
                {option.title || option.value}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">运动幅度</span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{label}</span>
        </div>
        <Slider
          value={[props.value.intensity]}
          min={bounds.min}
          max={bounds.max}
          step={bounds.step}
          disabled={props.interactive === false}
          onValueChange={(values) => {
            props.onChange({ ...props.value, intensity: clampIntensity(props.ext, values[0] ?? bounds.min) });
          }}
        />
        <div className="flex justify-between px-0.5">
          {ticks.map((tick) => (
            <span key={tick} className="w-4 text-center text-xs text-muted-foreground">
              {tick}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CameraMovementCanvasPreview({ comp }: { comp: Extract<UiComponent, { type: "CameraMovement" }> }) {
  const intensityFallback = clampIntensity(comp.ext, comp.basic?.params?.[1]?.defaultValue, 3);
  const [value, setValue] = useState<CameraMovementValue>(() =>
    normalizeCameraMovementValue(comp.ext, { movements: parseMovementList(comp.basic?.params?.[0]?.defaultValue), intensity: intensityFallback }, intensityFallback),
  );

  useEffect(() => {
    const allowed = new Set((comp.ext.options ?? []).map((option) => option.value));
    setValue((current) => ({
      movements: current.movements.filter((item) => allowed.has(item)),
      intensity: clampIntensity(comp.ext, current.intensity, intensityFallback),
    }));
  }, [comp.ext, intensityFallback]);

  return (
    <CameraMovementControl
      ext={comp.ext}
      value={value}
      onChange={setValue}
      onFocusOption={(optionIndex) => dispatchCanvasPreviewFocusOption("CameraMovement", { componentId: comp.id, optionIndex })}
    />
  );
}

function CameraMovementExtEditor({
  component,
  onChange,
}: {
  component: Extract<UiComponent, { type: "CameraMovement" }>;
  onChange: (next: UiComponent) => void;
}) {
  const options = component.ext.options ?? [];
  const intensityLabels = component.ext.intensityLabels ?? [];
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
      if (!detail || detail.componentId !== component.id) return;
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

    window.addEventListener(CAMERA_MOVEMENT_FOCUS_EVENT, handleFocusOption as EventListener);
    return () => {
      window.removeEventListener(CAMERA_MOVEMENT_FOCUS_EVENT, handleFocusOption as EventListener);
    };
  }, [component.id]);

  const updateExt = (patch: Partial<CameraMovementExt>) => {
    onChange({ ...component, ext: { ...component.ext, ...patch } });
  };

  return (
    <div className="space-y-4 mx-2">
      <div className="sticky top-0 z-10 -mx-2 bg-background px-3 pt-3 pb-3 border-b border-border/60 shadow-[0_1px_0_0_hsl(var(--background))]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">镜头运动选项</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const next: CameraMovementOption = { title: "新运镜", value: "", exclusive: false };
              updateExt({ options: [...options, next] });
            }}
          >
            <Plus className="w-4 h-4" />
            添加
          </Button>
        </div>
      </div>

      {options.map((option, idx) => (
        <div
          key={idx}
          ref={(node) => {
            optionRefs.current[idx] = node;
          }}
          className={`scroll-mt-20 rounded-lg border border-border p-3 space-y-2 transition-shadow ${
            highlightedIndex === idx ? "ring-1 ring-primary/50 shadow-sm" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">选项 {idx + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => updateExt({ options: options.filter((_, index) => index !== idx) })}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">标题</label>
              <Input
                value={option.title}
                onChange={(event) => {
                  const next = options.map((item, index) => (index === idx ? { ...item, title: event.target.value } : item));
                  updateExt({ options: next });
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">参数值</label>
              <Input
                value={option.value}
                onChange={(event) => {
                  const next = options.map((item, index) => (index === idx ? { ...item, value: event.target.value } : item));
                  updateExt({ options: next });
                }}
                className="h-9"
              />
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm text-foreground">
            <span>互斥（如静止）</span>
            <Switch
              checked={isExclusiveOption(option)}
              onCheckedChange={(checked) => {
                const next = options.map((item, index) => (index === idx ? { ...item, exclusive: checked === true } : item));
                updateExt({ options: next });
              }}
            />
          </label>
        </div>
      ))}

      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="text-sm font-medium text-foreground">运动幅度</div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">最小</label>
            <Input
              type="number"
              value={component.ext.intensityMin}
              onChange={(event) => updateExt({ intensityMin: Number(event.target.value) })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">最大</label>
            <Input
              type="number"
              value={component.ext.intensityMax}
              onChange={(event) => updateExt({ intensityMax: Number(event.target.value) })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">步长</label>
            <Input
              type="number"
              value={component.ext.intensityStep}
              onChange={(event) => updateExt({ intensityStep: Number(event.target.value) })}
              className="h-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">幅度文案</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const nextValue = (intensityLabels[intensityLabels.length - 1]?.value ?? 0) + 1;
                const next: CameraMovementIntensityLabel = { value: nextValue, label: "自定义" };
                updateExt({ intensityLabels: [...intensityLabels, next] });
              }}
            >
              <Plus className="w-4 h-4" />
              添加
            </Button>
          </div>
          {intensityLabels.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[88px_1fr_auto] gap-2">
              <Input
                type="number"
                value={item.value}
                onChange={(event) => {
                  const next = intensityLabels.map((label, index) =>
                    index === idx ? { ...label, value: Number(event.target.value) } : label,
                  );
                  updateExt({ intensityLabels: next });
                }}
                className="h-9"
              />
              <Input
                value={item.label}
                onChange={(event) => {
                  const next = intensityLabels.map((label, index) =>
                    index === idx ? { ...label, label: event.target.value } : label,
                  );
                  updateExt({ intensityLabels: next });
                }}
                className="h-9"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => updateExt({ intensityLabels: intensityLabels.filter((_, index) => index !== idx) })}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const cameraMovementDefinition: UiComponentDefinition = {
  type: "CameraMovement",
  iconName: "camera",
  palette: { id: "camera-movement", label: "镜头运动", category: "视频", badge: "Biz", order: 10 },
  renderPaletteHoverPreview: () => {
    const preview = createPreviewExt();
    return (
      <div className="w-[320px]">
        <div className="mb-3 flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">镜头运动</span>
        </div>
        <CameraMovementControl
          ext={preview}
          value={{ movements: ["pan_left", "pan_right", "tilt_up"], intensity: 3 }}
          onChange={() => {}}
          interactive={false}
        />
      </div>
    );
  },
  createInitialRuntimeValue: (component) => {
    const current = component as Extract<UiComponent, { type: "CameraMovement" }>;
    const intensityFallback = clampIntensity(current.ext, current.basic?.params?.[1]?.defaultValue, 3);
    return normalizeCameraMovementValue(
      current.ext,
      {
        movements: parseMovementList(current.basic?.params?.[0]?.defaultValue),
        intensity: intensityFallback,
      },
      intensityFallback,
    );
  },
  collectDispatchParams: (component, values) => {
    const current = component as Extract<UiComponent, { type: "CameraMovement" }>;
    const params = current.basic?.params ?? [];
    const intensityFallback = clampIntensity(current.ext, params[1]?.defaultValue, 3);
    const runtime = normalizeCameraMovementValue(current.ext, readRuntimeComponentValue(current, values).value, intensityFallback);
    const out: Record<string, unknown> = {};
    const mapping: Array<[UiParam | undefined, unknown]> = [
      [params[0], runtime.movements.join(",")],
      [params[1], runtime.intensity],
    ];
    mapping.forEach(([param, payload]) => {
      const key = getParamAlias(param);
      if (!key) return;
      if (typeof payload === "string" && !payload.trim()) return;
      out[key] = payload;
    });
    out.camerafixed = isStillSelected(runtime.movements, current.ext.options ?? []);
    return out;
  },
  renderCanvasPreview: (component): ReactNode => {
    return <CameraMovementCanvasPreview comp={component as Extract<UiComponent, { type: "CameraMovement" }>} />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const current = comp as Extract<UiComponent, { type: "CameraMovement" }>;
    const intensityFallback = clampIntensity(current.ext, current.basic?.params?.[1]?.defaultValue, 3);
    const parsed = normalizeCameraMovementValue(current.ext, value, intensityFallback);
    return (
      <div className="space-y-3">
        <LabelComp />
        <CameraMovementControl
          ext={current.ext}
          value={parsed}
          onChange={onChange}
        />
      </div>
    );
  },
  renderExtEditor: (component, onChange) => {
    return (
      <CameraMovementExtEditor
        component={component as Extract<UiComponent, { type: "CameraMovement" }>}
        onChange={onChange}
      />
    );
  },
};

function createPreviewExt(): CameraMovementExt {
  return {
    options: [
      { title: "左移", value: "pan_left" },
      { title: "右移", value: "pan_right" },
      { title: "上摇", value: "tilt_up" },
      { title: "下摇", value: "tilt_down" },
      { title: "推近", value: "zoom_in" },
      { title: "拉远", value: "zoom_out" },
      { title: "环绕", value: "orbit" },
      { title: "静止", value: "static", exclusive: true },
    ],
    intensityMin: 1,
    intensityMax: 5,
    intensityStep: 1,
    intensityLabels: [
      { value: 1, label: "微弱" },
      { value: 2, label: "较小" },
      { value: 3, label: "适中" },
      { value: 4, label: "较大" },
      { value: 5, label: "强烈" },
    ],
  };
}
