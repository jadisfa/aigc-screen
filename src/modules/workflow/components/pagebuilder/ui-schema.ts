import { createDefaultComponent } from "./definition/default-ext";

export const UI_SCHEMA_VERSION = 1 as const;

export type UiSchemaVersion = typeof UI_SCHEMA_VERSION;

export type UiSchemaV1 = {
  version: UiSchemaVersion;
  components: UiComponent[];
};

export type UiComponentType =
  | "Seed"
  | "AIAspectRatioSelect"
  | "PositivePrompt"
  | "TemplatePrompt"
  | "ImageUploadAuto"
  | "ImageSelectPreview"
  | "FirstLastFrame"
  | "SingleSelectChip"
  | "MultiSelectChip"
  | "ColorPicker"
  | "ModelSelector"
  | "MultiSourceImageUpload"
  | "CustomNumber"
  | "NumberSlider"
  | "ControlSwitch"
  | "CameraMovement"
  | "LlmModelSelector";

export type UiParamMarks = {
  count?: boolean;
  duration?: boolean;
  resolution?: boolean;
  ratio?: boolean;
  audioVideo?: boolean;
};

export type UiParam = {
  name: string;
  inputKey?: string;
  nodeId: string;
  required: boolean;
  defaultValue?: string;
  marks?: UiParamMarks;
};

export type UiComponentBasic = {
  params: UiParam[];
};

export type UiComponentMcp = {
  description?: string;
  ignore?: boolean;
  dataType?: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  defaultValue?: string;
};

export type UiParamSchemaType = "object" | "array" | "string" | "number" | "boolean" | "null" | "union";

export type UiParamSchemaFormat = "date" | "time" | "date-time" | "email" | "uri" | "regex" | "json";

export type UiParamSchema = {
  type: UiParamSchemaType;
  constraint?: {
    required?: boolean;
    nullable?: boolean;
  };
  meta?: {
    label?: string;
    description?: string;
    tags?: string[];
  };
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: UiParamSchemaFormat;
  enumValues?: string[];
  [k: string]: unknown;
};

export type SeedExt = {
  seedLength: number;
};

export type AIAspectRatioOption = {
  label: string;
  value: string;
  icon?: string;
  billingWeight?: number;
};

export type AIAspectRatioSelectExt = {
  options: AIAspectRatioOption[];
};

export type PromptExtBase = {
  prependPrompt?: string;
  enableLLM?: boolean;
  enableTranslate?: boolean;
  enableAutoTranslate?: boolean;
  aiPresetPrompt?: string;
};

export type PositivePromptExt = PromptExtBase;

export type TemplatePromptVar = {
  name: string;
  options: string[];
};

export type TemplatePromptExt = PromptExtBase & {
  template: string;
  vars: TemplatePromptVar[];
};

const imageUploadAutoFileTypes = ["image", "audio", "video"] as const;

export type ImageUploadAutoFileType = (typeof imageUploadAutoFileTypes)[number];

export type ImageUploadAutoImageRules = {
  maxSizeMB?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  quality?: number | string;
};

export type ImageUploadAutoExt = {
  fileTypes: ImageUploadAutoFileType[];
  imageRules: ImageUploadAutoImageRules;
  /** 工作流执行前是否将媒体公网 URL 物化到算力节点（Comfy 输入目录） */
  enableUploadBeforeRun?: boolean;
};

export type ImageSelectPreviewOption = {
  title: string;
  src?: string;
  value?: string;
  valueExtra?: string;
  values?: string[];
  weight?: number;
};

export type ImageSelectPreviewExt = {
  options: ImageSelectPreviewOption[];
  /** 工作流执行前是否将媒体公网 URL 物化到算力节点（Comfy 输入目录） */
  enableUploadBeforeRun?: boolean;
};

export type FirstLastFrameRecommendation = {
  title: string;
  iconUrl?: string;
};

export type FirstLastFrameExt = {
  maxSizeMB?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  quality?: number | string;
  recommendations: FirstLastFrameRecommendation[];
  /** 工作流执行前是否将媒体公网 URL 物化到算力节点（Comfy 输入目录） */
  enableUploadBeforeRun?: boolean;
};

export type SelectChipOption = {
  title: string;
  value: string;
  billingWeight?: number;
};

export type SingleSelectChipExt = {
  options: SelectChipOption[];
};

export type MultiSelectChipExt = {
  options: SelectChipOption[];
};

export const colorPickerFormats = ["hex", "rgb", "hsl"] as const;

export type ColorPickerFormat = (typeof colorPickerFormats)[number];

export type ColorPickerExt = {
  format: ColorPickerFormat;
};

export type ModelSelectorSourceMode = "fixed" | "dynamic";

export type ModelSelectorFixedOption = {
  label: string;
  modelId: string;
};

export type ModelSelectorExt = {
  sourceMode: ModelSelectorSourceMode;
  fixedOptions: ModelSelectorFixedOption[];
};

export type MultiSourceImageUploadExt = {
  maxSizeMB?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;
  quality?: number | string;
  /** 工作流执行前是否将媒体公网 URL 物化到算力节点（Comfy 输入目录） */
  enableUploadBeforeRun?: boolean;
};

export type CustomNumberExt = {
  min?: number;
  max?: number;
};

export type ControlSwitchExt = {
  onLabel: string;
  offLabel: string;
  onValue: string;
  offValue: string;
};

export type NumberSliderValueMode = "integer" | "float";

export type NumberSliderExt = {
  mode: NumberSliderValueMode;
  min: number;
  max: number;
  step: number;
};

export type CameraMovementOption = SelectChipOption & {
  exclusive?: boolean;
};

export type CameraMovementIntensityLabel = {
  value: number;
  label: string;
};

export type CameraMovementExt = {
  options: CameraMovementOption[];
  intensityMin: number;
  intensityMax: number;
  intensityStep: number;
  intensityLabels: CameraMovementIntensityLabel[];
};

export type LlmModelSelectorExt = {
  capability: string;
};

export type UiComponentCommon = {
  id: string;
  type: UiComponentType;
  title: string;
  position: number;
  basic: UiComponentBasic;
  mcp?: UiComponentMcp;
  schema?: UiParamSchema | Record<string, unknown> | null;
};

export type UiComponent =
  | (UiComponentCommon & { type: "Seed"; ext: SeedExt })
  | (UiComponentCommon & { type: "AIAspectRatioSelect"; ext: AIAspectRatioSelectExt })
  | (UiComponentCommon & { type: "PositivePrompt"; ext: PositivePromptExt })
  | (UiComponentCommon & { type: "TemplatePrompt"; ext: TemplatePromptExt })
  | (UiComponentCommon & { type: "ImageUploadAuto"; ext: ImageUploadAutoExt })
  | (UiComponentCommon & { type: "ImageSelectPreview"; ext: ImageSelectPreviewExt })
  | (UiComponentCommon & { type: "FirstLastFrame"; ext: FirstLastFrameExt })
  | (UiComponentCommon & { type: "SingleSelectChip"; ext: SingleSelectChipExt })
  | (UiComponentCommon & { type: "MultiSelectChip"; ext: MultiSelectChipExt })
  | (UiComponentCommon & { type: "ColorPicker"; ext: ColorPickerExt })
  | (UiComponentCommon & { type: "ModelSelector"; ext: ModelSelectorExt })
  | (UiComponentCommon & { type: "MultiSourceImageUpload"; ext: MultiSourceImageUploadExt })
  | (UiComponentCommon & { type: "CustomNumber"; ext: CustomNumberExt })
  | (UiComponentCommon & { type: "NumberSlider"; ext: NumberSliderExt })
  | (UiComponentCommon & { type: "ControlSwitch"; ext: ControlSwitchExt })
  | (UiComponentCommon & { type: "CameraMovement"; ext: CameraMovementExt })
  | (UiComponentCommon & { type: "LlmModelSelector"; ext: LlmModelSelectorExt });

export function createEmptyUiSchema(): UiSchemaV1 {
  return { version: UI_SCHEMA_VERSION, components: [] };
}

export function normalizePositions(components: UiComponent[]): UiComponent[] {
  return components.map((c, idx) => ({ ...c, position: idx + 1 }));
}

function coerceBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const normalized = v.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return fallback;
}

function coerceNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function coerceEditableNumber(v: unknown): number | string | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    if (trimmed === "-" || trimmed === "." || trimmed === "-." || trimmed.endsWith(".")) return v;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function coerceString(v: unknown, fallback: string): string {
  if (typeof v === "string") return v;
  return fallback;
}

function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : "")).filter((x) => x.trim());
}

function coerceColorPickerFormat(v: unknown, fallback: ColorPickerFormat): ColorPickerFormat {
  if (typeof v !== "string") return fallback;
  return colorPickerFormats.includes(v as ColorPickerFormat) ? (v as ColorPickerFormat) : fallback;
}

function toUiComponentType(v: unknown): UiComponentType | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  const allowed: UiComponentType[] = [
    "Seed",
    "AIAspectRatioSelect",
    "PositivePrompt",
    "TemplatePrompt",
    "ImageUploadAuto",
    "ImageSelectPreview",
    "FirstLastFrame",
    "SingleSelectChip",
    "MultiSelectChip",
    "ColorPicker",
    "ModelSelector",
    "MultiSourceImageUpload",
    "CustomNumber",
    "NumberSlider",
    "ControlSwitch",
    "CameraMovement",
    "LlmModelSelector",
  ];
  return allowed.includes(t as UiComponentType) ? (t as UiComponentType) : null;
}

const legacyTypeMap: Record<string, UiComponentType> = {
  seed: "Seed",
  ratio: "AIAspectRatioSelect",
  "pos-prompt": "PositivePrompt",
  "prompt-tpl": "TemplatePrompt",
  "upload-file": "ImageUploadAuto",
  "img-preprocess": "ImageSelectPreview",
  "first-last-frame": "FirstLastFrame",
  "tag-radio": "SingleSelectChip",
  "tag-multi": "MultiSelectChip",
  "img-pick": "MultiSourceImageUpload",
  "custom-number": "CustomNumber",
  "control-switch": "ControlSwitch",
  "camera-movement": "CameraMovement",
  "llm-model-selector": "LlmModelSelector",
};

function tryCoerceComponent(raw: unknown, position: number): UiComponent | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const typeFromNew = toUiComponentType(obj.type);
  const typeFromLegacy = typeof obj.itemId === "string" ? legacyTypeMap[obj.itemId] : null;
  const type = typeFromNew || typeFromLegacy;
  if (!type) return null;

  const base = createDefaultComponent(type, position);
  const id = typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : base.id;
  const title = typeof obj.title === "string" ? obj.title : typeof obj.label === "string" ? obj.label : base.title;

  const basicRaw = obj.basic && typeof obj.basic === "object" ? (obj.basic as Record<string, unknown>) : null;
  const paramsRaw = basicRaw && Array.isArray(basicRaw.params) ? basicRaw.params : Array.isArray(obj.params) ? obj.params : null;
  const params: UiParam[] = Array.isArray(paramsRaw)
    ? paramsRaw
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const po = p as Record<string, unknown>;
          const marksRaw = po.marks && typeof po.marks === "object" ? (po.marks as Record<string, unknown>) : null;
          const marks: UiParamMarks = {
            count: marksRaw ? coerceBool(marksRaw.count, false) : false,
            duration: marksRaw ? coerceBool(marksRaw.duration, false) : false,
            resolution: marksRaw ? coerceBool(marksRaw.resolution, false) : false,
            ratio: marksRaw ? coerceBool(marksRaw.ratio, false) : false,
            audioVideo: marksRaw ? coerceBool(marksRaw.audioVideo, false) : false,
          };
          const next: UiParam = {
            name: coerceString(po.name ?? po.paramName, ""),
            inputKey: coerceString(po.inputKey ?? po.input_key, ""),
            nodeId: coerceString(po.nodeId ?? po.node_id, ""),
            required: coerceBool(po.required ?? po.isRequired, false),
            defaultValue: typeof po.defaultValue === "string" ? po.defaultValue : "",
            marks,
          };
          const normalizedName = next.name.trim();
          const normalizedInputKey = next.inputKey?.trim() ?? "";
          return {
            ...next,
            name: normalizedName || normalizedInputKey,
            inputKey: normalizedInputKey || normalizedName,
          };
        })
    : base.basic.params;

  const mcpRaw = obj.mcp && typeof obj.mcp === "object" ? (obj.mcp as Record<string, unknown>) : null;
  const mcp: UiComponentMcp = {
    description: mcpRaw ? coerceString(mcpRaw.description, "") : base.mcp?.description ?? "",
    ignore: mcpRaw ? coerceBool(mcpRaw.ignore, false) : false,
    dataType: mcpRaw && typeof mcpRaw.dataType === "string" ? (mcpRaw.dataType as UiComponentMcp["dataType"]) : "string",
    required: mcpRaw ? coerceBool(mcpRaw.required, false) : false,
    defaultValue: mcpRaw ? coerceString(mcpRaw.defaultValue, "") : "",
  };

  const extRaw = obj.ext && typeof obj.ext === "object" ? (obj.ext as Record<string, unknown>) : null;
  const schemaRaw = typeof obj.schema !== "undefined" ? obj.schema : base.schema;
  const schema = schemaRaw == null ? null : typeof schemaRaw === "object" ? (schemaRaw as Record<string, unknown>) : base.schema;

  const common: UiComponentCommon = {
    id,
    type,
    title,
    position,
    basic: { params: params.length ? params : base.basic.params },
    mcp,
    schema,
  };

  if (type === "Seed") {
    return {
      ...common,
      type,
      ext: { seedLength: extRaw ? coerceNumber(extRaw.seedLength ?? extRaw.length, 9) : 9 },
    };
  }
  if (type === "AIAspectRatioSelect") {
    const optionsRaw = extRaw?.options;
    const options: AIAspectRatioOption[] = Array.isArray(optionsRaw)
      ? optionsRaw
          .map((o) => {
            if (!o || typeof o !== "object") return null;
            const oo = o as Record<string, unknown>;
            const next: AIAspectRatioOption = {
              label: coerceString(oo.label ?? oo.title, ""),
              value: coerceString(oo.value, ""),
              icon: typeof oo.icon === "string" && oo.icon.trim() ? oo.icon : undefined,
              billingWeight: typeof oo.billingWeight === "number" ? oo.billingWeight : undefined,
            };
            return next;
          })
          .filter((x): x is AIAspectRatioOption => !!x && !!x.label)
      : [];
    const baseExt = (base as Extract<UiComponent, { type: "AIAspectRatioSelect" }>).ext;
    return { ...common, type, ext: { options: options.length ? options : baseExt.options } };
  }
  if (type === "PositivePrompt") {
    return {
      ...common,
      type,
      ext: {
        prependPrompt: extRaw ? coerceString(extRaw.prependPrompt, "") : "",
        enableLLM: extRaw && typeof extRaw.enableLLM !== "undefined" ? coerceBool(extRaw.enableLLM, true) : true,
        enableTranslate: extRaw ? coerceBool(extRaw.enableTranslate, false) : false,
        enableAutoTranslate: extRaw ? coerceBool(extRaw.enableAutoTranslate, false) : false,
        aiPresetPrompt: extRaw ? coerceString(extRaw.aiPresetPrompt, "") : "",
      },
    };
  }
  if (type === "TemplatePrompt") {
    const varsRaw = extRaw?.vars;
    const vars: TemplatePromptVar[] = Array.isArray(varsRaw)
      ? varsRaw
          .map((v) => {
            if (!v || typeof v !== "object") return null;
            const vv = v as Record<string, unknown>;
            return { name: coerceString(vv.name, ""), options: coerceStringArray(vv.options) };
          })
          .filter((x): x is TemplatePromptVar => !!x && !!x.name)
      : [];
    return {
      ...common,
      type,
      ext: {
        prependPrompt: extRaw ? coerceString(extRaw.prependPrompt, "") : "",
        enableLLM: extRaw && typeof extRaw.enableLLM !== "undefined" ? coerceBool(extRaw.enableLLM, false) : false,
        enableTranslate: extRaw ? coerceBool(extRaw.enableTranslate, false) : false,
        enableAutoTranslate: extRaw ? coerceBool(extRaw.enableAutoTranslate, false) : false,
        aiPresetPrompt: extRaw ? coerceString(extRaw.aiPresetPrompt, "") : "",
        template: (() => {
          const baseExt = (base as Extract<UiComponent, { type: "TemplatePrompt" }>).ext;
          return extRaw ? coerceString(extRaw.template, baseExt.template) : baseExt.template;
        })(),
        vars: (() => {
          const baseExt = (base as Extract<UiComponent, { type: "TemplatePrompt" }>).ext;
          return vars.length ? vars : baseExt.vars;
        })(),
      },
    };
  }
  if (type === "ImageUploadAuto") {
    const fileTypesRaw = extRaw?.fileTypes;
    const coercedFileTypes = Array.isArray(fileTypesRaw) ? coerceStringArray(fileTypesRaw) : [];
    const fileTypes = coercedFileTypes.filter((t): t is ImageUploadAutoFileType =>
      (imageUploadAutoFileTypes as readonly string[]).includes(t),
    );

    const baseExt = (base as Extract<UiComponent, { type: "ImageUploadAuto" }>).ext;

    const imageRulesRaw =
      extRaw?.imageRules && typeof extRaw.imageRules === "object" ? (extRaw.imageRules as Record<string, unknown>) : null;

    const fallbackRules = baseExt.imageRules;
    const imageRules: ImageUploadAutoImageRules = {
      maxSizeMB:
        imageRulesRaw
          ? typeof imageRulesRaw.maxSizeMB !== "undefined"
            ? coerceEditableNumber(imageRulesRaw.maxSizeMB)
            : undefined
          : extRaw && typeof extRaw.maxSizeMB !== "undefined"
            ? coerceEditableNumber(extRaw.maxSizeMB)
            : fallbackRules.maxSizeMB,
      maxWidth:
        imageRulesRaw
          ? typeof imageRulesRaw.maxWidth !== "undefined"
            ? coerceEditableNumber(imageRulesRaw.maxWidth)
            : undefined
          : extRaw && typeof extRaw.maxWidth !== "undefined"
            ? coerceEditableNumber(extRaw.maxWidth)
            : fallbackRules.maxWidth,
      maxHeight:
        imageRulesRaw
          ? typeof imageRulesRaw.maxHeight !== "undefined"
            ? coerceEditableNumber(imageRulesRaw.maxHeight)
            : undefined
          : extRaw && typeof extRaw.maxHeight !== "undefined"
            ? coerceEditableNumber(extRaw.maxHeight)
            : fallbackRules.maxHeight,
      quality:
        imageRulesRaw
          ? typeof imageRulesRaw.quality !== "undefined"
            ? coerceEditableNumber(imageRulesRaw.quality)
            : undefined
          : extRaw && typeof extRaw.quality !== "undefined"
            ? coerceEditableNumber(extRaw.quality)
            : fallbackRules.quality,
    };

    return {
      ...common,
      type,
      ext: {
        fileTypes: fileTypes.length ? fileTypes : baseExt.fileTypes,
        imageRules,
        enableUploadBeforeRun:
          extRaw && typeof extRaw.enableUploadBeforeRun !== "undefined"
            ? coerceBool(extRaw.enableUploadBeforeRun, true)
            : (baseExt.enableUploadBeforeRun ?? true),
      },
    };
  }
  if (type === "ImageSelectPreview") {
    const optionsRaw = extRaw?.options;
    const options: ImageSelectPreviewOption[] = Array.isArray(optionsRaw)
      ? optionsRaw
          .map((o) => {
            if (!o || typeof o !== "object") return null;
            const oo = o as Record<string, unknown>;
            const next: ImageSelectPreviewOption = {
              title: coerceString(oo.title ?? oo.label, ""),
              src: coerceString(oo.src ?? oo.imageUrl ?? oo.image, ""),
              value: coerceString(oo.value ?? oo.param1Value, ""),
              valueExtra: coerceString(oo.valueExtra ?? oo.param2Value, ""),
              values: Array.isArray(oo.values) ? coerceStringArray(oo.values) : undefined,
              weight:
                typeof oo.weight !== "undefined"
                  ? coerceNumber(oo.weight, 1)
                  : typeof oo.billingWeight !== "undefined"
                    ? coerceNumber(oo.billingWeight, 1)
                    : undefined,
            };
            return next;
          })
          .filter((x): x is ImageSelectPreviewOption => !!x && !!x.title)
      : [];
    const baseExt = (base as Extract<UiComponent, { type: "ImageSelectPreview" }>).ext;
    return {
      ...common,
      type,
      ext: {
        options: options.length ? options : baseExt.options,
        enableUploadBeforeRun:
          extRaw && typeof extRaw.enableUploadBeforeRun !== "undefined"
            ? coerceBool(extRaw.enableUploadBeforeRun, baseExt.enableUploadBeforeRun ?? false)
            : (baseExt.enableUploadBeforeRun ?? false),
      },
    };
  }
  if (type === "FirstLastFrame") {
    const baseExt = (base as Extract<UiComponent, { type: "FirstLastFrame" }>).ext;
    const recommendationsRaw = extRaw?.recommendations;
    const recommendations: FirstLastFrameRecommendation[] = Array.isArray(recommendationsRaw)
      ? recommendationsRaw
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const recommendation = item as Record<string, unknown>;
            return {
              title: coerceString(recommendation.title ?? recommendation.label, ""),
              iconUrl: coerceString(
                recommendation.iconUrl ??
                recommendation.icon ??
                recommendation.imageUrl ??
                recommendation.firstFrameUrl ??
                recommendation.firstFrame ??
                recommendation.startFrameUrl ??
                recommendation.lastFrameUrl ??
                recommendation.lastFrame ??
                recommendation.endFrameUrl,
                "",
              ),
            };
          })
          .filter((item) => !!item.title)
      : [];
    return {
      ...common,
      type,
      ext: {
        maxSizeMB: extRaw
          ? typeof extRaw.maxSizeMB !== "undefined"
            ? coerceEditableNumber(extRaw.maxSizeMB)
            : undefined
          : baseExt.maxSizeMB,
        maxWidth: extRaw
          ? typeof extRaw.maxWidth !== "undefined"
            ? coerceEditableNumber(extRaw.maxWidth)
            : undefined
          : baseExt.maxWidth,
        maxHeight: extRaw
          ? typeof extRaw.maxHeight !== "undefined"
            ? coerceEditableNumber(extRaw.maxHeight)
            : undefined
          : baseExt.maxHeight,
        quality: extRaw
          ? typeof extRaw.quality !== "undefined"
            ? coerceEditableNumber(extRaw.quality)
            : undefined
          : baseExt.quality,
        recommendations: Array.isArray(recommendationsRaw) ? recommendations : baseExt.recommendations,
        enableUploadBeforeRun:
          extRaw && typeof extRaw.enableUploadBeforeRun !== "undefined"
            ? coerceBool(extRaw.enableUploadBeforeRun, true)
            : (baseExt.enableUploadBeforeRun ?? true),
      },
    };
  }
  if (type === "SingleSelectChip" || type === "MultiSelectChip") {
    const optionsRaw = extRaw?.options;
    const options: SelectChipOption[] = Array.isArray(optionsRaw)
      ? optionsRaw
          .map((o) => {
            if (!o || typeof o !== "object") return null;
            const oo = o as Record<string, unknown>;
            const next: SelectChipOption = {
              title: coerceString(oo.title ?? oo.label, ""),
              value: coerceString(oo.value, ""),
              billingWeight: typeof oo.billingWeight === "number" ? oo.billingWeight : undefined,
            };
            return next;
          })
          .filter((x): x is SelectChipOption => !!x)
      : [];
    const baseExt = (base as Extract<UiComponent, { type: "SingleSelectChip" | "MultiSelectChip" }>).ext;
    return { ...common, type, ext: { options: Array.isArray(optionsRaw) ? options : baseExt.options } } as UiComponent;
  }
  if (type === "ColorPicker") {
    const baseExt = (base as Extract<UiComponent, { type: "ColorPicker" }>).ext;
    return {
      ...common,
      type,
      ext: {
        format: extRaw ? coerceColorPickerFormat(extRaw.format ?? extRaw.colorFormat, baseExt.format) : baseExt.format,
      },
    };
  }
  if (type === "ModelSelector") {
    const fixedOptionsRaw = extRaw?.fixedOptions;
    const fixedOptions: ModelSelectorFixedOption[] = Array.isArray(fixedOptionsRaw)
      ? fixedOptionsRaw
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const option = item as Record<string, unknown>;
            return {
              label: coerceString(option.label ?? option.name ?? option.title, ""),
              modelId: coerceString(option.modelId ?? option.value ?? option.id, ""),
            };
          })
          .filter((item): item is ModelSelectorFixedOption => !!item && (!!item.label || !!item.modelId))
      : [];
    const baseExt = (base as Extract<UiComponent, { type: "ModelSelector" }>).ext;
    const sourceMode = extRaw?.sourceMode === "dynamic" ? "dynamic" : "fixed";
    return {
      ...common,
      type,
      ext: {
        sourceMode,
        fixedOptions: Array.isArray(fixedOptionsRaw) ? fixedOptions : baseExt.fixedOptions,
      },
    };
  }
  if (type === "CustomNumber") {
    return {
      ...common,
      type,
      ext: {},
    };
  }
  if (type === "NumberSlider") {
    const baseExt = (base as Extract<UiComponent, { type: "NumberSlider" }>).ext;
    return {
      ...common,
      type,
      ext: {
        mode: extRaw?.mode === "float" ? "float" : baseExt.mode,
        min: extRaw && typeof extRaw.min !== "undefined" ? coerceNumber(extRaw.min, baseExt.min) : baseExt.min,
        max: extRaw && typeof extRaw.max !== "undefined" ? coerceNumber(extRaw.max, baseExt.max) : baseExt.max,
        step: extRaw && typeof extRaw.step !== "undefined" ? coerceNumber(extRaw.step, baseExt.step) : baseExt.step,
      },
    };
  }
  if (type === "ControlSwitch") {
    const baseExt = (base as Extract<UiComponent, { type: "ControlSwitch" }>).ext;
    return {
      ...common,
      type,
      ext: {
        onLabel: extRaw && typeof extRaw.onLabel !== "undefined" ? coerceString(extRaw.onLabel, baseExt.onLabel) : baseExt.onLabel,
        offLabel: extRaw && typeof extRaw.offLabel !== "undefined" ? coerceString(extRaw.offLabel, baseExt.offLabel) : baseExt.offLabel,
        onValue: extRaw && typeof extRaw.onValue !== "undefined" ? coerceString(extRaw.onValue, baseExt.onValue) : baseExt.onValue,
        offValue: extRaw && typeof extRaw.offValue !== "undefined" ? coerceString(extRaw.offValue, baseExt.offValue) : baseExt.offValue,
      },
    };
  }
  if (type === "CameraMovement") {
    const baseExt = (base as Extract<UiComponent, { type: "CameraMovement" }>).ext;
    const optionsRaw = extRaw?.options;
    const options: CameraMovementOption[] = Array.isArray(optionsRaw)
      ? optionsRaw
          .map((o) => {
            if (!o || typeof o !== "object") return null;
            const oo = o as Record<string, unknown>;
            const next: CameraMovementOption = {
              title: coerceString(oo.title ?? oo.label, ""),
              value: coerceString(oo.value, ""),
              billingWeight: typeof oo.billingWeight === "number" ? oo.billingWeight : undefined,
              exclusive: typeof oo.exclusive === "undefined" ? undefined : coerceBool(oo.exclusive, false),
            };
            return next;
          })
          .filter((x): x is CameraMovementOption => !!x)
      : [];
    const labelsRaw = extRaw?.intensityLabels;
    const intensityLabels: CameraMovementIntensityLabel[] = Array.isArray(labelsRaw)
      ? labelsRaw
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const label = item as Record<string, unknown>;
            const value = coerceNumber(label.value, Number.NaN);
            if (!Number.isFinite(value)) return null;
            return { value, label: coerceString(label.label ?? label.title, "") };
          })
          .filter((item): item is CameraMovementIntensityLabel => !!item)
      : [];
    return {
      ...common,
      type,
      ext: {
        options: Array.isArray(optionsRaw) ? options : baseExt.options,
        intensityMin: extRaw && typeof extRaw.intensityMin !== "undefined" ? coerceNumber(extRaw.intensityMin, baseExt.intensityMin) : baseExt.intensityMin,
        intensityMax: extRaw && typeof extRaw.intensityMax !== "undefined" ? coerceNumber(extRaw.intensityMax, baseExt.intensityMax) : baseExt.intensityMax,
        intensityStep: extRaw && typeof extRaw.intensityStep !== "undefined" ? coerceNumber(extRaw.intensityStep, baseExt.intensityStep) : baseExt.intensityStep,
        intensityLabels: Array.isArray(labelsRaw) ? intensityLabels : baseExt.intensityLabels,
      },
    };
  }
  if (type === "LlmModelSelector") {
    const baseExt = (base as Extract<UiComponent, { type: "LlmModelSelector" }>).ext;
    return {
      ...common,
      type,
      ext: {
        capability: extRaw && typeof extRaw.capability !== "undefined"
          ? coerceString(extRaw.capability, baseExt.capability)
          : baseExt.capability,
      },
    };
  }

  const normalizedMultiSourceExt = {
    maxSizeMB: extRaw && typeof extRaw.maxSizeMB !== "undefined" ? coerceEditableNumber(extRaw.maxSizeMB) : undefined,
    maxWidth: extRaw && typeof extRaw.maxWidth !== "undefined" ? coerceEditableNumber(extRaw.maxWidth) : undefined,
    maxHeight: extRaw && typeof extRaw.maxHeight !== "undefined" ? coerceEditableNumber(extRaw.maxHeight) : undefined,
    quality: extRaw && typeof extRaw.quality !== "undefined" ? coerceEditableNumber(extRaw.quality) : undefined,
    enableUploadBeforeRun:
      extRaw && typeof extRaw.enableUploadBeforeRun !== "undefined"
        ? coerceBool(extRaw.enableUploadBeforeRun, true)
        : true,
  };
  return {
    ...common,
    type: "MultiSourceImageUpload",
    ext: normalizedMultiSourceExt,
  };
}

export function parseUiSchemaText(input: string): { ok: true; value: UiSchemaV1 } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, message: "ui_schema 不能为空" };
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, message: `ui_schema 不是合法 JSON：${e instanceof Error ? e.message : "parse error"}` };
  }

  if (Array.isArray(raw)) {
    const components = raw
      .map((x, idx) => tryCoerceComponent(x, idx + 1))
      .filter((x): x is UiComponent => !!x);
    return { ok: true, value: { version: UI_SCHEMA_VERSION, components: normalizePositions(components) } };
  }

  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "ui_schema 必须为对象或数组" };
  }

  const obj = raw as Record<string, unknown>;
  const version = typeof obj.version === "number" ? obj.version : typeof obj.version === "string" ? Number(obj.version) : null;
  const componentsRaw = obj.components;

  if (version !== UI_SCHEMA_VERSION) {
    return { ok: false, message: `ui_schema.version 必须为 ${UI_SCHEMA_VERSION}` };
  }
  if (!Array.isArray(componentsRaw)) {
    return { ok: false, message: "ui_schema.components 必须为数组" };
  }

  const components = componentsRaw
    .map((x, idx) => tryCoerceComponent(x, idx + 1))
    .filter((x): x is UiComponent => !!x);

  return { ok: true, value: { version: UI_SCHEMA_VERSION, components: normalizePositions(components) } };
}

export function normalizeUiSchemaText(input: string): { ok: true; text: string; value: UiSchemaV1 } | { ok: false; message: string } {
  const parsed = parseUiSchemaText(input);
  if (parsed.ok === false) return parsed;
  const normalized: UiSchemaV1 = { version: UI_SCHEMA_VERSION, components: normalizePositions(parsed.value.components) };
  return { ok: true, value: normalized, text: JSON.stringify(normalized, null, 2) };
}
