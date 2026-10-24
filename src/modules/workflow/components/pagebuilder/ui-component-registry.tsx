import type { ReactNode } from "react";
import { GripVertical, Info, X, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { UiComponent, UiComponentMcp, UiComponentType, UiSchemaV1 } from "./ui-schema";
import { UI_COMPONENT_DEFINITIONS, UI_COMPONENT_DEFINITION_MAP } from "./ui-definitions";
import type { UiComponentCanvasCardProps, UiComponentMeta } from "./ui-definitions/types";
import { runtimeValueSlot } from "@/modules/workflow/runtime-model/identity";
import { normalizeRuntimeLabel } from "./ui-definitions/shared";
import { SeedRuntimeField } from "./ui-definitions/seed";
import { TemplatePromptRuntimeField } from "./ui-definitions/template-prompt";
import { UI_COMPONENT_ICON_MAP } from "./constants/icons";
import { PALETTE_CATEGORY_ORDER } from "./constants/palette";
import { createDefaultComponent } from "./definition/default-ext";

export type { UiComponentMeta } from "./ui-definitions/types";
export { SeedRuntimeField, TemplatePromptRuntimeField };
export { normalizeRuntimeLabel };

export function getUiComponentDefinition(type: UiComponentType) {
  return UI_COMPONENT_DEFINITION_MAP[type];
}

export function getUiComponentMeta(type: UiComponentType): UiComponentMeta {
  const def = getUiComponentDefinition(type);
  return { type: def.type, iconName: def.iconName };
}

export function UiComponentIcon({ iconName, className }: { iconName: string; className?: string }) {
  const cn = className || "w-4 h-4";
  const Icon = UI_COMPONENT_ICON_MAP[iconName as keyof typeof UI_COMPONENT_ICON_MAP];
  return Icon ? <Icon className={cn} /> : <Info className={cn} />;
}

export type UiComponentPaletteItem = {
  id: string;
  label: string;
  iconName: string;
  badge?: string;
  type: UiComponentType;
};

export type UiComponentPaletteCategory = {
  name: string;
  items: UiComponentPaletteItem[];
  allowCustom: boolean;
};

export function getUiComponentPaletteCategories(): UiComponentPaletteCategory[] {
  const map = new Map<string, UiComponentPaletteItem[]>();

  for (const def of UI_COMPONENT_DEFINITIONS) {
    const p = def.palette;
    if (!p) continue;
    const list = map.get(p.category) ?? [];
    list.push({ id: p.id, label: p.label, iconName: def.iconName, badge: p.badge, type: def.type });
    map.set(p.category, list);
  }

  const categories: UiComponentPaletteCategory[] = Array.from(map.entries()).map(([name, items]) => ({
    name,
    allowCustom: true,
    items: [...items].sort((a, b) => {
      const pa = getUiComponentDefinition(a.type).palette?.order ?? 0;
      const pb = getUiComponentDefinition(b.type).palette?.order ?? 0;
      if (pa !== pb) return pa - pb;
      return a.label.localeCompare(b.label, "zh-Hans-CN");
    }),
  }));

  return categories.sort((a, b) => {
    const oa = PALETTE_CATEGORY_ORDER[a.name] ?? 999;
    const ob = PALETTE_CATEGORY_ORDER[b.name] ?? 999;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
}

export function renderUiComponentPaletteHoverPreview(type: UiComponentType): ReactNode {
  const def = getUiComponentDefinition(type);
  if (def.renderPaletteHoverPreview) return def.renderPaletteHoverPreview();

  const comp = createDefaultComponent(type, 0);
  const label = comp.title || def.palette?.label || type;
  return (
    <div className="w-[320px]">
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
        <span className="text-foreground">
          <UiComponentIcon iconName={def.iconName} className="w-4 h-4" />
        </span>
          <span>{label}</span>
      </div>
        {def.renderCanvasPreview(comp as never)}
      </div>
    </div>
  );
}

export function renderUiComponentCanvasCard(props: UiComponentCanvasCardProps): ReactNode {
  const def = getUiComponentDefinition(props.comp.type);
  if (def.renderCanvasCard) return def.renderCanvasCard(props as never);

  const meta = getUiComponentMeta(props.comp.type);
  return (
    <div
      onClick={props.onSelect}
      className={`rounded-lg border p-3 mb-1 cursor-pointer transition-all duration-200 group ${
        props.selected ? "border-1.5 border-purple-500 border-dashed bg-background" : "border-transparent hover:border-border border-solid bg-background"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <button
            type="button"
            draggable
            aria-label="拖拽排序"
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
            onClick={(e) => e.stopPropagation()}
            className={`cursor-grab active:cursor-grabbing ${props.selected ? "block" : "hidden group-hover:block"}`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-foreground">
            <UiComponentIcon iconName={meta.iconName} className="w-4 h-4" />
          </span>
          <span>{props.comp.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {props.comp.ext?.enableTranslate && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-accent text-primary pointer-events-none">
              翻译
            </Button>
          )}
          {props.comp.ext?.enableLLM && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] bg-accent text-primary pointer-events-none">
              AI润色
            </Button>
          )}
          <button
            aria-label="删除组件"
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove();
            }}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>{renderUiComponentCanvasPreview(props.comp)}</div>
    </div>
  );
}

export function buildDispatchParams(schema: UiSchemaV1 | null, values: Record<string, unknown>): Record<string, unknown> {
  if (!schema) return values;
  const params: Record<string, unknown> = {};
  for (const comp of schema.components) {
    const next = collectDispatchParamsForComponent(comp, values);
    for (const k of Object.keys(next)) {
      params[k] = next[k];
    }
  }
  return params;
}

export function prepareRuntimeValuesForDispatch(
  schema: UiSchemaV1 | null,
  values: Record<string, unknown>,
): { values: Record<string, unknown>; changed: boolean } {
  if (!schema) return { values, changed: false };
  let changed = false;
  let nextValues = values;

  for (const comp of schema.components) {
    const key = runtimeValueSlot(comp);
    if (!key) continue;
    const def = getUiComponentDefinition(comp.type);
    const prepared = def.prepareRuntimeValueBeforeDispatch?.(comp as never, nextValues[key]);
    if (prepared === undefined) continue;
    if (!changed) {
      nextValues = { ...nextValues };
      changed = true;
    }
    nextValues[key] = prepared;
  }

  return { values: nextValues, changed };
}

export function createInitialRuntimeValue(component: UiComponent): unknown {
  const def = getUiComponentDefinition(component.type);
  return def.createInitialRuntimeValue(component as never);
}

export function collectDispatchParamsForComponent(component: UiComponent, values: Record<string, unknown>): Record<string, unknown> {
  const def = getUiComponentDefinition(component.type);
  return def.collectDispatchParams(component as never, values);
}

export function renderUiComponentCanvasPreview(component: UiComponent): ReactNode {
  const def = getUiComponentDefinition(component.type);
  return def.renderCanvasPreview(component as never);
}

export function renderUiComponentRuntimeField(props: { comp: UiComponent; value: unknown; onChange: (next: unknown) => void }) {
  const label = normalizeRuntimeLabel(props.comp);
  const required = props.comp.basic?.params?.[0]?.required === true;
  const meta = getUiComponentMeta(props.comp.type);

  const LabelComp = () => (
    <label className="text-[14px] !font-normal workflow-form-label flex items-center gap-1.5 text-foreground/90 whitespace-nowrap overflow-hidden text-ellipsis">
      {required && <span className="text-destructive shrink-0">*</span>}
      <UiComponentIcon iconName={meta.iconName} className="w-4 h-4 text-foreground/70 shrink-0" />
      <span className="truncate">{label}</span>
    </label>
  );

  const def = getUiComponentDefinition(props.comp.type);
  return def.renderRuntimeField({ comp: props.comp as never, value: props.value, onChange: props.onChange, LabelComp } as never);
}

export function ensureMcp(mcp: UiComponentMcp | undefined): UiComponentMcp {
  return {
    description: mcp?.description ?? "",
    ignore: mcp?.ignore ?? false,
    dataType: mcp?.dataType ?? "string",
    required: mcp?.required ?? false,
    defaultValue: mcp?.defaultValue ?? "",
  };
}

export function renderUiComponentExtEditor(component: UiComponent, onChange: (next: UiComponent) => void): ReactNode {
  const def = getUiComponentDefinition(component.type);
  return def.renderExtEditor(component as never, onChange as never);
}
