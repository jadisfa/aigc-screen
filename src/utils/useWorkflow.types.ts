import type { ComfyUIProperties } from '~/utils/comfyuiApi'
import {
  modelTypeOptions,
  type PlatformModelType
} from '~/composables/admin/usePlatform.types'
import type { ComponentName } from '~/components/ai'

export type PropertyKey = keyof ComfyUIProperties

/**
 * 组件的的分类
 */
export enum ComponentGroupEnum {
  BASE = 'base', // 基础组件
  PROMPT = 'prompt', // 提示词
  HINT = 'hint', // 提示类
  SELECT = 'select', // 下拉框
  COLOR_SELECT = 'color_select',
  IMAGE = 'image', // 图片组件
  OUTPUT = 'output', // 产出，无实际组件
  BUSSINESS = 'business'
}

export type BillingTag = 'duration' | 'resolution' | 'count' | 'aspect_ratio' | 'audio'

/**
 * 组件的选项
 * @description 可用户构建页面的组件选项
 * @enum custom_number 自定义数字
 * @property value 单个节点的选项参数名称
 * @property params 一个节点支持多个参数
 */
export interface SelectOption {
  label: string
  componentName: ComponentName | null
  value: string
  // 计费标识
  billingTags?: BillingTag[]
  params?: Param[]
  example?:
    | IDynamicOptions
    | { title: string, value: string | number | boolean, src?: string }[] // 兼容旧数据
  type?: 'number' | 'string' | 'boolean'
  icon?: string
  price?: number
  isUnique?: boolean // 是否唯一
  group: ComponentGroupEnum
  dependOn?: string
}

export enum WorkFlowTypeEnum {
  system = 'system', // 系统级别，内置工作流
  common = 'common', // 公共级别，用户共享工作流
  personal = 'personal' // 个人级别，创作者工作流
}

/**
 * 工作流分类
 * @description 工作流分类，用于前端展示
 * @enum Marketing 营销
 * @enum Design 设计
 * @enum Development 开发
 * @enum CustomerService 客服
 * @enum Product 产品
 * @enum Operations 运营
 */
export enum WorkFlowCategoriesEnum {
  Marketing = 'Marketing',
  Design = 'Design',
  Development = 'Development',
  CustomerService = 'CustomerService',
  Product = 'Product',
  Operations = 'Operations'
}

/**
 * 工作流分类名称
 * @description 工作流分类名称，用于前端展示
 */
export const WorkFlowCategoriesLabel: Record<WorkFlowCategoriesEnum, string> = {
  [WorkFlowCategoriesEnum.Marketing]: '营销',
  [WorkFlowCategoriesEnum.Design]: '设计',
  [WorkFlowCategoriesEnum.Development]: '开发',
  [WorkFlowCategoriesEnum.CustomerService]: '客服',
  [WorkFlowCategoriesEnum.Product]: '产品',
  [WorkFlowCategoriesEnum.Operations]: '运营'
}

/**
 * 工作流的类型
 * @enum workflow: ComfyUI工作流应用
 * @enum custom: 自定义应用,访问链接跳转
 * @enum api: 自定义工作流应用，EasyAI 应用
 */
export enum AppTypeEnum {
  workflow = 'workflow',
  custom = 'custom',
  customWorkflow = 'customWorkflow',
  /** n8n Webhook 独立应用（非 EasyAI 自定义编排图） */
  n8n = 'n8n',
  canvasFlowApp = 'canvasFlowApp'
}

export interface IVoice {
  id: string
  name: string
  desc: string
  tags: string[]
  lang: string
  accent: string
  gender: string
  age: string
  icon: string
  audio: string
  clonedVoiceId?: string
  provider?: string
  platformId?: string
  platformName?: string
  status?: string
  expiresAt?: string
  lastUsedAt?: string
  source?: 'library' | 'cloned' | 'favorite'
}

/** 动态参数 */
export interface IDynamicOptions {
  min?: number
  max?: number
  step?: number
  hint?: string
  href?: string
  required?: boolean
  seedLength?: number // 随机种子的长度
  imageSelectItems?: IImageSelectItem[]
  voiceSelectItems?: IVoice[]
  selectItems?: ISelectItem[]
  enableLLM?: boolean // 是否启用大模型微调功能
  enableTranslate?: boolean // 是否启用翻译功能
  enableAutoTranslate?: boolean // 是否启用自动翻译功能
  presetPrompt?: string
  prePendPositive?: string // 前置追加正向提示词
  separator?: string // 分割符号
  limit?: number
  uploadColumns?: number // 多图上传每行展示数量，0或空值为自动
  maskDomain?: number
  modelType?: PlatformModelType
  modelList?: string[]
  accepts?: Array<'image' | 'audio' | 'video'>
  filterKeys?: string[]
  templateText?: string
  templateOptions?: Record<string, { label: string, value: string }[]>
  imageMaxSize?: number // 最大体积（MB）
  imageMaxWidth?: number // 最大宽度（像素）
  imageMaxHeight?: number // 最大高度（像素）
  imageCompressQuality?: number // 压缩质量 0-1，默认0.85
  modes?: Array<{ label: string, value: string }> // 多模态交互模式
  maxShots?: number // 最多镜头数
}

export const DynamicOptionsNameMap = {
  min: '最小值',
  max: '最大值',
  step: '步数',
  hint: '提示',
  href: '跳转链接',
  required: '必填项',
  seedLength: '随机种子长度',
  enableLLM: '启用LLM',
  prePendPositive: '前置追加正向提示词',
  presetPrompt: '预设AI润色指令',
  separator: '分隔符',
  limit: '限制数量',
  uploadColumns: '每行数量',
  title: '标题',
  label: '标签',
  value: '值',
  valueExtra: '值2(对应参数2节点）',
  src: '图片',
  enableTranslate: '启用翻译',
  enableAutoTranslate: '启用自动翻译',
  maskDomain: '遮罩域值',
  modelType: '模型能力',
  weight: '计费权重',
  modelList: '指定可选模型',
  templateText: '动态提示词模板',
  templateOptions: '提示词模版选项，暂只支持使用JSON代码维护，点击上方扩展属性右侧的代码视图按照模版进行修改',
  voiceSelectItems: '可选音色',
  accepts: '可选文件类型',
  imageMaxSize: '图片最大体积（MB）',
  imageMaxWidth: '图片最大宽度',
  imageMaxHeight: '图片最大高度',
  imageCompressQuality: '图片压缩质量',
  modes: '多模态交互模式',
  maxShots: '最多镜头数'
}

export const DynamicOptionsHintMap = {
  separator: '支持换行符（\\n）、逗号（,）、分号（;）',
  uploadColumns: '控制多图上传预览一行显示几个，0或空值表示自动，建议1-3'
}

export const DynamicOptionsOptsMap = {
  modelType: modelTypeOptions,
  modelList: [],
  filterKeys: [],
  modes: [
    { label: '图片/主体参考', value: 'imageReference' },
    { label: '视频编辑', value: 'videoEdit' },
    { label: '多模态参考', value: 'videoReference' },
    { label: '首尾帧', value: 'firstLastFrame' },
    { label: '多镜头生成', value: 'multiShot' }
  ],
  accepts: [
    {
      label: '图片',
      value: 'image'
    },
    {
      label: '音频',
      value: 'audio'
    },
    {
      label: '视频',
      value: 'video'
    }
  ]
}

/** picker 选项 */
export interface ISelectItem {
  label: string
  value: string | number | boolean
  /**
   * 计费权重，例如：
   * - 文本 token：1 表示基准价
   * - 图像 1024x1024：2 表示价格翻倍
   * - 视频 4K：4 表示 4 倍价格
   */
  weight?: number

  icon?: string
}

/** 预览选择组件参数 */
export interface IImageSelectItem {
  src: string
  title: string
  value: string | number | boolean
  valueExtra: string | number | boolean
  valueExtra2?: string | number | boolean
  /**
   * 计费权重，例如：
   * - 文本 token：1 表示基准价
   * - 图像 1024x1024：2 表示价格翻倍
   * - 视频 4K：4 表示 4 倍价格
   */
  weight?: number
}

export interface WorkFlowAppInjectStatus {
  available: Ref<boolean, boolean>
  workflow_app: Ref<WorkFlow, WorkFlow>
  bind_params: Ref<ComfyUIProperties, ComfyUIProperties>
}
