import type { MimeType } from "h3";
import type { IComment } from "@/utils/useComment";
import type {
  AppTypeEnum,
  WorkFlowCategoriesEnum,
  WorkFlowTypeEnum,
  IDynamicOptions,
  BillingTag,
} from "@/utils/useWorkflow.types";
import type { User } from "@/utils/authhooks.types";
import type { FieldSchema } from "@/utils/types/field-schema";
import type {
  ExecutionChainItem,
  GeneralOutput,
  InputPropertyDefaultType,
  ToolInputPropertyType,
} from "@/utils/types/index";
import type { ComponentName } from "~/components/ai";

/**
 * @property name 参数名称,一个参数或者多个参数
 * @property componentName 组件名称，用于前端显示
 * @property type 保存详细的节点编号，节点名称和对应的属性  ["节点编号|节点名称“，”属性信息“]
 *
 * @property hint 提示信息,用户hint组件显示
 * @property attributes 组件的属性，根据不同的组件对应的属性不同
 * @property param 参数，也存储默认参数，string  number boolean
 * @property params 参数，一个组件可以对应多个参数
 * @property timeout 超时时间，单位秒，默认60秒，针对整体的产出有效
 * @property outputType 输出类型，默认为image，可选image|video|audio|text|3d
 */
export interface Param {
  title: string; // 显示名称，参数显示的名称
  name: keyof ComfyUIProperties | string; // 节点对应的参数名称
  componentName?: ComponentName | undefined;
  type: string[]; // ["节点编号|节点名称“，”属性信息“
  node?: string; // 节点
  nodeClass?: string; // 节点英文名称
  nodeKey?: string; // 节点key
  param?: string | number | boolean; // 默认参数
  params?: Param[];
  timeout?: number; // 时间秒
  outputType?: OutputType;
  attributes?:
    | IDynamicOptions
    | { title: string; value: string | number | boolean; src?: string }[]; // 兼容旧数据
  bindAttrItemValueKey?: "value" | "valueExtra" | "valueExtra2";
  hint?: string;
  required?: boolean;
  // 计费标识
  billingTags?: BillingTag[];

  // MCP的参数
  mcp_description?: string;
  mcp_ignore?: boolean;
  mcp_type?: ToolInputPropertyType;
  mcp_examples?: InputPropertyDefaultType[];
  mcp_required?: boolean;
  mcp_default?: InputPropertyDefaultType;

  /** 参数值的 JSON Schema 描述，用于校验与表单生成 */
  schema?: FieldSchema;
}

/** 上传文件参数 */
export interface AntUploadFile {
  uid: string;
  name: string;
  lastModified: number;
  lastModifiedDate: Date;
  originFileObj: File;
  percent: number;
  size: number;
  type: MimeType;
}

// 用在外部接口的匹配
export interface ComfyUIProperties {
  ckpt_name?: string;
  lora_name?: string;
  lora_trigger_text?: string;
  positive?: string;
  positiveCN?: string; // 预防应用自动翻译，保留原始数据
  positive_template?: string;
  negative?: string;
  width?: number;
  height?: number;
  seed?: number;
  checked?: boolean;
  aspect_ratio?: string;
  voice_id?: string;

  image_path?: string; // 整个工作流只有一张图片输入，一般使用这个参数
  image_path_mask?: string; // 遮罩图片
  image_path_face?: string; // 换脸场景，脸部参考图片
  image_path_style?: string; // 参考图场景，例如ipdapter
  denoise?: number;
  output?: string;
  // 视频参数
  video_frames?: number;
  fps?: number;
  motion_bucket_id?: number;
  augmentation_level?: number;
  filename_prefix?: string;
  cfg?: number;
  steps?: number;
  min_cfg?: number;

  upscale_by?: number; // 放大倍数
  // SD3专属参数
  sd3_aspect_ratio?: SD3AspectRatio;

  // 自定义下拉列表
  custom_dropselect?: string;
  custom_dropselect_number?: number;

  advance_select_image_preview?: string; // 高级选择组件，带图片样式预览
  advance_select_single_chips?: string; // 高级选择组件，纸片组单选
  advance_select_multi_chips?: string; // 高级选择组件，纸片组多选

  // 颜色选择
  advance_select_color: string;

  // 颜色预览选择
  advance_select_preview_color: string;

  // 在线遮罩编辑
  advance_onlineEdit_origin?: string; // 在线遮罩编辑，原图（图像图层部分）
  advance_onlineEdit_mask?: string; // 在线遮罩编辑，遮罩部分  advance_onlineEdit_origin?: string    //在线遮罩编辑，原图（图像图层部分）
  advance_onlineEdit_origin_2?: string;
  advance_onlineEdit_mask_2?: string;

  // 生成的图像批次数量
  batch_size?: number;

  // 自定义数字滑块
  custom_number_slider?: number;

  //     自定义参数
  custom_number?: number;
  custom_string?: string;

  // 自定义批量处理
  custom_batch_image_path_origin?: string;
  custom_batch_image_path_origin_2?: string;

  // 自定义提示信息
  custom_hint?: string;
  // 第二版
  // 模型选择
  advance_ckpt_name?: string;
  advance_lora_name?: string;
  // 3d图片路径
  advance_image_path_3d?: string;
  // 正向提示词
  advance_positive?: string;
  // 负向提示词
  advance_negative?: string;
  // 细节增强提示词
  advance_adetailer?: string;
  // 自定义分组标签
  custom_group_label?: string;
  // 高级图片上传-参考图
  advance_image_upload?: string;
  // 高级图片上传-间单图片
  advance_sample_image_upload?: string;
  // 高级图片上传-背景图片
  advance_background_upload?: string;
  // 高级图片上传-画板图片
  advance_canvas_image_upload?: string;
  // 高级图片上传-遮罩图片
  advance_canvas_mask_upload?: string;
  // 高级图片上传-拆件原图
  advance_splitter_image_upload?: string;
  // 高级图片上传-拆件遮罩原图
  advance_splitter_mask_upload?: string;
  // 自定义单选框-参考图
  custom_radio?: string;
  // 高级自定义数字滑块
  advance_custom_number_slider?: number;
  // 高级自定义下拉列表
  advance_custom_dropselect?: string;
  // 高级随机种子
  advance_seed?: number;
  // 点集
  coordinates?: string; // 正样本点集坐标
  neg_coordinates?: string; // 负样本点集坐标

  canvas_swap_background?: string; // 交换背景图片
  canvas_swap_origin?: string; // 交换背景原图

  multi_image_path?: string; // 多张图片
  multi_source_image_path?: string; // 多源图片选择

  canvas_image_group?: string; // 图片合并
  image_first_frame?: string; // 首帧图片
  image_last_frame?: string; // 尾帧图片
  model?: string;
  model_name?: string;
  modelName?: string;
  model_alias?: string; // 模型别名
  real_model_name?: string;
  realModelName?: string;
  multi_view_images?: string; // 多视图图片上传
  advance_select_single_chips_1?: string; // 视频质量
  advance_select_single_chips_2?: string | number; // 视频时长
  lora_index?: number; // 甲型下标
}

export class ComfyUI {
  public static preAssignedServer: ServerStatus | null;
  private static websocket: WebSocket;
  private static sd3_key = "";

  /**
   * 保存绘画历史记录
   *
   */
  static async saveDrawHistory(drawHistory: IDrawHistoryCreat) {
    const user = useAuthUserinfo();
    Object.assign(drawHistory, {
      user_id: user?.value?._id,
      status: 0,
    });
    return await Client_POST<DrawHistoryItem, IDrawHistoryCreat>(
      "/draw/history",
      drawHistory,
    );
  }

  /**
   * 更新绘画历史记录
   *
   */
  static async updateDrawHistory(id: string, drawHistory: DrawHistoryItem) {
    Object.assign(drawHistory, {
      status: 1,
    });
    return await Client_PATCH<DrawHistoryItem>(
      `/draw/history/${id}`,
      drawHistory,
    );
  }

  /**
   * 处理comfyUI的服务器地址，避免多出末尾的/导致运行错误
   */
  static handleAddress(http_url: string) {
    if (http_url.trim().endsWith("/")) {
      return http_url.trim().replace(/\/$/, "");
    } else {
      return http_url.trim();
    }
  }

  /**
   * 运行分享的工作流,可以使本地测试运行，也可以是发送到服务端
   */
  static runSharedWorkFlow = async (
    workflow: any,
    params: Param[],
    drawParams: ComfyUIProperties,
    options: ComfyUIOptions,
    opts?: {
      signal?: AbortSignal;
    },
  ) => {
    // 将参数赋值给工作流
    return await this.submitCustomeWorkflow(drawParams, options, opts);
  };

  /**
   * 提交自定义工作流和参数到服务器端绘图
   */
  static async submitCustomeWorkflow(
    params: ComfyUIProperties,
    options: ComfyUIOptions,
    opts?: {
      signal?: AbortSignal;
    },
  ): Promise<DrawResponse> {
    const user = useAuthUserinfo();
    return (await Client_POST(
      `/draw/customWorkflow`,
      {
        client_id: user.value?._id || "",
        socket_id: user.value?.socket_id,
        params,
        options,
      } as ComfyUIRequestParams,
      { ...opts, showError: false },
    )) as DrawResponse;
  }

  static async submitVideoUpscaleTask(
    params: VideoUpscaleRequest,
  ): Promise<DrawResponse> {
    return (await Client_POST("/draw/video-upscale", params, {
      showError: false,
    })) as DrawResponse;
  }

  /**
   * 获取所有系统的服务器配置
   */
  static getServerList = async (): Promise<ServerStatus[]> => {
    return (await Client_GET("/draw/server")) as ServerStatus[];
  };

  /**
   * 根据user_id获取服务器配置
   */
  static getServerListByUserId = async (): Promise<ServerStatus[]> => {
    const user = useAuthUserinfo();
    return (await Client_GET(
      `/draw/server/${user.value?._id}`,
    )) as ServerStatus[];
  };

  /**
   * 根据工作流名称获取大模型的选择清单
   * @param workflow_id
   */
  static getModelListByWorkflowId = async (
    workflow_id: string,
  ): Promise<string[]> => Client_GET(`/draw/getModelListById/${workflow_id}`);

  /**
   * 根据工作流名称获取lora列表
   * @param workflow_id
   */
  static getLoraListByWorkflowId = async (
    workflow_id: string,
  ): Promise<string[]> => Client_GET(`/draw/getLoraListById/${workflow_id}`);

  /**
   * 预分配服务器
   */
  static preAssignServer = async () => {
    this.preAssignedServer = (await Client_GET(
      "/draw/preAssignServer",
    )) as ServerStatus;
  };

  /**
   * 上传图片到OSS，返回图片url
   * @param file
   */
  static uploadImage = async (
    file: File | any,
  ): Promise<string | undefined> => {
    // 清空预分配的服务器
    this.preAssignedServer = null;
    return await useUtilsUploadFileToOSS(file);
  };

  /**
   * 将文件上传到ComfyUI服务器,返回示例{
   *     "name": "00001.png",
   *     "subfolder": "",
   *     "type": "input"
   * }
   * @param file
   */
  static async uploadToComfyUIServer(file: File): Promise<string | undefined> {
    const formdata = new FormData();
    formdata.append("image", file);
    await this.preAssignServer();
    if (this.preAssignedServer && this.preAssignedServer.http_url) {
      const serverUrl = this.handleAddress(this.preAssignedServer.http_url);
      const { name } = (await myFetch(`${serverUrl}/upload/image`, {
        method: "post",
        body: formdata,
        mode: "cors",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      }).catch((err) => {
        useSnackbarStore().showErrorMessage(err);
      })) as any;
      // response.body
      return `./input/${name}`;
    }
  }

  /**
   * local_getWorkFlowByWorkFlowName
   * 根据API名称获取对应的工作流和参数
   */
  static local_getWorkFlowByWorkFlowName(
    workflow_name: string,
  ): WorkFlow | null {
    // 从状态中读取
    const { workflows } = useStableDiffusionStore();
    return workflows.find((item) => item.name === workflow_name) || null;
  }

  /**
   * 验证图片的文件大小和宽高不超过1024，文件大小不超过4M
   * @param file
   * @returns
   */
  static validateImage = async (file: any): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (!file.size || file.size > 4048000) {
        resolve(false);
      }
      const _URL = window.URL || window.webkitURL;
      const image = new Image();
      image.src = _URL.createObjectURL(file);
      image.onload = function () {
        // console.log(image.width>1024||image.height>1024)
        if (image.width > 1200 || image.height > 1200) {
          resolve(false);
          //   释放内存
          _URL.revokeObjectURL(image.src);
        } else {
          resolve(true);
          _URL.revokeObjectURL(image.src);
        }
      };
    });
  };

  /**
   * 取消绘画任务
   * @param task_id
   */
  static cancelDrawTask = async (task_id: string) => {
    return await Client_POST(`draw/cancelTask/${task_id}`);
  };
}

export type SD3AspectRatio =
  | "1:1"
  | "16:9"
  | "21:9"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "9:16";
type SD3StylePreset =
  | "3d-model"
  | "analog-film"
  | "anime"
  | "cinematic"
  | "comic-book"
  | "digital-art"
  | "enhance"
  | "fantasy-art"
  | "isometric"
  | "line-art"
  | "low-poly"
  | "modeling-compound"
  | "neon-punk"
  | "origami"
  | "photographic"
  | "pixel-art"
  | "tile-texture";

export interface DrawResponse {
  task_id: string;
  status:
    | "submitted"
    | "process"
    | "success"
    | "failed"
    | "rejected"
    | "unknown"; // 增加一个reject,队列超出限制的时候返回
  output?: string[]; // 数组，图像url,如果使用批次则是多张图，不适用批次为单张图
  output_content?: GeneralOutput[];
  output_stage?: "generating" | "upscaling" | "completed" | "failed";
  execution_chain?: ExecutionChainItem[];
  type?: OutputType;
  message?: string; // 错误消息
}

export interface VideoUpscaleRequest {
  video_url: string;
  model?: string;
  target_resolution?: string;
  source_task_id?: string;
  request_id?: string;
}

export interface UserWorkFlow {
  user_id: string;
  workflows: WorkFlow[];
}

/** 工作流超时设定 */
export interface TimeOutConfig {
  timeout: number;
  timeoutActions?: TimeOutActionEnum[];
}

export const TimeOutActionConst = {
  CANCEL: "cancel",
  CONTINUE: "continue",
  RETRY: "RETRY",
} as const;

export type TimeOutActionEnum =
  (typeof TimeOutActionConst)[keyof typeof TimeOutActionConst];

export type UseGuide =
  | { type: "image"; src: string }
  | { type: "component"; name: string }
  | { type: "html"; html: string };

/**
 * @property _id 工作流id
 * @property title 显示名称
 * @property name 标准名称，需要保持唯一
 * @property params 参数
 * @property workflow 工作流
 * @property cover 封面图
 * @property preview 预览图
 * @property is_public 是否公开
 * @property description 工作流描述
 * @property power   算力消耗
 * @property nodeCount 节点数
 * @property runTime 运行时间，秒
 * @property sortNumber 排序
 * @property tags 应用标签
 * @property useGuide 使用指导图，显示在工作流的使用页面
 * @property includeServers 指定运行的服务器名
 * @property excludeServers 排除运行的服务器名
 * @property user 用户
 * @property type 工作流类型
 * @property mainProducts 代表作
 * @property comment 评论
 * @property organizations 所属组织
 * @property salePrice 销售价格
 * @property updated_at 更新时间
 * @property application_id  所属应用
 * @property editor_model 0表示创造新内容， 1表示编辑已有内容
 * @property prem_level_min 默认为空，表示无需权限层级，有值时表示需要相应的权限层级才可以访问
 * @property category 分类
 * @property appType 应用类型
 * @property custom_workflow 自定义工作流id
 * @property customAccessUrl 自定义访问接口
 * @property created_at 创建时间
 * @property isLiked 是否喜欢
 * @property likeCount 喜欢数
 * @property isFavorited 是否喜欢
 * @property favoriteCount 喜欢数
 * @property useCount 使用次数
 */
export interface WorkFlow {
  _id?: string;
  title?: string; // 显示名称
  name: string; // 标准名称，需要保持唯一
  params: Param[]; // 参数
  workflow?: string | object; // 工作流
  cover?: string; // 封面图
  miniCover?: string; // 应用图标
  preview?: string; // 预览图
  is_public?: boolean; // 是否公开
  is_public_mcp?: boolean;
  description?: string; // 工作流描述
  appDetailMarkdown?: string; // 应用详情页说明（Markdown）
  description_mcp?: string; // 描述，用于mcp
  power?: number; //   算力消耗
  nodeCount?: number; // 节点数
  runTime?: number; // 运行时间，秒
  // timeout_setting?: TimeOutConfig;
  sortNumber?: number; // 排序
  tags?: string[]; // 应用标签
  useGuide?: UseGuide; // 使用指导图，显示在工作流的使用页面
  includeServers?: string[]; // 指定运行的服务器名
  excludeServers?: string[]; // 排除运行的服务器名
  user?: User;
  // type?: WorkFlowTypeEnum; // 工作流类型
  mainProducts?: string[]; // 代表作
  comment?: IComment[]; // 评论
  organizations?: string[]; // 所属组织
  salePrice?: number; // 销售价格
  updated_at?: number; // 更新时间
  application_id?: string[]; // 所属应用
  editor_model?: 0 | 1; // editor_model 0表示创造新内容， 1表示编辑已有内容
  prem_level_min?: number; // 默认为空，表示无需权限层级，有值时表示需要相应的权限层级才可以访问
  category?: WorkFlowCategoriesEnum[]; // 分类
  appType?: AppTypeEnum;
  custom_workflow?: string; // 自定义工作流id
  /** appType=n8n 时绑定的集成 Api _id */
  n8n_api_id?: string;
  template_example_data?: Record<string, any>;
  customAccessUrl?: string; // 自定义访问接口
  created_at?: number; // 创建时间
  isLiked?: boolean; // 是否喜欢
  likeCount?: number; // 喜欢数
  isFavorited?: boolean; // 是否收藏
  favoriteCount?: number; // 收藏数
  useCount?: number; // 使用次数
  integrationPlatforms?: { _id: string; code: string; isAuthed: boolean }[]; // 集成平台
  categoryId?: string; // 分类Id
  disableCancel?: boolean; // 是否禁止取消
  enableCanvasUse?: boolean; // 是否允许在画布中使用
  powder?: number; // 算力消耗，单张
}

/**
 * 绘图参数
 * @property task_id 任务id
 * @property source 调用来源
 * @property apisource 使用的api源，默认default,使用sd3官方API绘图时传sd3
 * @property lifo 优先
 * @property servername 服务器名称
 * @property workflow_id 工作流Id
 * @property workflow_name 工作流名称,使用自定义工作流必须
 * @property workflow_title 工作流名称-中文
 * @property result_retrieval 结果取回方式promise和websocket两种
 *
 */
export interface ComfyUIOptions {
  task_id?: string;
  source?: "web" | "wechat"; // 默认web,web端调用不需要传值
  apisource?: "sd3" | "default"; // ,默认default,使用sd3官方API绘图时传sd3
  lifo?: boolean; // 优先
  servername?: string; // 服务器名称
  workflow_id?: string; // 工作流Id
  workflow_name?: string; // 工作流名称,使用自定义工作流必须
  workflow_title?: string; // 工作流名称-中文
  server_id?: string; // 服务器名称
  // 结果取回方式promise和websocket两种
  result_retrieval?: "promise" | "websocket"; // 如果这里指定了就按照指定的方式取回结果
}

export interface ComfyUIRequestParams {
  params: ComfyUIProperties;
  client_id?: string;
  socket_id?: string;
  options?: ComfyUIOptions;
}

/**
 * 绘图历史
 * @property _id 历史id
 * @property user_id 用户id
 * @property workflow_id 工作流id
 * @property prompt_id 提示id
 * @property params 参数
 * @property created_at 创建时间
 * @property options 选项
 * @property status 状态，0未完成 1 已完成 2 异常出错 3任务取消
 * @property output 结果
 * @property type 类型
 * @property is_deleted 是否删除
 * @property is_public 是否公开
 * @property tags 标签
 * @property message 任务执行的错误信息
 * @property comment 评论
 */
export interface DrawHistoryItem {
  _id: string;
  user_id: string;
  workflow_id?: string;
  prompt_id?: string;
  params?: ComfyUIProperties;
  model_snapshot?: {
    display_name?: string;
    alias?: string;
    model_name?: string;
    real_model_name?: string;
    platform_model_id?: string;
    base_model_id?: string;
    source?: string;
  };
  created_at?: number;
  options?: ComfyUIOptions;
  status?: 0 | 1 | 2 | 3 | 4 | 6 | 9; // 0未完成 1 已完成 2异常 3取消 4超时 6进行中 9未知
  output?: string[];
  output_content?: GeneralOutput[];
  output_stage?: "generating" | "upscaling" | "completed" | "failed";
  execution_chain?: ExecutionChainItem[];
  type?: OutputType;
  is_deleted?: boolean;
  is_public?: boolean;
  is_public_to_profile?: boolean; // 是否公开到个人主页
  publish_status?: "pending" | "approved" | "rejected" | "withdrawn"; // 发布审核状态
  tags?: string[];
  mediaSize?: MediaSize;
  message?: string; // 任务执行的错误信息
  original_error_message?: string; // 原始错误信息，区别于转换后的友好错误信息
  comment?: IComment[];
  power?: number;
  income?: number;
  incomeRMB?: number;
  started_at?: number; // 任务开始执行时间
  finished_at?: number; // 任务完成时间
  workflow?: WorkFlow;
  /** 服务端任务进度（与 WebSocket queue_status 同源时可同步） */
  progress?: number;

  server_id?: string;
  conversation_id?: string;
  user?: User;
  platform_id?: string; // 针对API生成的没有工作流，只有平台
  attempt_count?: number;
  retry_chain_summary?: RetryChainSummary;
  retry_chain?: RetryChainItem[];
}

export interface RetryChainItem {
  _id?: string;
  event_type?: "attempt" | "tpm_wait" | "rate_limit" | "policy";
  status?: string;
  attempt_no?: number;
  platform_id?: string;
  platform_model_id?: string;
  base_model_id?: string;
  provider_name?: string;
  platform_name?: string;
  display_name?: string;
  alias?: string;
  real_model_name?: string;
  queue_key?: string;
  usage?: Record<string, unknown>;
  rate_limit_snapshot?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  retryable?: boolean;
  trace?: RetryChainTraceItem[];
  error?: { message?: string; name?: string };
  duration_ms?: number;
  created_at?: string | number;
}

export interface RetryChainTraceItem {
  type?: string;
  event?: string;
  scope?: string;
  action?: string;
  reason?: string;
  message?: string;
  at?: number;
  createdAt?: string;
  retry?: boolean;
  policySource?: string;
  policy?: string;
  policyRule?: string;
  matchedValue?: string;
  errorCode?: string;
  statusCode?: number;
  category?: string;
  nextPlatformId?: string;
  nextPlatformName?: string;
  cooldownSeconds?: number;
  candidateCount?: number;
  eligibleClientCount?: number;
  candidateIndex?: number;
  candidateRank?: number;
  attemptNo?: number;
  maxAttempts?: number;
  attemptedClientCount?: number;
  remainingCandidateCount?: number;
  currentPlatformId?: string;
  currentPlatformName?: string;
  selectionStrategy?: string;
  selectionReason?: string;
  candidateMetrics?: RetryChainCandidateMetric[];
  currentPriority?: number;
  currentPlatformPriority?: number;
  currentModelPriority?: number;
  currentDynamicPriority?: number;
  currentEffectivePriority?: number;
  currentLimiterRatio?: number;
  decisionOutcome?: string;
  terminal?: boolean;
  terminalReason?: string;
  exhausted?: boolean;
  data?: Record<string, unknown>;
}

export interface RetryChainCandidateMetric {
  rank?: number;
  platformId?: string;
  platformName?: string;
  platformModelId?: string;
  alias?: string;
  realModelName?: string;
  priority?: number;
  platformPriority?: number;
  modelPriority?: number;
  dynamicPriority?: number;
  effectivePriority?: number;
  limiterRatio?: number;
  policyLoadRatio?: number;
  queueLoadRatio?: number;
  queue?: number;
  waitingQueue?: number;
  activeQueue?: number;
  referenceConcurrency?: number;
  lastAssignedAt?: number;
  selected?: boolean;
  transferFallback?: boolean;
}

export interface RetryChainSummary {
  attempt_count?: number;
  wait_count?: number;
  platforms?: string[];
  aliases?: string[];
  last_status?: string;
  last_error?: string;
  timeline?: RetryChainItem[];
}

export type DrawHistoryItemPopulate = DrawHistoryItem & {
  user: User;
  workflow?: WorkFlow;
  platform?: IntegrationPlatform;
  server?: {
    _id: string;
    name: string;
    [key: string]: any;
  };
};

export type IDrawHistoryItemDTO = Omit<DrawHistoryItem, "user_id"> & {
  user: User;
};

export type IDrawHistoryQuery = DrawHistoryItem & {
  created_from: number;
  created_to: number;
  userKeyWord: string;
  searchKeyWord: string;
};

export type IDrawHistoryCreat = Omit<DrawHistoryItem, "_id" | "user_id"> & {
  user_id: string;
};

export type DrawTaskStatus = DrawHistoryItem & {
  progress?: number;
  queue?: number;
  remainingTime?: number;
  abortController?: AbortController;
};

interface MediaSize {
  /**
   * 资源类型，image/video/audio
   */
  type: OutputType;
  /**
   * 资源状态，0未计算,1已计算,2资源异常
   */
  status: 0 | 1 | 2; // 0未计算,1已计算,2资源异常
  width?: number;
  height?: number;
}

// 产出接口
export interface OutPut {
  result: string;
  type: OutputType;
  params: ComfyUIProperties;
}

// 服务器状态
export interface ServerStatus {
  _id: string;
  name: string;
  http_url: string;
  queue: number;
  enabled: boolean; // 是否启用
  status: 0 | 1; // 0:offline, 1:custom
  type: "common" | "user"; // 服务器类型
  user_id: string; // 服务器所属的user_id
  channel?: "default" | "autodl";
  concurrency_limit?: number;
  priority?: number; // 优先级，数值越大优先级越高
  organizations: string[];
  deployment_container_uuid?: string;
  cloud_platform_id?: string;
  queueStatus?: QueueStatus;
  customHeaders?: Array<{ key: string; value: string }>;
}

interface QueueStatus {
  total: number;
  waiting: number;
  active: number;
}

// 产出类型
export type OutputType = "image" | "video" | "text" | "audio" | "3d";

/**
 * 绘图参数-图片
 * @property image_path_origin 原图路径
 * @property advance_onlineEdit_origin 原图在线编辑
 * @property advance_onlineEdit_mask 蒙版在线编辑
 * @property custom_batch_image_path_origin 原图路径-批量上传
 * @property advance_image_path_3d 3D模型路径
 * @property advance_image_upload 上传图片
 * @property advance_sample_image_upload 上传样本图片
 * @property advance_background_upload 上传背景图片
 * @property advance_canvas_image_upload 上传画布图片
 * @property advance_canvas_mask_upload 上传画布蒙版图片
 * @property advance_splitter_image_upload 上传分割图片
 * @property advance_splitter_mask_upload 上传分割蒙版图片
 * @property multi_image_path 多图上传
 * @property multi_source_image_path 多源图片选择
 */
export type ComfyUIImageProperties = Pick<
  ComfyUIProperties,
  | "image_path"
  | "advance_onlineEdit_origin"
  | "advance_onlineEdit_origin_2"
  | "advance_onlineEdit_mask"
  | "advance_onlineEdit_mask_2"
  | "custom_batch_image_path_origin"
  | "custom_batch_image_path_origin_2"
  | "advance_image_path_3d"
  | "advance_image_upload"
  | "advance_sample_image_upload"
  | "advance_background_upload"
  | "advance_canvas_image_upload"
  | "advance_canvas_mask_upload"
  | "advance_splitter_image_upload"
  | "advance_splitter_mask_upload"
  | "multi_source_image_path"
  | "multi_image_path"
  | "canvas_image_group"
>;

/**
 * 绘图参数-图片
 */
export const ComfyUIImageKeys: (keyof ComfyUIImageProperties)[] = [
  "image_path",
  "advance_onlineEdit_origin",
  "advance_onlineEdit_mask",
  "custom_batch_image_path_origin",
  "advance_image_path_3d",
  "advance_image_upload",
  "advance_sample_image_upload",
  "advance_background_upload",
  "advance_canvas_image_upload",
  "advance_canvas_mask_upload",
  "advance_splitter_image_upload",
  "advance_splitter_mask_upload",
  "multi_source_image_path",
  "multi_image_path",
  "canvas_image_group",
];
