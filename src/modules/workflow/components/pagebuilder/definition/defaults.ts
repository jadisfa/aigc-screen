import type { UiComponentType } from "../ui-schema";

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const DEFAULT_TITLE_BY_TYPE: Record<UiComponentType, string> = {
  "Seed": "随机种子",
  "AIAspectRatioSelect": "比例选择",
  "PositivePrompt": "正向提示词",
  "TemplatePrompt": "构建动态提示词",
  "ImageUploadAuto": "上传图片",
  "ImageSelectPreview": "图像预览选择",
  "FirstLastFrame": "首尾帧",
  "SingleSelectChip": "标签（单选）",
  "MultiSelectChip": "标签（多选）",
  "ColorPicker": "颜色选择",
  "ModelSelector": "LORA选择",
  "MultiSourceImageUpload": "图片选择",
  "CustomNumber": "自定义数字输入",
  "NumberSlider": "数字滑块",
  "ControlSwitch": "控制开关",
  "CameraMovement": "镜头运动",
  "LlmModelSelector": "选择模型",
};

export const BASE_PARAM_KEY_BY_TYPE: Record<UiComponentType, string> = {
  "Seed": "seed",
  "AIAspectRatioSelect": "aspect_ratio",
  "PositivePrompt": "positive_prompt",
  "TemplatePrompt": "template_prompt",
  "ImageUploadAuto": "file",
  "ImageSelectPreview": "image_preprocess",
  "FirstLastFrame": "first_frame",
  "SingleSelectChip": "tag",
  "MultiSelectChip": "tags",
  "ColorPicker": "color",
  "ModelSelector": "model",
  "MultiSourceImageUpload": "image",
  "CustomNumber": "custom_number",
  "NumberSlider": "number_slider",
  "ControlSwitch": "control_switch",
  "CameraMovement": "camera_movement",
  "LlmModelSelector": "model",
};

export function defaultParamNameByType(type: UiComponentType, index = 0): string {
  const base = BASE_PARAM_KEY_BY_TYPE[type];
  if (type === "ImageSelectPreview") {
    if (index === 0) return "lora_name";
    if (index === 1) return "lora_trigger_text";
    return `${base}_${index + 1}`;
  }
  if (type === "FirstLastFrame") {
    if (index === 0) return "first_frame";
    if (index === 1) return "last_frame";
    return `${base}_${index + 1}`;
  }
  if (type === "CameraMovement") {
    if (index === 0) return "camera_movement";
    if (index === 1) return "camera_movement_intensity";
    if (index === 2) return "camerafixed";
    return `${base}_${index + 1}`;
  }
  if (index === 0) return base;
  return `${base}_${index + 1}`;
}
