import type { ModelHubCatalogPickerPricing, ModelHubCatalogPickerRateCardRow } from "@/shared/api/model-hub/model-hub";
import { resolveCanonicalParamKey } from "./identity";
import { asString, toFiniteNumber } from "./values";

export type RuntimePricing = {
  unitPrice: number | null;
  quantityKey: string | null;
  rateCard: Array<{ match: Record<string, string>; unitPrice: number }>;
};

function canonicalText(value: unknown): string {
  return asString(value).toLowerCase();
}

function normalizeRateCard(rows: ModelHubCatalogPickerRateCardRow[] | null | undefined): RuntimePricing["rateCard"] {
  if (!rows?.length) return [];
  const out: RuntimePricing["rateCard"] = [];
  for (const row of rows) {
    const unitPrice = toFiniteNumber(row?.unitPrice);
    if (unitPrice == null || unitPrice <= 0) continue;
    const match: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(row.match ?? {})) {
      const key = resolveCanonicalParamKey(rawKey);
      const value = canonicalText(rawValue);
      if (key && value) match[key] = value;
    }
    out.push({ match, unitPrice });
  }
  return out;
}

export function pricingFromPicker(raw: ModelHubCatalogPickerPricing | null | undefined): RuntimePricing | null {
  if (!raw) return null;
  const rateCard = normalizeRateCard(raw.rateCard);
  const unitPrice = toFiniteNumber(raw.unitPrice);
  const quantityKeyRaw = asString(raw.quantityKey);
  const quantityKey = quantityKeyRaw ? resolveCanonicalParamKey(quantityKeyRaw) || quantityKeyRaw : null;
  if ((unitPrice == null || unitPrice <= 0) && rateCard.length === 0) return null;
  return {
    unitPrice: unitPrice != null && unitPrice > 0 ? unitPrice : null,
    quantityKey,
    rateCard,
  };
}

function selectUnitPrice(scheme: RuntimePricing, canonicalValues: Record<string, unknown>): number | null {
  let best: { unitPrice: number; score: number } | null = null;
  for (const row of scheme.rateCard) {
    const keys = Object.keys(row.match);
    if (keys.length === 0) continue;
    if (!keys.every((key) => canonicalText(canonicalValues[key]) === row.match[key])) continue;
    if (!best || keys.length > best.score) best = { unitPrice: row.unitPrice, score: keys.length };
  }
  return best?.unitPrice ?? (scheme.unitPrice != null && scheme.unitPrice > 0 ? scheme.unitPrice : null);
}

function quantityOf(scheme: RuntimePricing, canonicalValues: Record<string, unknown>): number | null {
  if (!scheme.quantityKey) return 1;
  const quantity = toFiniteNumber(canonicalValues[scheme.quantityKey]);
  if (quantity == null || quantity <= 0) return null;
  return quantity;
}

export function estimateRuntimeYuan(
  scheme: RuntimePricing | null | undefined,
  canonicalValues: Record<string, unknown>,
): number {
  if (!scheme) return 0;
  const unitPrice = selectUnitPrice(scheme, canonicalValues);
  const quantity = quantityOf(scheme, canonicalValues);
  if (unitPrice == null || quantity == null) return 0;
  return unitPrice * quantity;
}
