import type { ReactNode } from "react";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { GripVertical, ToggleLeft, X } from "lucide-react";
import type { ControlSwitchExt, UiComponent } from "../ui-schema";
import { getRuntimeParamAlias, readRuntimeComponentValue } from "./shared";
import type { UiComponentCanvasCardProps, UiComponentDefinition } from "./types";

const DEFAULT_EXT: ControlSwitchExt = {
  onLabel: "开启",
  offLabel: "关闭",
  onValue: "true",
  offValue: "false",
};

function normalizeExt(ext: ControlSwitchExt | undefined): ControlSwitchExt {
  return {
    onLabel: typeof ext?.onLabel === "string" ? ext.onLabel : DEFAULT_EXT.onLabel,
    offLabel: typeof ext?.offLabel === "string" ? ext.offLabel : DEFAULT_EXT.offLabel,
    onValue: typeof ext?.onValue === "string" ? ext.onValue : DEFAULT_EXT.onValue,
    offValue: typeof ext?.offValue === "string" ? ext.offValue : DEFAULT_EXT.offValue,
  };
}

function parseSwitchPayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const normalized = trimmed.toLowerCase();
  if (normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "false" || normalized === "no" || normalized === "off") return false;
  if (Number.isFinite(Number(trimmed))) return Number(trimmed);
  return trimmed;
}

export function isControlSwitchOn(value: unknown, ext: ControlSwitchExt): boolean {
  const normalized = normalizeExt(ext);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed === normalized.onValue) return true;
    if (trimmed === normalized.offValue) return false;
    const payload = parseSwitchPayload(trimmed);
    if (typeof payload === "boolean") return payload;
    if (typeof payload === "number") return payload !== 0;
  }
  return false;
}

export function resolveControlSwitchDispatchValue(checked: boolean, ext: ControlSwitchExt): unknown {
  const normalized = normalizeExt(ext);
  return parseSwitchPayload(checked ? normalized.onValue : normalized.offValue);
}

function SwitchControl(props: {
  checked: boolean;
  ext: ControlSwitchExt;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const ext = normalizeExt(props.ext);
  const label = props.checked ? ext.onLabel : ext.offLabel;
  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* <span className="text-sm text-muted-foreground">{label || (props.checked ? "开启" : "关闭")}</span> */}
      <Switch
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={(next) => props.onCheckedChange?.(next === true)}
      />
    </div>
  );
}

function SwitchTitleRow(props: {
  title: ReactNode;
  checked: boolean;
  ext: ControlSwitchExt;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <div className="min-w-0 flex-1">{props.title}</div>
      <div className="flex items-center gap-2 shrink-0">
        <SwitchControl
          checked={props.checked}
          ext={props.ext}
          disabled={props.disabled}
          onCheckedChange={props.onCheckedChange}
        />
        {props.trailing}
      </div>
    </div>
  );
}

function ControlSwitchCanvasCard(props: UiComponentCanvasCardProps) {
  const component = props.comp as Extract<UiComponent, { type: "ControlSwitch" }>;
  const checked = isControlSwitchOn(component.basic?.params?.[0]?.defaultValue, component.ext);
  return (
    <div
      onClick={props.onSelect}
      className={`rounded-lg border p-3 mb-1 cursor-pointer transition-all duration-200 group ${
        props.selected
          ? "border-1.5 border-purple-500 border-dashed bg-background"
          : "border-transparent hover:border-border border-solid bg-background"
      }`}
    >
      <SwitchTitleRow
        title={
          <div className="flex items-center gap-2 text-sm font-medium text-foreground min-w-0">
            <button
              type="button"
              draggable
              aria-label="拖拽排序"
              onDragStart={props.onDragStart}
              onDragEnd={props.onDragEnd}
              onClick={(event) => event.stopPropagation()}
              className={`cursor-grab active:cursor-grabbing ${props.selected ? "block" : "hidden group-hover:block"}`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            <ToggleLeft className="w-4 h-4 text-foreground shrink-0" />
            <span className="truncate">{component.title}</span>
          </div>
        }
        checked={checked}
        ext={component.ext}
        disabled
        trailing={
          <button
            aria-label="删除组件"
            onClick={(event) => {
              event.stopPropagation();
              props.onRemove();
            }}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        }
      />
    </div>
  );
}

function ControlSwitchExtEditor(props: {
  component: Extract<UiComponent, { type: "ControlSwitch" }>;
  onChange: (next: UiComponent) => void;
}) {
  const ext = normalizeExt(props.component.ext);
  const updateExt = (patch: Partial<ControlSwitchExt>) => {
    props.onChange({
      ...props.component,
      ext: { ...ext, ...patch },
    });
  };

  return (
    <div className="space-y-3 mt-4 mx-2">
      <div className="text-sm font-medium text-foreground">开关设置</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">开启文案</label>
          <Input className="h-9" value={ext.onLabel} onChange={(event) => updateExt({ onLabel: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">关闭文案</label>
          <Input className="h-9" value={ext.offLabel} onChange={(event) => updateExt({ offLabel: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">开启取值</label>
          <Input className="h-9" value={ext.onValue} onChange={(event) => updateExt({ onValue: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">关闭取值</label>
          <Input className="h-9" value={ext.offValue} onChange={(event) => updateExt({ offValue: event.target.value })} />
        </div>
      </div>
    </div>
  );
}

export const controlSwitchDefinition: UiComponentDefinition = {
  type: "ControlSwitch",
  iconName: "toggle-left",
  palette: { id: "control-switch", label: "控制开关", category: "基础", order: 35 },
  renderPaletteHoverPreview: () => {
    return (
      <div className="w-[260px]">
        <SwitchTitleRow
          title={
            <div className="flex items-center gap-1.5 min-w-0">
              <ToggleLeft className="h-4 w-4 text-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">控制开关</span>
            </div>
          }
          checked={false}
          ext={DEFAULT_EXT}
          disabled
        />
      </div>
    );
  },
  renderCanvasCard: (props) => <ControlSwitchCanvasCard {...props} />,
  createInitialRuntimeValue: (component) => {
    const current = component as Extract<UiComponent, { type: "ControlSwitch" }>;
    return isControlSwitchOn(current.basic?.params?.[0]?.defaultValue, current.ext);
  },
  collectDispatchParams: (component, values) => {
    const current = component as Extract<UiComponent, { type: "ControlSwitch" }>;
    const key = getRuntimeParamAlias(current);
    if (!key) return {};
    const runtimeState = readRuntimeComponentValue(current, values);
    const defaultChecked = isControlSwitchOn(current.basic?.params?.[0]?.defaultValue, current.ext);
    const checked = runtimeState.hasValue ? isControlSwitchOn(runtimeState.value, current.ext) : defaultChecked;
    return { [key]: resolveControlSwitchDispatchValue(checked, current.ext) };
  },
  renderCanvasPreview: (component): ReactNode => {
    const current = component as Extract<UiComponent, { type: "ControlSwitch" }>;
    return (
      <div className="flex justify-end">
        <SwitchControl
          checked={isControlSwitchOn(current.basic?.params?.[0]?.defaultValue, current.ext)}
          ext={current.ext}
          disabled
        />
      </div>
    );
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const current = comp as Extract<UiComponent, { type: "ControlSwitch" }>;
    return (
      <SwitchTitleRow
        title={<LabelComp />}
        checked={isControlSwitchOn(value, current.ext)}
        ext={current.ext}
        onCheckedChange={onChange}
      />
    );
  },
  renderExtEditor: (component, onChange) => {
    return (
      <ControlSwitchExtEditor
        component={component as Extract<UiComponent, { type: "ControlSwitch" }>}
        onChange={onChange}
      />
    );
  },
};
