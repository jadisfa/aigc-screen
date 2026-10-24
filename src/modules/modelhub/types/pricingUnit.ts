export type PricingUnitKind = "token" | "image" | "second" | "char" | "hour" | "request" | "step" | "task" | "unit";

export const DEFAULT_UNIT_BY_KIND: Record<PricingUnitKind, string> = {
  token: "1M tokens",
  image: "image",
  second: "second",
  char: "1K chars",
  hour: "hour",
  request: "request",
  step: "step",
  task: "task",
  unit: "unit",
};

const CAPABILITY_BILLING_UNIT_KINDS: Record<string, PricingUnitKind[]> = {
  text_generation: ["token"],
  deep_thinking: ["token"],
  translation: ["token"],
  role_play: ["token"],
  text_understanding: ["token"],
  text_embedding: ["token"],
  multimodal_embedding: ["token"],
  image_generation: ["image", "token"],
  image_understanding: ["token"],
  video_generation: ["second", "token"],
  video_understanding: ["token"],
  three_d_generation: ["token", "request"],
  speech_recognition: ["second", "token"],
  speech_synthesis: ["char"],
  ai_dubbing: ["char"],
  music_generation: ["second", "task", "request"],
  speech_understanding: ["second"],
  tool_calling: ["request"],
  resource_gpu: ["hour"],
};

export function getCapabilityBillingUnitKinds(capabilityCode: string): PricingUnitKind[] {
  return CAPABILITY_BILLING_UNIT_KINDS[capabilityCode] || ["token"];
}

export function getDefaultUnitForKind(kind: PricingUnitKind) {
  return DEFAULT_UNIT_BY_KIND[kind];
}

export function getBillingUnitKindLabel(kind: PricingUnitKind) {
  if (kind === "token") return "按 Token";
  if (kind === "image") return "按图片数量";
  if (kind === "second") return "按时长";
  if (kind === "char") return "按字符";
  if (kind === "hour") return "按小时";
  if (kind === "request") return "按次";
  if (kind === "step") return "按步";
  if (kind === "task") return "按任务";
  return "按单位";
}

export type PricingUnitDescriptor = {
  rawUnit: string;
  normalizedUnit: string;
  divisor: number;
  displayLabel: string;
  rawQuantityLabel: string;
  kind: PricingUnitKind;
};

const TOKEN_PRIMARY_METERS = new Set(["input_token", "output_token", "reasoning_token", "cache_hit_token"]);
const IMAGE_PRIMARY_METERS = new Set(["image_count"]);
const CHAR_PRIMARY_METERS = new Set(["char_count"]);
const DURATION_PRIMARY_METERS = new Set(["duration"]);

function formatNumber(value: number, maxFractionDigits = 8) {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(maxFractionDigits).replace(/0+$/g, "").replace(/\.$/, "");
}

function normalizeUnitToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildDescriptor(
  rawUnit: string,
  normalizedUnit: string,
  divisor: number,
  displayLabel: string,
  rawQuantityLabel: string,
  kind: PricingUnitKind,
): PricingUnitDescriptor {
  return {
    rawUnit,
    normalizedUnit,
    divisor,
    displayLabel,
    rawQuantityLabel,
    kind,
  };
}

function formatCountDisplayLabel(amount: number, singularLabel: string, pluralLabel: string) {
  return amount === 1 ? singularLabel : `${formatNumber(amount)} ${pluralLabel}`;
}

function getDefaultUnitDescriptor(fallbackKind: PricingUnitKind, rawUnit: string): PricingUnitDescriptor {
  if (fallbackKind === "token") {
    return buildDescriptor(rawUnit, "token", 1, "token", "tokens", "token");
  }
  if (fallbackKind === "image") {
    return buildDescriptor(rawUnit, "image", 1, "image", "images", "image");
  }
  if (fallbackKind === "second") {
    return buildDescriptor(rawUnit, "second", 1, "second", "seconds", "second");
  }
  if (fallbackKind === "char") {
    return buildDescriptor(rawUnit, "char", 1, "char", "chars", "char");
  }
  if (fallbackKind === "hour") {
    return buildDescriptor(rawUnit, "hour", 1, "hour", "hours", "hour");
  }
  if (fallbackKind === "request") {
    return buildDescriptor(rawUnit, "request", 1, "request", "requests", "request");
  }
  if (fallbackKind === "step") {
    return buildDescriptor(rawUnit, "step", 1, "step", "steps", "step");
  }
  if (fallbackKind === "task") {
    return buildDescriptor(rawUnit, "task", 1, "task", "tasks", "task");
  }
  return buildDescriptor(rawUnit, "unit", 1, "unit", "units", "unit");
}

export function isTokenPrimaryMeter(primaryMeter: string) {
  return TOKEN_PRIMARY_METERS.has(primaryMeter);
}

function buildQuantityUnitDescriptor(
  normalized: string,
  rawUnit: string,
  singularPattern: RegExp,
  singularLabel: string,
  pluralLabel: string,
  kind: PricingUnitKind,
) {
  const match = normalized.match(singularPattern);
  if (!match) return null;

  const amount = Number(match[1] || 1);
  const magnitude = (match[2] || "").toLowerCase();
  const multiplier = magnitude === "m" ? 1000000 : magnitude === "k" ? 1000 : 1;
  const divisor = amount * multiplier;
  const displayLabel =
    divisor === 1
      ? singularLabel
      : magnitude
        ? `${formatNumber(amount)}${magnitude.toUpperCase()} ${pluralLabel}`
        : formatCountDisplayLabel(amount, singularLabel, pluralLabel);

  return buildDescriptor(rawUnit, singularLabel, divisor, displayLabel, pluralLabel, kind);
}

function buildDurationUnitDescriptor(
  normalized: string,
  rawUnit: string,
  fallbackKind: "second" | "hour",
) {
  const rawQuantityLabel = fallbackKind === "hour" ? "hours" : "seconds";

  const secondMatch = normalized.match(/^(\d+(?:\.\d+)?)?\s*(seconds?|secs?|s|秒)$/i);
  if (secondMatch) {
    const amount = Number(secondMatch[1] || 1);
    const divisor = fallbackKind === "hour" ? amount / 3600 : amount;
    const displayLabel = amount === 1 ? "second" : `${formatNumber(amount)} seconds`;
    return buildDescriptor(rawUnit, "second", divisor, displayLabel, rawQuantityLabel, fallbackKind);
  }

  const minuteMatch = normalized.match(/^(\d+(?:\.\d+)?)?\s*(minutes?|mins?|分钟)$/i);
  if (minuteMatch) {
    const amount = Number(minuteMatch[1] || 1);
    const divisor = fallbackKind === "hour" ? amount / 60 : amount * 60;
    const displayLabel = amount === 1 ? "minute" : `${formatNumber(amount)} minutes`;
    return buildDescriptor(rawUnit, "minute", divisor, displayLabel, rawQuantityLabel, fallbackKind);
  }

  const hourMatch = normalized.match(/^(\d+(?:\.\d+)?)?\s*(hours?|hrs?|h|小时)$/i);
  if (hourMatch) {
    const amount = Number(hourMatch[1] || 1);
    const divisor = fallbackKind === "hour" ? amount : amount * 3600;
    const displayLabel = amount === 1 ? "hour" : `${formatNumber(amount)} hours`;
    return buildDescriptor(rawUnit, "hour", divisor, displayLabel, rawQuantityLabel, fallbackKind);
  }

  return null;
}

export function resolvePricingUnitDescriptor(
  unit: string | null | undefined,
  fallbackKind: PricingUnitKind = "unit",
): PricingUnitDescriptor {
  const rawUnit = String(unit || "").trim();
  const normalized = normalizeUnitToken(rawUnit);

  if (!normalized) {
    return getDefaultUnitDescriptor(fallbackKind, rawUnit);
  }

  const tokenDescriptor = buildQuantityUnitDescriptor(
    normalized,
    rawUnit,
    /^(\d+(?:\.\d+)?)?\s*([km])?\s*tokens?$/i,
    "token",
    "tokens",
    "token",
  );
  if (tokenDescriptor) {
    return tokenDescriptor;
  }

  const imageDescriptor = buildQuantityUnitDescriptor(
    normalized,
    rawUnit,
    /^(\d+(?:\.\d+)?)?\s*([km])?\s*(images?|张)$/i,
    "image",
    "images",
    "image",
  );
  if (imageDescriptor) {
    return imageDescriptor;
  }

  if (fallbackKind === "second" || fallbackKind === "hour") {
    const durationDescriptor = buildDurationUnitDescriptor(normalized, rawUnit, fallbackKind);
    if (durationDescriptor) {
      return durationDescriptor;
    }
  }

  const charDescriptor = buildQuantityUnitDescriptor(
    normalized,
    rawUnit,
    /^(\d+(?:\.\d+)?)?\s*([km])?\s*(chars?|characters?|字符)$/i,
    "char",
    "chars",
    "char",
  );
  if (charDescriptor) {
    return charDescriptor;
  }

  const requestDescriptor = buildQuantityUnitDescriptor(
    normalized,
    rawUnit,
    /^(\d+(?:\.\d+)?)?\s*([km])?\s*(requests?|次请求)$/i,
    "request",
    "requests",
    "request",
  );
  if (requestDescriptor) {
    return requestDescriptor;
  }

  const stepDescriptor = buildQuantityUnitDescriptor(
    normalized,
    rawUnit,
    /^(\d+(?:\.\d+)?)?\s*([km])?\s*(steps?|步)$/i,
    "step",
    "steps",
    "step",
  );
  if (stepDescriptor) {
    return stepDescriptor;
  }

  const taskDescriptor = buildQuantityUnitDescriptor(
    normalized,
    rawUnit,
    /^(\d+(?:\.\d+)?)?\s*([km])?\s*(tasks?|个任务)$/i,
    "task",
    "tasks",
    "task",
  );
  if (taskDescriptor) {
    return taskDescriptor;
  }

  return getDefaultUnitDescriptor(fallbackKind, rawUnit);
}

export function convertToBillingQuantity(
  rawQuantity: number,
  unit: string | null | undefined,
  fallbackKind: PricingUnitKind = "unit",
) {
  const descriptor = resolvePricingUnitDescriptor(unit, fallbackKind);
  return rawQuantity / descriptor.divisor;
}

export function buildScaledPricingFormula(
  basePrice: number,
  rawQuantity: number,
  unit: string | null | undefined,
  fallbackKind: PricingUnitKind = "unit",
) {
  const descriptor = resolvePricingUnitDescriptor(unit, fallbackKind);
  if (Math.abs(descriptor.divisor - 1) < 1e-9) {
    return `${formatNumber(basePrice)} × ${formatNumber(rawQuantity)} ${descriptor.rawQuantityLabel}`;
  }

  return `${formatNumber(basePrice)} × (${formatNumber(rawQuantity)} ${descriptor.rawQuantityLabel} / ${formatNumber(descriptor.divisor)})`;
}

export function resolveCapabilityUnitKind(
  capabilityCode: string,
  currentUnit: string,
  explicitKind?: string | null,
): PricingUnitKind {
  const allowed = getCapabilityBillingUnitKinds(capabilityCode);
  if (explicitKind && allowed.includes(explicitKind as PricingUnitKind)) {
    return explicitKind as PricingUnitKind;
  }

  const inferred = resolvePricingUnitDescriptor(currentUnit, allowed[0] || "unit").kind;
  if (allowed.includes(inferred)) {
    return inferred;
  }
  return allowed[0] || "unit";
}

export function resolvePricingUnitKindForContext(
  capabilityCode: string,
  capabilityType: string,
  primaryMeter: string,
  currentUnit: string,
  explicitKind?: string | null,
): PricingUnitKind | null {
  if (CAPABILITY_BILLING_UNIT_KINDS[capabilityCode]) {
    return resolveCapabilityUnitKind(capabilityCode, currentUnit, explicitKind);
  }

  const currentDescriptor = resolvePricingUnitDescriptor(
    currentUnit,
    capabilityType === "gpu_resource" ? "hour" : "unit",
  );

  if (currentUnit.trim() && currentDescriptor.kind !== "unit") {
    return currentDescriptor.kind;
  }

  if (capabilityCode === "tool_calling") return "request";
  if (capabilityType === "three_d") return "token";
  if (capabilityType === "gpu_resource") return "hour";
  if (isTokenPrimaryMeter(primaryMeter)) return "token";
  if (IMAGE_PRIMARY_METERS.has(primaryMeter)) return "image";
  if (CHAR_PRIMARY_METERS.has(primaryMeter)) return "char";
  if (DURATION_PRIMARY_METERS.has(primaryMeter)) return "second";
  if (primaryMeter === "step") return "step";
  if (primaryMeter === "request") return "request";

  return null;
}

export function getPricingUnitOptionsForContext(
  capabilityCode: string,
  capabilityType: string,
  primaryMeter: string,
  currentUnit: string,
  explicitKind?: string | null,
) {
  const kind = resolvePricingUnitKindForContext(capabilityCode, capabilityType, primaryMeter, currentUnit, explicitKind);
  if (!kind) {
    return [];
  }

  let options: Array<{ label: string; value: string }> = [];
  if (kind === "token") {
    options = [
      { label: "百万 Tokens", value: "1M tokens" },
      { label: "1K Tokens", value: "1K tokens" },
      { label: "Token", value: "token" },
    ];
  } else if (kind === "image") {
    options = [
      { label: "张", value: "image" },
      { label: "10 张", value: "10 images" },
      { label: "100 张", value: "100 images" },
    ];
  } else if (kind === "second") {
    options = [
      { label: "秒", value: "second" },
      { label: "分钟", value: "minute" },
    ];
  } else if (kind === "hour") {
    options = [
      { label: "分钟", value: "minute" },
      { label: "小时", value: "hour" },
    ];
  } else if (kind === "char") {
    options = [
      { label: "千字符", value: "1K chars" },
      { label: "百万字符", value: "1M chars" },
      { label: "单字符", value: "char" },
    ];
  } else if (kind === "request") {
    options = [
      { label: "次", value: "request" },
      { label: "10 次", value: "10 requests" },
      { label: "100 次", value: "100 requests" },
    ];
  } else if (kind === "step") {
    options = [
      { label: "单步", value: "step" },
      { label: "10 步", value: "10 steps" },
      { label: "100 步", value: "100 steps" },
    ];
  } else if (kind === "task") {
    options = [
      { label: "任务次", value: "task" },
      { label: "10 任务", value: "10 tasks" },
      { label: "100 任务", value: "100 tasks" },
    ];
  }

  const normalizedCurrent = String(currentUnit || "").trim();
  if (normalizedCurrent && !options.some((option) => option.value === normalizedCurrent)) {
    return [...options, { label: normalizedCurrent, value: normalizedCurrent }];
  }

  return options;
}

export function getSuggestedBasePriceStep(
  capabilityCode: string,
  capabilityType: string,
  primaryMeter: string,
  unit: string,
) {
  const kind = resolvePricingUnitKindForContext(capabilityCode, capabilityType, primaryMeter, unit);
  if (!kind) {
    return "0.01";
  }

  const descriptor = resolvePricingUnitDescriptor(unit, kind);
  if (kind === "token") {
    if (descriptor.divisor >= 1000000) return "0.000001";
    if (descriptor.divisor >= 1000) return "0.0001";
    return "0.000001";
  }
  if (kind === "char") {
    if (descriptor.divisor >= 1000) return "0.0001";
    if (descriptor.divisor >= 100) return "0.001";
    return "0.0001";
  }
  if (kind === "image" || kind === "request" || kind === "step" || kind === "task") {
    if (descriptor.divisor >= 100) return "0.001";
    return "0.01";
  }
  return "0.01";
}

export function buildPricingUnitHint(
  capabilityCode: string,
  capabilityType: string,
  primaryMeter: string,
  unit: string,
) {
  const kind = resolvePricingUnitKindForContext(capabilityCode, capabilityType, primaryMeter, unit);
  if (!kind) {
    return "";
  }

  const descriptor = resolvePricingUnitDescriptor(unit, kind);
  if (kind === "token") {
    if (descriptor.divisor === 1) {
      return "当前按每个 Token 计价。若单价非常小，建议切换为 1K Tokens 或 1M Tokens 口径。";
    }

    return `当前按每 ${descriptor.displayLabel} 计价；例如 1500 Tokens 会折算为 ${formatNumber(1500 / descriptor.divisor)} 个计费单位。`;
  }

  if (kind === "image") {
    if (descriptor.divisor === 1) {
      return "当前按单张图片计价。若单价较低，可切换为 10 张或 100 张口径。";
    }
    return `当前按每 ${descriptor.displayLabel} 计价；例如 12 张图片会折算为 ${formatNumber(12 / descriptor.divisor)} 个计费单位。`;
  }

  if (kind === "char") {
    if (descriptor.divisor === 1) {
      return "当前按单字符计价。若单价较低，建议切换为 100 字符或 1K 字符口径。";
    }
    return `当前按每 ${descriptor.displayLabel} 计价；例如 1200 字符会折算为 ${formatNumber(1200 / descriptor.divisor)} 个计费单位。`;
  }

  if (kind === "second") {
    return `当前按每 ${descriptor.displayLabel} 计价；例如 120 秒会折算为 ${formatNumber(120 / descriptor.divisor)} 个计费单位。`;
  }

  if (kind === "hour") {
    return descriptor.displayLabel === "minute"
      ? "当前按分钟计价；例如 1 小时会折算为 60 个计费单位。"
      : "当前按小时计价。";
  }

  if (kind === "request") {
    return descriptor.divisor === 1
      ? "当前按单次请求计价。若单价较低，可切换为 10 次或 100 次请求口径。"
      : `当前按每 ${descriptor.displayLabel} 计价。`;
  }

  if (kind === "step") {
    return descriptor.divisor === 1
      ? "当前按单步计价。若单价较低，可切换为 10 步或 100 步口径。"
      : `当前按每 ${descriptor.displayLabel} 计价。`;
  }

  if (kind === "task") {
    return descriptor.divisor === 1
      ? "当前按单任务计价。若单价较低，可切换为 10 个或 100 个任务口径。"
      : `当前按每 ${descriptor.displayLabel} 计价。`;
  }

  return "";
}

export function buildPricingRateLabel(
  basePrice: number,
  unit: string | null | undefined,
  fallbackKind: PricingUnitKind = "unit",
) {
  const descriptor = resolvePricingUnitDescriptor(unit, fallbackKind);
  return `${formatNumber(basePrice)}/${descriptor.displayLabel}`;
}
