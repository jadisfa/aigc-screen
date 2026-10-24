import type { ModelCapabilityCode, ModelCapabilityConfigs } from "@/modules/modelhub/types/modelCapabilityMetadata";

export type ModelStatus = "启用" | "维护中" | "下线";
export type ModelType = "language" | "vision" | "multimodal" | "vector" | "speech" | "three_d";
export type CapabilityDetailTabId = "capability" | "default" | "pricing";

export type ProviderOption = {
  id: string;
  name: string;
  logoUrl: string;
  officialName?: string;
};

export type ModelEditorValue = {
  id?: string;
  code: string;
  name: string;
  providerId: string;
  capabilities: ModelCapabilityCode[];
  capabilityConfigs: ModelCapabilityConfigs;
  modelType: ModelType;
  contextWindow: string;
  maxInputTokens: string;
  maxOutputTokens: string;
  description: string;
  status: ModelStatus;
};

export const EMPTY_MODEL_EDITOR_FORM: ModelEditorValue = {
  code: "",
  name: "",
  providerId: "",
  capabilities: [],
  capabilityConfigs: {},
  modelType: "language",
  contextWindow: "128K",
  maxInputTokens: "",
  maxOutputTokens: "",
  description: "",
  status: "启用",
};
