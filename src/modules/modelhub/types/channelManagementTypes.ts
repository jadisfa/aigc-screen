export type ChannelType = "provider_direct" | "api_aggregator";
export type AuthMode = "shared" | "byok";
export type AuthType = "api_key" | "token" | "ak_sk";
export type ChannelHealthState = "normal" | "degraded" | "down";
export type ChannelStatus = "enabled" | "disabled";

export type ChannelSceneOption = {
  code: string;
  label: string;
  capabilityCode: string;
};

export type ChannelProtocolOption = {
  id: string;
  code: string;
  name: string;
  version: string;
  sceneCode: string;
  invocationStyle: string;
  openaiCompatible: boolean;
};

export type ChannelSceneChip = {
  sceneCode: string;
  sceneLabel: string;
  protocolCode: string;
  protocolLabel: string;
};

export type ChannelScopeSelection = {
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
};

export type ProviderOption = {
  id: string;
  providerCode: string;
  displayName: string;
  logoUrl: string;
};

export type SupportedModelOption = {
  id: string;
  displayName: string;
  providerIds: string[];
};

export type ChannelModelCatalogItem = SupportedModelOption & {
  code: string;
  modelType: string;
  providerId: string;
  providerCode?: string;
  providerDisplayName?: string;
  capabilityCodes: string[];
};

export type ChannelBaseItem = {
  id: string;
  displayName: string;
  channelCode: string;
  merchantId: string;
  storeId: string | null;
  principalId: string | null;
  channelType: ChannelType;
  authMode: AuthMode;
  sceneChips: ChannelSceneChip[];
  providerId: string;
  providerCode: string;
  providerDisplayName: string;
  platformSubject: string;
  supportedModelIds: string[];
  supportedModels: Array<{
    id: string;
    displayName: string;
  }>;
  endpoint: string;
  iconUrl: string;
  healthState: ChannelHealthState;
  status: ChannelStatus;
  updatedAt: string;
};

export type ChannelQuotaAccountSummary = {
  currency: string;
  availableAmount: string;
  usedAmount: string;
  totalAmount: string;
  status: string;
  lastSyncAt: string | null;
};

export type ChannelListItem = ChannelBaseItem & {
  quotaSummary: ChannelQuotaAccountSummary;
};

export type ChannelEditorValue = {
  id?: string;
  name: string;
  channelCode: string;
  merchantId: string;
  storeId: string;
  principalId: string;
  channelType: ChannelType;
  authMode: AuthMode;
  sceneProtocolIds: Record<string, string>;
  sceneConfigJsons: Record<string, string>;
  providerId: string;
  platformSubject: string;
  supportedModelIds: string[];
  modelBillingMultipliers: Record<string, string>;
  /** 上游供应商 model 编码（按目录模型；KIE 等需填官方 model，勿默认等同目录 code） */
  modelUpstreamCodes: Record<string, string>;
  modelPathPrefixes: Record<string, string>;
  endpoint: string;
  iconUrl: string;
  enabled: boolean;
  credentialId?: string | null;
  credentialName: string;
  authType: AuthType;
  primaryCredential: boolean;
  credentialSecret: string;
  credentialMask: string;
};

export type ChannelQuotaLedgerListItem = {
  id: string;
  ledgerType: string;
  changeAmount: string;
  balanceAfter: string;
  bizRef: string;
  traceId: string;
  remark: string;
  status: string;
  createdAt: string;
};

export type ChannelQuotaAdjustmentValue = {
  changeAmount: string;
  balanceAfter: string;
  bizRef: string;
  remark: string;
};

export function getChannelTypeLabel(channelType: ChannelType): string {
  return channelType === "provider_direct" ? "厂商直连" : "聚合平台";
}

export function getAuthModeLabel(authMode: AuthMode): string {
  return authMode === "shared" ? "平台共享" : "商户 BYOK";
}

export function protocolsForScene(sceneCode: string, protocols: ChannelProtocolOption[]): ChannelProtocolOption[] {
  return protocols.filter((item) => item.sceneCode === sceneCode);
}

const FALLBACK_SCENES_BY_CAPABILITY: Record<string, ChannelSceneOption> = {
  three_d_generation: { code: "three_d_generation", label: "3D", capabilityCode: "three_d_generation" },
};

function impliedCapabilityCodes(model: ChannelModelCatalogItem): string[] {
  const codes = [...(model.capabilityCodes || [])];
  if (model.modelType === "three_d" && !codes.includes("three_d_generation")) {
    codes.push("three_d_generation");
  }
  return codes;
}

export function collectRequiredScenes(
  modelIds: string[],
  modelCatalog: ChannelModelCatalogItem[],
  scenes: ChannelSceneOption[],
): ChannelSceneOption[] {
  const capabilityCodes = new Set<string>();
  const modelMap = modelCatalog.reduce<Record<string, ChannelModelCatalogItem>>((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});
  for (const modelId of modelIds) {
    const model = modelMap[modelId];
    if (!model) {
      continue;
    }
    for (const capabilityCode of impliedCapabilityCodes(model)) {
      capabilityCodes.add(capabilityCode);
    }
  }
  const matched = scenes.filter((scene) => capabilityCodes.has(scene.capabilityCode));
  const covered = new Set(matched.map((scene) => scene.capabilityCode));
  const synthesized = Object.values(FALLBACK_SCENES_BY_CAPABILITY).filter(
    (scene) => capabilityCodes.has(scene.capabilityCode) && !covered.has(scene.capabilityCode),
  );
  return [...matched, ...synthesized];
}

export function deriveProviderDirectVendorName(
  modelIds: string[],
  modelCatalog: ChannelModelCatalogItem[],
): string {
  const names = new Set<string>();
  const modelMap = modelCatalog.reduce<Record<string, ChannelModelCatalogItem>>((accumulator, item) => {
    accumulator[item.id] = item;
    return accumulator;
  }, {});
  for (const modelId of modelIds) {
    const model = modelMap[modelId];
    const name = (model?.providerDisplayName || model?.providerCode || "").trim();
    if (name) {
      names.add(name);
    }
  }
  return names.size === 1 ? [...names][0] : "";
}

export function scenesRequiringProtocolChoice(
  requiredScenes: ChannelSceneOption[],
  protocols: ChannelProtocolOption[],
): ChannelSceneOption[] {
  return requiredScenes.filter((scene) => protocolsForScene(scene.code, protocols).length >= 2);
}

export function resolveSingleSceneProtocol(
  sceneCode: string,
  protocols: ChannelProtocolOption[],
): ChannelProtocolOption | null {
  const available = protocolsForScene(sceneCode, protocols);
  return available.length === 1 ? available[0] : null;
}

export function resolveSceneProtocolId(
  sceneCode: string,
  protocols: ChannelProtocolOption[],
  chosen: Record<string, string>,
): string | null {
  const selected = chosen[sceneCode]?.trim();
  if (selected) {
    return selected;
  }
  const available = protocolsForScene(sceneCode, protocols);
  if (available.length === 1) {
    return available[0].id;
  }
  return null;
}

export function protocolLabel(
  protocolId: string,
  protocols: ChannelProtocolOption[],
): string {
  const matched = protocols.find((item) => item.id === protocolId);
  return matched?.name || matched?.code || protocolId;
}

export function getChannelStatusLabel(status: ChannelStatus): string {
  return status === "enabled" ? "启用" : "停用";
}

export function getHealthStateLabel(healthState: ChannelHealthState): string {
  if (healthState === "normal") return "正常";
  if (healthState === "degraded") return "降级";
  return "不可用";
}

export function formatChannelQuotaSummaryValue(summary: ChannelQuotaAccountSummary): string {
  return `${summary.currency} ${summary.availableAmount || "0"}`;
}

export function formatDecimalAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "0";
  }
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }
  return amount.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function getChannelQuotaStatusLabel(status: string): string {
  if (status === "warning") return "预警";
  if (status === "exhausted") return "已耗尽";
  if (status === "normal") return "正常";
  return "未知";
}

export function getChannelLedgerTypeLabel(type: string): string {
  if (type === "sync_increase") return "同步增加";
  if (type === "sync_decrease") return "同步扣减";
  if (type === "freeze") return "冻结";
  if (type === "unfreeze") return "解冻";
  return "手工调整";
}

export function getChannelLedgerStatusLabel(status: string): string {
  return status === "reversed" ? "已冲销" : "已入账";
}

export function getChannelLedgerSourceLabel(source: string): string {
  const normalized = source.trim().toLowerCase();
  if (!normalized) {
    return "-";
  }
  if (normalized === "manual") {
    return "平台人工充值";
  }
  if (normalized === "online") {
    return "线上充值";
  }
  if (normalized === "manual_adjust") {
    return "人工调整";
  }
  return source;
}

export function getSupportedModelLabels(modelIds: string[], options: SupportedModelOption[]): string[] {
  const optionMap = options.reduce<Record<string, string>>((accumulator, item) => {
    accumulator[item.id] = item.displayName;
    return accumulator;
  }, {});
  return modelIds.map((item) => optionMap[item]).filter(Boolean);
}

const PATH_PREFIX_KEY = "pathPrefix";
const REQUEST_PATH_KEY = "requestPath";

export function readDeploymentPathPrefix(parameterOverridesJson?: string | null): string {
  if (!parameterOverridesJson?.trim()) {
    return "";
  }
  try {
    const parsed = JSON.parse(parameterOverridesJson) as Record<string, unknown>;
    const requestPath = typeof parsed[REQUEST_PATH_KEY] === "string" ? parsed[REQUEST_PATH_KEY].trim() : "";
    if (requestPath) {
      return requestPath;
    }
    return typeof parsed[PATH_PREFIX_KEY] === "string" ? parsed[PATH_PREFIX_KEY].trim() : "";
  } catch {
    return "";
  }
}

export function writeDeploymentPathPrefix(
  parameterOverridesJson: string | null | undefined,
  pathPrefix: string,
): string | undefined {
  let parsed: Record<string, unknown> = {};
  if (parameterOverridesJson?.trim()) {
    try {
      const current = JSON.parse(parameterOverridesJson);
      if (current && typeof current === "object" && !Array.isArray(current)) {
        parsed = { ...(current as Record<string, unknown>) };
      }
    } catch {
      parsed = {};
    }
  }
  const normalized = pathPrefix.trim();
  if (normalized) {
    parsed[PATH_PREFIX_KEY] = normalized;
  } else {
    delete parsed[PATH_PREFIX_KEY];
  }
  delete parsed[REQUEST_PATH_KEY];
  return Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : undefined;
}
