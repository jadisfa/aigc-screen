import type {
  ModelHubCatalogPicker,
  ModelHubCatalogPickerModel,
  ModelHubCatalogPickerProvider,
} from "@/shared/api/model-hub/model-hub";
import type { FieldConstraintMap } from "./constraints";
import { pricingFromPicker, type RuntimePricing } from "./pricing";
import { toFiniteNumber } from "./values";

export function modelPickerCatalogQueryKey(capability: string) {
  return ["model-picker-catalog", capability] as const;
}

export type DisplayProvider = ModelHubCatalogPickerProvider & {
  label: string;
  isNew: boolean;
};

export type DisplayModel = ModelHubCatalogPickerModel & {
  displayName: string;
  providerLabel: string;
  isNew: boolean;
  isRecommended: boolean;
};

type RuntimeModelSnapshot = {
  fields: FieldConstraintMap;
  pricing: RuntimePricing | null;
};

const UNIT_LABEL: Record<string, string> = {
  second: "秒",
  seconds: "秒",
  sec: "秒",
  duration: "秒",
  video_seconds: "秒",
  audio_seconds: "秒",
  image: "张",
  images: "张",
  image_count: "张",
  token: "Token",
  tokens: "Token",
  char: "字符",
  chars: "字符",
  character: "字符",
  hour: "小时",
  hours: "小时",
  request: "次",
  requests: "次",
  times: "次",
  次: "次",
  次请求: "次",
  task: "任务",
  tasks: "任务",
  step: "步",
  steps: "步",
};

function formatAmount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(8).replace(/0+$/g, "").replace(/\.$/, "");
}

function inferUnitFromRaw(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("request") || raw.includes("次")) return "次";
  if (lower.includes("second") || lower.includes("sec") || lower.includes("duration") || raw.includes("秒")) return "秒";
  if (lower.includes("image") || raw.includes("张")) return "张";
  if (lower.includes("token")) return raw.replace(/tokens?/gi, "Token");
  if (lower.includes("char") || raw.includes("字符")) return raw.replace(/chars?/gi, "字符");
  if (lower.includes("hour") || raw.includes("小时")) return "小时";
  if (lower.includes("task") || raw.includes("任务")) return "任务";
  if (lower.includes("step") || raw.includes("步")) return "步";
  return raw;
}

function localizePricingUnit(pricingUnit: string | null | undefined): string {
  const raw = (pricingUnit ?? "").trim();
  if (!raw || raw.toLowerCase() === "unit") return "";
  return UNIT_LABEL[raw] ?? UNIT_LABEL[raw.toLowerCase()] ?? inferUnitFromRaw(raw);
}

function positiveAmount(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n != null && n > 0 ? n : null;
}

export function formatPickerPriceLabel(
  model: Pick<ModelHubCatalogPickerModel, "pricing"> | null | undefined,
): string | null {
  const pricing = model?.pricing;
  if (!pricing) return null;
  const amounts = [pricing.unitPrice, ...(pricing.rateCard ?? []).map((row) => row.unitPrice)]
    .map(positiveAmount)
    .filter((n): n is number => n != null);
  if (amounts.length === 0) return null;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const amount = max > min ? `${formatAmount(min)}~${formatAmount(max)}` : formatAmount(min);
  const unit = localizePricingUnit(pricing.pricingUnit);
  return unit ? `${amount}元/${unit}` : `${amount}元`;
}

function text(value: string | null | undefined, fallback = ""): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function toSelectorCatalog(data: ModelHubCatalogPicker | null | undefined): {
  providers: DisplayProvider[];
  models: DisplayModel[];
} {
  const providers = (data?.providers ?? []).map((item) => ({
    ...item,
    label: text(item.displayName, item.providerCode),
    isNew: item.isNew === true,
  }));
  const providerLabelById = new Map(providers.map((item) => [item.id, item.label]));
  const models = (data?.models ?? []).map((item) => ({
    ...item,
    displayName: text(item.name, item.code),
    providerLabel: providerLabelById.get(item.providerId) || text(item.providerCode),
    isNew: item.isNew === true,
    isRecommended: item.isRecommended === true,
  }));
  return { providers, models };
}

function fieldConstraintsFromPickerParamSchema(
  schema: NonNullable<ModelHubCatalogPickerModel["paramSchema"]> | null | undefined,
): FieldConstraintMap {
  if (!schema) return {};
  const fields: FieldConstraintMap = {};
  if (schema.minDurationSeconds != null || schema.maxDurationSeconds != null || schema.defaultDurationSeconds != null) {
    fields.duration = {
      min: schema.minDurationSeconds ?? undefined,
      max: schema.maxDurationSeconds ?? undefined,
      default: schema.defaultDurationSeconds ?? undefined,
    };
  }
  if (schema.resolutions?.length) {
    fields.resolution = {
      allowed: schema.resolutions,
      default: schema.defaultResolution ?? undefined,
    };
  }
  if (schema.aspectRatios?.length) {
    const ratio = {
      allowed: schema.aspectRatios,
      default: schema.defaultAspectRatio ?? undefined,
    };
    fields.aspect_ratio = ratio;
    fields.ratio = ratio;
  }
  if (schema.frameRates?.length) {
    fields.framepersecond = {
      allowed: schema.frameRates,
      default: schema.defaultFrameRate ?? undefined,
    };
  }
  return fields;
}

export function snapshotFromPickerModel(
  model: Pick<ModelHubCatalogPickerModel, "paramSchema" | "pricing"> | null | undefined,
): RuntimeModelSnapshot {
  if (!model) return { fields: {}, pricing: null };
  return {
    fields: fieldConstraintsFromPickerParamSchema(model.paramSchema),
    pricing: pricingFromPicker(model.pricing),
  };
}

export function modelMatchesQuery(model: DisplayModel, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [model.displayName, model.name, model.code, model.description ?? "", model.providerLabel]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function pickDefaultModel(models: DisplayModel[]): DisplayModel | undefined {
  return models.find((item) => item.isRecommended) ?? models[0];
}
