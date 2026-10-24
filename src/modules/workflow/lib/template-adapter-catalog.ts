import type { WorkflowExecution } from "@/modules/workflow/lib/workflow-exec";
import { BIZ_CAPABILITY_CODES } from "@/shared/lib/biz-capability-codes";

/** 模板应用只走 LLM 模型平台；不含 RunningHub / Liblib。 */
export type TemplateAdapterId =
  | "generateVideo"
  | "imageGenerateVideo"
  | "generateImage"
  | "imageGenerateImage"
  | "generate3d"
  | "imageGenerate3d"
  | "editImage"
  | "generateSpeech"
  | "generateSong";

export const DEFAULT_TEMPLATE_ADAPTER_ID: TemplateAdapterId = "generateVideo";

/** 文生视频模板默认 X-Biz-Code（scene=`video_generation`） */
export const DEFAULT_TEMPLATE_BIZ_CODE = BIZ_CAPABILITY_CODES.WORKFLOW_TEMPLATE_VIDEO;

export type TemplateFieldType = "string" | "number" | "boolean";

export type TemplateOutputType = "image" | "video" | "audio" | "3d";

export type TemplateFieldDef = {
  name: string;
  type: TemplateFieldType;
  defaultValue: string | number | boolean;
  required: boolean;
  description?: string;
  vendor?: { nodeId: string; fieldName: string };
};

export type TemplateAdapter = {
  id: TemplateAdapterId;
  label: string;
  platformLabel: string;
  enabled: boolean;
  comingSoonHint?: string;
  executionBackend: WorkflowExecution;
  execClassType: string;
  execTitle: string;
  defaultTimeoutSec: number;
  defaultOutputType: TemplateOutputType;
  allowedOutputTypes: TemplateOutputType[];
  /** 模板基础属性，写入执行节点 data.bizCode 与 config_json；不进入开始节点入参 */
  defaultBizCode?: string;
  defaultFields: TemplateFieldDef[];
};

function field(
  name: string,
  type: TemplateFieldType,
  defaultValue: string | number | boolean,
  extra?: Partial<TemplateFieldDef>,
): TemplateFieldDef {
  return { name, type, defaultValue, required: false, ...extra };
}

const LLM_PLATFORM = "LLM 模型平台";

/** 文/图生视频共用的 /videos 规范键。PageBuilder 别名经 inputKey 映射；bizCode 不进此表。 */
const VIDEO_SHARED_FIELDS: TemplateFieldDef[] = [
  field("model", "string", ""),
  field("aspect_ratio", "string", ""),
  field("resolution", "string", ""),
  field("duration", "number", ""),
  field("framepersecond", "number", ""),
  field("watermark", "boolean", ""),
  field("seed", "number", ""),
  field("camerafixed", "boolean", ""),
  field("generate_audio", "boolean", ""),
];

/** 文/图生图共用的 /images/generations 规范键。多参考图仍走同一 image 入参，不另开模板。 */
const IMAGE_SHARED_FIELDS: TemplateFieldDef[] = [
  field("model", "string", ""),
  field("size", "string", ""),
  field("n", "number", ""),
  field("quality", "string", ""),
  field("aspect_ratio", "string", ""),
  field("watermark", "boolean", ""),
  field("seed", "number", ""),
];

/** 文/图生 3D 共用的 /3d/generations 规范键。 */
const THREE_D_SHARED_FIELDS: TemplateFieldDef[] = [
  field("model", "string", ""),
  field("format", "string", ""),
  field("quality", "string", ""),
  field("seed", "number", ""),
];

export const TEMPLATE_ADAPTERS: TemplateAdapter[] = [
  {
    id: "generateVideo",
    label: "文生视频",
    platformLabel: LLM_PLATFORM,
    enabled: true,
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Generate Video",
    defaultTimeoutSec: 600,
    defaultOutputType: "video",
    allowedOutputTypes: ["video"],
    defaultBizCode: DEFAULT_TEMPLATE_BIZ_CODE,
    defaultFields: [field("prompt", "string", "", { required: true }), ...VIDEO_SHARED_FIELDS],
  },
  {
    id: "imageGenerateVideo",
    label: "图生视频",
    platformLabel: LLM_PLATFORM,
    enabled: true,
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Image to Video",
    defaultTimeoutSec: 600,
    defaultOutputType: "video",
    allowedOutputTypes: ["video"],
    defaultBizCode: DEFAULT_TEMPLATE_BIZ_CODE,
    defaultFields: [
      field("prompt", "string", ""),
      field("first_frame", "string", "", { required: true, description: "首帧图片 URL，页面搭建请用「首尾帧」绑定" }),
      field("last_frame", "string", "", { description: "尾帧图片 URL，可选" }),
      ...VIDEO_SHARED_FIELDS,
    ],
  },
  {
    id: "generateImage",
    label: "文生图",
    platformLabel: LLM_PLATFORM,
    enabled: true,
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Generate Image",
    defaultTimeoutSec: 180,
    defaultOutputType: "image",
    allowedOutputTypes: ["image"],
    defaultBizCode: BIZ_CAPABILITY_CODES.WORKFLOW_TEMPLATE_IMAGE,
    defaultFields: [field("prompt", "string", "", { required: true }), ...IMAGE_SHARED_FIELDS],
  },
  {
    id: "imageGenerateImage",
    label: "图生图",
    platformLabel: LLM_PLATFORM,
    enabled: true,
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Image to Image",
    defaultTimeoutSec: 180,
    defaultOutputType: "image",
    allowedOutputTypes: ["image"],
    defaultBizCode: BIZ_CAPABILITY_CODES.WORKFLOW_TEMPLATE_IMAGE,
    defaultFields: [
      field("prompt", "string", "", { required: true }),
      field("image", "string", "", {
        required: true,
        description: "参考图 URL；多图用「图片选择」绑定同一入参，运行时按逗号拼接",
      }),
      ...IMAGE_SHARED_FIELDS,
    ],
  },
  {
    id: "generate3d",
    label: "文生3D",
    platformLabel: LLM_PLATFORM,
    enabled: true,
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Generate 3D",
    defaultTimeoutSec: 180,
    defaultOutputType: "3d",
    allowedOutputTypes: ["3d"],
    defaultBizCode: BIZ_CAPABILITY_CODES.WORKFLOW_TEMPLATE_3D,
    defaultFields: [field("prompt", "string", "", { required: true }), ...THREE_D_SHARED_FIELDS],
  },
  {
    id: "imageGenerate3d",
    label: "图生3D",
    platformLabel: LLM_PLATFORM,
    enabled: true,
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Image to 3D",
    defaultTimeoutSec: 180,
    defaultOutputType: "3d",
    allowedOutputTypes: ["3d"],
    defaultBizCode: BIZ_CAPABILITY_CODES.WORKFLOW_TEMPLATE_3D,
    defaultFields: [
      field("prompt", "string", ""),
      field("image", "string", "", {
        required: true,
        description: "参考图 URL；多图用「图片选择」绑定同一入参，运行时按逗号拼接",
      }),
      ...THREE_D_SHARED_FIELDS,
    ],
  },
  {
    id: "editImage",
    label: "编辑图片",
    platformLabel: LLM_PLATFORM,
    enabled: false,
    comingSoonHint: "即将支持",
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Edit Image",
    defaultTimeoutSec: 180,
    defaultOutputType: "image",
    allowedOutputTypes: ["image"],
    defaultBizCode: BIZ_CAPABILITY_CODES.WORKFLOW_TEMPLATE_IMAGE,
    defaultFields: [field("image", "string", "", { required: true }), field("prompt", "string", "", { required: true })],
  },
  {
    id: "generateSpeech",
    label: "语音合成",
    platformLabel: LLM_PLATFORM,
    enabled: false,
    comingSoonHint: "即将支持",
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Generate Speech",
    defaultTimeoutSec: 120,
    defaultOutputType: "audio",
    allowedOutputTypes: ["audio"],
    defaultBizCode: BIZ_CAPABILITY_CODES.WORKFLOW_TEMPLATE_AUDIO,
    defaultFields: [
      field("input", "string", "", { required: true }),
      field("model", "string", ""),
      field("voice", "string", ""),
      field("speed", "number", ""),
    ],
  },
  {
    id: "generateSong",
    label: "音乐生成",
    platformLabel: LLM_PLATFORM,
    enabled: false,
    comingSoonHint: "即将支持",
    executionBackend: "template",
    execClassType: "OpenAIImage",
    execTitle: "Generate Song",
    defaultTimeoutSec: 180,
    defaultOutputType: "audio",
    allowedOutputTypes: ["audio"],
    defaultBizCode: BIZ_CAPABILITY_CODES.WORKFLOW_TEMPLATE_AUDIO,
    defaultFields: [field("prompt", "string", "", { required: true }), field("model", "string", ""), field("make_instrumental", "boolean", false)],
  },
];

export function getTemplateAdapter(id: string | null | undefined): TemplateAdapter | null {
  if (!id) return null;
  return TEMPLATE_ADAPTERS.find((item) => item.id === id) ?? null;
}

export function enabledTemplateAdapters(): TemplateAdapter[] {
  return TEMPLATE_ADAPTERS.filter((item) => item.enabled);
}
