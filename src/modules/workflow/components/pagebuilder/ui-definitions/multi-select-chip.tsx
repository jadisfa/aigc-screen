import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { SelectChipOption, UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";
import { dispatchCanvasPreviewFocusOption, getCanvasPreviewFocusOptionEventName, type CanvasPreviewFocusOptionDetail } from "./canvas-preview-focus-link";

const MULTI_SELECT_CHIP_FOCUS_EVENT = getCanvasPreviewFocusOptionEventName("MultiSelectChip");

function MultiSelectChipCanvasPreview({ comp }: { comp: Extract<UiComponent, { type: "MultiSelectChip" }> }) {
  const options = useMemo(() => comp.ext.options ?? [], [comp.ext.options]);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);

  useEffect(() => {
    setSelectedValues((current) => current.filter((value) => options.some((option) => option.value === value)));
  }, [options]);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o, idx) => {
        const active = selectedValues.includes(o.value);
        return (
          <button
            key={`${idx}:${o.value}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedValues((current) => (current.includes(o.value) ? current.filter((value) => value !== o.value) : [...current, o.value]));
              dispatchCanvasPreviewFocusOption("MultiSelectChip", { componentId: comp.id, optionIndex: idx });
            }}
            className={`px-3 py-1 text-sm rounded-md border transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {o.title}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelectChipExtEditor({
  component,
  onChange,
}: {
  component: Extract<UiComponent, { type: "MultiSelectChip" }>;
  onChange: (next: UiComponent) => void;
}) {
  const options: SelectChipOption[] = component.ext.options;
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

    window.addEventListener(MULTI_SELECT_CHIP_FOCUS_EVENT, handleFocusOption as EventListener);
    return () => {
      window.removeEventListener(MULTI_SELECT_CHIP_FOCUS_EVENT, handleFocusOption as EventListener);
    };
  }, [component.id]);

  return (
    <div className="space-y-3 mx-2">
      <div className="sticky top-0 z-10 -mx-2 bg-background px-3 pt-3 pb-3 border-b border-border/60 shadow-[0_1px_0_0_hsl(var(--background))]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">选项</span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const next = { title: "新选项", value: "", billingWeight: 1 };
              onChange({ ...component, ext: { ...component.ext, options: [...options, next] } });
            }}
          >
            <Plus className="w-4 h-4" />
            添加
          </Button>
        </div>
      </div>

      {options.map((o, idx) => (
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
                onChange({ ...component, ext: { ...component.ext, options: next } });
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">标题</label>
              <Input
                value={o.title}
                onChange={(e) => {
                  const next = options.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x));
                  onChange({ ...component, ext: { ...component.ext, options: next } });
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">参数值</label>
              <Input
                value={o.value}
                onChange={(e) => {
                  const next = options.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x));
                  onChange({ ...component, ext: { ...component.ext, options: next } });
                }}
                className="h-9"
              />
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
      ))}
    </div>
  );
}

export const multiSelectChipDefinition: UiComponentDefinition = {
  type: "MultiSelectChip",
  iconName: "chevron-right",
  palette: { id: "tag-multi", label: "标签组-多选", category: "选择", order: 20 },
  // createInitialRuntimeValue：
  // - 运行时初始值（value）的生成函数
  // - 多选语义：默认给空数组，表示未选中任何项
  createInitialRuntimeValue: () => [],
  collectDispatchParams: (component, values) => {
    const params = defaultCollectDispatchParamsForComponent(component, values);
    for (const k of Object.keys(params)) {
      if (Array.isArray(params[k])) {
        params[k] = params[k].join(",");
      }
    }
    return params;
  },
  // renderCanvasPreview：
  // - 画布中的静态预览（不依赖运行时 value）
  // - 用于展示组件的外观与配置（这里展示所有选项 chip）
  renderCanvasPreview: (component): ReactNode => {
    return <MultiSelectChipCanvasPreview comp={component as Extract<UiComponent, { type: "MultiSelectChip" }>} />;
  },
  // renderRuntimeField：
  // - 运行时表单中的真实输入控件
  // - 用户点击 chip 会在 Set 中增删选项，并通过 onChange 写回 value（string[]）
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const c = comp as Extract<UiComponent, { type: "MultiSelectChip" }>;
    const options = c.ext?.options ?? [];
    const v = Array.isArray(value) ? value.map((x) => String(x)) : [];
    const set = new Set(v);
    return (
      <div className="space-y-2">
        <LabelComp />
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const active = set.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  const next = new Set(set);
                  if (next.has(o.value)) next.delete(o.value);
                  else next.add(o.value);
                  onChange(Array.from(next));
                }}
                className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {o.title}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
  // renderExtEditor：
  // - 右侧属性面板的扩展配置编辑器
  // - 用于维护 c.ext.options（可选项标题/值/计费权重等），影响运行时渲染与提交参数
  renderExtEditor: (component, onChange) => {
    return <MultiSelectChipExtEditor component={component as Extract<UiComponent, { type: "MultiSelectChip" }>} onChange={onChange} />;
  },
};
