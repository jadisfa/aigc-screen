import type { ModelType } from "@/modules/modelhub/components/model-editor/modelEditorTypes";

const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  language: "语言模型",
  vision: "视觉模型",
  multimodal: "多模态模型",
  vector: "向量模型",
  speech: "语音模型",
  three_d: "3D模型",
};

const MODEL_TYPE_OPTIONS: Array<{ value: ModelType; label: string }> = [
  { value: "language", label: "语言模型" },
  { value: "vision", label: "视觉模型" },
  { value: "three_d", label: "3D模型" },
  { value: "multimodal", label: "多模态模型" },
  { value: "vector", label: "向量模型" },
  { value: "speech", label: "语音模型" },
];

export function getModelTypeLabel(modelType: ModelType | string) {
  return MODEL_TYPE_LABELS[modelType as ModelType] || modelType || "-";
}

export function resolveModelKindLabel(
  modelType: string | null | undefined,
  capabilityCodes: string[] = [],
): string {
  const codes = new Set(capabilityCodes.map((item) => item.trim()).filter(Boolean));
  const has3d = codes.has("three_d_generation");
  const hasVisionGeneration = codes.has("image_generation") || codes.has("video_generation");
  if (has3d && !hasVisionGeneration) {
    return "3D模型";
  }
  if (modelType === "three_d") {
    return "3D模型";
  }
  return getModelTypeLabel(modelType || "");
}

export function getModelTypeOptions() {
  return MODEL_TYPE_OPTIONS;
}

export function isModelType(value: string): value is ModelType {
  return value in MODEL_TYPE_LABELS;
}
