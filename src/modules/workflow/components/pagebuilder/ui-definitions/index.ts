import type { UiComponentType } from "../ui-schema";
import type { UiComponentDefinition } from "./types";
import { seedDefinition } from "./seed";
import { aiAspectRatioSelectDefinition } from "./ai-aspect-ratio-select";
import { positivePromptDefinition } from "./positive-prompt";
import { templatePromptDefinition } from "./template-prompt";
import { imageUploadAutoDefinition } from "./image-upload-auto";
import { imageSelectPreviewDefinition } from "./image-select-preview";
import { firstLastFrameDefinition } from "./first-last-frame";
import { singleSelectChipDefinition } from "./single-select-chip";
import { multiSelectChipDefinition } from "./multi-select-chip";
import { colorPickerDefinition } from "./color-picker";
import { modelSelectorDefinition } from "./model-selector";
import { multiSourceImageUploadDefinition } from "./multi-source-image-upload";
import { customNumberDefinition } from "./custom-number";
import { numberSliderDefinition } from "./number-slider";
import { controlSwitchDefinition } from "./control-switch";
import { cameraMovementDefinition } from "./camera-movement";
import { llmModelSelectorDefinition } from "./llm-model-selector";

export const UI_COMPONENT_DEFINITIONS = [
  seedDefinition,
  aiAspectRatioSelectDefinition,
  positivePromptDefinition,
  templatePromptDefinition,
  imageUploadAutoDefinition,
  imageSelectPreviewDefinition,
  firstLastFrameDefinition,
  singleSelectChipDefinition,
  multiSelectChipDefinition,
  colorPickerDefinition,
  modelSelectorDefinition,
  multiSourceImageUploadDefinition,
  customNumberDefinition,
  numberSliderDefinition,
  controlSwitchDefinition,
  llmModelSelectorDefinition,
  cameraMovementDefinition,
] as const satisfies readonly UiComponentDefinition[];

export const UI_COMPONENT_DEFINITION_MAP: Record<UiComponentType, UiComponentDefinition> = UI_COMPONENT_DEFINITIONS.reduce(
  (acc, d) => {
    acc[d.type] = d;
    return acc;
  },
  {} as Record<UiComponentType, UiComponentDefinition>,
);
