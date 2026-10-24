import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { SelectChipOption, UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";
import { dispatchCanvasPreviewFocusOption, getCanvasPreviewFocusOptionEventName, type CanvasPreviewFocusOptionDetail } from "./canvas-preview-focus-link";

const SINGLE_SELECT_CHIP_FOCUS_EVENT = getCanvasPreviewFocusOptionEventName("SingleSelectChip");

function SingleSelectChipCanvasPreview({ comp }: { comp: Extract<UiComponent, { type: "SingleSelectChip" }> }) {
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
    <div className="flex flex-wrap gap-2">
      {options.map((o, idx) => {
        const active = selectedValue === o.value;
        return (
          <button
            key={`${idx}:${o.value}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedValue(o.value);
              dispatchCanvasPreviewFocusOption("SingleSelectChip", { componentId: comp.id, optionIndex: idx });
            }}
            className={`px-3 py-1 text-xs rounded-md border transition-colors ${
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

function SingleSelectChipExtEditor({
  component,
  onChange,
}: {
  component: Extract<UiComponent, { type: "SingleSelectChip" }>;
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

    window.addEventListener(SINGLE_SELECT_CHIP_FOCUS_EVENT, handleFocusOption as EventListener);
    return () => {
      window.removeEventListener(SINGLE_SELECT_CHIP_FOCUS_EVENT, handleFocusOption as EventListener);
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

function SingleSelectChipRuntimeField(props: {
  component: Extract<UiComponent, { type: "SingleSelectChip" }>;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp: () => ReactNode;
}) {
  const options = props.component.ext?.options ?? [];
  const v = typeof props.value === "string" ? props.value : "";
  return (
    <div className="space-y-2">
      <props.LabelComp />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = v === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => props.onChange(o.value)}
              className={`px-3 py-1 text-xs rounded-md border transition-colors ${
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
}

export const singleSelectChipDefinition: UiComponentDefinition = {
  type: "SingleSelectChip",
  iconName: "circle-dot",
  palette: { id: "tag-radio", label: "高级-标签组-单选", category: "选择", order: 10 },
  // createInitialRuntimeValue：
  // - 当页面/表单首次渲染时，为该组件生成一个默认的运行时值（value）
  // - 这里优先使用 basic.params[0].defaultValue；否则回退为第一个 option 的 value
  createInitialRuntimeValue: (component) => {
    const c = component as Extract<UiComponent, { type: "SingleSelectChip" }>;
    const def = c.basic?.params?.[0]?.defaultValue;
    if (def) return def;
    return c.ext?.options?.[0]?.value || "";
  },
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  // renderCanvasPreview：
  // - PageBuilder 画布里的“静态预览”
  // - 目标：让用户在画布中直观看到组件的大致样式/配置效果（这里展示所有选项 chip）
  renderCanvasPreview: (component): ReactNode => {
    return <SingleSelectChipCanvasPreview comp={component as Extract<UiComponent, { type: "SingleSelectChip" }>} />;
  },
  // renderRuntimeField：
  // - 运行时表单里的真实输入控件
  // - 用户点击 chip 会触发 onChange，把选择结果写入运行时 value
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    return (
      <SingleSelectChipRuntimeField
        component={comp as Extract<UiComponent, { type: "SingleSelectChip" }>}
        value={value}
        onChange={onChange}
        LabelComp={LabelComp}
      />
    );
  },
  // renderExtEditor：
  // - 右侧属性面板的扩展配置编辑器
  // - 这里编辑的是 schema（c.ext.options），决定运行时可选项列表与展示文案
  renderExtEditor: (component, onChange) => {
    return <SingleSelectChipExtEditor component={component as Extract<UiComponent, { type: "SingleSelectChip" }>} onChange={onChange} />;
  },
};
