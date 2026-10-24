import { formatModelHubDateTime } from "@/modules/modelhub/services/modelhubAdminUi";
import {
  createModelHubProvider,
  deleteModelHubProvider,
  listModelHubProviders,
  updateModelHubProvider,
  type ModelHubProvider,
  type UpsertModelHubProviderCommand,
} from "@/shared/api/model-hub/model-hub";

export type ProviderEditorStatus = "启用" | "停用";

export type ProviderListItem = {
  id: string;
  name: string;
  providerCode: string;
  logoUrl: string;
  description: string;
  status: ProviderEditorStatus;
  updatedAt: string;
};

export type ProviderSaveValue = {
  id?: string;
  name: string;
  providerCode?: string;
  logoUrl: string;
  description: string;
  status: ProviderEditorStatus;
};

export function toProviderEditorStatus(status: string | null | undefined): ProviderEditorStatus {
  return status === "disabled" ? "停用" : "启用";
}

export function toProviderListItem(item: ModelHubProvider): ProviderListItem {
  return {
    id: item.id,
    name: item.displayName,
    providerCode: item.providerCode || "",
    logoUrl: item.logoUrl || "",
    description: item.description || "",
    status: toProviderEditorStatus(item.status),
    updatedAt: formatModelHubDateTime(item.updatedAt),
  };
}

export async function listProviderItems(): Promise<ProviderListItem[]> {
  const providerRows = await listModelHubProviders();
  return providerRows.map(toProviderListItem);
}

export async function saveProvider(value: ProviderSaveValue): Promise<string | null> {
  const command: UpsertModelHubProviderCommand = {
    providerCode: value.providerCode?.trim() || undefined,
    displayName: value.name.trim(),
    logoUrl: value.logoUrl.trim() || undefined,
    description: value.description.trim() || undefined,
    status: value.status === "停用" ? "disabled" : "enabled",
  };

  if (value.id) {
    await updateModelHubProvider(value.id, command);
    return value.id;
  }

  return createModelHubProvider(command);
}

export async function deleteProvider(id: string): Promise<void> {
  await deleteModelHubProvider(id);
}
