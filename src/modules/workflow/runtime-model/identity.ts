import { asString, isRecord, toFiniteNumber } from "./values";

const ALIAS_TO_CANONICAL: Record<string, string> = {
  seconds: "duration",
  fps: "framepersecond",
  frame_per_second: "framepersecond",
  camera_fixed: "camerafixed",
  camera_movements: "camera_movement",
  camera_movement_amplitude: "camera_movement_intensity",
  movement_intensity: "camera_movement_intensity",
  positive_prompt: "prompt",
  template_prompt: "prompt",
  image_first_frame: "first_frame",
  image_last_frame: "last_frame",
  first_frame_url: "first_frame",
  last_frame_url: "last_frame",
  image_url: "image",
  video_generate_audio: "generate_audio",
  generateAudio: "generate_audio",
  with_audio: "generate_audio",
  batch_size: "count",
};

type RuntimeParamBinding = {
  slotId: string;
  identityKeys: string[];
  capability: string;
};

export function resolveCanonicalParamKey(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return ALIAS_TO_CANONICAL[trimmed] ?? ALIAS_TO_CANONICAL[trimmed.toLowerCase()] ?? trimmed;
}

function firstParam(component: unknown): Record<string, unknown> | null {
  if (!isRecord(component)) return null;
  const basic = isRecord(component.basic) ? component.basic : {};
  const params = Array.isArray(basic.params) ? basic.params : [];
  return isRecord(params[0]) ? params[0] : null;
}

/** 运行时 values 的槽位：component.id，否则参数 name。表单 / 约束 / 估算共用。 */
export function runtimeValueSlot(component: unknown): string | null {
  if (!isRecord(component)) return null;
  return asString(component.id) || asString(firstParam(component)?.name) || null;
}

export function readRuntimeParamBinding(component: unknown): RuntimeParamBinding | null {
  const slotId = runtimeValueSlot(component);
  if (!slotId || !isRecord(component)) return null;
  const param = firstParam(component) ?? {};

  const identityKeys: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const key = raw.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    identityKeys.push(key);
  };
  const marks = isRecord(param.marks) ? param.marks : {};
  for (const [mark, enabled] of Object.entries(marks)) {
    if (enabled) push(mark);
  }
  for (const raw of [asString(param.inputKey), asString(param.name)]) {
    const canonical = resolveCanonicalParamKey(raw);
    if (canonical) push(canonical);
  }

  const ext = isRecord(component.ext) ? component.ext : {};
  return {
    slotId,
    identityKeys,
    capability: asString(ext.capability),
  };
}

export function findCatalogModelBinding(
  uiSchema: unknown,
  values: Record<string, unknown>,
): { capability: string; modelCode: string } | null {
  if (!isRecord(uiSchema) || !Array.isArray(uiSchema.components)) return null;
  for (const component of uiSchema.components) {
    const binding = readRuntimeParamBinding(component);
    if (!binding?.capability || !binding.identityKeys.includes("model")) continue;
    return {
      capability: binding.capability,
      modelCode: asString(values[binding.slotId]),
    };
  }
  return null;
}

export function readCanonicalRuntimeValues(
  uiSchema: unknown,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (!isRecord(uiSchema) || !Array.isArray(uiSchema.components)) return next;
  for (const component of uiSchema.components) {
    const binding = readRuntimeParamBinding(component);
    if (!binding) continue;
    const value = values[binding.slotId];
    for (const key of binding.identityKeys) {
      next[key] = value;
    }
  }
  return next;
}

export function canonicalImageCount(canonicalValues: Record<string, unknown>): number {
  const n = toFiniteNumber(canonicalValues.count);
  if (n == null) return 1;
  return Math.max(1, Math.floor(n));
}
