import type {
  FixedChannelOption,
  PoolOption,
  RoutingProfile,
  RoutingProfileFormValue,
  RoutingScopeSelection,
} from "@/modules/modelhub/types/routingManagementTypes";
import { buildRoutingProfilePayload, normalizeRoutingProfileStatus } from "@/modules/modelhub/types/routingManagementTypes";
import {
  listModelHubChannelsCatalog,
  createModelHubRoutingProfile,
  deleteModelHubRoutingProfile,
  getModelHubRoutingProfile,
  listModelHubPoolsCatalog,
  listModelHubRoutingProfiles,
  updateModelHubRoutingProfile,
  type ListModelHubRoutingProfilesParams,
  type ModelHubRoutingProfileDataset,
  type ModelHubScopeQuery,
} from "@/shared/api/model-hub/model-hub";

function normalizeRoutingScope(scope?: RoutingScopeSelection): ModelHubScopeQuery {
  return {
    merchantId: scope?.merchantId?.trim() || null,
    storeId: scope?.storeId?.trim() || null,
    principalId: scope?.principalId?.trim() || null,
  };
}

function normalizeRoutingProfile(profile: RoutingProfile): RoutingProfile {
  return {
    ...profile,
    status: normalizeRoutingProfileStatus(profile.status),
  };
}

export async function listRoutingProfilesPage(
  params: Omit<ListModelHubRoutingProfilesParams, "merchantId" | "storeId" | "principalId"> & {
    scope?: RoutingScopeSelection;
  },
): Promise<ModelHubRoutingProfileDataset> {
  const scope = normalizeRoutingScope(params.scope);
  const dataset = await listModelHubRoutingProfiles({
    pageNo: params.pageNo,
    pageSize: params.pageSize,
    total: params.total,
    keyword: params.keyword,
    status: params.status,
    isSystemDefault: params.isSystemDefault,
    merchantId: scope.merchantId,
    storeId: scope.storeId,
    principalId: scope.principalId,
  });
  return {
    ...dataset,
    items: dataset.items.map((profile) => normalizeRoutingProfile(profile as RoutingProfile)),
  };
}

export async function listRoutingProfilesCatalog(scope?: RoutingScopeSelection) {
  const dataset = await listRoutingProfilesPage({ pageNo: 1, pageSize: 200, scope });
  return dataset.items;
}

export async function getRoutingProfile(id: string) {
  const profile = await getModelHubRoutingProfile(id);
  return normalizeRoutingProfile(profile as RoutingProfile);
}

export async function createRoutingProfile(form: RoutingProfileFormValue, scope: RoutingScopeSelection) {
  return createModelHubRoutingProfile(buildRoutingProfilePayload(form), normalizeRoutingScope(scope));
}

export async function updateRoutingProfile(id: string, form: RoutingProfileFormValue, scope: RoutingScopeSelection) {
  return updateModelHubRoutingProfile(id, buildRoutingProfilePayload(form), normalizeRoutingScope(scope));
}

export async function deleteRoutingProfile(id: string, scope: RoutingScopeSelection) {
  return deleteModelHubRoutingProfile(id, normalizeRoutingScope(scope));
}

/**
 * 入口目标池 / 最终兜底池选项。
 * 租户路由作用域下为「本分区池 ∪ 平台池」：平台池为全平台共用公共配置，商户路由可直接引用。
 */
export async function listRoutingPoolOptions(scope: RoutingScopeSelection): Promise<PoolOption[]> {
  const normalized = normalizeRoutingScope(scope);
  const isTenantScoped = Boolean(normalized.merchantId?.trim() || normalized.storeId?.trim());
  if (!isTenantScoped) {
    const pools = await listModelHubPoolsCatalog({
      ...normalized,
      scopeType: "platform",
    });
    return pools.map((pool) => toPoolOption(pool, false));
  }
  // 不传 scopeType，列表 SQL 会包含本商户/门店池与平台池。
  const pools = await listModelHubPoolsCatalog(normalized);
  return pools.map((pool) => toPoolOption(pool, isPlatformPool(pool)));
}

/**
 * @deprecated 与 {@link listRoutingPoolOptions} 相同；保留别名以免旧调用方断裂。
 */
export async function listRoutingFallbackPoolOptions(scope: RoutingScopeSelection): Promise<PoolOption[]> {
  return listRoutingPoolOptions(scope);
}

function isPlatformPool(pool: { merchantId?: string | null; storeId?: string | null; principalId?: string | null }) {
  return !pool.merchantId?.trim() && !pool.storeId?.trim() && !pool.principalId?.trim();
}

function toPoolOption(
  pool: { id: string; displayName?: string | null; poolCode?: string | null; merchantId?: string | null; storeId?: string | null; principalId?: string | null },
  markPlatform: boolean,
): PoolOption {
  const base = pool.displayName?.trim() || pool.poolCode?.trim() || pool.id;
  return {
    value: pool.id,
    label: markPlatform ? `平台 · ${base}` : base,
    code: pool.poolCode?.trim() || null,
  };
}

export async function listRoutingFixedChannelOptions(scope: RoutingScopeSelection): Promise<FixedChannelOption[]> {
  const channels = await listModelHubChannelsCatalog(normalizeRoutingScope(scope));
  return channels
    .map((channel) => ({
      value: channel.id,
      label: channel.displayName?.trim() || channel.channelCode?.trim() || channel.id,
      code: channel.channelCode?.trim() || null,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
}
