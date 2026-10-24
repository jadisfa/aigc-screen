import type { UploadFile } from 'ant-design-vue'
import type { AspectRatioType } from '~/composables/admin/usePlatform.types'
import type { ImageResolutionType } from '~/composables/admin/billingManager.types'

export type GenerationModeType = 'image' | 'video' | 'digital_human' | 'audio' | 'tts'
export type ImageQualityType = 'low' | 'medium' | 'high' | 'auto'

export interface ImageEditParams {
  // @ts-ignore
  image?: File[]
  // @ts-ignore
  mask?: File
  prompt: string
  model: string
  aspect_ratio?: AspectRatioType
  size?: string
  resolution?: ImageResolutionType
  seed?: number
  n?: number
  width?: number
  height?: number
  // UI 层额外字段
  mode?: 'single' | 'group' // 单图/组图模式
  quality?: ImageQualityType // 生成质量控制，对应请求层 quality
  linked?: boolean // 是否关联宽高
  imageCount?: number // 图片张数
}

/**
 * 视频生成参数
 * @param camerafixed 是否固定镜头
 */
export type IVideoGenerationParams = {
  content: IVideoGenerationContent[]
  model: string
  aspect_ratio?: AspectRatioType // 宽高比,默认adaptive
  resolution?: VideoResolutionType // 分辨率，默认720p
  duration?: number // 时长，默认5秒
  audio?: boolean
  generate_audio?: boolean | string | number
  generateAudio?: boolean | string | number
  return_last_frame?: boolean | string | number
  returnLastFrame?: boolean | string | number
  execution_expires_after?: number
  executionExpiresAfter?: number
  safety_identifier?: string
  safetyIdentifier?: string
  tools?: Array<Partial<Record<'type' | 'Type', string>> | string>
  framespersecond?: number // 帧率，豆包默认24
  watermark?: boolean // 默认false
  seed?: number // 种子，默认-1
  camerafixed?: boolean // 是否固定镜头，默认false
  camera_control?: CameraControlEnum
  camera_control_strength?: number // [-10, 10]
  prompt_extend?: boolean
  size?: string
  // UI 层额外字段（与请求层字段对应）
  quality?: VideoResolutionType // UI 层使用的质量字段，对应 resolution
  generateSound?: boolean // UI 层使用的字段，对应 audio
}

export type NativeVideoResolutionType = '480p' | '720p' | '1080p' | '1440p' | '2160p'
export type VideoUpscaleResolutionType
  = | '720p_upscale'
    | '1080p_upscale'
    | '2k_upscale'
    | '4k_upscale'
export type VideoResolutionType = NativeVideoResolutionType | VideoUpscaleResolutionType

/**
 * UI 层分辨率类型（支持大小写混合，用于数字人和音频参数）
 */
export type UIResolutionType = '480P' | '720P' | '1080P' | '4K' | '480p' | '720p' | '1080p'

export type CameraControlEnum =
  | 'simple:horizontal'
  | 'simple:vertical'
  | 'simple:pan'
  | 'simple:tilt'
  | 'simple:roll'
  | 'simple:zoom'
  | 'down_back'
  | 'forward_up'
  | 'right_turn_forward'
  | 'left_turn_forward'

export interface IVideoGenerationContent {
  type: 'text' | 'image_url' | 'audio_url' | 'video_url' | 'element'
  text?: string
  image_url?: {
    url: string
  }
  video_url?: {
    url: string
  }
  /** 输入视频时长（秒），兼容历史内容字段 */
  duration?: number
  /** 输入视频时长（秒），用于参考视频单独计费 */
  duration_seconds?: number
  /** 输入视频时长（毫秒），用于参考视频单独计费 */
  duration_ms?: number
  audio_url?: {
    url: string
  }
  role?: 'first_frame' | 'last_frame' | 'digital_human_frame' | 'reference'
    | 'element' | 'video_feature' | 'video_base'

  /** 主体信息（type='element' 时使用） */
  element?: {
    /** 系统主体 ID（当前后端不支持查询，需传 inline_element） */
    system_element_id?: string
    /** 内联主体信息（必须传递完整信息） */
    inline_element?: {
      name: string
      description?: string
      frontal_image_url: string
      refer_images: Array<{ url: string; slot_key?: string }>
      tags?: string[]
    }
  }

  /** 是否保留原声（视频参考时使用） */
  keep_original_sound?: 'yes' | 'no'
}

/** 数字人生成参数
 *
 *  @property resource_id  数字人资源id
 * @property audio_url  音频路径
 * @property templ_start_strategy  指定模板开始策略 start_from_given_seconds：指定模板开始时间
 *
 * @property separate_vocal 是否打开人声分离，开启后会抑制音频背景杂音。针对即梦视频改口型有效
 * @property open_scenedet 是否打开场景切分与说话人识别（仅对Basic模式生效）.针对即梦视频改口型有效
 * @property align_audio 是否开启视频循环（仅对Lite模式生效）.当驱动音频时长大于模版视频时长时，开启后默认打开视频正循环，视频结束后从头开始循环。 默认值：true
 * @property align_audio_reverse 是否开启倒放循环（仅对Lite模式生效，开启此参数需要同时开启align_audio参数）。
 * 开启后视频循环流程为：正放->倒放->正放->......，可以解决视频循环播放时衔接处跳变的问题。
 * 默认值：false
 * @property templ_start_seconds 模版视频开始时间（仅对Lite模式生效）
 * 默认值：0
 *
 * @templ_start_seconds  指定渲染模版开始时间点
 */
export interface IDigitalHumanGenerateParams {
  model: string
  resource_id?: string
  image_url?: string
  audio_url?: string
  video_url?: string
  templ_start_strategy?: 'start_from_given_seconds'
  templ_start_seconds?: number
  separate_vocal?: boolean
  open_scenedet?: boolean
  align_audio?: boolean
  align_audio_reverse?: boolean
}

/**
 * 音频生成参数（UI 层使用，基于 ISongGenerationParams）
 */
export interface IAudioParams {
  prompt: string
  model: string
  make_instrumental?: boolean // 是否生成纯音乐（无歌词）
  customMode?: boolean // 是否使用自定义模式（UI 层辅助字段，对应 mode: 'simple' | 'custom'）
  style?: string // 音乐风格
  title?: string // 音乐标题
  /** 人声性别偏好。m 男声，f 女声 */
  vocal_gender?: 'm' | 'f'
  /** 对风格的遵循强度。范围 0–1，保留两位小数。示例：0.65。  */
  style_weight?: number
  /** 创意/离散程度。范围 0–1，保留两位小数。示例：0.65。  */
  weirdness_constraint?: number
  /** 音频要素权重。范围 0–1，保留两位小数。示例：0.65。 */
  audio_weight?: number
  // UI 层辅助字段（用于显示，不提交到后端）
  mode?: 'simple' | 'custom' // 模式：简单模式/自定义模式（用于 UI 显示，对应 customMode）
}

/** 语音合成参数 */
export interface ISpeechSynthesisParams {
  model: string
  text: string
  text_file_id?: string
  voice_id: string
  cloned_voice_id?: string
  clonedVoiceId?: string
  speed?: number
  vol?: number
  pitch?: number
  emotion?: string
}

/** 音频生成参数
 *
 * @property prompt 音频生成内容
 * @property model 模型名称
 * @property make_instrumental 是否生成无声音的音频
 * @property customMode 是否使用自定义模型
 * @property style 模型风格
 * @property title 歌曲标题
 *
 * */
export interface ISongGenerationParams {
  prompt: string
  model: string
  make_instrumental?: boolean
  customMode?: boolean
  style?: string
  title?: string
  /** 人声性别偏好。m 男声，f 女声 */
  vocal_gender?: 'm' | 'f'
  /** 对风格的遵循强度。范围 0–1，保留两位小数。示例：0.65。  */
  style_weight?: number
  /** 创意/离散程度。范围 0–1，保留两位小数。示例：0.65。  */
  weirdness_constraint?: number
  /** 音频要素权重。范围 0–1，保留两位小数。示例：0.65。 */
  audio_weight?: number
}
/**
 * AI生成提交数据的类型定义
 */
export type AIGenerationSubmitData =
  | {
    type: 'image'
    prompt: string
    model: string
    mode?: { value: string, label: string }
    params: ImageEditParams
    images?: UploadFile<File>[] | string[]
  }
  | {
    type: 'video'
    prompt: string
    model: string
    mode?: string
    params: IVideoGenerationParams
    firstFrame?: UploadFile<File>
    lastFrame?: UploadFile<File>
  }
  | {
    type: 'digital_human'
    prompt: string
    model: string
    mode?: string
    resource_id?: string
    params: IDigitalHumanGenerateParams
    image?: UploadFile<File>
    audio?: UploadFile<File>
    referenceVideo?: UploadFile<File>
    subjectImage?: UploadFile<File>
    video?: UploadFile<File>
  }
  | {
    type: 'audio'
    prompt: string
    model: string
    mode?: { value: string, label: string }
    params: ISongGenerationParams
    referenceImage?: string
  }
  | {
    type: 'tts'
    prompt: string
    model: string
    mode?: { value: string, label: string }
    params: ISpeechSynthesisParams
    text?: string
  };

export interface AspectRatioOptions {
  value: AspectRatioType
  label: string
  iconClass: string
}

export interface VideoResolutionOption {
  value: VideoResolutionType
  label: string
}

export type VideoGenerationMode = 'text-to-video' | 'first-frame' | 'first-last-frame' | 'last-frame'

export interface DurationOption {
  value: number
  label: string
}

export interface CanvasHandleFunction {
  insertCanvasTaskItem: (taskId: string) => void | Promise<void>
}
