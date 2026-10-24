import type { ReactNode } from "react";
import { Input } from "@/shared/ui/input";
import { Hash } from "lucide-react";
import type { UiComponent } from "../ui-schema";
import { defaultCollectDispatchParamsForComponent } from "./shared";
import type { UiComponentDefinition } from "./types";

function normalizeNumberish(value: unknown): number | "" {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return "";
    const n = Number(t);
    return Number.isFinite(n) ? n : "";
  }
  return "";
}

export const customNumberDefinition: UiComponentDefinition = {
  type: "CustomNumber",
  iconName: "hash",
  palette: { id: "custom-number", label: "自定义数字", category: "基础", order: 30 },
  renderPaletteHoverPreview: () => {
    return (
      <div className="w-[260px]">
        <div className="flex items-center gap-1.5 mb-2">
          <Hash className="w-4 h-4 text-foreground" />
          <span className="text-sm font-medium text-foreground">自定义数字输入</span>
        </div>
        <Input className="h-9" value={1} readOnly />
      </div>
    );
  },
  createInitialRuntimeValue: (component) => {
    const c = component as Extract<UiComponent, { type: "CustomNumber" }>;
    const def = c.basic?.params?.[0]?.defaultValue;
    if (typeof def === "string" && def.trim()) {
      const n = Number(def.trim());
      if (Number.isFinite(n)) return n;
    }
    return 1;
  },
  collectDispatchParams: (component, values) => defaultCollectDispatchParamsForComponent(component, values),
  renderCanvasPreview: (component): ReactNode => {
    const c = component as Extract<UiComponent, { type: "CustomNumber" }>;
    const def = c.basic?.params?.[0]?.defaultValue;
    const displayValue = (() => {
      if (typeof def === "string" && def.trim()) {
        const n = Number(def.trim());
        if (Number.isFinite(n)) return n;
      }
      return 1;
    })();
    return <Input className="h-9" value={displayValue} readOnly />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const current = comp as Extract<UiComponent, { type: "CustomNumber" }>;
    const min = current.ext.min;
    const max = current.ext.max;
    return (
      <div className="space-y-2">
        <LabelComp />
        <Input
          type="number"
          className="workflow-form-input"
          min={typeof min === "number" && Number.isFinite(min) ? min : undefined}
          max={typeof max === "number" && Number.isFinite(max) ? max : undefined}
          value={normalizeNumberish(value)}
          onChange={(e) => {
            const v = e.target.value;
            if (!v.trim()) {
              onChange("");
              return;
            }
            const n = Number(v);
            onChange(Number.isFinite(n) ? n : "");
          }}
          placeholder="请输入数字"
        />
      </div>
    );
  },
  renderExtEditor: () => {
    return <div className="text-sm text-muted-foreground mt-4 mx-2">当前组件暂无扩展属性。</div>;
  },
};
