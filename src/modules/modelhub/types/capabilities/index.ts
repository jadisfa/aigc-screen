import type { CapabilityPackage } from "../capabilityPluginTypes";
import { imageGenerationCapabilityPackage } from "./imageGenerationCapabilityPlugin";
import { imageUnderstandingCapabilityPackage } from "./imageUnderstandingCapabilityPlugin";
import {
  aiDubbingCapabilityPackage,
  deepThinkingCapabilityPackage,
  musicGenerationCapabilityPackage,
  multimodalEmbeddingCapabilityPackage,
  rolePlayCapabilityPackage,
  translationCapabilityPackage,
} from "./newCapabilityPackages";
import { resourceGpuCapabilityPackage } from "./resourceGpuCapabilityPlugin";
import { speechRecognitionCapabilityPackage } from "./speechRecognitionCapabilityPlugin";
import { speechSynthesisCapabilityPackage } from "./speechSynthesisCapabilityPlugin";
import { speechUnderstandingCapabilityPackage } from "./speechUnderstandingCapabilityPlugin";
import { textEmbeddingCapabilityPackage } from "./textEmbeddingCapabilityPlugin";
import { textGenerationCapabilityPackage } from "./textGenerationCapabilityPlugin";
import { textUnderstandingCapabilityPackage } from "./textUnderstandingCapabilityPlugin";
import { threeDGenerationCapabilityPackage } from "./threeDGenerationCapabilityPlugin";
import { toolCallingCapabilityPackage } from "./toolCallingCapabilityPlugin";
import { videoGenerationCapabilityPackage } from "./videoGenerationCapabilityPlugin";
import { videoUnderstandingCapabilityPackage } from "./videoUnderstandingCapabilityPlugin";

export const capabilityPackages: CapabilityPackage[] = [
  textGenerationCapabilityPackage,
  deepThinkingCapabilityPackage,
  translationCapabilityPackage,
  rolePlayCapabilityPackage,
  textUnderstandingCapabilityPackage,
  textEmbeddingCapabilityPackage,
  multimodalEmbeddingCapabilityPackage,
  imageGenerationCapabilityPackage,
  imageUnderstandingCapabilityPackage,
  videoGenerationCapabilityPackage,
  videoUnderstandingCapabilityPackage,
  threeDGenerationCapabilityPackage,
  speechRecognitionCapabilityPackage,
  speechSynthesisCapabilityPackage,
  aiDubbingCapabilityPackage,
  musicGenerationCapabilityPackage,
  speechUnderstandingCapabilityPackage,
  toolCallingCapabilityPackage,
  resourceGpuCapabilityPackage,
];
