import type {
  ApiKeyEditorOptions,
  ApiKeyListItem,
  ApiKeySecret,
  ApiKeyScopeSelection,
  ApiKeyUpsertPayload,
  RotateApiKeyPayload,
} from "@/modules/modelhub/types/apiKeyManagementTypes";
import {
  createModelHubApiKey,
  deleteModelHubApiKey,
  getModelHubApiKey,
  getModelHubApiKeyEditorOptions,
  listModelHubApiKeys,
  revokeModelHubApiKey,
  rotateModelHubApiKey,
  type ListModelHubApiKeysParams,
  type ModelHubApiKeyDataset,
  type ModelHubScopeQuery,
  updateModelHubApiKey,
} from "@/shared/api/model-hub/model-hub";

function normalizeApiKeyScope(scope?: ApiKeyScopeSelection): ModelHubScopeQuery {
  return {
    merchantId: scope?.merchantId?.trim() || null,
    storeId: scope?.storeId?.trim() || null,
    principalId: scope?.principalId?.trim() || null,
  };
}

export async function listApiKeysPage(
  params: Omit<ListModelHubApiKeysParams, "merchantId" | "storeId" | "principalId"> & {
    scope?: ApiKeyScopeSelection;
  },
): Promise<ModelHubApiKeyDataset> {
  const scope = normalizeApiKeyScope(params.scope);
  return listModelHubApiKeys({
    pageNo: params.pageNo,
    pageSize: params.pageSize,
    total: params.total,
    keyword: params.keyword,
    bindingType: params.bindingType,
    merchantId: scope.merchantId,
    storeId: scope.storeId,
    principalId: scope.principalId,
  });
}

export async function getApiKey(id: string): Promise<ApiKeyListItem> {
  return getModelHubApiKey(id);
}

export async function getApiKeyEditorOptions(scope?: ApiKeyScopeSelection): Promise<ApiKeyEditorOptions> {
  return getModelHubApiKeyEditorOptions(normalizeApiKeyScope(scope));
}

export async function createApiKey(payload: ApiKeyUpsertPayload, scope: ApiKeyScopeSelection): Promise<ApiKeySecret> {
  return createModelHubApiKey(payload, normalizeApiKeyScope(scope));
}

export async function updateApiKey(id: string, payload: ApiKeyUpsertPayload, scope: ApiKeyScopeSelection): Promise<ApiKeyListItem> {
  return updateModelHubApiKey(id, payload, normalizeApiKeyScope(scope));
}

export async function revokeApiKey(id: string): Promise<ApiKeyListItem> {
  return revokeModelHubApiKey(id);
}

export async function deleteApiKey(id: string): Promise<boolean> {
  return deleteModelHubApiKey(id);
}

export async function rotateApiKey(id: string, payload?: RotateApiKeyPayload): Promise<ApiKeySecret> {
  return rotateModelHubApiKey(id, payload);
}
