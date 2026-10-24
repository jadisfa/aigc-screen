import { apiFetch } from "@/shared/api/sys/http";

export type DictionaryOptionItem = {
  value: string;
  label: string;
};

export type IntegrationDictionaryView = {
  platformTypes: DictionaryOptionItem[];
  serviceCodes: DictionaryOptionItem[];
  templateTypes: DictionaryOptionItem[];
  regions: DictionaryOptionItem[];
  templateCodes: DictionaryOptionItem[];
  /** 站内信 eventType 中文；与 MessageDictionaryCatalog.INBOX_EVENT_TYPE_OPTIONS 对齐 */
  inboxEventTypes?: DictionaryOptionItem[];
  platformServiceCodeMap: Record<string, string[]>;
};

export async function getCloudServiceDictionaries(): Promise<IntegrationDictionaryView> {
  return apiFetch<IntegrationDictionaryView>("/api/admin/int/cloudService/dictionaries", { method: "GET" });
}

export async function getMessageTemplateDictionaries(): Promise<IntegrationDictionaryView> {
  return apiFetch<IntegrationDictionaryView>("/api/admin/int/messageTemplate/dictionaries", { method: "GET" });
}
