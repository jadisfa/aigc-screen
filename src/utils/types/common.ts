import type { UseWebSocketReturn } from "@vueuse/core";
import type { WatchHandle, Reactive } from "vue";
import type { WorkFlowApp } from "~/composables/app/useHome";
import type { IImageSource } from "~/composables/ai/useImageSource";
import type { IPageFeature } from "~/composables/admin/usePageFeature.types";
import type { ImageResolutionType } from "~/composables/admin/billingManager.types";
import type { WorkFlow } from "@/utils/comfyuiApi";

/** websocket状态 */
export interface ISocketState {
  socket: null | WebSocket;
  isInitialized: boolean;
}

/** Websocket */
export interface IMyUseWebSocketReturn<T> extends UseWebSocketReturn<T> {
  stopWatch: Ref<WatchHandle | null>;
  sessionReady?: Ref<boolean>;
  waitForSessionReady?: (timeoutMs?: number) => Promise<boolean>;
  setOnMessage: (callback: (msg: unknown) => void) => void;
  addOnMessageListener?: (callback: (msg: unknown) => void) => () => void;
  setOnConnected: (callback: (ws: WebSocket) => void) => void;
  setOnConnectError: (callback: (ws: WebSocket) => void) => void;
  setOnClosed: (callback: (ws: WebSocket, event: CloseEvent) => void) => void;
}

/**
 * 分页查询
 * @property pageNumber 当前页数
 * @property pageSize 分页大小
 * @property search 搜索关键字
 * @property sort 排序类型 asc:升序 desc:降序
 */
export interface IPageNation {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  sort?: "asc" | "desc";
}

/**
 * 分页查询结果
 * @property total 总数
 * @property items 数据
 */
export interface IPageNationQuery<T> {
  total: number;
  items: T[];
}

/** 将属性变为必填字段 */
export type MakeRequired<T, K extends keyof T> = Partial<T> &
  Required<Pick<T, K>>;

/** vuetify 表格headers  */
export interface IHeader<T> {
  title: string;
  key: keyof T | "actions" | "select";
  align?: "left" | "center" | "right" | "start";
  sortable?: boolean;
  width?: string | number;
  readonly minWidth?: string | number | undefined;
  readonly maxWidth?: string | number | undefined;
  readonly nowrap?: boolean | undefined;
}

export const GlobalInjectKeyConst = {
  MemberInfo: "memberInfo",
  WorkflowAppStatus: "workflowAppStatus",
  AllWorkFlowApps: "allWorkFlowApps",
  AllPublicWorks: "allPublicWorks",
  PageStyles: "pageStyles",
  PageStylesDynamicComponent: "pageStylesDynamicComponent",
  AllMaterials: "allMaterials",
  SelfHistories: "selfHistories",
  Organizations: "organizations",
  FeatureControl: "featureControl",
  UploadFileToOSS: "useUtilsUploadFileToOSS",
  WorkflowShareData: "workflowShareData",
} as const;

// Builder 编辑模式注入 key（使用 Symbol 确保唯一性）
export const BuilderEditingKey: InjectionKey<true> = Symbol("BuilderEditing");

// Chat 相关的注入 key（使用 Symbol 确保唯一性）
export const ChatMiniIconModeKey = Symbol("ChatMiniIconMode");
export const ChatActionMiniIconModeKey = Symbol("ChatActionMiniIconMode");

export type GlobalInjectKeyEnum =
  (typeof GlobalInjectKeyConst)[keyof typeof GlobalInjectKeyConst];

/** 全局注入会员信息 */
export interface GlobalInjectMemberStatus {
  memberInfo: Ref<IMember | null, IMember | null>;
}

/** 全局注入工作流应用状态（workflows 为 reactive，未加载时为 undefined） */
export interface GlobalInjectWorkflowAppStatus {
  workflows: WorkFlowApp[] | undefined;
  refreshAllWorkflows: () => Promise<void>;
}

/** 全局注入公开的作品状态 */
export interface GlobalInjectPublicWorkStatus {
  publicWorks: Ref<DrawHistoryItem[], DrawHistoryItem[]>;
  refreshAllPublicWorks: () => Promise<void>;
}

/** 全局注入的页面样式状态 */
export interface GlobalInjectPageStyleStatus {
  pageStyles: Ref<IPageStyle[], IPageStyle[]>;
  pageStylesDynamicComponent: Ref<
    Record<string, IDynamicComponentNode[]>,
    Record<string, IDynamicComponentNode[]>
  >;
  darkTheme: Ref<boolean, boolean>;
}

/** 全局注入的素材数据 */
export interface GlobalInjectMaterials {
  materials: Ref<IMaterial[], IMaterial[]>;
  refreshMaterials: () => Promise<void>;
}

/** 全局注入的个人历史记录 */
export interface GlobalInjectPersonalHistories {
  personalHistories: Ref<IImageSource[], IImageSource[]>;
  refreshPersonalHistories: () => Promise<void>;
  /** 后端返回的标签列表（分页模式） */
  serverTags?: Ref<string[], string[]>;
  /** 是否还有更多数据（分页模式） */
  hasMore?: Ref<boolean, boolean>;
  /** 是否正在加载（分页模式） */
  loading?: Ref<boolean, boolean>;
  /** 加载更多数据（分页模式） */
  loadMore?: () => Promise<void>;
  /** 切换标签（分页模式） */
  onTagChange?: (tag?: string) => void;
}

/** 注入的组织架构数据 */
export interface InjectOrganizations {
  organizations: Ref<IOrganization[], IOrganization[]>;
  refreshOrganizations: () => Promise<void>;
}
export interface GlobalInjectInjectFeatureControl {
  featureControl: Ref<IPageFeature[], IPageFeature[]>;
  refreshFeatureControl: () => Promise<void>;
}

/** 全局注入函数，上传文件 */
export interface GlobalInjectUploadFileToOSS {
  useUtilsUploadFileToOSS: (
    file: File | Blob,
    filename?: string,
  ) => Promise<string>;
}

export interface WorkFLowShareData {
  type: Ref<PlatformModelType, PlatformModelType>;
  modelConfig: Ref<PlatformModel, PlatformModel>;
  currentMode: Reactive<CurrentGenerationMode>;
}

export interface CurrentGenerationMode {
  images_upload?:
    | "input_first_frame"
    | "input_last_frame"
    | "input_first_last_frame";
  resolution?: VideoResolutionType | ImageResolutionType;
  duration?: number;
  aspectRatio?: AspectRatioType;
}

export interface HistoryItem {
  _id: string;
  workflow_id: string;
  type: "image" | "video";
  output: string[];
  finished_at?: string;
  created_at: string;
  workflow_type?: string;
  workflow?: WorkFlow;
  startedAt?: string;
  [key: string]: any;
}
