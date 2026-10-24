import { formatModelHubDateTime } from "@/modules/modelhub/services/modelhubAdminUi";
import {
  collectRequiredScenes,
  deriveProviderDirectVendorName,
  formatDecimalAmount,
  protocolLabel,
  readDeploymentPathPrefix,
  resolveSceneProtocolId,
  writeDeploymentPathPrefix,
  type ChannelEditorValue,
  type ChannelListItem,
  type ChannelModelCatalogItem,
  type ChannelProtocolOption,
  type ChannelQuotaAccountSummary,
  type ChannelQuotaAdjustmentValue,
  type ChannelQuotaLedgerListItem,
  type ChannelSceneChip,
  type ChannelSceneOption,
  type ChannelScopeSelection,
  type ProviderOption,
} from "@/modules/modelhub/types/channelManagementTypes";
import {
  createModelHubChannel,
  createModelHubChannelCredential,
  createModelHubChannelQuotaLedger,
  getModelHubChannel,
  getModelHubChannelEditorOptions,
  getModelHubChannelQuotaAccount,
  listModelHubBaseModelsCatalog,
  listModelHubChannelCredentials,
  listModelHubChannelDeployments,
  listModelHubChannelDeploymentsByIds,
  listModelHubChannelQuotaAccountsByIds,
  listModelHubChannelQuotaLedgers,
  listModelHubChannelScenes,
  listModelHubChannelScenesByIds,
  listModelHubChannels,
  listModelHubProviders,
  updateModelHubChannel,
  updateModelHubChannelCredential,
  type ListModelHubChannelsParams,
  type ModelHubBaseModel,
  type ModelHubChannel,
  type ModelHubChannelCredential,
  type ModelHubChannelDeployment,
  type ModelHubChannelQuotaAccount,
  type ModelHubChannelScene,
  type ModelHubScopeQuery,
  type ModelHubProvider,
  type UpsertModelHubChannelCommand,
  type UpsertModelHubChannelCredentialCommand,
} from "@/shared/api/model-hub/model-hub";

type ChannelPageData = {
  providers: ProviderOption[];
  modelCatalog: ChannelModelCatalogItem[];
  channels: ChannelListItem[];
  scenes: ChannelSceneOption[];
  protocols: ChannelProtocolOption[];
  page: {
    pageNo: number;
    pageSize: number;
    total: number;
  };
};

export type ChannelListPageParams = Omit<ListModelHubChannelsParams, "merchantId" | "storeId" | "principalId"> & {
  scope?: ChannelScopeSelection;
};

type ChannelDetailData = {
  editorValue: ChannelEditorValue;
  quotaSummary: ChannelQuotaAccountSummary;
  ledgers: ChannelQuotaLedgerListItem[];
};

function toProviderOption(item: ModelHubProvider): ProviderOption {
  return {
    id: item.id,
    providerCode: item.providerCode,
    displayName: item.displayName,
    logoUrl: item.logoUrl || "",
  };
}

function toModelCatalogItem(
  item: ModelHubBaseModel,
  providers?: Record<string, ProviderOption>,
): ChannelModelCatalogItem {
  const provider = providers?.[item.providerId];
  return {
    id: item.id,
    displayName: item.name,
    providerIds: [item.providerId],
    code: item.code,
    modelType: item.modelType,
    providerId: item.providerId,
    providerCode: provider?.providerCode || "",
    providerDisplayName: provider?.displayName || "",
    capabilityCodes: item.capabilities || [],
  };
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() || "";
}

function normalizeEndpointValue(value: string | null | undefined): string {
  let normalized = normalizeText(value);
  while (normalized.length >= 2) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    const wrappedByBackticks = first === "`" && last === "`";
    const wrappedByDoubleQuotes = first === "\"" && last === "\"";
    const wrappedBySingleQuotes = first === "'" && last === "'";
    if (!wrappedByBackticks && !wrappedByDoubleQuotes && !wrappedBySingleQuotes) {
      break;
    }
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function normalizeCompareValue(value: string | null | undefined): string {
  return normalizeText(value).toLowerCase();
}

function resolvePlatformProvider(
  channel: Pick<ModelHubChannel, "vendorName">,
  deployments: ModelHubChannelDeployment[],
  providers: ProviderOption[],
  providerMap: Record<string, ProviderOption>,
): ProviderOption | null {
  const vendorName = normalizeCompareValue(channel.vendorName);
  if (vendorName) {
    const matchedProvider = providers.find((item) =>
      normalizeCompareValue(item.displayName) === vendorName || normalizeCompareValue(item.providerCode) === vendorName,
    );
    if (matchedProvider) {
      return matchedProvider;
    }
  }

  const deploymentProviderIds = Array.from(
    new Set(
      deployments
        .map((item) => item.providerId)
        .filter((item): item is string => Boolean(item && item.trim())),
    ),
  );

  if (deploymentProviderIds.length === 1) {
    return providerMap[deploymentProviderIds[0]] || null;
  }
  return null;
}

function buildPlatformSubject(
  vendorName: string | null | undefined,
  platformProvider: ProviderOption | null,
): string {
  const normalizedVendorName = normalizeText(vendorName);
  if (!normalizedVendorName) {
    return "";
  }
  if (!platformProvider) {
    return normalizedVendorName;
  }
  const compareValue = normalizeCompareValue(normalizedVendorName);
  if (
    compareValue === normalizeCompareValue(platformProvider.displayName)
    || compareValue === normalizeCompareValue(platformProvider.providerCode)
  ) {
    return "";
  }
  return normalizedVendorName;
}

function buildQuotaSummary(account: ModelHubChannelQuotaAccount | null | undefined): ChannelQuotaAccountSummary {
  return {
    currency: account?.currency || "CNY",
    availableAmount: formatDecimalAmount(account?.availableQuota),
    usedAmount: formatDecimalAmount(account?.usedQuota),
    totalAmount: formatDecimalAmount(account?.totalQuota),
    status: account?.status || "unknown",
    lastSyncAt: formatModelHubDateTime(account?.lastSyncAt),
  };
}

function toQuotaLedgerListItem(change: Awaited<ReturnType<typeof listModelHubChannelQuotaLedgers>>[number]): ChannelQuotaLedgerListItem {
  return {
    id: change.id,
    ledgerType: change.ledgerType,
    changeAmount: formatDecimalAmount(change.changeAmount),
    balanceAfter: formatDecimalAmount(change.balanceAfter),
    bizRef: change.bizRef || "",
    traceId: change.traceId || "",
    remark: change.remark || "",
    status: change.status,
    createdAt: formatModelHubDateTime(change.createdAt),
  };
}

function buildVendorName(value: ChannelEditorValue, modelCatalog: ChannelModelCatalogItem[]): string {
  const subject = value.platformSubject.trim();
  if (value.channelType === "api_aggregator") {
    return subject;
  }
  return deriveProviderDirectVendorName(value.supportedModelIds, modelCatalog) || subject;
}

function buildChannelCommand(
  value: ChannelEditorValue,
  modelCatalog: ChannelModelCatalogItem[],
  healthState: string | undefined,
  scenes: UpsertModelHubChannelCommand["scenes"],
  deployments: UpsertModelHubChannelCommand["deployments"],
): UpsertModelHubChannelCommand {
  return {
    channelCode: value.channelCode.trim(),
    displayName: value.name.trim(),
    merchantId: value.merchantId.trim() || undefined,
    storeId: value.storeId.trim() || undefined,
    principalId: value.principalId.trim() || undefined,
    channelType: value.channelType,
    authMode: value.authMode,
    endpoint: normalizeEndpointValue(value.endpoint),
    iconUrl: normalizeEndpointValue(value.iconUrl),
    vendorName: buildVendorName(value, modelCatalog) || undefined,
    status: value.enabled ? "enabled" : "disabled",
    healthState: healthState === "degraded" || healthState === "down" ? healthState : "normal",
    scenes,
    deployments,
  };
}

function normalizeChannelScope(scope?: ChannelScopeSelection): ModelHubScopeQuery {
  return {
    merchantId: scope?.merchantId?.trim() || null,
    storeId: scope?.storeId?.trim() || null,
    principalId: scope?.principalId?.trim() || null,
  };
}

function maskChannelCredential(secret: string): string {
  const value = secret.trim();
  if (!value) {
    return "";
  }
  if (value.length <= 12) {
    return `${value.slice(0, Math.min(4, value.length))}****`;
  }
  return `${value.slice(0, 8)}****${value.slice(-4)}`;
}

function buildCredentialCommand(
  value: ChannelEditorValue,
  existing: ModelHubChannelCredential | null,
): UpsertModelHubChannelCredentialCommand {
  const secret = value.credentialSecret.trim();
  return {
    credentialName: value.credentialName.trim() || existing?.credentialName || "主凭证",
    authType: value.authType,
    // 编辑留空表示不轮换密钥；勿传空串，避免后端误清空。
    credentialCiphertext: secret || undefined,
    credentialMask: secret
      ? maskChannelCredential(secret)
      : existing?.credentialMask || value.credentialMask.trim() || undefined,
    primaryCredential: value.primaryCredential,
    lastVerifiedStatus: existing?.lastVerifiedStatus || "unknown",
  };
}

function buildDeploymentCommand(
  value: ChannelEditorValue,
  model: ChannelModelCatalogItem,
  sceneCode: string,
  existing: ModelHubChannelDeployment | null,
): NonNullable<UpsertModelHubChannelCommand["deployments"]>[number] {
  const trimmedChannelCode = value.channelCode.trim();
  const parsedMultiplier = Number(value.modelBillingMultipliers[model.id] || existing?.billingMultiplier || 1);
  const upstreamModelCode = (value.modelUpstreamCodes[model.id] || "").trim();
  if (!upstreamModelCode) {
    throw new Error(`请填写「${model.displayName || model.code}」的上游模型编码`);
  }
  return {
    sceneCode,
    providerId: model.providerId,
    baseModelId: model.id,
    deploymentCode: existing?.deploymentCode || `${trimmedChannelCode}-${model.code}-${sceneCode}`.replace(/\s+/g, "-"),
    upstreamModelCode,
    billingMultiplier: Number.isFinite(parsedMultiplier) && parsedMultiplier > 0 ? parsedMultiplier : 1,
    displayName: existing?.displayName || model.displayName,
    modelType: existing?.modelType || model.modelType,
    publicApi: existing?.publicApi ?? true,
    status: value.enabled ? "enabled" : "disabled",
    healthState:
      existing?.healthState === "healthy"
      || existing?.healthState === "degraded"
      || existing?.healthState === "unhealthy"
      || existing?.healthState === "unknown"
        ? existing.healthState
        : "unknown",
    parameterOverridesJson: writeDeploymentPathPrefix(
      existing?.parameterOverridesJson,
      value.modelPathPrefixes[model.id] || "",
    ),
  };
}

function assertChannelValue(value: ChannelEditorValue): void {
  if (!value.name.trim()) {
    throw new Error("请输入渠道名称");
  }
  if (!value.channelCode.trim()) {
    throw new Error("请输入渠道编码");
  }
  if (value.storeId.trim() && !value.merchantId.trim()) {
    throw new Error("门店归属必须同时指定商户");
  }
  if (!value.endpoint.trim()) {
    throw new Error("请输入接入 Endpoint");
  }
  for (const modelId of value.supportedModelIds) {
    const multiplierText = (value.modelBillingMultipliers[modelId] || "1").trim();
    const multiplier = Number(multiplierText);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new Error("请为已选模型填写大于 0 的成本倍率");
    }
    const upstream = (value.modelUpstreamCodes[modelId] || "").trim();
    if (!upstream) {
      throw new Error("请为已选模型填写上游模型编码（供应商 API model，可能与目录编码不同）");
    }
  }
}

async function loadNestedChannelData(channelId: string): Promise<{
  quotaAccount: ModelHubChannelQuotaAccount | null;
  deployments: ModelHubChannelDeployment[];
}> {
  const [quotaAccount, deployments] = await Promise.all([
    getModelHubChannelQuotaAccount(channelId).catch(() => null),
    listModelHubChannelDeployments(channelId).catch(() => []),
  ]);
  return { quotaAccount, deployments };
}

export async function loadChannelPageData(params: ChannelListPageParams): Promise<ChannelPageData> {
  const scopeQuery = normalizeChannelScope(params.scope);
  const [channelDataset, editorOptions] = await Promise.all([
    listModelHubChannels({
      pageNo: params.pageNo,
      pageSize: params.pageSize,
      total: params.total,
      keyword: params.keyword,
      channelType: params.channelType,
      authMode: params.authMode,
      status: params.status,
      merchantId: scopeQuery.merchantId,
      storeId: scopeQuery.storeId,
      principalId: scopeQuery.principalId,
    }),
    getModelHubChannelEditorOptions(),
  ]);

  const channelRows = channelDataset.items;
  const channelIds = channelRows.map((item) => item.id);
  const [deployments, quotaAccounts, scenes] = await Promise.all([
    listModelHubChannelDeploymentsByIds(channelIds).catch(() => [] as ModelHubChannelDeployment[]),
    listModelHubChannelQuotaAccountsByIds(channelIds).catch(() => [] as ModelHubChannelQuotaAccount[]),
    listModelHubChannelScenesByIds(channelIds).catch(() => [] as ModelHubChannelScene[]),
  ]);
  const deploymentsByChannel = deployments.reduce<Record<string, ModelHubChannelDeployment[]>>((accumulator, item) => {
    const current = accumulator[item.channelId] || [];
    current.push(item);
    accumulator[item.channelId] = current;
    return accumulator;
  }, {});
  const quotaByChannel = quotaAccounts.reduce<Record<string, ModelHubChannelQuotaAccount>>((accumulator, item) => {
    accumulator[item.channelId] = item;
    return accumulator;
  }, {});
  const scenesByChannel = scenes.reduce<Record<string, ModelHubChannelScene[]>>((accumulator, item) => {
    const current = accumulator[item.channelId] || [];
    current.push(item);
    accumulator[item.channelId] = current;
    return accumulator;
  }, {});
  const sceneOptions = editorOptions.scenes || [];
  const protocolOptions = editorOptions.protocols || [];

  const channels = channelRows.map((item) => {
    const nestedDeployments = deploymentsByChannel[item.id] || [];
    const nestedQuota = quotaByChannel[item.id] || null;
    const nestedScenes = scenesByChannel[item.id] || [];
    const supportedModels: Array<{ id: string; displayName: string }> = [];
    const seenModelIds = new Set<string>();
    nestedDeployments.forEach((deployment) => {
      if (!deployment.baseModelId || seenModelIds.has(deployment.baseModelId)) {
        return;
      }
      seenModelIds.add(deployment.baseModelId);
      supportedModels.push({
        id: deployment.baseModelId,
        displayName: deployment.displayName?.trim()
          || deployment.upstreamModelCode?.trim()
          || deployment.baseModelId
          || "-",
      });
    });
    const supportedModelIds = supportedModels.map((model) => model.id);
    const sceneChips: ChannelSceneChip[] = nestedScenes.map((scene) => {
      const sceneOption = sceneOptions.find((option) => option.code === scene.sceneCode);
      return {
        sceneCode: scene.sceneCode,
        sceneLabel: sceneOption?.label || scene.sceneCode,
        protocolCode: scene.protocolCode || scene.protocolId,
        protocolLabel: protocolLabel(scene.protocolId, protocolOptions) || scene.protocolCode || scene.protocolId,
      };
    });
    return {
      id: item.id,
      displayName: item.displayName,
      channelCode: item.channelCode,
      merchantId: item.merchantId || "",
      storeId: item.storeId || null,
      principalId: item.principalId || null,
      channelType: item.channelType,
      authMode: item.authMode,
      sceneChips,
      providerId: "",
      providerCode: "",
      providerDisplayName: normalizeText(item.vendorName) || "-",
      platformSubject: buildPlatformSubject(item.vendorName, null),
      supportedModelIds,
      supportedModels,
      endpoint: normalizeEndpointValue(item.endpoint),
      iconUrl: normalizeEndpointValue(item.iconUrl),
      healthState: item.healthState,
      status: item.status,
      updatedAt: formatModelHubDateTime(item.updatedAt),
      quotaSummary: buildQuotaSummary(nestedQuota),
    } satisfies ChannelListItem;
  });

  return {
    providers: [],
    modelCatalog: [],
    channels,
    scenes: sceneOptions,
    protocols: protocolOptions,
    page: channelDataset.page,
  };
}

export async function loadChannelEditorCatalog(): Promise<{
  providers: ProviderOption[];
  modelCatalog: ChannelModelCatalogItem[];
}> {
  const [providerRows, modelRows] = await Promise.all([
    listModelHubProviders(),
    listModelHubBaseModelsCatalog(),
  ]);
  const providers = providerRows.map(toProviderOption);
  const providerMap = providers.reduce<Record<string, ProviderOption>>((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});
  return {
    providers,
    modelCatalog: modelRows.map((item) => toModelCatalogItem(item, providerMap)),
  };
}

export async function loadChannelDetail(
  channelId: string,
  providers: ProviderOption[],
  modelCatalog: ChannelModelCatalogItem[],
): Promise<ChannelDetailData> {
  const [channel, credentials, deployments, scenes, quotaAccount, ledgers] = await Promise.all([
    getModelHubChannel(channelId),
    listModelHubChannelCredentials(channelId),
    listModelHubChannelDeployments(channelId),
    listModelHubChannelScenes(channelId).catch(() => [] as ModelHubChannelScene[]),
    getModelHubChannelQuotaAccount(channelId).catch(() => null),
    listModelHubChannelQuotaLedgers(channelId).catch(() => []),
  ]);

  const providerMap = providers.reduce<Record<string, ProviderOption>>((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});
  const primaryCredential = credentials.find((item) => item.primaryCredential) || credentials[0] || null;
  const platformProvider = resolvePlatformProvider(channel, deployments, providers, providerMap);

  return {
    editorValue: {
      id: channel.id,
      name: channel.displayName,
      channelCode: channel.channelCode,
      merchantId: channel.merchantId || "",
      storeId: channel.storeId || "",
      principalId: channel.principalId || "",
      channelType: channel.channelType,
      authMode: channel.authMode,
      sceneProtocolIds: scenes.reduce<Record<string, string>>((accumulator, item) => {
        if (item.sceneCode && item.protocolId) {
          accumulator[item.sceneCode] = item.protocolId;
        }
        return accumulator;
      }, {}),
      sceneConfigJsons: scenes.reduce<Record<string, string>>((accumulator, item) => {
        if (item.sceneCode && item.configJson && item.configJson.trim() && item.configJson.trim() !== "{}") {
          accumulator[item.sceneCode] = item.configJson;
        }
        return accumulator;
      }, {}),
      providerId: platformProvider?.id || "",
      platformSubject: buildPlatformSubject(channel.vendorName, platformProvider),
      supportedModelIds: Array.from(new Set(deployments.map((item) => item.baseModelId).filter(Boolean) as string[])),
      modelBillingMultipliers: deployments.reduce<Record<string, string>>((accumulator, item) => {
        if (item.baseModelId) {
          accumulator[item.baseModelId] = String(item.billingMultiplier ?? 1);
        }
        return accumulator;
      }, {}),
      modelUpstreamCodes: deployments.reduce<Record<string, string>>((accumulator, item) => {
        if (!item.baseModelId || accumulator[item.baseModelId]) {
          return accumulator;
        }
        const upstream = item.upstreamModelCode?.trim();
        if (upstream) {
          accumulator[item.baseModelId] = upstream;
        }
        return accumulator;
      }, {}),
      modelPathPrefixes: deployments.reduce<Record<string, string>>((accumulator, item) => {
        if (!item.baseModelId || accumulator[item.baseModelId]) {
          return accumulator;
        }
        const prefix = readDeploymentPathPrefix(item.parameterOverridesJson);
        if (prefix) {
          accumulator[item.baseModelId] = prefix;
        }
        return accumulator;
      }, {}),
      endpoint: normalizeEndpointValue(channel.endpoint),
      iconUrl: normalizeEndpointValue(channel.iconUrl),
      enabled: channel.status === "enabled",
      credentialId: primaryCredential?.id || null,
      credentialName: primaryCredential?.credentialName || "",
      authType: (primaryCredential?.authType as ChannelEditorValue["authType"]) || "api_key",
      primaryCredential: primaryCredential?.primaryCredential ?? true,
      credentialSecret: "",
      credentialMask: primaryCredential?.credentialMask || "",
    },
    quotaSummary: buildQuotaSummary(quotaAccount),
    ledgers: ledgers.map(toQuotaLedgerListItem),
  };
}

export async function saveChannel(
  mode: "create" | "edit",
  value: ChannelEditorValue,
  modelCatalog: ChannelModelCatalogItem[],
): Promise<string> {
  assertChannelValue(value);

  let channelId = value.id || "";
  let existingCredentials: ModelHubChannelCredential[] = [];
  let existingHealthState: string | undefined;
  let existingDeployments: ModelHubChannelDeployment[] = [];
  let existingScenes: ModelHubChannelScene[] = [];

  if (mode === "edit") {
    if (!channelId) {
      throw new Error("缺少待编辑的渠道 ID");
    }
    const [channel, credentials, deployments, scenes] = await Promise.all([
      getModelHubChannel(channelId),
      listModelHubChannelCredentials(channelId),
      listModelHubChannelDeployments(channelId),
      listModelHubChannelScenes(channelId).catch(() => [] as ModelHubChannelScene[]),
    ]);
    existingCredentials = credentials;
    existingDeployments = deployments;
    existingScenes = scenes;
    existingHealthState = channel.healthState;
  }

  const modelMap = modelCatalog.reduce<Record<string, ChannelModelCatalogItem>>((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});
  const editorOptions = await getModelHubChannelEditorOptions();
  const sceneOptions = editorOptions.scenes || [];
  const protocolOptions = editorOptions.protocols || [];
  const requiredScenes = collectRequiredScenes(value.supportedModelIds, modelCatalog, sceneOptions);
  const sceneItems = requiredScenes.map((scene) => {
    const protocolId = resolveSceneProtocolId(
      scene.code,
      protocolOptions,
      value.sceneProtocolIds,
    );
    if (!protocolId) {
      throw new Error(`请选择「${scene.label}」调用协议`);
    }
    return {
      sceneCode: scene.code,
      protocolId,
      configJson: value.sceneConfigJsons[scene.code]?.trim() || undefined,
    };
  });
  const existingSceneCodeById = new Map(existingScenes.map((item) => [item.id, item.sceneCode]));
  const existingBySceneCodeAndModel = new Map<string, ModelHubChannelDeployment>();
  existingDeployments.forEach((item) => {
    const sceneCode = existingSceneCodeById.get(item.channelSceneId);
    if (!sceneCode || !item.baseModelId) {
      return;
    }
    existingBySceneCodeAndModel.set(`${sceneCode}:${item.baseModelId}`, item);
  });
  const deploymentItems = value.supportedModelIds.flatMap((modelId) => {
    const model = modelMap[modelId];
    if (!model) {
      return [];
    }
    return collectRequiredScenes([modelId], modelCatalog, sceneOptions).map((scene) =>
      buildDeploymentCommand(
        value,
        model,
        scene.code,
        existingBySceneCodeAndModel.get(`${scene.code}:${modelId}`) || null,
      ),
    );
  });
  const coveredSceneCodes = new Set(sceneItems.map((item) => item.sceneCode));
  for (const deployment of deploymentItems) {
    if (coveredSceneCodes.has(deployment.sceneCode)) {
      continue;
    }
    const protocolId = resolveSceneProtocolId(
      deployment.sceneCode,
      protocolOptions,
      value.sceneProtocolIds,
    );
    if (!protocolId) {
      throw new Error(`请选择「${deployment.sceneCode}」调用协议`);
    }
    sceneItems.push({
      sceneCode: deployment.sceneCode,
      protocolId,
      configJson: value.sceneConfigJsons[deployment.sceneCode]?.trim() || undefined,
    });
    coveredSceneCodes.add(deployment.sceneCode);
  }
  const channelCommand = buildChannelCommand(value, modelCatalog, existingHealthState, sceneItems, deploymentItems);

  if (mode === "edit") {
    await updateModelHubChannel(channelId, channelCommand);
  } else {
    channelId = await createModelHubChannel(channelCommand);
  }

  const editableCredential =
    existingCredentials.find((item) => item.id === value.credentialId)
    || existingCredentials.find((item) => item.primaryCredential)
    || existingCredentials[0]
    || null;

  if (value.credentialName.trim() || value.credentialSecret.trim() || editableCredential) {
    const credentialCommand = buildCredentialCommand(value, editableCredential);
    if (editableCredential) {
      await updateModelHubChannelCredential(channelId, editableCredential.id, credentialCommand);
    } else {
      await createModelHubChannelCredential(channelId, credentialCommand);
    }
  }

  return channelId;
}

export async function createChannelQuotaAdjustment(
  channelId: string,
  value: ChannelQuotaAdjustmentValue,
): Promise<void> {
  await createModelHubChannelQuotaLedger(channelId, {
    ledgerType: "manual_adjust",
    changeAmount: Number(value.changeAmount),
    balanceAfter: value.balanceAfter.trim() ? Number(value.balanceAfter) : undefined,
    bizRef: value.bizRef.trim() || undefined,
    remark: value.remark.trim() || undefined,
    status: "recorded",
  });
}

export async function loadChannelQuotaDetail(channelId: string): Promise<{
  quotaSummary: ChannelQuotaAccountSummary;
  ledgers: ChannelQuotaLedgerListItem[];
}> {
  const [quotaAccount, ledgers] = await Promise.all([
    getModelHubChannelQuotaAccount(channelId).catch(() => null),
    listModelHubChannelQuotaLedgers(channelId).catch(() => []),
  ]);

  return {
    quotaSummary: buildQuotaSummary(quotaAccount),
    ledgers: ledgers.map(toQuotaLedgerListItem),
  };
}
