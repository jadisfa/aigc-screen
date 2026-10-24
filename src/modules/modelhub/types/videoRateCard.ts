import type {
  CapabilityPricingRateCardRow,
  CapabilityPricingRule,
  ModelCapabilityConfig,
} from "./modelCapabilityMetadata";
import { getVideoCapabilityResolutions } from "./modelCapabilityMetadata";

const RESOLUTION_ALIASES: Record<string, string> = {
  "1920x1080": "1080p",
  "1920*1080": "1080p",
  "1280x720": "720p",
  "1280*720": "720p",
  "854x480": "480p",
  "854*480": "480p",
  "1366x768": "768p",
  "1280x768": "768p",
  "960x540": "540p",
  "2160p": "4k",
  "3840x2160": "4k",
  "1440p": "2k",
  "2560x1440": "2k",
};

export function roundVideoUnitPrice(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

export function canonicalizeVideoResolution(value: unknown) {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!token) return "";
  if (RESOLUTION_ALIASES[token]) return RESOLUTION_ALIASES[token];
  if (token === "4k" || token === "2k") return token;
  return token;
}

export function isVideoPricingAxisMetric(metric: string) {
  const compact = String(metric || "")
    .trim()
    .toLowerCase()
    .replace(/[-_ ]/g, "");
  return (
    compact === "resolution" ||
    compact === "size" ||
    compact === "framerate" ||
    compact === "fps" ||
    compact === "framepersecond"
  );
}

export function excludeVideoAxisRules(rules: CapabilityPricingRule[] | undefined) {
  return (Array.isArray(rules) ? rules : []).filter((rule) => !isVideoPricingAxisMetric(rule.metric));
}

export function buildDefaultVideoRateCard(basePrice: number): CapabilityPricingRateCardRow[] {
  const unitPrice = Number.isFinite(basePrice) ? basePrice : 0;
  return [
    { resolution: "480p", unitPrice: roundVideoUnitPrice(unitPrice * (2 / 3)) },
    { resolution: "720p", unitPrice: roundVideoUnitPrice(unitPrice), isDefault: true },
    { resolution: "1080p", unitPrice: roundVideoUnitPrice(unitPrice * 1.3) },
  ];
}

export function hydrateVideoRateCard(config: ModelCapabilityConfig): CapabilityPricingRateCardRow[] {
  const boundaryResolutions = getVideoCapabilityResolutions(config);
  const defaultResolution =
    canonicalizeVideoResolution(config.defaults?.defaultResolution) ||
    canonicalizeVideoResolution(boundaryResolutions[0]);
  const existingByResolution = new Map<string, CapabilityPricingRateCardRow>();
  for (const row of Array.isArray(config.pricing.rateCard) ? config.pricing.rateCard : []) {
    const resolution = canonicalizeVideoResolution(row.resolution);
    if (!resolution) continue;
    existingByResolution.set(resolution, row);
  }
  const projectedByResolution = projectVideoRateCardFromRules(
    Number(config.pricing.basePrice || 0),
    config.pricing.rules,
  );
  const keys =
    boundaryResolutions.length > 0
      ? boundaryResolutions.map((item) => canonicalizeVideoResolution(item)).filter(Boolean)
      : [...new Set([...existingByResolution.keys(), ...projectedByResolution.keys()])];

  return Array.from(new Set(keys)).map((resolution) => {
    const existing = existingByResolution.get(resolution);
    const projected = projectedByResolution.get(resolution);
    const unitPrice =
      existing && Number(existing.unitPrice) >= 0
        ? Number(existing.unitPrice)
        : projected != null
          ? projected
          : Number(config.pricing.basePrice || 0);
    const displayResolution =
      boundaryResolutions.find((item) => canonicalizeVideoResolution(item) === resolution) ||
      existing?.resolution ||
      resolution;
    return {
      resolution: displayResolution,
      unitPrice,
      isDefault: resolution === defaultResolution,
    };
  });
}

export function selectVideoRateCardUnitPrice(
  rows: CapabilityPricingRateCardRow[],
  resolution: unknown,
  fallback: number,
) {
  const requested = canonicalizeVideoResolution(resolution);
  if (requested) {
    const matched = rows.find((row) => canonicalizeVideoResolution(row.resolution) === requested);
    if (matched) return Number(matched.unitPrice);
  }
  const defaultRow = rows.find((row) => row.isDefault);
  if (defaultRow) return Number(defaultRow.unitPrice);
  return Number.isFinite(fallback) ? fallback : 0;
}

export function defaultVideoRateCardUnitPrice(rows: CapabilityPricingRateCardRow[], fallback: number) {
  const defaultRow = rows.find((row) => row.isDefault) || rows[0];
  if (defaultRow && Number(defaultRow.unitPrice) >= 0) {
    return Number(defaultRow.unitPrice);
  }
  return Number.isFinite(fallback) ? fallback : 0;
}

export function buildVideoRateCardAdjustments(rows: CapabilityPricingRateCardRow[]) {
  const defaultPrice = defaultVideoRateCardUnitPrice(rows, 0);
  if (!(defaultPrice > 0)) return [];
  const defaultResolution = canonicalizeVideoResolution((rows.find((row) => row.isDefault) || rows[0])?.resolution);
  return rows
    .filter((row) => canonicalizeVideoResolution(row.resolution) !== defaultResolution)
    .filter((row) => Number(row.unitPrice) > 0)
    .map((row) => ({
      metric: "resolution",
      operator: "eq" as const,
      value: row.resolution,
      multiplier: roundVideoUnitPrice(Number(row.unitPrice) / defaultPrice),
      description: row.resolution,
    }));
}

export function syncVideoRateCardBasePrice(rows: CapabilityPricingRateCardRow[], basePrice: number) {
  const unitPrice = roundVideoUnitPrice(basePrice);
  return rows.map((row) => (row.isDefault ? { ...row, unitPrice } : row));
}

function projectVideoRateCardFromRules(basePrice: number, rules: CapabilityPricingRule[] | undefined) {
  const projected = new Map<string, number>();
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!isVideoPricingAxisMetric(rule.metric)) continue;
    const compact = String(rule.metric || "")
      .trim()
      .toLowerCase()
      .replace(/[-_ ]/g, "");
    if (compact !== "resolution" && compact !== "size") continue;
    if (rule.operator && rule.operator !== "eq") continue;
    const resolution = canonicalizeVideoResolution(rule.value);
    const multiplier = Number(rule.multiplier || 0);
    if (!resolution || !(multiplier > 0)) continue;
    projected.set(resolution, roundVideoUnitPrice(basePrice * multiplier));
  }
  return projected;
}
