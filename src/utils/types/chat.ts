import type OpenAI from 'openai'
import type {
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions'
import type { PlatformModel, PlatformModelType } from '~/composables/admin/usePlatform.types'
import type { AgentProcessEventContent, AgentStreamRunEventContent } from '~/composables'

/**
 * 模型
 * @param name 模型名称
 * @param icon 图标
 * @param owner 模型平台
 * @param types 模型类型
 * @param tags 标签
 */
export interface IChatModel {
  /** 调用别名，当前 name 也保持为请求使用的模型标识 */
  alias?: string
  name: string
  displayName?: string
  realModelName?: string
  icon?: string
  owner?: string
  description?: string
  types?: PlatformModelType[]
  tags?: string[]
  capabilities?: PlatformModel['capabilities']
}

/** 绘画模型 */
export interface IChatDrawModel extends IChatModel {
  workflow_id: WorkFlow['_id']
  workflow_name: WorkFlow['name']
  workflow_title: WorkFlow['title']
  param: WorkFlow['params']
  tags: WorkFlow['tags']
  isWorkflow?: boolean
}

export type ImageSize = '256x256' | '512x512' | '1024x1024'

export interface ChatItem extends ChatOption {
  id: number
}

export interface ChatOption {
  promptId?: ChatPromptCategoryItem['id']
  name: string
  model: IChatModel['name']
  order?: number
}

/** 角色 */
export type IChatRole = OpenAI.ChatCompletionMessageParam['role']

/** 带有异常的消息 */
export type ChatMessageExOption = ChatMessage & {
  active?: boolean
  show?: boolean
  error?: boolean
  errorMessage?: string
}

/**
 * 媒体消息,包含图片、视频等多媒体信息内容
 */
export type ChatMediaMessage = {
  type: FileType
  src: string
  originFile?: File
  fileName?: string
  fileSize?: number
  mimeType?: string
  /** 上传进度 0-100，仅在上传中时有值 */
  uploadPercent?: number
  mask?: string // mask url 上传OSS的路径
  mask_b64_json?: string
  mask_preview_b64_json?: string
  canvasData?: unknown
}

// 定义工具相关的类型
type ToolRelated = {
  isCallTool?: boolean
  tool_name?: string
  tool_args?: object
  tool_call_id?: string
}

/** 绘画消息 */
export type IChatMixMessage = ChatMessageExOption
  & Partial<DrawResponse>
  & Partial<{
    workflow_id: WorkFlow['_id']
    workflow_name: WorkFlow['name']
    workflow_title: WorkFlow['title']
    progress: number
    batchSize: number
  }> & {
    medias?: ChatMediaMessage[]
  } & (ChatMessageExOption extends { role: 'tool' }
    ? ToolRelated & { tool_call_id: string }
    : ToolRelated)
/**
 * 基础聊天消息
 * @param role 角色
 * @param content 内容
 * @param model 模型
 * @param creatAt 创建时间
 * @param imageN 图片数量
 * @param imageSize 图片尺寸
 * @param clearContext 是否清除上下文
 * @param session_id 理解内容
 * @param metadata 元数据: {查询资源文档}
 */
export type ChatMessage = ChatCompletionMessageParam & {
  reasoning_content?: string
  model?: IChatModel
  creatAt?: number
  finishAt?: number
  reasoningStart?: number
  reasoningEnd?: number
  clearContext?: boolean
  metadata?: Metadata
  session_id?: string
  requestId?: string
  runStreamEvents?: AgentStreamRunEventContent[]
  agentProcessEvents?: AgentProcessEventContent[]
  agentFinalMessageStarted?: boolean
}

/** Chat请求参数 */
export type ChatRequestMessageParam = OpenAI.ChatCompletionMessageParam

/**
 * 聊天会话
 * @param _id 会话id
 * @param messageId 消息i
 */
export interface IChatConversationItem {
  _id: string
  user_id: string
  title: string
  messages: ChatMessageExOption[]
  creat_time: number
  update_time: number
  agent_id?: string
}

export type IChatConversationCreat = Omit<
  IChatConversationItem,
  '_id' | 'update_time'
>
export type IChatConversationUpdate = Partial<
  Omit<IChatConversationItem, '_id'>
>

export interface ChatPromptCategoryItem extends ChatPromptCategoryOption {
  id: number
}

export interface ChatPromptCategoryOption {
  name: string
  order: number
}

/** 基础的图像生成请求 */
export type BaseParamsRequest = {
  prompt: string
  model?: string
}

/**
 * 图片编辑参数
 */
export type ImageEditParamsRequest = {
  image?: File | File[]
  mask?: File
} & BaseParamsRequest

/**
 * The output of the VLLM model.
 */
export interface GeneralOutput {
  /**
   * The generated output type, defaults to `image`,support `image` and `video` etc.
   */
  type?: FileType
  /**
   * The base64-encoded JSON of the generated image. Default value for `gpt-image-1`,
   * and only present if `response_format` is set to `b64_json` for `dall-e-2` and
   * `dall-e-3`.
   */
  b64_json?: string

  /**
   * For `dall-e-3` only, the revised prompt that was used to generate the image.
   */
  revised_prompt?: string

  /**
   * When using `dall-e-2` or `dall-e-3`, the URL of the generated image if
   * `response_format` is set to `url` (default value). Unsupported for
   * `gpt-image-1`.
   */
  url?: string
  buffer?: unknown
  /**
   * The generated content.
   */
  content?: string
  text?: string
  role?: string
  duration?: number
  has_audio?: boolean
  width?: number
  height?: number
  stage?: 'intermediate' | 'final'
  stage_label?: string
  route_resolution?: string
  source_resolution?: string
  target_resolution?: string
  generated_url?: string
}

export interface ExecutionChainItem {
  stage?: 'generation' | 'video_upscale'
  stage_label?: string
  status?: 'process' | 'success' | 'failed'
  platform_id?: string
  platform_name?: string
  provider_code?: string
  provider_name?: string
  model?: string
  real_model_name?: string
  input_url?: string
  output_url?: string
  started_at?: number
  finished_at?: number
  message?: string
}

/**
 * The response from the VLLM model.
 */
export type GeneratedResponse = Omit<OpenAI.ImagesResponse, 'data'> & {
  data?: Array<GeneralOutput>
  output?: string[]
  output_content?: Array<GeneralOutput>
  output_stage?: 'generating' | 'upscaling' | 'completed' | 'failed'
  execution_chain?: ExecutionChainItem[]
  status: DrawResponse['status']
  message?: string
}

// 检索资源接口
interface RetrieverResource {
  dataset_id: string
  dataset_name: string
  document_id: string
  document_name: string
  data_source_type: string
  segment_id: string
  retriever_from: string
  score: number
  doc_metadata: null
  content: string
  position: number
}
interface Metadata {
  retriever_resources: RetrieverResource[]
}
