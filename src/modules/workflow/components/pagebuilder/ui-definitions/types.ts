import type { DragEvent, ReactNode } from "react";
import type { UiComponent, UiComponentType } from "../ui-schema";

// Ui 组件定义体系说明：
// - 一个 UiComponentDefinition 描述了某类组件在「组件面板」「画布」「运行时表单」「扩展配置面板」中的渲染方式与数据处理方式
// - PageBuilder 会在不同场景调用不同的 render* 方法：
//   - renderCanvasPreview：画布中“非选中态/概览态”的预览（偏静态展示，用于排版与识别）
//   - renderRuntimeField：运行时表单中的真实交互输入控件（用户真正填写/选择的入口）
//   - renderExtEditor：右侧属性面板中该组件的扩展配置编辑器（配置 ext 字段，影响渲染/校验/约束等）
export type UiComponentMeta = {
  type: UiComponentType;
  iconName: string;
};

// 组件在左侧“组件面板”中的展示元信息。
// 说明：
// - id：该面板项的稳定标识
// - label：显示名称
// - category：分组（用于面板分栏）
// - badge：可选标签（如 Biz / Beta）
// - order：同分组内排序
export type UiComponentPaletteMeta = {
  id: string;
  label: string;
  category: string;
  badge?: string;
  order?: number;
};

// 运行时字段渲染入参：
// - comp：当前组件 schema（定义层数据）
// - value：该组件在本次运行中的值（运行层数据）
// - onChange：写回运行时值
// - LabelComp：统一标签渲染器（由注册中心注入，保证样式一致）
export type UiComponentRuntimeFieldProps = {
  comp: UiComponent;
  value: unknown;
  onChange: (next: unknown) => void;
  LabelComp: () => ReactNode;
};

// 画布卡片渲染入参：
// - 负责“已放置组件”的外层交互容器（选中、拖拽、删除）
// - 组件自身视觉内容由 renderCanvasPreview 渲染
export type UiComponentCanvasCardProps = {
  comp: UiComponent;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onChangeComponent?: (next: UiComponent) => void;
  onRemove: () => void;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
};

export type UiComponentDefinition = {
  type: UiComponentType;
  iconName: string;
  palette?: UiComponentPaletteMeta;
  // renderPaletteHoverPreview：
  // - 左侧组件面板中，鼠标悬浮某个组件时显示的“预览卡片”
  // - 用于让用户在拖拽/添加前快速理解组件大致形态与交互
  renderPaletteHoverPreview?: () => ReactNode;
  // renderCanvasCard：
  // - PageBuilder 画布中每个已放置组件的外层卡片渲染（含选中态、拖拽手柄、删除按钮等）
  // - 这里通常会包裹 renderCanvasPreview 或渲染更丰富的卡片内容
  renderCanvasCard?: (props: UiComponentCanvasCardProps) => ReactNode;
  // createInitialRuntimeValue：
  // - 为运行时 values 提供初始值（通常来自 defaultValue 或组件约定的默认结构）
  // - 仅影响“运行态输入”，不修改 schema 本身
  createInitialRuntimeValue: (component: UiComponent) => unknown;
  // prepareRuntimeValueBeforeDispatch：
  // - 在“提交/运行工作流”之前，对运行时 value 做一次可选的标准化/补全
  // - 常用于：自动生成值、去除临时字段、或把 UI 内部结构转成后端需要的结构
  prepareRuntimeValueBeforeDispatch?: (component: UiComponent, value: unknown) => unknown | undefined;
  // collectDispatchParams：
  // - 从 values（所有组件的运行时值）中提取当前组件对应的参数，并组装成 dispatch payload
  // - 一般会读取 basic.params[0].name 作为 key，将 value 映射到该 key 上
  collectDispatchParams: (component: UiComponent, values: Record<string, unknown>) => Record<string, unknown>;
  // renderCanvasPreview：
  // - PageBuilder 画布中的“组件预览内容”
  // - 通常用于让用户在画布中识别组件类型与当前配置效果（偏静态，不一定可交互）
  renderCanvasPreview: (component: UiComponent) => ReactNode;
  // renderRuntimeField：
  // - 运行时表单的字段渲染（真实交互控件）
  // - 用户实际输入/选择的数据会通过 onChange 写入运行时 values
  renderRuntimeField: (props: UiComponentRuntimeFieldProps) => ReactNode;
  // renderExtEditor：
  // - 右侧属性面板的扩展配置编辑器
  // - 修改的是组件 schema（UiComponent.ext 等），而不是运行时 value
  renderExtEditor: (component: UiComponent, onChange: (next: UiComponent) => void) => ReactNode;
};
