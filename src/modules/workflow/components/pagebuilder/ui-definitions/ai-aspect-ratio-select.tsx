import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Plus, Trash2, RatioIcon } from "lucide-react";
import type { UiComponent } from "../ui-schema";
import { buildSafeSelectOptions, defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";
import { cn } from "@/shared/lib/utils";
import { dispatchCanvasPreviewFocusOption, getCanvasPreviewFocusOptionEventName, type CanvasPreviewFocusOptionDetail } from "./canvas-preview-focus-link";

const AI_ASPECT_RATIO_SELECT_FOCUS_EVENT = getCanvasPreviewFocusOptionEventName("AIAspectRatioSelect");

const ASPECT_PAIR = String.raw`\d+(?:\.\d+)?\s*[:：xX×*]\s*\d+(?:\.\d+)?`;
const ASPECT_RATIO_ANNOTATION = String.raw`\s*[（(]\s*\d+(?:\.\d+)?\s*[:：]\s*\d+(?:\.\d+)?\s*[）)]`;
const ASPECT_RATIO_VALUE_PATTERN = new RegExp(`^${ASPECT_PAIR}(?:${ASPECT_RATIO_ANNOTATION})?$`);

function readPositivePair(left: string, right: string): { w: number; h: number } | null {
  const w = Number(left);
  const h = Number(right);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

/** 从 16:9 / 1728x2304 / 2048×2048 (1:1) 等配置值中解析宽高，供比例图标使用。 */
function parseAspectRatioParts(ratioStr: string | undefined | null): { w: number; h: number } | null {
  const raw = String(ratioStr ?? "").trim();
  if (!raw) return null;
  const annotated = raw.match(/[（(]\s*(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)\s*[）)]/);
  if (annotated) {
    const fromAnnotation = readPositivePair(annotated[1], annotated[2]);
    if (fromAnnotation) return fromAnnotation;
  }
  const match = raw.match(/(\d+(?:\.\d+)?)\s*[:：xX×*]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return readPositivePair(match[1], match[2]);
}

function isAspectRatioValueFormat(value: string | undefined | null): boolean {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  return ASPECT_RATIO_VALUE_PATTERN.test(raw);
}

const RatioRectangle = ({
  ratioStr,
  fallbackStr,
  size = 12,
}: {
  ratioStr: string;
  fallbackStr?: string;
  size?: number;
}) => {
  const parsed = parseAspectRatioParts(ratioStr) ?? parseAspectRatioParts(fallbackStr);
  const w = parsed?.w ?? 1;
  const h = parsed?.h ?? 1;
  const maxDim = size - 2; // leave padding for stroke
  let rectW, rectH;
  if (w > h) {
    rectW = maxDim;
    rectH = maxDim * (h / w);
  } else {
    rectH = maxDim;
    rectW = maxDim * (w / h);
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x={(size - rectW) / 2}
        y={(size - rectH) / 2}
        width={rectW}
        height={rectH}
        rx={size > 12 ? 1.5 : 1}
        stroke="currentColor"
        strokeWidth={size > 12 ? 1.5 : 1}
      />
    </svg>
  );
};

function AIAspectRatioSelectCanvasPreview({ comp }: { comp: Extract<UiComponent, { type: "AIAspectRatioSelect" }> }) {
  const options = useMemo(() => comp.ext.options ?? [], [comp.ext.options]);
  const [selectedValue, setSelectedValue] = useState(() => comp.basic?.params?.[0]?.defaultValue || options[0]?.value || "");

  useEffect(() => {
    if (options.length === 0) {
      setSelectedValue("");
      return;
    }
    if (!options.some((option) => option.value === selectedValue)) {
      setSelectedValue(comp.basic?.params?.[0]?.defaultValue || options[0]?.value || "");
    }
  }, [comp.basic, options, selectedValue]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o, idx) => {
          const active = o.value === selectedValue;
          return (
            <button
              key={`${idx}:${o.value}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedValue(o.value);
                dispatchCanvasPreviewFocusOption("AIAspectRatioSelect", { componentId: comp.id, optionIndex: idx });
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-normal transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <RatioRectangle ratioStr={o.value} fallbackStr={o.label} />
              <span>{String(o.label ?? o.value ?? "")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AIAspectRatioSelectExtEditor({
  component,
  onChange,
}: {
  component: Extract<UiComponent, { type: "AIAspectRatioSelect" }>;
  onChange: (next: UiComponent) => void;
}) {
  const options = component.ext.options;
  const optionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const highlightTimerRef = useRef<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [valueFieldTouched, setValueFieldTouched] = useState<Record<number, boolean>>({});

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

    window.addEventListener(AI_ASPECT_RATIO_SELECT_FOCUS_EVENT, handleFocusOption as EventListener);
    return () => {
      window.removeEventListener(AI_ASPECT_RATIO_SELECT_FOCUS_EVENT, handleFocusOption as EventListener);
    };
  }, [component.id]);

  return (
    <div className="space-y-3 mx-2">
      <div className="sticky top-0 z-10 -mx-3 bg-background px-3 pt-3 pb-3 border-b border-border/60 shadow-[0_1px_0_0_hsl(var(--background))]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">比例选项</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const next = { label: "新比例", value: "", icon: "", billingWeight: 1 };
              onChange({ ...component, ext: { ...component.ext, options: [...options, next] } });
            }}
          >
            <Plus className="w-4 h-4" />
            添加
          </Button>
        </div>
      </div>
      {options.map((o, idx) => {
        const formatInvalid = !isAspectRatioValueFormat(o.value);
        return (
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
              onClick={() => {
                const next = options.filter((_, i) => i !== idx);
                setValueFieldTouched((prev) => {
                  const shifted: Record<number, boolean> = {};
                  for (const [key, touched] of Object.entries(prev)) {
                    const i = Number(key);
                    if (!touched || i === idx) continue;
                    shifted[i > idx ? i - 1 : i] = true;
                  }
                  return shifted;
                });
                onChange({ ...component, ext: { ...component.ext, options: next } });
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">标签</label>
              <Input
                value={o.label}
                onChange={(e) => {
                  const next = options.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x));
                  onChange({ ...component, ext: { ...component.ext, options: next } });
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">值 (如 16:9)</label>
              <Input
                value={o.value}
                onChange={(e) => {
                  const next = options.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x));
                  onChange({ ...component, ext: { ...component.ext, options: next } });
                }}
                onBlur={() => setValueFieldTouched((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }))}
                aria-invalid={formatInvalid}
                className={cn(
                  "h-9",
                  formatInvalid && "border-destructive hover:border-destructive focus:border-destructive"
                )}
                placeholder="例如: 16:9 或 2048×2048 (1:1)"
              />
              {valueFieldTouched[idx] && formatInvalid ? (
                <div className="text-xs text-destructive">请输入 16:9、1728x2304 格式</div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">计费权重</label>
              <Input
                value={o.billingWeight == null ? "" : String(o.billingWeight)}
                onChange={(e) => {
                  const v = e.target.value.trim() ? Number(e.target.value) : undefined;
                  const next = options.map((x, i) => (i === idx ? { ...x, billingWeight: Number.isFinite(v as number) ? v : undefined } : x));
                  onChange({ ...component, ext: { ...component.ext, options: next } });
                }}
                className="h-9"
              />
            </div>
          </div>
        </div>
        );
      })}
    </div>
  );
}

function AIAspectRatioSelectRuntimeField(props: {
  component: Extract<UiComponent, { type: "AIAspectRatioSelect" }>;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp: () => ReactNode;
}) {
  const safeOptions = buildSafeSelectOptions(props.component.ext?.options ?? []);
  const rawValue = typeof props.value === "string" ? props.value : "";

  return (
    <div className="space-y-2">
      <props.LabelComp />
      <div className="flex flex-wrap gap-2">
        {safeOptions.map((o) => {
          const isSelected = o.rawValue === rawValue;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => props.onChange(o.rawValue)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <RatioRectangle ratioStr={o.rawValue} fallbackStr={o.label} />
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const aiAspectRatioSelectDefinition: UiComponentDefinition = {
  type: "AIAspectRatioSelect",
  iconName: "ratio",
  palette: { id: "ratio", label: "比例选择", category: "基础", order: 20 },
  renderPaletteHoverPreview: () => {
    return (
      <div className="w-[240px]">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-foreground">
            <RatioIcon className="w-4 h-4" />
          </span>
          <span className="text-sm font-medium text-foreground">比例选择</span>
        </div>
        <div className="flex items-center gap-1.5">
          {["1:1", "3:4", "9:16"].map((r) => (
            <span key={r} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-sm rounded border border-border text-muted-foreground">
              <RatioRectangle ratioStr={r} size={12} />
              {r}
            </span>
          ))}
        </div>
      </div>
    );
  },
  createInitialRuntimeValue: (component) => {
    const c = component as Extract<UiComponent, { type: "AIAspectRatioSelect" }>;
    const def = c.basic?.params?.[0]?.defaultValue;
    if (def) return def;
    return c.ext?.options?.[0]?.value || "";
  },
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  renderCanvasPreview: (component): ReactNode => {
    return <AIAspectRatioSelectCanvasPreview comp={component as Extract<UiComponent, { type: "AIAspectRatioSelect" }>} />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    return (
      <AIAspectRatioSelectRuntimeField
        component={comp as Extract<UiComponent, { type: "AIAspectRatioSelect" }>}
        value={value}
        onChange={onChange}
        LabelComp={LabelComp}
      />
    );
  },
  renderExtEditor: (component, onChange) => {
    return <AIAspectRatioSelectExtEditor component={component as Extract<UiComponent, { type: "AIAspectRatioSelect" }>} onChange={onChange} />;
  },
};
