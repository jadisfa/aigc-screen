import { formatModelHubDateTime } from "@/modules/modelhub/services/modelhubAdminUi";
import {
  createModelHubPool,
  getModelHubPool,
  listModelHubBindings,
  listModelHubChannelDeploymentsByIds,
  listModelHubChannelsCatalog,
  listModelHubPools,
  listModelHubProviders,
  replaceModelHubPoolBindings,
  updateModelHubPool,
  type ModelHubChannel,
  type ModelHubChannelDeployment,
  type ModelHubHealthState,
  type ModelHubPool,
  type ModelHubPoolBinding,
  type ModelHubProvider,
  type ModelHubRoutingMode,
  type ModelHubScopeType,
  type ModelHubScopeQuery,
  type ModelHubStatus,
  type ReplaceModelHubBindingItem,
  type UpsertModelHubPoolCommand,
  type ListModelHubPoolsParams,
} from "@/shared/api/model-hub/model-hub";

export type PoolEditorStatus = "启用" | "停用";
export type PoolBindingEditorStatus = "启用" | "停用";

export type PoolListItem = {
  id: string;
  poolCode: string;
  displayName: string;
  merchantId: string;
  storeId: string | null;
  principalId: string | null;
  scopeType: ModelHubScopeType;
  scopeTypeLabel: string;
  scopeValue: string;
  status: PoolEditorStatus;
  routingMode: ModelHubRoutingMode;
  bindingCount: number;
  candidateModels: Array<{
    id: string;
    displayName: string;
    providerLogoUrl: string;
  }>;
  updatedAt: string;
};

export type PoolBindingOption = {
  key: string;
  baseModelId: string;
  baseModelName: string;
  baseModelCode: string;
  modelLogoUrl: string;
  channelId: string;
  channelName: string;
  channelCode: string;
  channelIconUrl: string;
  providerName: string;
  channelStatus: ModelHubStatus;
};

export type PoolBindingEditorItem = {
  id?: string;
  baseModelId: string;
  baseModelName: string;
  baseModelCode: string;
  modelLogoUrl: string;
  channelId: string;
  channelName: string;
  channelCode: string;
  channelIconUrl: string;
  providerName: string;
  candidateCode: string;
  status: PoolBindingEditorStatus;
  healthState: ModelHubHealthState;
  weight: number;
  priority: number;
  channelStatus: ModelHubStatus;
};

export type PoolEditorValue = {
  id?: string;
  poolCode: string;
  displayName: string;
  merchantId: string;
  storeId: string;
  principalId: string;
  status: PoolEditorStatus;
  routingMode: ModelHubRoutingMode;
  bindings: PoolBindingEditorItem[];
};

export type PoolPageData = {
  pools: PoolListItem[];
  page: {
    pageNo: number;
    pageSize: number;
    total: number;
  };
};

export type PoolListPageParams = Omit<ListModelHubPoolsParams, "merchantId" | "storeId" | "principalId"> & {
  scope: PoolScopeSelection;
};

export type PoolEditorData = {
  value: PoolEditorValue;
  bindingCatalog: PoolBindingOption[];
};

export type PoolScopeSelection = {
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
};

const DEFAULT_ROUTING_MODE: ModelHubRoutingMode = "balanced";

function isDisabledStatus(status: string | null | undefined): boolean {
  return status === "disabled";
}

function toEditorStatus(status: string | null | undefined): PoolEditorStatus {
  return isDisabledStatus(status) ? "停用" : "启用";
}

function toBindingEditorStatus(status: string | null | undefined): PoolBindingEditorStatus {
  return isDisabledStatus(status) ? "停用" : "启用";
}

export function resolvePoolScopeType(scope: PoolScopeSelection): ModelHubScopeType {
  if (scope.storeId?.trim()) {
    return "store";
  }
  if (scope.merchantId?.trim()) {
    return "merchant";
  }
  return "platform";
}

export function normalizePoolScopeSelection(scope: PoolScopeSelection): ModelHubScopeQuery {
  const merchantId = scope.merchantId?.trim() || null;
  const storeId = scope.storeId?.trim() || null;
  const principalId = scope.principalId?.trim() || null;
  return {
    merchantId,
    storeId,
    principalId,
  };
}

export function getPoolScopeValue(scope: PoolScopeSelection): string {
  return scope.storeId?.trim() || scope.merchantId?.trim() || "平台级";
}

export function getPoolScopeTypeLabel(value: ModelHubScopeType): string {
  if (value === "platform") {
    return "平台";
  }
  if (value === "store") {
    return "门店";
  }
  return "商户";
}

export function getPoolRoutingModeLabel(value: ModelHubRoutingMode): string {
  if (value === "cost_first") {
    return "成本优先";
  }
  if (value === "stability_first") {
    return "稳定优先";
  }
  return "综合评分";
}

export const POOL_ROUTING_MODE_OPTIONS: Array<{ value: ModelHubRoutingMode; label: string }> = [
  { value: "balanced", label: getPoolRoutingModeLabel("balanced") },
  { value: "cost_first", label: getPoolRoutingModeLabel("cost_first") },
  { value: "stability_first", label: getPoolRoutingModeLabel("stability_first") },
];

function toPoolListItem(item: ModelHubPool): PoolListItem {
  const scopeType = resolvePoolScopeType(item);
  return {
    id: item.id,
    poolCode: item.poolCode,
    displayName: item.displayName,
    merchantId: item.merchantId || "",
    storeId: item.storeId || null,
    principalId: item.principalId || null,
    scopeType,
    scopeTypeLabel: getPoolScopeTypeLabel(scopeType),
    scopeValue: getPoolScopeValue(item),
    status: toEditorStatus(item.status),
    routingMode: item.routingMode || DEFAULT_ROUTING_MODE,
    bindingCount: typeof item.bindingCount === "number" ? item.bindingCount : 0,
    candidateModels: (item.candidateModels || []).map((model) => ({
      id: model.id,
      displayName: model.displayName,
      providerLogoUrl: model.providerLogoUrl || "",
    })),
    updatedAt: formatModelHubDateTime(item.updatedAt),
  };
}

function buildPoolCommand(value: PoolEditorValue): UpsertModelHubPoolCommand {
  return {
    poolCode: value.poolCode.trim() || undefined,
    displayName: value.displayName.trim(),
    merchantId: value.merchantId.trim() || undefined,
    storeId: value.storeId.trim() || undefined,
    principalId: value.principalId.trim() || undefined,
    status: value.status === "停用" ? "disabled" : "enabled",
    routingMode: value.routingMode,
  };
}

function buildBindingCommand(
  item: PoolBindingEditorItem,
  priority: number,
  scope: ModelHubScopeQuery,
): ReplaceModelHubBindingItem {
  return {
    id: item.id || undefined,
    merchantId: scope.merchantId,
    storeId: scope.storeId,
    principalId: scope.principalId,
    channelId: item.channelId,
    baseModelId: item.baseModelId,
    candidateCode: item.candidateCode.trim() || undefined,
    status: item.status === "停用" ? "disabled" : "enabled",
    healthState: item.healthState,
    weight: item.weight,
    priority,
  };
}

function toCatalogOption(
  deployment: ModelHubChannelDeployment,
  channel: ModelHubChannel,
  providerLogoUrl: string,
): PoolBindingOption | null {
  if (!deployment.baseModelId) {
    return null;
  }
  const baseModelName = deployment.displayName?.trim() || deployment.upstreamModelCode?.trim() || deployment.baseModelId;
  const baseModelCode = deployment.upstreamModelCode?.trim() || deployment.deploymentCode?.trim() || deployment.baseModelId;
  const providerName = channel.vendorName?.trim() || "-";
  return {
    key: `${deployment.baseModelId}:${channel.id}`,
    baseModelId: deployment.baseModelId,
    baseModelName,
    baseModelCode,
    modelLogoUrl: providerLogoUrl,
    channelId: channel.id,
    channelName: channel.displayName,
    channelCode: channel.channelCode,
    channelIconUrl: channel.iconUrl?.trim() || "",
    providerName,
    channelStatus: channel.status,
  };
}

function toDeploymentKey(channelId: string, baseModelId: string): string {
  return `${channelId}:${baseModelId}`;
}

function toEditorBindingItem(
  binding: ModelHubPoolBinding,
  channelMap: Record<string, ModelHubChannel>,
  deploymentMap: Record<string, ModelHubChannelDeployment>,
  providerLogoById: Record<string, string>,
): PoolBindingEditorItem {
  const channel = channelMap[binding.channelId];
  const deployment = deploymentMap[toDeploymentKey(binding.channelId, binding.baseModelId)];
  const providerName = channel?.vendorName?.trim() || "-";

  return {
    id: binding.id,
    baseModelId: binding.baseModelId,
    baseModelName: deployment?.displayName?.trim() || binding.modelCode || binding.baseModelId,
    baseModelCode: deployment?.upstreamModelCode?.trim() || binding.modelCode || binding.baseModelId,
    modelLogoUrl: deployment?.providerId ? providerLogoById[deployment.providerId] || "" : "",
    channelId: binding.channelId,
    channelName: channel?.displayName || binding.channelCode || binding.channelId,
    channelCode: channel?.channelCode || binding.channelCode || binding.channelId,
    channelIconUrl: channel?.iconUrl?.trim() || "",
    providerName,
    candidateCode: binding.candidateCode || "",
    status: toBindingEditorStatus(binding.status),
    healthState: binding.healthState,
    weight: binding.weight,
    priority: binding.priority,
    channelStatus: channel?.status || "disabled",
  };
}

export async function loadPoolBindingCatalog(scope: PoolScopeSelection): Promise<PoolBindingOption[]> {
  const { bindingCatalog } = await loadBindingCatalogSource(scope);
  return bindingCatalog;
}

async function loadBindingCatalogSource(scope: PoolScopeSelection) {
  const scopeQuery = normalizePoolScopeSelection(scope);
  const [channelRows, providerRows] = await Promise.all([
    listModelHubChannelsCatalog(scopeQuery),
    listModelHubProviders().catch(() => [] as ModelHubProvider[]),
  ]);
  const channelMap = channelRows.reduce<Record<string, ModelHubChannel>>((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});
  const providerLogoById = providerRows.reduce<Record<string, string>>((accumulator, item) => {
    accumulator[item.id] = item.logoUrl?.trim() || "";
    return accumulator;
  }, {});

  const allDeployments = await listModelHubChannelDeploymentsByIds(channelRows.map((item) => item.id)).catch(
    () => [] as ModelHubChannelDeployment[],
  );
  const deploymentGroups = channelRows.map((channel) => ({
    channelId: channel.id,
    deployments: allDeployments.filter((item) => item.channelId === channel.id),
  }));
  const deploymentMap = deploymentGroups.reduce<Record<string, ModelHubChannelDeployment>>((accumulator, { channelId, deployments }) => {
    deployments.forEach((deployment) => {
      if (!deployment.baseModelId) {
        return;
      }
      accumulator[toDeploymentKey(channelId, deployment.baseModelId)] = deployment;
    });
    return accumulator;
  }, {});

  const bindingCatalog = deploymentGroups
    .flatMap(({ channelId, deployments }) => {
      const channel = channelMap[channelId];
      if (!channel) {
        return [];
      }
      return deployments
        .map((deployment) => toCatalogOption(
          deployment,
          channel,
          deployment.providerId ? providerLogoById[deployment.providerId] || "" : "",
        ))
        .filter((item): item is PoolBindingOption => Boolean(item));
    })
    .filter((item, index, items) => items.findIndex((candidate) => candidate.key === item.key) === index)
    .sort((left, right) => {
      if (left.baseModelName === right.baseModelName) {
        return left.channelName.localeCompare(right.channelName, "zh-CN");
      }
      return left.baseModelName.localeCompare(right.baseModelName, "zh-CN");
    });

  return {
    bindingCatalog,
    channelMap,
    deploymentMap,
    providerLogoById,
  };
}

export async function loadPoolPageData(params: PoolListPageParams): Promise<PoolPageData> {
  const scopeQuery = normalizePoolScopeSelection(params.scope);
  const poolDataset = await listModelHubPools({
    pageNo: params.pageNo,
    pageSize: params.pageSize,
    total: params.total,
    keyword: params.keyword,
    scopeType: params.scopeType,
    merchantId: scopeQuery.merchantId,
    storeId: scopeQuery.storeId,
    principalId: scopeQuery.principalId,
  });

  return {
    pools: poolDataset.items.map((item) => toPoolListItem(item)),
    page: poolDataset.page,
  };
}

export async function loadPoolEditorData(
  mode: "create" | "edit",
  poolId: string | undefined,
  fallbackScope: PoolScopeSelection,
): Promise<PoolEditorData> {
  const initialPool = mode === "edit" && poolId
    ? await getModelHubPool(poolId)
    : null;
  const targetScope = initialPool ?? fallbackScope;
  const scopeQuery = normalizePoolScopeSelection(targetScope);
  const [{ bindingCatalog, channelMap, deploymentMap, providerLogoById }, bindingRows] = await Promise.all([
    loadBindingCatalogSource(targetScope),
    poolId ? listModelHubBindings(scopeQuery, [poolId]) : Promise.resolve([]),
  ]);

  const poolBindings = poolId
    ? bindingRows
      .filter((item) => item.poolId === poolId)
      .map((item) => toEditorBindingItem(item, channelMap, deploymentMap, providerLogoById))
      .sort((left, right) => left.priority - right.priority)
    : [];

  const value: PoolEditorValue = initialPool
    ? {
      id: initialPool.id,
      poolCode: initialPool.poolCode,
      displayName: initialPool.displayName,
      merchantId: initialPool.merchantId || "",
      storeId: initialPool.storeId || "",
      principalId: initialPool.principalId || "",
      status: toEditorStatus(initialPool.status),
      routingMode: initialPool.routingMode || DEFAULT_ROUTING_MODE,
      bindings: poolBindings,
    }
    : {
      poolCode: "",
      displayName: "",
      merchantId: fallbackScope.merchantId?.trim() || "",
      storeId: fallbackScope.storeId?.trim() || "",
      principalId: fallbackScope.principalId?.trim() || "",
      status: "启用",
      routingMode: DEFAULT_ROUTING_MODE,
      bindings: [],
    };

  return {
    value,
    bindingCatalog,
  };
}

export async function savePool(mode: "create" | "edit", value: PoolEditorValue): Promise<string> {
  let poolId = value.id || "";
  const scopeQuery = normalizePoolScopeSelection(value);

  if (mode === "edit") {
    if (!poolId) {
      throw new Error("缺少待编辑的模型池 ID");
    }
    await updateModelHubPool(poolId, buildPoolCommand(value));
  } else {
    poolId = await createModelHubPool(buildPoolCommand(value));
  }

  await replaceModelHubPoolBindings(
    poolId,
    value.bindings.map((item, index) => buildBindingCommand(item, index + 1, scopeQuery)),
  );

  return poolId;
}
