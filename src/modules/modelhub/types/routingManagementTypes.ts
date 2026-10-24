import type { RouteEntryCode } from "@/shared/lib/route-entry-dicts";
import { ROUTE_ENTRY_LABEL, ROUTE_ENTRY_ORDER } from "@/shared/lib/route-entry-dicts";

export type { RouteEntryCode } from "@/shared/lib/route-entry-dicts";
export type RoutingProfileStatus = "enabled" | "disabled";
export type TenantLevel = "platform" | "merchant" | "consumer";
export type RegionLevel = "domestic" | "asia_pacific" | "europe" | "north_america";
export type ChannelPolicy = "follow_pool" | "shared_first" | "byok_first" | "fixed";
export type RoutingMode = "balanced" | "cost_first" | "stability_first";
export type EntryRoutingMode = "" | RoutingMode;
export type PoolId = string;
export type FixedChannelId = string;
export type UnmatchedBehavior = "fallback_to_system_default" | "reject";
export type StrategySource = "api_key_assigned" | "api_key_other_assigned" | "tenant_default";

export type RouteEntryPolicyValue = {
  targetPoolId: PoolId;
  channelPolicy: ChannelPolicy;
  fixedChannelId: FixedChannelId;
  routingMode: EntryRoutingMode;
};

export type RoutingProfileEntry = {
  entry: RouteEntryCode;
  targetPoolId: PoolId;
  targetPoolCode?: string | null;
  targetPoolLabel?: string | null;
  channelPolicy: ChannelPolicy;
  fixedChannelId: FixedChannelId;
  routingMode?: RoutingMode | null;
};

export type RoutingProfileDefaultBehavior = {
  unmatchedBehavior: UnmatchedBehavior;
  fallbackPoolId: PoolId;
  fallbackPoolCode?: string | null;
  fallbackPoolLabel?: string | null;
};

export type RoutingProfile = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  merchantId: string | null;
  storeId: string | null;
  principalId: string | null;
  status: RoutingProfileStatus;
  isSystemDefault?: boolean;
  attachCount: number;
  tenantDefaultBindingCount: number;
  applicableTenantLevels: TenantLevel[];
  applicableRegions: RegionLevel[];
  defaultBehavior: RoutingProfileDefaultBehavior;
  entries: RoutingProfileEntry[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type RoutingProfileFormValue = {
  code: string;
  name: string;
  description: string;
  status: RoutingProfileStatus;
  isSystemDefault: boolean;
  attachCount: number;
  tenantDefaultBindingCount: number;
  applicableTenantLevels: TenantLevel[];
  applicableRegions: RegionLevel[];
  unmatchedBehavior: UnmatchedBehavior;
  fallbackPoolId: PoolId;
  entries: Record<RouteEntryCode, RouteEntryPolicyValue>;
};

export type PoolOption = {
  value: PoolId;
  label: string;
  code?: string | null;
};

export type FixedChannelOption = {
  value: FixedChannelId;
  label: string;
  code?: string | null;
};

export type RoutingScopeSelection = {
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
};

export const ENTRY_ORDER = ROUTE_ENTRY_ORDER;
export const ENTRY_LABEL = ROUTE_ENTRY_LABEL;

export const ENTRY_HINT: Record<RouteEntryCode, string> = {
  chat: "对应 chat/completions。深度思考、翻译、角色扮演仍走此入口，不单独建映射；池内模型需具备文本生成能力。",
  embedding: "对应 embeddings 文本向量请求。多模态向量目前不会命中此入口。",
  image_generation: "对应图片生成（文生图/图生图）。视觉理解不走此入口。",
  audio_transcription: "对应语音转写 / 语音识别。语音理解、AI 配音不走此入口。",
  audio_synthesis: "对应语音合成与播报。AI 配音、音乐生成目前没有独立入口。",
  video_generation: "对应视频生成。视频理解不走此入口。",
  three_d_generation: "对应 3D 生成（文生 3D / 图生 3D）。可按百万 tokens 或按次计费；池内模型需具备 3D 生成能力。",
};

export const TENANT_LABEL: Record<TenantLevel, string> = {
  platform: "平台",
  merchant: "商户",
  consumer: "C端",
};

export const REGION_LABEL: Record<RegionLevel, string> = {
  domestic: "国内",
  asia_pacific: "亚太",
  europe: "欧洲",
  north_america: "北美",
};

export const ENTRY_FILTER_LABEL: Record<RouteEntryCode, string> = {
  chat: "chat",
  embedding: "embedding",
  image_generation: "image_generation",
  audio_transcription: "audio_transcription",
  audio_synthesis: "audio_synthesis",
  video_generation: "video_generation",
  three_d_generation: "three_d_generation",
};

export const TENANT_LEVEL_OPTIONS: Array<{ value: TenantLevel; label: string }> = [
  { value: "platform", label: "平台内部" },
  { value: "merchant", label: "商户" },
  { value: "consumer", label: "C 端用户" },
];

export const REGION_LEVEL_OPTIONS: Array<{ value: RegionLevel; label: string }> = [
  { value: "domestic", label: "国内" },
  { value: "asia_pacific", label: "亚太" },
  { value: "europe", label: "欧洲" },
  { value: "north_america", label: "北美" },
];

export const EMPTY_FIXED_CHANNEL_OPTION: FixedChannelOption = { value: "inherit", label: "不指定" };

export const CHANNEL_POLICY_OPTIONS: Array<{ value: ChannelPolicy; label: string }> = [
  { value: "follow_pool", label: "跟随模型池优先顺序" },
  { value: "shared_first", label: "平台共享渠道优先" },
  { value: "byok_first", label: "商户 BYOK 渠道优先" },
  { value: "fixed", label: "固定渠道" },
];

export const ROUTING_MODE_OPTIONS: Array<{ value: RoutingMode; label: string }> = [
  { value: "balanced", label: "综合评分" },
  { value: "cost_first", label: "成本优先" },
  { value: "stability_first", label: "稳定优先" },
];

function normalizeOptionalEntryValue(value?: string | null): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized === EMPTY_FIXED_CHANNEL_OPTION.value) {
    return undefined;
  }
  return normalized;
}

function normalizeRoutingMode(value?: string | null): RoutingMode {
  if (value === "cost_first") {
    return "cost_first";
  }
  if (value === "stability_first") {
    return "stability_first";
  }
  return "balanced";
}

function normalizeEntryRoutingMode(value?: string | null): EntryRoutingMode {
  return value ? normalizeRoutingMode(value) : "";
}

export const ROUTING_STATUS_META: Record<
  RoutingProfileStatus,
  { label: string; badgeVariant: "secondary" | "outline" }
> = {
  enabled: { label: "启用", badgeVariant: "secondary" },
  disabled: { label: "停用", badgeVariant: "outline" },
};

export function normalizeRoutingProfileStatus(value?: string | null): RoutingProfileStatus {
  return value === "disabled" ? "disabled" : "enabled";
}

export function getRoutingStatusMeta(value?: string | null) {
  return ROUTING_STATUS_META[normalizeRoutingProfileStatus(value)];
}

export function createDefaultRoutingProfileFormValue(): RoutingProfileFormValue {
  return {
    code: "",
    name: "",
    description: "",
    status: "disabled",
    isSystemDefault: false,
    attachCount: 0,
    tenantDefaultBindingCount: 0,
    applicableTenantLevels: ["merchant"],
    applicableRegions: ["domestic"],
    unmatchedBehavior: "fallback_to_system_default",
    fallbackPoolId: "",
    entries: ENTRY_ORDER.reduce<Record<RouteEntryCode, RouteEntryPolicyValue>>((accumulator, entry) => {
      accumulator[entry] = {
        targetPoolId: "",
        channelPolicy: "follow_pool",
        fixedChannelId: "inherit",
        routingMode: "",
      }
      return accumulator;
    }, {} as Record<RouteEntryCode, RouteEntryPolicyValue>),
  };
}

export function toRoutingProfileFormValue(profile?: RoutingProfile | null): RoutingProfileFormValue {
  const defaultValue = createDefaultRoutingProfileFormValue();
  if (!profile) {
    return defaultValue;
  }

  const nextEntries = { ...defaultValue.entries };
  for (const entry of profile.entries) {
    nextEntries[entry.entry] = {
      targetPoolId: entry.targetPoolId,
      channelPolicy: entry.channelPolicy,
      fixedChannelId: entry.fixedChannelId || "inherit",
      routingMode: normalizeEntryRoutingMode(entry.routingMode),
    };
  }

  return {
    code: profile.code,
    name: profile.name,
    description: profile.description || "",
    status: profile.status,
    isSystemDefault: Boolean(profile.isSystemDefault),
    attachCount: profile.attachCount,
    tenantDefaultBindingCount: profile.tenantDefaultBindingCount,
    applicableTenantLevels: [...profile.applicableTenantLevels],
    applicableRegions: [...profile.applicableRegions],
    unmatchedBehavior: profile.defaultBehavior.unmatchedBehavior,
    fallbackPoolId: profile.defaultBehavior.fallbackPoolId,
    entries: nextEntries,
  };
}

export function buildRoutingProfilePayload(form: RoutingProfileFormValue) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    status: form.status,
    isSystemDefault: form.isSystemDefault,
    applicableTenantLevels: [...form.applicableTenantLevels],
    applicableRegions: [...form.applicableRegions],
    defaultBehavior: {
      unmatchedBehavior: form.unmatchedBehavior,
      fallbackPoolId: form.fallbackPoolId,
    },
    entries: ENTRY_ORDER.map((entry) => {
      const entryValue = form.entries[entry];
      const fixedChannelId =
        entryValue.channelPolicy === "fixed" ? normalizeOptionalEntryValue(entryValue.fixedChannelId) : undefined;
      const routingMode = normalizeOptionalEntryValue(entryValue.routingMode);
      return {
        entry,
        targetPoolId: entryValue.targetPoolId,
        channelPolicy: entryValue.channelPolicy,
        fixedChannelId,
        routingMode: routingMode ? normalizeRoutingMode(routingMode) : undefined,
      };
    }),
  };
}

export function buildEntrySummary(entries: RoutingProfileEntry[]) {
  return entries
    .map((item) => `${ENTRY_LABEL[item.entry]} -> ${item.targetPoolLabel || item.targetPoolCode || item.targetPoolId}`)
    .join(" / ");
}

export function buildChannelPolicySummary(entries: RoutingProfileEntry[]) {
  return Array.from(new Set(entries.map((item) => CHANNEL_POLICY_OPTIONS.find((option) => option.value === item.channelPolicy)?.label || item.channelPolicy))).join(
    " / ",
  );
}

export function buildTenantSummary(levels: TenantLevel[]) {
  return levels.map((item) => TENANT_LABEL[item]).join(" / ");
}

export function buildRegionSummary(regions: RegionLevel[]) {
  return regions.map((item) => REGION_LABEL[item]).join(" / ");
}

export function buildPoolLabelMap(options: PoolOption[]) {
  return options.reduce<Record<string, string>>((accumulator, item) => {
    accumulator[item.value] = item.label;
    return accumulator;
  }, {});
}
