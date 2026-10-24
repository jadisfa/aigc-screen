import { readRuntimeParamBinding, runtimeValueSlot } from "./identity";
import { isRecord, toFiniteNumber } from "./values";

export type FieldConstraint = {
  min?: number;
  max?: number;
  allowed?: string[];
  default?: string | number | null;
};

export type FieldConstraintMap = Record<string, FieldConstraint>;

function fieldIdentityKeys(component: unknown): string[] {
  return readRuntimeParamBinding(component)?.identityKeys ?? [];
}

function extHasOptions(ext: unknown): boolean {
  return isRecord(ext) && Array.isArray(ext.options);
}

function extHasNumericBounds(ext: unknown): boolean {
  return isRecord(ext) && (typeof ext.min === "number" || typeof ext.max === "number");
}

function hasDurationMark(component: unknown): boolean {
  return fieldIdentityKeys(component).includes("duration");
}

export function matchFieldConstraint(component: unknown, fields: FieldConstraintMap): FieldConstraint | null {
  for (const key of fieldIdentityKeys(component)) {
    const constraint = fields[key];
    if (constraint) return constraint;
  }
  return null;
}

type SelectOptionLike = { value: string; title?: string; label?: string };

function overlaySelectOptions<T extends SelectOptionLike>(
  configured: T[] | null | undefined,
  allowed: string[] | null | undefined,
): T[] {
  const current = Array.isArray(configured) ? configured : [];
  const options = (allowed ?? []).map((item) => item.trim()).filter(Boolean);
  if (options.length === 0) return current;
  const byValue = new Map(current.map((item) => [String(item.value ?? "").trim().toLowerCase(), item]));
  return options.map((value) => {
    const existing = byValue.get(value.toLowerCase());
    if (existing) return { ...existing, value };
    return { ...({ value, title: value, label: value } as T), value };
  });
}

export function applyConstraintToComponent<T>(component: T, constraint: FieldConstraint): T {
  if (!isRecord(component)) return component;
  let ext: Record<string, unknown> = isRecord(component.ext) ? { ...component.ext } : {};
  let changed = false;

  const hasRange = constraint.min != null || constraint.max != null;
  const canTakeRange = extHasNumericBounds(ext) || hasDurationMark(component);
  if (hasRange && canTakeRange) {
    const min = constraint.min ?? (typeof ext.min === "number" ? ext.min : undefined);
    const max = constraint.max ?? (typeof ext.max === "number" ? ext.max : undefined);
    if (min != null && ext.min !== min) {
      ext = { ...ext, min };
      changed = true;
    }
    if (max != null && ext.max !== max) {
      ext = { ...ext, max };
      changed = true;
    }
    if (typeof ext.min === "number" && typeof ext.max === "number" && ext.max < ext.min) {
      ext = { ...ext, max: ext.min };
      changed = true;
    }
  }

  if (constraint.allowed?.length && extHasOptions(ext)) {
    ext = { ...ext, options: overlaySelectOptions(ext.options as SelectOptionLike[], constraint.allowed) };
    changed = true;
  }

  if (!changed) return component;
  return { ...component, ext };
}

function matchAllowedValue(
  value: unknown,
  allowed: string[] | null | undefined,
  fallback?: string | number | null,
): string | null {
  const options = (allowed ?? []).map((item) => item.trim()).filter(Boolean);
  const raw = String(value ?? "").trim();
  if (options.length === 0) return raw || (fallback == null ? null : String(fallback));
  if (raw) {
    const matched = options.find((item) => item.toLowerCase() === raw.toLowerCase());
    if (matched) return matched;
  }
  if (fallback != null && String(fallback).trim()) {
    const matchedFallback = options.find((item) => item.toLowerCase() === String(fallback).trim().toLowerCase());
    if (matchedFallback) return matchedFallback;
  }
  return options[0] ?? null;
}

function suggestConstrainedValue(value: unknown, constraint: FieldConstraint | null): unknown | undefined {
  if (!constraint) return undefined;
  if (constraint.min != null || constraint.max != null) {
    const parsed = toFiniteNumber(value);
    if (parsed == null && value != null && String(value).trim() !== "") return undefined;
    let next = parsed ?? toFiniteNumber(constraint.default);
    if (next == null) return undefined;
    if (constraint.min != null && next < constraint.min) next = constraint.min;
    if (constraint.max != null && next > constraint.max) next = constraint.max;
    if (next !== parsed) return next;
  }
  if (constraint.allowed?.length) {
    const matched = matchAllowedValue(value, constraint.allowed, constraint.default);
    if (matched != null && matched !== String(value ?? "").trim()) return matched;
  }
  return undefined;
}

export function applyFieldConstraintsToRuntimeValues(
  components: unknown[],
  values: Record<string, unknown>,
  fields: FieldConstraintMap,
): Record<string, unknown> {
  if (Object.keys(fields).length === 0) return values;
  let changed = false;
  const next = { ...values };
  for (const component of components) {
    const key = runtimeValueSlot(component);
    if (!key) continue;
    const suggested = suggestConstrainedValue(next[key], matchFieldConstraint(component, fields));
    if (suggested !== undefined && !Object.is(suggested, next[key])) {
      next[key] = suggested;
      changed = true;
    }
  }
  return changed ? next : values;
}
