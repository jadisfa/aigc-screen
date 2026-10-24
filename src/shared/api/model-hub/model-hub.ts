import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams, type PageSearchParamsInput } from "@/shared/api/sys/paging";

export const MODEL_HUB_ADMIN_API_PREFIX = "/api/v1/admin/model";

export type ModelHubStatus = "enabled" | "disabled";
export type ModelHubHealthState = "normal" | "degraded" | "down";
export type ModelHubRoutingMode = "balanced" | "cost_first" | "stability_first";
export type ModelHubAuthMode = "shared" | "byok";
export type ModelHubChannelType = "provider_direct" | "api_aggregator";
export type ModelHubGuardrailAction = "block" | "review" | "alert";
export type ModelHubGuardrailRiskLevel = "low" | "medium" | "high";
export type ModelHubGuardrailStatus = "draft" | "enabled" | "disabled";
export type ModelHubCredentialVerifyStatus = "unknown" | "passed" | "failed";
export type ModelHubQuotaStatus = "unknown" | "normal" | "warning" | "exhausted";
export type ModelHubQuotaType = "amount" | "tokens" | "requests";
export type ModelHubQuotaLedgerType =
  | "sync_increase"
  | "sync_decrease"
  | "manual_adjust"
  | "freeze"
  | "unfreeze";
export type ModelHubQuotaLedgerStatus = "recorded" | "reversed";
export type ModelHubBaseModelStatus = "enabled" | "maintaining" | "offline";
export type ModelHubScopeType = "platform" | "merchant" | "store";
export type ModelHubScopeQuery = {
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
};

export type ModelHubCodeLabelOption = {
  value: string;
  label: string;
};

export type ModelHubSceneOption = {
  code: string;
  label: string;
  capabilityCode: string;
};

export type ModelHubProtocolOption = {
  id: string;
  code: string;
  name: string;
  version: string;
  sceneCode: string;
  invocationStyle: string;
  openaiCompatible: boolean;
};

export type ModelHubProtocolCatalogItem = {
  id: string;
  code: string;
  name: string;
  version: string;
  transportType: string;
  invocationStyle: string;
  adapterKind: string;
  sceneCodes: string[];
  definition: Record<string, unknown>;
  isSystem: boolean;
  status: ModelHubStatus;
  bindingCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubProtocolCatalogSummary = {
  totalCount: number;
  enabledCount: number;
  systemCount: number;
  customCount: number;
};

export type UpsertModelHubProtocolCommand = {
  code: string;
  name: string;
  version: string;
  status: ModelHubStatus;
  definition: Record<string, unknown>;
};

export type ModelHubChannelEditorOptions = {
  scenes: ModelHubSceneOption[];
  protocols: ModelHubProtocolOption[];
};

export type ModelHubChannelScene = {
  id: string;
  channelId: string;
  sceneCode: string;
  protocolId: string;
  protocolCode?: string;
  configJson?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubProvider = {
  id: string;
  providerCode: string;
  displayName: string;
  logoUrl: string | null;
  description: string | null;
  status: ModelHubStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubChannel = {
  id: string;
  channelCode: string;
  displayName: string;
  merchantId: string | null;
  storeId: string | null;
  principalId: string | null;
  channelType: ModelHubChannelType;
  authMode: ModelHubAuthMode;
  endpoint: string | null;
  iconUrl: string | null;
  vendorName: string | null;
  status: ModelHubStatus;
  healthState: ModelHubHealthState;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubChannelCredential = {
  id: string;
  channelId: string;
  credentialName: string;
  authType: string;
  credentialMask: string | null;
  primaryCredential: boolean;
  lastVerifiedStatus: ModelHubCredentialVerifyStatus;
  lastVerifiedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubChannelDeployment = {
  id: string;
  channelId: string;
  channelSceneId: string;
  providerId: string | null;
  baseModelId: string | null;
  deploymentCode: string;
  upstreamModelCode: string;
  billingMultiplier: number | null;
  displayName: string;
  modelType: string;
  publicApi: boolean;
  status: ModelHubStatus;
  healthState: "healthy" | "degraded" | "unhealthy" | "unknown";
  parameterOverridesJson?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubChannelQuotaAccount = {
  id: string | null;
  channelId: string;
  quotaType: ModelHubQuotaType;
  currency: string;
  totalQuota: number | null;
  usedQuota: number;
  availableQuota: number;
  status: ModelHubQuotaStatus;
  lastSyncAt: string | null;
  updatedAt: string | null;
};

export type ModelHubChannelQuotaLedger = {
  id: string;
  channelId: string;
  quotaAccountId: string | null;
  ledgerType: ModelHubQuotaLedgerType;
  changeAmount: number;
  balanceAfter: number | null;
  fundLedgerId: string | null;
  bizRef: string | null;
  traceId: string | null;
  remark: string | null;
  status: ModelHubQuotaLedgerStatus;
  createdAt: string | null;
};

export type ModelHubBaseModelCapabilityConfig = {
  boundary: Record<string, unknown>;
  defaults: Record<string, unknown>;
  pricing: Record<string, unknown>;
};

export type ModelHubBaseModel = {
  id: string;
  providerId: string;
  providerCode: string | null;
  code: string;
  name: string;
  modelType: string;
  capabilities: string[];
  capabilityConfigs: Record<string, ModelHubBaseModelCapabilityConfig>;
  contextWindow: string;
  maxInputTokens: string;
  maxOutputTokens: string;
  description: string | null;
  status: ModelHubBaseModelStatus;
  poolCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubPool = {
  id: string;
  poolCode: string;
  displayName: string;
  merchantId: string | null;
  storeId: string | null;
  principalId: string | null;
  status: ModelHubStatus;
  routingMode: ModelHubRoutingMode;
  bindingCount?: number | null;
  candidateModels?: Array<{
    id: string;
    displayName: string;
    providerLogoUrl: string;
  }> | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubPoolBinding = {
  id: string;
  poolId: string;
  poolCode: string;
  channelId: string;
  channelCode: string;
  baseModelId: string;
  modelCode: string;
  candidateCode: string;
  status: ModelHubStatus;
  healthState: ModelHubHealthState;
  weight: number;
  priority: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubRoutingProfileStatus = "enabled" | "disabled";
export type ModelHubTenantLevel = "platform" | "merchant" | "consumer";
export type ModelHubRegionLevel = "domestic" | "asia_pacific" | "europe" | "north_america";
export type ModelHubRouteEntryCode =
  | "chat"
  | "embedding"
  | "image_generation"
  | "audio_transcription"
  | "audio_synthesis"
  | "video_generation"
  | "three_d_generation";
export type ModelHubChannelPolicy = "follow_pool" | "shared_first" | "byok_first" | "fixed";
export type ModelHubUnmatchedBehavior = "fallback_to_system_default" | "reject";

export type ModelHubRoutingProfileEntry = {
  entry: ModelHubRouteEntryCode;
  targetPoolId: string;
  targetPoolCode?: string | null;
  targetPoolLabel?: string | null;
  channelPolicy: ModelHubChannelPolicy;
  fixedChannelId: string;
  routingMode?: ModelHubRoutingMode | null;
};

export type ModelHubRoutingProfileDefaultBehavior = {
  unmatchedBehavior: ModelHubUnmatchedBehavior;
  fallbackPoolId: string;
  fallbackPoolCode?: string | null;
  fallbackPoolLabel?: string | null;
};

export type ModelHubRoutingProfile = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  merchantId: string | null;
  storeId: string | null;
  principalId: string | null;
  status: ModelHubRoutingProfileStatus;
  isSystemDefault: boolean;
  attachCount: number;
  tenantDefaultBindingCount: number;
  applicableTenantLevels: ModelHubTenantLevel[];
  applicableRegions: ModelHubRegionLevel[];
  defaultBehavior: ModelHubRoutingProfileDefaultBehavior;
  entries: ModelHubRoutingProfileEntry[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubGuardrail = {
  id: string;
  name: string;
  riskLevel: ModelHubGuardrailRiskLevel;
  matchItems: string[];
  action: ModelHubGuardrailAction;
  isSystemBaseline: boolean;
  status: ModelHubGuardrailStatus;
  referenceCount: number;
  hitCount24h: number;
  referenceSummary: {
    explicitCount: number;
    explicitBindings: string[];
    fallbackCount: number;
    fallbackBindings: string[];
  };
  createdAt: string | null;
  updatedAt: string | null;
};

export type ModelHubRouteChoice = {
  poolId: string;
  poolCode: string;
  bindingId: string;
  candidateCode: string;
  channelId: string;
  channelCode: string;
  baseModelId: string;
  modelCode: string;
};

export type ModelHubGuardrailHit = {
  ruleId: string;
  ruleCode: string;
  action: ModelHubGuardrailAction;
  detail: string;
};

export type ModelHubRouteExplain = {
  id: string;
  sceneCode: string;
  outcome: string;
  explainSummary: string;
  routeRuleId: string | null;
  routeCode: string | null;
  choice: ModelHubRouteChoice | null;
  steps: string[];
  guardrailHits: ModelHubGuardrailHit[];
  createdAt: string | null;
};

export type ModelHubCallLog = {
  requestId: string | null;
  traceId: string;
  requestPath: string | null;
  sceneCode: string | null;
  stream: boolean;
  routeOutcome: string | null;
  routeExplainId: string | null;
  providerCode: string | null;
  providerModelCode: string | null;
  merchantId: string | null;
  storeId: string | null;
  principalId: string | null;
  merchantName?: string | null;
  storeName?: string | null;
  principalName?: string | null;
  applicationId: string | null;
  apiKeyId: string | null;
  apiKeyName?: string | null;
  apiKeyPrefix?: string | null;
  accessType?: "API_KEY" | "SESSION" | string | null;
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedTotalTokens: number;
  estimatedAmount: number | null;
  actualAmount: number | null;
  currency: string | null;
  fundAccountId: string | null;
  fundAccountType: string | null;
  fundLedgerId: string | null;
  fundChargeRecordId: string | null;
  status: string;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ModelHubCallLogDataset = {
  page: {
    pageNo: number;
    pageSize: number;
    total: number;
  };
  items: ModelHubCallLog[];
};

export type ListModelHubCallLogsParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  status?: string;
  sceneCode?: string;
  startedFrom?: string;
  startedTo?: string;
};

export type ModelHubTraceSpan = {
  spanType: string;
  spanSeq: number | null;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  inputJson: string | null;
  outputJson: string | null;
  errorMessage: string | null;
  extJson: string | null;
};

export type ModelHubTraceDetail = {
  callLog: ModelHubCallLog;
  routeExplain: ModelHubRouteExplain | null;
  spans: ModelHubTraceSpan[];
};

export type ModelHubApiKeyBindingType = "platform" | "merchant" | "store" | "user";

export type ModelHubApiKeyRoutingProfileSummary = {
  id: string;
  code: string;
  name: string;
  status: string;
  systemDefault: boolean;
  source: "explicit" | "system_default_fallback";
};

export type ModelHubApiKeyGuardrailSummary = {
  id: string;
  code: string;
  name: string;
  status: string;
  systemBaseline: boolean;
  source: "explicit" | "system_baseline_fallback";
};

export type ModelHubApiKey = {
  id: string;
  bindingType: ModelHubApiKeyBindingType;
  editable: boolean;
  inherited: boolean;
  merchantId: string | null;
  merchantName?: string | null;
  storeId: string | null;
  storeName?: string | null;
  principalId: string | null;
  principalName?: string | null;
  keyName: string;
  keyPrefix: string;
  secretMasked: string;
  assignedRoutingProfileId: string | null;
  concurrencyLimit: number | null;
  sourceCode: string | null;
  alertContact: string | null;
  status: "active" | "disabled" | "revoked" | "expired";
  expiresAt: string | null;
  lastUsedAt: string | null;
  ipWhitelist: string[];
  rateLimit: Record<string, unknown>;
  assignedGuardrailRuleIds: string[];
  usesSystemDefaultRouting: boolean;
  usesSystemBaselineGuardrail: boolean;
  effectiveRoutingProfile: ModelHubApiKeyRoutingProfileSummary | null;
  explicitGuardrails: ModelHubApiKeyGuardrailSummary[];
  effectiveGuardrails: ModelHubApiKeyGuardrailSummary[];
  createdAt: string | null;
  updatedAt: string | null;
  revokedAt: string | null;
};

export type ModelHubApiKeySecret = {
  id: string;
  keyName: string;
  keyPrefix: string;
  secretMasked: string;
  plainSecret: string;
  status: "active" | "disabled" | "revoked" | "expired";
  expiresAt: string | null;
};

export type ModelHubApiKeyEditorOptions = {
  currentRole: string;
  canSelectNonDefaultRouting: boolean;
  bindingType: ModelHubApiKeyBindingType;
  merchantId: string | null;
  storeId: string | null;
  principalId: string | null;
  routingProfiles: ModelHubApiKeyRoutingProfileSummary[];
  guardrails: ModelHubApiKeyGuardrailSummary[];
};

export type UpsertModelHubApiKeyCommand = {
  keyName: string;
  expiresAt?: string | null;
  ipWhitelist?: string[];
  rateLimit?: Record<string, unknown>;
  concurrencyLimit?: number | null;
  sourceCode?: string | null;
  alertContact?: string | null;
  assignedRoutingProfileId?: string | null;
  guardrailRuleIds?: string[];
};

export type RotateModelHubApiKeyCommand = {
  expiresAt?: string | null;
  ipWhitelist?: string[];
  rateLimit?: Record<string, unknown>;
};

export type ModelHubGuardrailEvent = {
  id: string;
  sceneCode: string;
  ruleId: string;
  ruleCode: string;
  action: ModelHubGuardrailAction;
  detail: string;
  promptSample: string;
  createdAt: string | null;
};

export type ModelHubGuardrailDashboard = {
  totalEvents: number;
  blockEvents: number;
  flagEvents: number;
  actionCounts: Record<string, number>;
  recentEvents: ModelHubGuardrailEvent[];
};

export type ModelHubDashboardStats = {
  channelCount: number;
  onlineChannelCount: number;
  sharedChannelCount: number;
  byokChannelCount: number;
  poolCount: number;
  enabledPoolCount: number;
  baseModelCount: number;
  apiKeyCount: number;
  routingProfileCount: number;
  guardrailRuleCount: number;
  todayCallCount: number;
  todaySuccessCount: number;
  todaySuccessRate: number;
  todayCost: number;
  currency: string;
};

export type ModelHubDashboardHighlights = {
  guardrailEventCount: number;
  routingAnomalyCount: number;
  balanceAlertCount: number;
};

export type ModelHubDashboardEvent = {
  id: string;
  module: string;
  subject: string;
  status: string;
  owner: string;
  time: string | null;
};

export type ModelHubDashboard = {
  stats: ModelHubDashboardStats;
  highlights: ModelHubDashboardHighlights;
  recentEvents: ModelHubDashboardEvent[];
};

export type ModelHubConsumptionRecordSummary = {
  totalCount: number;
  totalAmount: number;
  settledCount: number;
  byokCount: number;
  pendingCount: number;
  currency: string;
};

export type ModelHubConsumptionRecord = {
  id: string;
  requestId: string | null;
  traceId: string | null;
  model: string;
  scene: string;
  inputTokens: number;
  outputTokens: number;
  cachedPromptTokens: number;
  tokens: number;
  amount: number;
  currency: string | null;
  status: string;
  channel: string;
  /** API_KEY | BIZ_CODE */
  accessType: string;
  apiKey: string;
  bizCode: string | null;
  merchantId?: string | null;
  merchantName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  principalId?: string | null;
  principalName?: string | null;
  principalAvatarUrl?: string | null;
  pool: string;
  time: string | null;
};

export type ModelHubConsumptionRecordDataset = {
  summary: ModelHubConsumptionRecordSummary;
  page: {
    pageNo: number;
    pageSize: number;
    total: number;
  };
  items: ModelHubConsumptionRecord[];
};

export type ListModelHubConsumptionRecordsParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  status?: string;
};

export type ModelHubAlertSummary = {
  totalCount: number;
  openCount: number;
  highPriorityCount: number;
  specialTopicCount: number;
};

export type ModelHubAlertItem = {
  id: string;
  type: string;
  level: string;
  subject: string;
  status: string;
  owner: string;
  topic: string;
  time: string | null;
};

export type ModelHubAlertDataset = {
  summary: ModelHubAlertSummary;
  page: {
    pageNo: number;
    pageSize: number;
    total: number;
  };
  items: ModelHubAlertItem[];
};

export type ListModelHubAlertsParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  type?: string;
  status?: string;
};

export type ModelHubPageMeta = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type ModelHubProtocolCatalogDataset = {
  summary: ModelHubProtocolCatalogSummary;
  page: ModelHubPageMeta;
  items: ModelHubProtocolCatalogItem[];
};

export type ModelHubApiKeySummary = {
  totalBusiness: number;
  activeBusiness: number;
  systemFallback: number;
  customGuardrail: number;
  legacyPlatform: number;
};

export type ModelHubApiKeyDataset = {
  summary: ModelHubApiKeySummary;
  page: ModelHubPageMeta;
  items: ModelHubApiKey[];
};

export type ListModelHubApiKeysParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  bindingType?: string;
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
};

export type ModelHubChannelDataset = {
  page: ModelHubPageMeta;
  items: ModelHubChannel[];
};

export type ListModelHubChannelsParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  channelType?: string;
  authMode?: string;
  status?: string;
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
};

export type ModelHubCatalogPickerProvider = {
  id: string;
  providerCode: string;
  displayName: string;
  logoUrl: string | null;
  isNew?: boolean;
};

export type ModelHubCatalogPickerRateCardRow = {
  match?: Record<string, string> | null;
  unitPrice: number;
};

/** 选择器目录下发的预览计价方案；正式扣费仍走后端预算。 */
export type ModelHubCatalogPickerPricing = {
  unitPrice: number | null;
  pricingUnit: string | null;
  quantityKey: string | null;
  rateCard?: ModelHubCatalogPickerRateCardRow[] | null;
};

export type ModelHubCatalogPickerModel = {
  id: string;
  code: string;
  name: string;
  providerId: string;
  providerCode: string | null;
  description: string | null;
  status: string;
  createdAt: string | null;
  isNew?: boolean;
  isRecommended?: boolean;
  pricing?: ModelHubCatalogPickerPricing | null;
  paramSchema?: {
    supportTextToVideo?: boolean;
    supportImageToVideo?: boolean;
    supportGenerateAudio?: boolean;
    minDurationSeconds?: number | null;
    maxDurationSeconds?: number | null;
    resolutions?: string[];
    aspectRatios?: string[];
    frameRates?: string[];
    defaultResolution?: string | null;
    defaultFrameRate?: string | null;
    defaultDurationSeconds?: number | null;
    defaultAspectRatio?: string | null;
  } | null;
};

export type ModelHubCatalogPicker = {
  providers: ModelHubCatalogPickerProvider[];
  models: ModelHubCatalogPickerModel[];
};

export type ModelHubBaseModelDataset = {
  page: ModelHubPageMeta;
  items: ModelHubBaseModel[];
};

export type ListModelHubBaseModelsParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  capabilityDomain?: string;
  slim?: boolean;
};

export type ModelHubPoolDataset = {
  page: ModelHubPageMeta;
  items: ModelHubPool[];
};

export type ListModelHubPoolsParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  scopeType?: string;
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
};

export type ModelHubGuardrailSummary = {
  totalCount: number;
  enabledCount: number;
  highRiskCount: number;
  hitCount: number;
};

export type ModelHubGuardrailDataset = {
  summary: ModelHubGuardrailSummary;
  page: ModelHubPageMeta;
  items: ModelHubGuardrail[];
};

export type ListModelHubGuardrailsParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  riskLevel?: string;
};

export type ModelHubRoutingProfileSummary = {
  totalCount: number;
  enabledCount: number;
  tenantCoverageCount: number;
  fallbackCount: number;
};

export type ModelHubRoutingProfileDataset = {
  summary: ModelHubRoutingProfileSummary;
  page: ModelHubPageMeta;
  items: ModelHubRoutingProfile[];
};

export type ListModelHubRoutingProfilesParams = {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  status?: string;
  isSystemDefault?: boolean;
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
};

const MODEL_HUB_CATALOG_PAGE_SIZE = 200;

type ModelHubPagedDataset<T> = {
  page: ModelHubPageMeta;
  items: T[];
};

async function fetchAllModelHubPages<T>(
  fetchPage: (pageNo: number, pageSize: number) => Promise<ModelHubPagedDataset<T>>,
  pageSize = MODEL_HUB_CATALOG_PAGE_SIZE,
): Promise<T[]> {
  const first = await fetchPage(1, pageSize);
  const items = [...(first.items ?? [])];
  const total = Number(first.page?.total ?? items.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return items;
  }
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2, pageSize)),
  );
  for (const page of rest) {
    items.push(...(page.items ?? []));
  }
  return items;
}

export type UpsertModelHubProviderCommand = {
  providerCode?: string;
  displayName: string;
  logoUrl?: string | null;
  description?: string | null;
  status?: ModelHubStatus;
};

export type UpsertModelHubChannelCommand = {
  channelCode: string;
  displayName: string;
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
  channelType?: ModelHubChannelType;
  authMode?: ModelHubAuthMode;
  endpoint?: string | null;
  iconUrl?: string | null;
  vendorName?: string | null;
  status?: ModelHubStatus;
  healthState?: ModelHubHealthState;
  scenes?: Array<{
    sceneCode: string;
    protocolId: string;
    configJson?: string | null;
  }>;
  deployments?: Array<{
    sceneCode: string;
    providerId?: string | null;
    baseModelId?: string | null;
    deploymentCode: string;
    upstreamModelCode: string;
    billingMultiplier?: number | null;
    displayName: string;
    modelType?: string;
    publicApi?: boolean;
    status?: ModelHubStatus;
    healthState?: "healthy" | "degraded" | "unhealthy" | "unknown";
    parameterOverridesJson?: string | null;
  }>;
};

export type UpsertModelHubChannelCredentialCommand = {
  credentialName: string;
  authType: string;
  credentialCiphertext?: string | null;
  credentialMask?: string | null;
  primaryCredential?: boolean;
  lastVerifiedStatus?: ModelHubCredentialVerifyStatus;
};

export type UpsertModelHubChannelDeploymentCommand = {
  channelSceneId: string;
  providerId?: string | null;
  baseModelId?: string | null;
  deploymentCode: string;
  upstreamModelCode: string;
  billingMultiplier?: number | null;
  displayName: string;
  modelType?: string;
  publicApi?: boolean;
  status?: ModelHubStatus;
  healthState?: "healthy" | "degraded" | "unhealthy" | "unknown";
  parameterOverridesJson?: string | null;
};

export type UpsertModelHubChannelQuotaAccountCommand = {
  quotaType?: ModelHubQuotaType;
  currency?: string;
  totalQuota?: number | null;
  usedQuota?: number | null;
  availableQuota?: number | null;
  status?: ModelHubQuotaStatus;
  ledgerType?: ModelHubQuotaLedgerType | null;
  bizRef?: string | null;
  traceId?: string | null;
  remark?: string | null;
};

export type CreateModelHubChannelQuotaLedgerCommand = {
  ledgerType: ModelHubQuotaLedgerType;
  changeAmount: number;
  balanceAfter?: number | null;
  bizRef?: string | null;
  traceId?: string | null;
  remark?: string | null;
  status?: ModelHubQuotaLedgerStatus;
};

export type UpsertModelHubBaseModelCommand = {
  providerId: string;
  code?: string;
  name: string;
  modelType: string;
  capabilities: string[];
  capabilityConfigs: Record<string, ModelHubBaseModelCapabilityConfig>;
  contextWindow?: string;
  maxInputTokens?: string;
  maxOutputTokens?: string;
  description?: string | null;
  status?: ModelHubBaseModelStatus;
};

export type UpsertModelHubPoolCommand = {
  poolCode?: string;
  displayName: string;
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
  status?: ModelHubStatus;
  routingMode?: ModelHubRoutingMode;
};

export type UpsertModelHubBindingCommand = {
  poolId: string;
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
  channelId: string;
  baseModelId: string;
  candidateCode?: string | null;
  status?: ModelHubStatus;
  healthState?: ModelHubHealthState;
  weight?: number;
  priority?: number;
};

export type ReplaceModelHubBindingItem = {
  id?: string | null;
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
  channelId: string;
  baseModelId: string;
  candidateCode?: string | null;
  status?: ModelHubStatus;
  healthState?: ModelHubHealthState;
  weight?: number;
  priority?: number;
};

export type ReplaceModelHubChannelDeploymentItem = UpsertModelHubChannelDeploymentCommand & {
  id?: string | null;
};

export type ReplaceModelHubChannelSceneItem = {
  sceneCode: string;
  protocolId: string;
  configJson?: string | null;
};

export type UpsertModelHubRoutingProfileCommand = {
  code: string;
  name: string;
  description?: string | null;
  status: ModelHubRoutingProfileStatus;
  isSystemDefault: boolean;
  applicableTenantLevels: ModelHubTenantLevel[];
  applicableRegions: ModelHubRegionLevel[];
  defaultBehavior: {
    unmatchedBehavior: ModelHubUnmatchedBehavior;
    fallbackPoolId: string;
  };
  entries: Array<{
    entry: ModelHubRouteEntryCode;
    targetPoolId: string;
    channelPolicy: ModelHubChannelPolicy;
    fixedChannelId: string;
    routingMode?: ModelHubRoutingMode | null;
  }>;
};

export type UpsertModelHubGuardrailCommand = {
  name: string;
  riskLevel?: ModelHubGuardrailRiskLevel;
  matchItems: string[];
  action?: ModelHubGuardrailAction;
  isSystemBaseline?: boolean;
  status?: ModelHubGuardrailStatus;
};

export type ModelHubRouteExplainRequest = {
  sceneCode: string;
  prompt?: string;
  unavailableBindingIds?: string[];
  unavailableChannelIds?: string[];
};

export function buildModelHubAdminPath(pathname: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${MODEL_HUB_ADMIN_API_PREFIX}${normalizedPath}`;
}

function normalizeWrappedText(value: string | null | undefined): string | null | undefined {
  if (value == null) {
    return value;
  }
  let normalized = value.trim();
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
  return normalized || null;
}

function normalizeChannelCommand(command: UpsertModelHubChannelCommand): UpsertModelHubChannelCommand {
  return {
    ...command,
    endpoint: normalizeWrappedText(command.endpoint),
    iconUrl: normalizeWrappedText(command.iconUrl),
  };
}

function appendModelHubScopeQuery(pathname: string, scope?: ModelHubScopeQuery): string {
  const params = new URLSearchParams();
  appendModelHubScopeToSearchParams(params, scope);
  const basePath = buildModelHubAdminPath(pathname);
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function appendModelHubScopeToSearchParams(params: URLSearchParams, scope?: ModelHubScopeQuery): void {
  const merchantId = scope?.merchantId?.trim();
  const storeId = scope?.storeId?.trim();
  const principalId = scope?.principalId?.trim();
  if (merchantId) {
    params.set("merchantId", merchantId);
  }
  if (storeId) {
    params.set("storeId", storeId);
  }
  if (principalId) {
    params.set("principalId", principalId);
  }
}

function buildModelHubScopedListUrl(
  pathname: string,
  pageParams: PageSearchParamsInput,
  scope?: ModelHubScopeQuery,
  filters?: Record<string, string | undefined>,
): string {
  const qs = buildPageSearchParams(pageParams);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value?.trim()) {
        qs.set(key, value.trim());
      }
    });
  }
  appendModelHubScopeToSearchParams(qs, scope);
  return `${buildModelHubAdminPath(pathname)}?${qs.toString()}`;
}

function toModelHubScopeQuery(params: {
  merchantId?: string | null;
  storeId?: string | null;
  principalId?: string | null;
}): ModelHubScopeQuery | undefined {
  const merchantId = params.merchantId?.trim() || null;
  const storeId = params.storeId?.trim() || null;
  const principalId = params.principalId?.trim() || null;
  if (!merchantId && !storeId && !principalId) {
    return undefined;
  }
  return { merchantId, storeId, principalId };
}

export async function listModelHubApiKeys(params: ListModelHubApiKeysParams): Promise<ModelHubApiKeyDataset> {
  return apiFetch<ModelHubApiKeyDataset>(
    buildModelHubScopedListUrl(
      "/api-keys",
      params,
      toModelHubScopeQuery(params),
      {
        keyword: params.keyword,
        bindingType: params.bindingType,
      },
    ),
    { method: "GET" },
  );
}

export async function getModelHubApiKey(id: string): Promise<ModelHubApiKey> {
  return apiFetch<ModelHubApiKey>(buildModelHubAdminPath(`/api-keys/${encodeURIComponent(id)}`), {
    method: "GET",
  });
}

export async function getModelHubApiKeyEditorOptions(scope?: ModelHubScopeQuery): Promise<ModelHubApiKeyEditorOptions> {
  return apiFetch<ModelHubApiKeyEditorOptions>(appendModelHubScopeQuery("/api-keys/editor-options", scope), {
    method: "GET",
  });
}

export async function createModelHubApiKey(
  command: UpsertModelHubApiKeyCommand,
  scope?: ModelHubScopeQuery,
): Promise<ModelHubApiKeySecret> {
  return apiFetch<ModelHubApiKeySecret>(appendModelHubScopeQuery("/api-keys", scope), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function updateModelHubApiKey(
  id: string,
  command: UpsertModelHubApiKeyCommand,
  scope?: ModelHubScopeQuery,
): Promise<ModelHubApiKey> {
  return apiFetch<ModelHubApiKey>(appendModelHubScopeQuery(`/api-keys/${encodeURIComponent(id)}`, scope), {
    method: "PUT",
    body: JSON.stringify(command),
  });
}

export async function revokeModelHubApiKey(id: string): Promise<ModelHubApiKey> {
  return apiFetch<ModelHubApiKey>(buildModelHubAdminPath(`/api-keys/${encodeURIComponent(id)}/revoke`), {
    method: "POST",
  });
}

export async function deleteModelHubApiKey(id: string): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/api-keys/${encodeURIComponent(id)}`), {
    method: "DELETE",
  });
}

export async function rotateModelHubApiKey(
  id: string,
  command?: RotateModelHubApiKeyCommand,
): Promise<ModelHubApiKeySecret> {
  return apiFetch<ModelHubApiKeySecret>(buildModelHubAdminPath(`/api-keys/${encodeURIComponent(id)}/rotate`), {
    method: "POST",
    body: JSON.stringify(command ?? {}),
  });
}

export async function listModelHubProviders(): Promise<ModelHubProvider[]> {
  return apiFetch<ModelHubProvider[]>(buildModelHubAdminPath("/providers"), { method: "GET" });
}

export async function createModelHubProvider(command: UpsertModelHubProviderCommand): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath("/providers"), { method: "POST", body: JSON.stringify(command) });
}

export async function updateModelHubProvider(id: string, command: UpsertModelHubProviderCommand): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/providers/${encodeURIComponent(id)}`), { method: "PUT", body: JSON.stringify(command) });
}

export async function deleteModelHubProvider(id: string): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/providers/${encodeURIComponent(id)}`), { method: "DELETE" });
}

export async function listModelHubChannels(params: ListModelHubChannelsParams): Promise<ModelHubChannelDataset> {
  return apiFetch<ModelHubChannelDataset>(
    buildModelHubScopedListUrl(
      "/channels",
      params,
      toModelHubScopeQuery(params),
      {
        keyword: params.keyword,
        channelType: params.channelType,
        authMode: params.authMode,
        status: params.status,
      },
    ),
    { method: "GET" },
  );
}

export async function listModelHubChannelsCatalog(scope?: ModelHubScopeQuery): Promise<ModelHubChannel[]> {
  return fetchAllModelHubPages((pageNo, pageSize) =>
    listModelHubChannels({
      pageNo,
      pageSize,
      merchantId: scope?.merchantId,
      storeId: scope?.storeId,
      principalId: scope?.principalId,
    }),
  );
}

export async function getModelHubChannel(id: string): Promise<ModelHubChannel> {
  return apiFetch<ModelHubChannel>(buildModelHubAdminPath(`/channels/${encodeURIComponent(id)}`), { method: "GET" });
}

export async function getModelHubChannelEditorOptions(): Promise<ModelHubChannelEditorOptions> {
  return apiFetch<ModelHubChannelEditorOptions>(buildModelHubAdminPath("/channels/editor-options"), { method: "GET" });
}

export async function listModelHubProtocols(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  keyword?: string;
  status?: string;
}): Promise<ModelHubProtocolCatalogDataset> {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) {
    qs.set("keyword", params.keyword.trim());
  }
  if (params.status?.trim()) {
    qs.set("status", params.status.trim());
  }
  return apiFetch<ModelHubProtocolCatalogDataset>(`${buildModelHubAdminPath("/protocols")}?${qs.toString()}`, {
    method: "GET",
  });
}

export async function getModelHubProtocol(id: string): Promise<ModelHubProtocolCatalogItem> {
  return apiFetch<ModelHubProtocolCatalogItem>(buildModelHubAdminPath(`/protocols/${encodeURIComponent(id)}`), {
    method: "GET",
  });
}

export async function createModelHubProtocol(command: UpsertModelHubProtocolCommand): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath("/protocols"), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function updateModelHubProtocol(id: string, command: UpsertModelHubProtocolCommand): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/protocols/${encodeURIComponent(id)}`), {
    method: "PUT",
    body: JSON.stringify(command),
  });
}

export async function updateModelHubProtocolStatus(id: string, status: ModelHubStatus): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/protocols/${encodeURIComponent(id)}/status`), {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function cloneModelHubProtocol(
  id: string,
  command: { code: string; name: string; version: string },
): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath(`/protocols/${encodeURIComponent(id)}/clone`), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function deleteModelHubProtocol(id: string): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/protocols/${encodeURIComponent(id)}`), { method: "DELETE" });
}

export async function createModelHubChannel(command: UpsertModelHubChannelCommand): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath("/channels"), {
    method: "POST",
    body: JSON.stringify(normalizeChannelCommand(command)),
  });
}

export async function updateModelHubChannel(id: string, command: UpsertModelHubChannelCommand): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/channels/${encodeURIComponent(id)}`), {
    method: "PUT",
    body: JSON.stringify(normalizeChannelCommand(command)),
  });
}

export async function deleteModelHubChannel(id: string): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/channels/${encodeURIComponent(id)}`), { method: "DELETE" });
}

export async function listModelHubChannelCredentials(channelId: string): Promise<ModelHubChannelCredential[]> {
  return apiFetch<ModelHubChannelCredential[]>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/credentials`),
    { method: "GET" },
  );
}

export async function createModelHubChannelCredential(
  channelId: string,
  command: UpsertModelHubChannelCredentialCommand,
): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/credentials`), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function updateModelHubChannelCredential(
  channelId: string,
  credentialId: string,
  command: UpsertModelHubChannelCredentialCommand,
): Promise<boolean> {
  return apiFetch<boolean>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/credentials/${encodeURIComponent(credentialId)}`),
    { method: "PUT", body: JSON.stringify(command) },
  );
}

export async function deleteModelHubChannelCredential(channelId: string, credentialId: string): Promise<boolean> {
  return apiFetch<boolean>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/credentials/${encodeURIComponent(credentialId)}`),
    { method: "DELETE" },
  );
}

export async function listModelHubChannelScenes(channelId: string): Promise<ModelHubChannelScene[]> {
  return apiFetch<ModelHubChannelScene[]>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/scenes`),
    { method: "GET" },
  );
}

export async function replaceModelHubChannelScenes(
  channelId: string,
  items: ReplaceModelHubChannelSceneItem[],
): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/scenes`), {
    method: "PUT",
    body: JSON.stringify(items),
  });
}

export async function listModelHubChannelScenesByIds(channelIds: string[]): Promise<ModelHubChannelScene[]> {
  const ids = channelIds.map((item) => item.trim()).filter(Boolean);
  if (ids.length === 0) {
    return [];
  }
  const params = new URLSearchParams();
  params.set("channelIds", ids.join(","));
  return apiFetch<ModelHubChannelScene[]>(
    `${buildModelHubAdminPath("/channels/scenes-by-ids")}?${params.toString()}`,
    { method: "GET" },
  );
}

export async function listModelHubChannelDeployments(channelId: string): Promise<ModelHubChannelDeployment[]> {
  return apiFetch<ModelHubChannelDeployment[]>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/deployments`),
    { method: "GET" },
  );
}

export async function listModelHubChannelDeploymentsByIds(channelIds: string[]): Promise<ModelHubChannelDeployment[]> {
  const ids = channelIds.map((item) => item.trim()).filter(Boolean);
  if (ids.length === 0) {
    return [];
  }
  const params = new URLSearchParams();
  params.set("channelIds", ids.join(","));
  return apiFetch<ModelHubChannelDeployment[]>(
    `${buildModelHubAdminPath("/channels/deployments-by-ids")}?${params.toString()}`,
    { method: "GET" },
  );
}

export async function listModelHubChannelQuotaAccountsByIds(channelIds: string[]): Promise<ModelHubChannelQuotaAccount[]> {
  const ids = channelIds.map((item) => item.trim()).filter(Boolean);
  if (ids.length === 0) {
    return [];
  }
  const params = new URLSearchParams();
  params.set("channelIds", ids.join(","));
  return apiFetch<ModelHubChannelQuotaAccount[]>(
    `${buildModelHubAdminPath("/channels/quota-accounts-by-ids")}?${params.toString()}`,
    { method: "GET" },
  );
}

export async function createModelHubChannelDeployment(
  channelId: string,
  command: UpsertModelHubChannelDeploymentCommand,
): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/deployments`), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function replaceModelHubChannelDeployments(
  channelId: string,
  items: ReplaceModelHubChannelDeploymentItem[],
): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/deployments`), {
    method: "PUT",
    body: JSON.stringify(items),
  });
}

export async function updateModelHubChannelDeployment(
  channelId: string,
  deploymentId: string,
  command: UpsertModelHubChannelDeploymentCommand,
): Promise<boolean> {
  return apiFetch<boolean>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/deployments/${encodeURIComponent(deploymentId)}`),
    { method: "PUT", body: JSON.stringify(command) },
  );
}

export async function deleteModelHubChannelDeployment(channelId: string, deploymentId: string): Promise<boolean> {
  return apiFetch<boolean>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/deployments/${encodeURIComponent(deploymentId)}`),
    { method: "DELETE" },
  );
}

export async function getModelHubChannelQuotaAccount(channelId: string): Promise<ModelHubChannelQuotaAccount> {
  return apiFetch<ModelHubChannelQuotaAccount>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/quota-account`),
    { method: "GET" },
  );
}

export async function upsertModelHubChannelQuotaAccount(
  channelId: string,
  command: UpsertModelHubChannelQuotaAccountCommand,
): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/quota-account`), {
    method: "PUT",
    body: JSON.stringify(command),
  });
}

export async function listModelHubChannelQuotaLedgers(channelId: string): Promise<ModelHubChannelQuotaLedger[]> {
  return apiFetch<ModelHubChannelQuotaLedger[]>(
    buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/quota-ledgers`),
    { method: "GET" },
  );
}

export async function createModelHubChannelQuotaLedger(
  channelId: string,
  command: CreateModelHubChannelQuotaLedgerCommand,
): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath(`/channels/${encodeURIComponent(channelId)}/quota-ledgers`), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function listModelHubCatalogPicker(capability?: string): Promise<ModelHubCatalogPicker> {
  const qs = new URLSearchParams();
  if (capability?.trim()) {
    qs.set("capability", capability.trim());
  }
  const query = qs.toString();
  const suffix = query ? `?${query}` : "";
  return apiFetch<ModelHubCatalogPicker>(`${buildModelHubAdminPath("/catalog/picker")}${suffix}`, { method: "GET" });
}

export async function listModelHubBaseModels(params: ListModelHubBaseModelsParams): Promise<ModelHubBaseModelDataset> {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) {
    qs.set("keyword", params.keyword.trim());
  }
  if (params.capabilityDomain?.trim()) {
    qs.set("capabilityDomain", params.capabilityDomain.trim());
  }
  if (params.slim) {
    qs.set("slim", "true");
  }
  return apiFetch<ModelHubBaseModelDataset>(`${buildModelHubAdminPath("/base-models")}?${qs.toString()}`, {
    method: "GET",
  });
}

export async function listModelHubBaseModelsCatalog(): Promise<ModelHubBaseModel[]> {
  return fetchAllModelHubPages((pageNo, pageSize) =>
    listModelHubBaseModels({ pageNo, pageSize, slim: true }),
  );
}

export async function getModelHubBaseModel(id: string): Promise<ModelHubBaseModel> {
  return apiFetch<ModelHubBaseModel>(buildModelHubAdminPath(`/base-models/${encodeURIComponent(id)}`), { method: "GET" });
}

export async function createModelHubBaseModel(command: UpsertModelHubBaseModelCommand): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath("/base-models"), { method: "POST", body: JSON.stringify(command) });
}

export async function updateModelHubBaseModel(id: string, command: UpsertModelHubBaseModelCommand): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/base-models/${encodeURIComponent(id)}`), { method: "PUT", body: JSON.stringify(command) });
}

export async function deleteModelHubBaseModel(id: string): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/base-models/${encodeURIComponent(id)}`), { method: "DELETE" });
}

export async function listModelHubPools(params: ListModelHubPoolsParams): Promise<ModelHubPoolDataset> {
  return apiFetch<ModelHubPoolDataset>(
    buildModelHubScopedListUrl(
      "/pools",
      params,
      toModelHubScopeQuery(params),
      {
        keyword: params.keyword,
        scopeType: params.scopeType,
      },
    ),
    { method: "GET" },
  );
}

export async function listModelHubPoolsCatalog(
  scope?: ModelHubScopeQuery & { scopeType?: string },
): Promise<ModelHubPool[]> {
  return fetchAllModelHubPages((pageNo, pageSize) =>
    listModelHubPools({
      pageNo,
      pageSize,
      merchantId: scope?.merchantId,
      storeId: scope?.storeId,
      principalId: scope?.principalId,
      scopeType: scope?.scopeType,
    }),
  );
}

export async function getModelHubPool(id: string): Promise<ModelHubPool> {
  return apiFetch<ModelHubPool>(buildModelHubAdminPath(`/pools/${encodeURIComponent(id)}`), { method: "GET" });
}

export async function createModelHubPool(command: UpsertModelHubPoolCommand): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath("/pools"), { method: "POST", body: JSON.stringify(command) });
}

export async function updateModelHubPool(id: string, command: UpsertModelHubPoolCommand): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/pools/${encodeURIComponent(id)}`), { method: "PUT", body: JSON.stringify(command) });
}

export async function deleteModelHubPool(id: string): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/pools/${encodeURIComponent(id)}`), { method: "DELETE" });
}

export async function listModelHubBindings(
  scope?: ModelHubScopeQuery,
  poolIds?: string[],
): Promise<ModelHubPoolBinding[]> {
  const params = new URLSearchParams();
  appendModelHubScopeToSearchParams(params, scope);
  const normalizedPoolIds = (poolIds ?? []).map((item) => item.trim()).filter(Boolean);
  if (normalizedPoolIds.length > 0) {
    params.set("poolIds", normalizedPoolIds.join(","));
  }
  const queryString = params.toString();
  return apiFetch<ModelHubPoolBinding[]>(
    queryString ? `${buildModelHubAdminPath("/bindings")}?${queryString}` : buildModelHubAdminPath("/bindings"),
    { method: "GET" },
  );
}

export async function getModelHubBinding(id: string): Promise<ModelHubPoolBinding> {
  return apiFetch<ModelHubPoolBinding>(buildModelHubAdminPath(`/bindings/${encodeURIComponent(id)}`), {
    method: "GET",
  });
}

export async function createModelHubBinding(command: UpsertModelHubBindingCommand): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath("/bindings"), { method: "POST", body: JSON.stringify(command) });
}

export async function replaceModelHubPoolBindings(
  poolId: string,
  items: ReplaceModelHubBindingItem[],
): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/bindings/pool/${encodeURIComponent(poolId)}`), {
    method: "PUT",
    body: JSON.stringify(items),
  });
}

export async function updateModelHubBinding(id: string, command: UpsertModelHubBindingCommand): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/bindings/${encodeURIComponent(id)}`), { method: "PUT", body: JSON.stringify(command) });
}

export async function deleteModelHubBinding(id: string): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/bindings/${encodeURIComponent(id)}`), { method: "DELETE" });
}

export async function listModelHubRoutingProfiles(
  params: ListModelHubRoutingProfilesParams,
): Promise<ModelHubRoutingProfileDataset> {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) {
    qs.set("keyword", params.keyword.trim());
  }
  if (params.status?.trim()) {
    qs.set("status", params.status.trim());
  }
  if (typeof params.isSystemDefault === "boolean") {
    qs.set("isSystemDefault", String(params.isSystemDefault));
  }
  appendModelHubScopeToSearchParams(qs, toModelHubScopeQuery(params));
  return apiFetch<ModelHubRoutingProfileDataset>(
    `${buildModelHubAdminPath("/routing-profiles")}?${qs.toString()}`,
    { method: "GET" },
  );
}

export async function listModelHubRoutingProfilesCatalog(scope?: ModelHubScopeQuery): Promise<ModelHubRoutingProfile[]> {
  return fetchAllModelHubPages((pageNo, pageSize) =>
    listModelHubRoutingProfiles({
      pageNo,
      pageSize,
      merchantId: scope?.merchantId,
      storeId: scope?.storeId,
      principalId: scope?.principalId,
    }),
  );
}

export async function getModelHubRoutingProfile(id: string): Promise<ModelHubRoutingProfile> {
  return apiFetch<ModelHubRoutingProfile>(buildModelHubAdminPath(`/routing-profiles/${encodeURIComponent(id)}`), {
    method: "GET",
  });
}

export async function createModelHubRoutingProfile(
  command: UpsertModelHubRoutingProfileCommand,
  scope?: ModelHubScopeQuery,
): Promise<string> {
  return apiFetch<string>(appendModelHubScopeQuery("/routing-profiles", scope), {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function updateModelHubRoutingProfile(
  id: string,
  command: UpsertModelHubRoutingProfileCommand,
  scope?: ModelHubScopeQuery,
): Promise<boolean> {
  return apiFetch<boolean>(appendModelHubScopeQuery(`/routing-profiles/${encodeURIComponent(id)}`, scope), {
    method: "PUT",
    body: JSON.stringify(command),
  });
}

export async function deleteModelHubRoutingProfile(id: string, scope?: ModelHubScopeQuery): Promise<boolean> {
  return apiFetch<boolean>(appendModelHubScopeQuery(`/routing-profiles/${encodeURIComponent(id)}`, scope), {
    method: "DELETE",
  });
}

export async function listModelHubGuardrails(params: ListModelHubGuardrailsParams): Promise<ModelHubGuardrailDataset> {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) {
    qs.set("keyword", params.keyword.trim());
  }
  if (params.riskLevel?.trim()) {
    qs.set("riskLevel", params.riskLevel.trim());
  }
  return apiFetch<ModelHubGuardrailDataset>(`${buildModelHubAdminPath("/guardrails")}?${qs.toString()}`, {
    method: "GET",
  });
}

export async function listModelHubGuardrailsCatalog(): Promise<ModelHubGuardrail[]> {
  return fetchAllModelHubPages((pageNo, pageSize) =>
    listModelHubGuardrails({ pageNo, pageSize }),
  );
}

export async function getModelHubGuardrail(id: string): Promise<ModelHubGuardrail> {
  return apiFetch<ModelHubGuardrail>(buildModelHubAdminPath(`/guardrails/${encodeURIComponent(id)}`), {
    method: "GET",
  });
}

export async function createModelHubGuardrail(command: UpsertModelHubGuardrailCommand): Promise<string> {
  return apiFetch<string>(buildModelHubAdminPath("/guardrails"), { method: "POST", body: JSON.stringify(command) });
}

export async function updateModelHubGuardrail(id: string, command: UpsertModelHubGuardrailCommand): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/guardrails/${encodeURIComponent(id)}`), { method: "PUT", body: JSON.stringify(command) });
}

export async function deleteModelHubGuardrail(id: string): Promise<boolean> {
  return apiFetch<boolean>(buildModelHubAdminPath(`/guardrails/${encodeURIComponent(id)}`), { method: "DELETE" });
}

export async function evaluateModelHubRoute(
  request: ModelHubRouteExplainRequest,
  scope?: ModelHubScopeQuery,
): Promise<ModelHubRouteExplain> {
  return apiFetch<ModelHubRouteExplain>(appendModelHubScopeQuery("/router/explain", scope), {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function listModelHubRouteExplains(scope?: ModelHubScopeQuery): Promise<ModelHubRouteExplain[]> {
  return apiFetch<ModelHubRouteExplain[]>(appendModelHubScopeQuery("/router/explains", scope), { method: "GET" });
}

export async function getModelHubDashboard(): Promise<ModelHubDashboard> {
  return apiFetch<ModelHubDashboard>(buildModelHubAdminPath("/dashboard"), { method: "GET" });
}

export async function listModelHubConsumptionRecords(
  params: ListModelHubConsumptionRecordsParams,
): Promise<ModelHubConsumptionRecordDataset> {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) {
    qs.set("keyword", params.keyword.trim());
  }
  if (params.status?.trim()) {
    qs.set("status", params.status.trim());
  }
  return apiFetch<ModelHubConsumptionRecordDataset>(
    `${buildModelHubAdminPath("/consumption-records")}?${qs.toString()}`,
    { method: "GET" },
  );
}

export async function listModelHubCallLogs(
  params: ListModelHubCallLogsParams,
): Promise<ModelHubCallLogDataset> {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) {
    qs.set("keyword", params.keyword.trim());
  }
  if (params.status?.trim()) {
    qs.set("status", params.status.trim());
  }
  if (params.sceneCode?.trim()) {
    qs.set("sceneCode", params.sceneCode.trim());
  }
  if (params.startedFrom?.trim()) {
    qs.set("startedFrom", params.startedFrom.trim());
  }
  if (params.startedTo?.trim()) {
    qs.set("startedTo", params.startedTo.trim());
  }
  return apiFetch<ModelHubCallLogDataset>(`${buildModelHubAdminPath("/call-logs")}?${qs.toString()}`, {
    method: "GET",
  });
}

export async function getModelHubCallLog(traceId: string): Promise<ModelHubTraceDetail> {
  return apiFetch<ModelHubTraceDetail>(buildModelHubAdminPath(`/call-logs/${encodeURIComponent(traceId)}`), {
    method: "GET",
  });
}

export async function getModelHubTrace(traceId: string): Promise<ModelHubTraceDetail> {
  return apiFetch<ModelHubTraceDetail>(buildModelHubAdminPath(`/traces/${encodeURIComponent(traceId)}`), {
    method: "GET",
  });
}

export async function getModelHubGuardrailDashboard(): Promise<ModelHubGuardrailDashboard> {
  return apiFetch<ModelHubGuardrailDashboard>(buildModelHubAdminPath("/guardrails/dashboard"), { method: "GET" });
}

export async function listModelHubAlerts(params: ListModelHubAlertsParams): Promise<ModelHubAlertDataset> {
  const qs = buildPageSearchParams(params);
  if (params.keyword?.trim()) {
    qs.set("keyword", params.keyword.trim());
  }
  if (params.type?.trim()) {
    qs.set("type", params.type.trim());
  }
  if (params.status?.trim()) {
    qs.set("status", params.status.trim());
  }
  return apiFetch<ModelHubAlertDataset>(`${buildModelHubAdminPath("/alerts")}?${qs.toString()}`, { method: "GET" });
}
