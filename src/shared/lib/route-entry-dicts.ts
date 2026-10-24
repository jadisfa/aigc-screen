/** RouteEntryCode 字典：sys / modelhub 共用，与后端 RouteEntryCode 对齐。 */

export type RouteEntryCode =
  | "chat"
  | "embedding"
  | "image_generation"
  | "audio_transcription"
  | "audio_synthesis"
  | "video_generation"
  | "three_d_generation";

export const ROUTE_ENTRY_ORDER: RouteEntryCode[] = [
  "chat",
  "embedding",
  "image_generation",
  "audio_transcription",
  "audio_synthesis",
  "video_generation",
  "three_d_generation",
];

export const ROUTE_ENTRY_LABEL: Record<RouteEntryCode, string> = {
  chat: "对话",
  embedding: "向量",
  image_generation: "图片生成",
  audio_transcription: "语音转写",
  audio_synthesis: "语音合成",
  video_generation: "视频生成",
  three_d_generation: "3D生成",
};

export const ROUTE_ENTRY_REQUIRED_CAPABILITY: Record<RouteEntryCode, string> = {
  chat: "text_generation",
  embedding: "text_embedding",
  image_generation: "image_generation",
  audio_transcription: "speech_recognition",
  audio_synthesis: "speech_synthesis",
  video_generation: "video_generation",
  three_d_generation: "three_d_generation",
};

export const ROUTE_ENTRY_REQUIRED_CAPABILITY_LABEL: Record<RouteEntryCode, string> = {
  chat: "文本生成",
  embedding: "文本向量",
  image_generation: "图片生成",
  audio_transcription: "语音识别",
  audio_synthesis: "语音合成",
  video_generation: "视频生成",
  three_d_generation: "3D生成",
};

/** @deprecated 兼容旧导入名，请优先使用 ROUTE_ENTRY_* */
export const ENTRY_ORDER = ROUTE_ENTRY_ORDER;
export const ENTRY_LABEL = ROUTE_ENTRY_LABEL;
