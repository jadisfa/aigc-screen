/**
 * ModelHub 业务能力编码（会话推理请求头 X-Biz-Code）。
 */
export const BIZ_CAPABILITY_CODES = {
  /** 工作流 PageBuilder 正向提示词 / 提示词模板 AI 润色 */
  WORKFLOW_UI_LLM: "workflow_ui_llm",
  /** 模板应用视频生成（scene=`video_generation`） */
  WORKFLOW_TEMPLATE_VIDEO: "workflow_template_video",
  /** 模板应用图片生成/编辑（scene=`image_generation`） */
  WORKFLOW_TEMPLATE_IMAGE: "workflow_template_image",
  /** 模板应用 3D 生成（scene=`three_d_generation`） */
  WORKFLOW_TEMPLATE_3D: "workflow_template_3d",
  /** 模板应用语音合成/音乐生成（scene=`audio_synthesis`） */
  WORKFLOW_TEMPLATE_AUDIO: "workflow_template_audio",
} as const;

export type BizCapabilityCode = (typeof BIZ_CAPABILITY_CODES)[keyof typeof BIZ_CAPABILITY_CODES];
