import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/shared/ui/input";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import type { ColorPickerFormat, UiComponent } from "../ui-schema";
import { getRuntimeParamAlias, readRuntimeComponentValue } from "./shared";
import type { UiComponentDefinition } from "./types";

const DEFAULT_COLOR = "#8B5CF6";

const COLOR_FORMAT_OPTIONS: Array<{ value: ColorPickerFormat; label: string }> = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
];

function expandHex(value: string): string | null {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return `#${trimmed.slice(1).toUpperCase()}`;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const chars = trimmed.slice(1).split("");
    return `#${chars.map((char) => `${char}${char}`).join("").toUpperCase()}`;
  }
  return null;
}

function clampRgbChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function normalizeHue(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => clampRgbChannel(channel).toString(16).padStart(2, "0").toUpperCase())
    .join("")}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = expandHex(hex) ?? DEFAULT_COLOR;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = clampRgbChannel(r) / 255;
  const gn = clampRgbChannel(g) / 255;
  const bn = clampRgbChannel(b) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;

  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
      break;
  }

  return {
    h: Math.round(h * 60),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hue = normalizeHue(h) / 360;
  const saturation = clampPercentage(s) / 100;
  const lightness = clampPercentage(l) / 100;

  if (saturation === 0) {
    const channel = Math.round(lightness * 255);
    return { r: channel, g: channel, b: channel };
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const hueToRgb = (t: number) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };

  return {
    r: Math.round(hueToRgb(hue + 1 / 3) * 255),
    g: Math.round(hueToRgb(hue) * 255),
    b: Math.round(hueToRgb(hue - 1 / 3) * 255),
  };
}

function parseRgbInput(value: string): string | null {
  const match = value.trim().match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i);
  if (!match) return null;
  const channels = match.slice(1, 4).map((item) => Number(item));
  if (channels.some((item) => !Number.isFinite(item) || item < 0 || item > 255)) return null;
  return rgbToHex(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0);
}

function parseHslInput(value: string): string | null {
  const match = value
    .trim()
    .match(/^hsla?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d{1,3}(?:\.\d+)?)%\s*,\s*(\d{1,3}(?:\.\d+)?)%(?:\s*,\s*[\d.]+)?\s*\)$/i);
  if (!match) return null;
  const hue = Number(match[1]);
  const saturation = Number(match[2]);
  const lightness = Number(match[3]);
  if (![hue, saturation, lightness].every((item) => Number.isFinite(item))) return null;
  if (saturation < 0 || saturation > 100 || lightness < 0 || lightness > 100) return null;
  const { r, g, b } = hslToRgb(hue, saturation, lightness);
  return rgbToHex(r, g, b);
}

function parseColorToHex(value: unknown, format: ColorPickerFormat, fallback = DEFAULT_COLOR): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const parsedHex = expandHex(trimmed);
  if (parsedHex) return parsedHex;

  const orderedParsers =
    format === "rgb"
      ? [parseRgbInput, parseHslInput]
      : format === "hsl"
        ? [parseHslInput, parseRgbInput]
        : [parseRgbInput, parseHslInput];

  for (const parser of orderedParsers) {
    const parsed = parser(trimmed);
    if (parsed) return parsed;
  }

  return fallback;
}

function formatColorValue(hex: string, format: ColorPickerFormat): string {
  const normalizedHex = expandHex(hex) ?? DEFAULT_COLOR;
  if (format === "hex") return normalizedHex;

  const { r, g, b } = hexToRgb(normalizedHex);
  if (format === "rgb") {
    return `rgb(${r}, ${g}, ${b})`;
  }

  const { h, s, l } = rgbToHsl(r, g, b);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function resolveStoredColorValue(value: unknown, format: ColorPickerFormat): string {
  return parseColorToHex(value, format, DEFAULT_COLOR);
}

function collectColorDispatchParams(
  component: Extract<UiComponent, { type: "ColorPicker" }>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const paramAlias = getRuntimeParamAlias(component);
  if (!paramAlias) return {};

  const runtimeState = readRuntimeComponentValue(component, values);
  const defaultRaw = component.basic?.params?.[0]?.defaultValue;
  const defaultHex =
    typeof defaultRaw === "string" && defaultRaw.trim()
      ? parseColorToHex(defaultRaw, component.ext.format, "")
      : "";

  const runtimeValue = runtimeState.value;
  const isRuntimeEmpty =
    runtimeValue === undefined ||
    runtimeValue === null ||
    (typeof runtimeValue === "string" && runtimeValue.trim() === "");

  if (!runtimeState.hasValue && !defaultHex) return {};

  const finalHex = isRuntimeEmpty
    ? defaultHex
    : parseColorToHex(runtimeValue, component.ext.format, defaultHex || DEFAULT_COLOR);

  if (!finalHex) return {};
  return { [paramAlias]: formatColorValue(finalHex, component.ext.format) };
}

function ColorPickerField(props: {
  component: Extract<UiComponent, { type: "ColorPicker" }>;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp?: () => ReactNode;
}) {
  const currentHex = resolveStoredColorValue(props.value, props.component.ext.format);
  const displayValue = formatColorValue(currentHex, props.component.ext.format);
  const [draftValue, setDraftValue] = useState(displayValue);

  useEffect(() => {
    setDraftValue(displayValue);
  }, [displayValue]);

  const commitTextValue = (raw: string) => {
    const nextHex = parseColorToHex(raw, props.component.ext.format, currentHex);
    props.onChange(nextHex);
    setDraftValue(formatColorValue(nextHex, props.component.ext.format));
  };

  return (
    <div className="space-y-2">
      {props.LabelComp ? <props.LabelComp /> : null}
      <div className="flex items-center gap-3">
        <Input
          value={draftValue}
          onChange={(event) => {
            const nextDraft = event.target.value;
            setDraftValue(nextDraft);
            const nextHex = parseColorToHex(nextDraft, props.component.ext.format, "");
            if (nextHex) {
              props.onChange(nextHex);
            }
          }}
          onBlur={(event) => commitTextValue(event.target.value)}
          className="workflow-form-input"
          placeholder={formatColorValue(DEFAULT_COLOR, props.component.ext.format)}
          aria-label="颜色值输入"
        />
        <Input
          type="color"
          value={currentHex.toLowerCase()}
          onChange={(event) => props.onChange(parseColorToHex(event.target.value, "hex"))}
          className="h-10 w-14 cursor-pointer p-1"
          aria-label="颜色面板"
        />
      </div>
    </div>
  );
}

function ColorPickerExtEditor(props: {
  component: Extract<UiComponent, { type: "ColorPicker" }>;
  onChange: (next: UiComponent) => void;
}) {
  return (
    <div className="space-y-3 mt-4 mx-2">
      <div className="text-sm font-medium text-foreground">颜色格式</div>
      <RadioGroup
        value={props.component.ext.format}
        onValueChange={(nextValue) => {
          const nextFormat = COLOR_FORMAT_OPTIONS.some((item) => item.value === nextValue)
            ? (nextValue as ColorPickerFormat)
            : "hex";
          props.onChange({
            ...props.component,
            ext: {
              ...props.component.ext,
              format: nextFormat,
            },
          });
        }}
        className="flex flex-nowrap items-center gap-4"
      >
        {COLOR_FORMAT_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="inline-flex items-center gap-2 px-0 py-1 text-sm text-foreground cursor-pointer"
          >
            <RadioGroupItem value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

export const colorPickerDefinition: UiComponentDefinition = {
  type: "ColorPicker",
  iconName: "palette",
  palette: { id: "color-picker", label: "颜色选择", category: "选择", order: 30 },
  createInitialRuntimeValue: (component) => {
    const current = component as Extract<UiComponent, { type: "ColorPicker" }>;
    return resolveStoredColorValue(current.basic?.params?.[0]?.defaultValue, current.ext.format);
  },
  collectDispatchParams: (component, values) =>
    collectColorDispatchParams(component as Extract<UiComponent, { type: "ColorPicker" }>, values),
  renderCanvasPreview: (component): ReactNode => {
    const current = component as Extract<UiComponent, { type: "ColorPicker" }>;
    return <ColorPickerField component={current} value={current.basic?.params?.[0]?.defaultValue} onChange={() => undefined} />;
  },
  renderRuntimeField: ({ comp, value, onChange, LabelComp }) => {
    const current = comp as Extract<UiComponent, { type: "ColorPicker" }>;
    return <ColorPickerField component={current} value={value} onChange={onChange} LabelComp={LabelComp} />;
  },
  renderExtEditor: (component, onChange) => {
    return (
      <ColorPickerExtEditor
        component={component as Extract<UiComponent, { type: "ColorPicker" }>}
        onChange={onChange as (next: UiComponent) => void}
      />
    );
  },
};
