import type { ModelEditorValue, ModelStatus, ModelType, ProviderOption } from "@/modules/modelhub/components/model-editor/modelEditorTypes";
import { isModelType } from "@/modules/modelhub/types/modelTypeProfiles";
import { toProviderEditorStatus } from "@/modules/modelhub/services/providers";
import { normalizeCapabilityCodes } from "@/modules/modelhub/types/capabilityRegistryFactory";
import type { ModelCapabilityCode, ModelCapabilityConfigs } from "@/modules/modelhub/types/modelCapabilityMetadata";
import { normalizeCapabilityConfigsAtBoundary } from "@/modules/modelhub/types/modelEditorIo";
import { formatModelHubDateTime } from "@/modules/modelhub/services/modelhubAdminUi";
import {
  createModelHubBaseModel,
  getModelHubBaseModel,
  listModelHubBaseModels,
  listModelHubBaseModelsCatalog,
  listModelHubProviders,
  updateModelHubBaseModel,
  type ListModelHubBaseModelsParams,
  type ModelHubBaseModel,
  type ModelHubBaseModelCapabilityConfig,
  type ModelHubBaseModelStatus,
  type UpsertModelHubBaseModelCommand,
} from "@/shared/api/model-hub/model-hub";

export type BaseModelListItem = Omit<ModelEditorValue, "id"> & {
  id: string;
  status: ModelStatus;
  pools: number;
  updatedAt: string;
};

export type BaseModelProviderItem = ProviderOption & {
  status: "启用" | "停用";
  description: string;
  updatedAt: string;
  modelCount?: number;
};

export async function loadBaseModelProviderOptions(): Promise<ProviderOption[]> {
  const providerRows = await listModelHubProviders();
  return providerRows.map((item) => ({
    id: item.id,
    name: item.displayName,
    logoUrl: item.logoUrl || "",
    officialName: item.providerCode,
  }));
}

export async function loadBaseModelVendorPageData(): Promise<{
  providers: BaseModelProviderItem[];
  models: BaseModelListItem[];
}> {
  const [providerRows, modelRows] = await Promise.all([
    listModelHubProviders(),
    listModelHubBaseModelsCatalog(),
  ]);

  return {
    providers: providerRows.map((item) => ({
      id: item.id,
      name: item.displayName,
      logoUrl: item.logoUrl || "",
      officialName: item.providerCode,
      status: toProviderEditorStatus(item.status),
      description: item.description || "",
      updatedAt: formatModelHubDateTime(item.updatedAt),
    })),
    models: modelRows.map(toBaseModelListItem),
  };
}

export async function loadBaseModelListPageData(
  params: ListModelHubBaseModelsParams,
): Promise<{
  providers: BaseModelProviderItem[];
  models: BaseModelListItem[];
  page: {
    pageNo: number;
    pageSize: number;
    total: number;
  };
}> {
  const [providerRows, modelDataset] = await Promise.all([
    listModelHubProviders(),
    listModelHubBaseModels(params),
  ]);

  return {
    providers: providerRows.map((item) => ({
      id: item.id,
      name: item.displayName,
      logoUrl: item.logoUrl || "",
      officialName: item.providerCode,
      status: toProviderEditorStatus(item.status),
      description: item.description || "",
      updatedAt: formatModelHubDateTime(item.updatedAt),
    })),
    models: modelDataset.items.map(toBaseModelListItem),
    page: modelDataset.page,
  };
}

export async function loadBaseModelDetail(id: string): Promise<ModelEditorValue> {
  const detail = await getModelHubBaseModel(id);
  return toModelEditorValue(detail);
}

export async function saveBaseModel(mode: "create" | "edit", value: ModelEditorValue): Promise<string | null> {
  const command = toUpsertCommand(value);
  if (mode === "create") {
    return createModelHubBaseModel(command);
  }
  if (!value.id) {
    throw new Error("缺少基础模型 ID");
  }
  await updateModelHubBaseModel(value.id, command);
  return value.id;
}

function toBaseModelListItem(item: ModelHubBaseModel): BaseModelListItem {
  const editorValue = toModelEditorValue(item);
  return {
    ...editorValue,
    id: item.id,
    status: editorValue.status,
    pools: item.poolCount,
    updatedAt: formatModelHubDateTime(item.updatedAt),
  };
}

function toModelEditorValue(item: ModelHubBaseModel): ModelEditorValue {
  const capabilityCodes = normalizeCapabilityCodes(item.capabilities as ModelCapabilityCode[]);
  const capabilityConfigs = normalizeCapabilityConfigsAtBoundary(
    capabilityCodes,
    item.capabilityConfigs as Partial<Record<ModelCapabilityCode, ModelHubBaseModelCapabilityConfig>>,
  ) as ModelCapabilityConfigs;

  return {
    id: item.id,
    code: item.code,
    name: item.name,
    providerId: item.providerId,
    capabilities: capabilityCodes,
    capabilityConfigs,
    modelType: normalizeModelType(item.modelType),
    contextWindow: item.contextWindow || "",
    maxInputTokens: item.maxInputTokens || "",
    maxOutputTokens: item.maxOutputTokens || "",
    description: item.description || "",
    status: toUiStatus(item.status),
  };
}

function toUpsertCommand(value: ModelEditorValue): UpsertModelHubBaseModelCommand {
  const capabilities = normalizeCapabilityCodes(value.capabilities);
  const capabilityConfigs = normalizeCapabilityConfigsAtBoundary(capabilities, value.capabilityConfigs);

  return {
    providerId: value.providerId,
    code: value.code.trim() || undefined,
    name: value.name.trim(),
    modelType: value.modelType,
    capabilities,
    capabilityConfigs: capabilityConfigs as Record<string, ModelHubBaseModelCapabilityConfig>,
    contextWindow: value.contextWindow.trim(),
    maxInputTokens: value.maxInputTokens.trim(),
    maxOutputTokens: value.maxOutputTokens.trim(),
    description: value.description.trim(),
    status: toApiStatus(value.status),
  };
}

function toUiStatus(status: ModelHubBaseModelStatus): ModelStatus {
  if (status === "offline") return "下线";
  if (status === "maintaining") return "维护中";
  return "启用";
}

function toApiStatus(status: ModelStatus): ModelHubBaseModelStatus {
  if (status === "下线") return "offline";
  if (status === "维护中") return "maintaining";
  return "enabled";
}

function normalizeModelType(value: string): ModelType {
  return isModelType(value) ? value : "language";
}
