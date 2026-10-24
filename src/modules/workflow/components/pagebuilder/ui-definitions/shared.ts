import type { AIAspectRatioOption, UiComponent } from "../ui-schema";
import { getParamAlias } from "../param-utils";
import { runtimeValueSlot } from "@/modules/workflow/runtime-model/identity";

export type SafeSelectOption = { key: string; uiValue: string; rawValue: string; label: string };

// 在一组候选字段中读取“第一个有效字符串”，并做统一清洗。
// 常用于从素材对象中提取可直接用于工作流输入的 URL/path。
function readStringField(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return normalizeInputString(v);
  }
  return null;
}

// 规范化字符串输入：
// 1) trim 前后空白；2) 去掉成对包裹符（`...` / "..." / '...'）。
// 目的是减少用户输入中“复制粘贴包裹符”对后端参数的影响。
function normalizeInputString(raw: string): string {
  let v = String(raw ?? "").trim();
  while (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    const wrapped =
      (first === "`" && last === "`") ||
      (first === '"' && last === '"') ||
      (first === "'" && last === "'");
    if (!wrapped) break;
    v = v.slice(1, -1).trim();
  }
  return v;
}

// 将“原始选项”转换为“安全可选项”：
// - 解决 option.value 为空字符串时，UI 选择控件无法区分“未选择”和“选择了空值”的问题
// - uiValue 用于 UI 组件的 value；rawValue 才是实际提交给后端/工作流的值
export function buildSafeSelectOptions(options: AIAspectRatioOption[]): SafeSelectOption[] {
  return (options ?? []).map((o, idx) => {
    const rawValue = String(o.value ?? "");
    const uiValue = rawValue === "" ? `__empty_option_${idx}__` : rawValue;
    return {
      key: `${idx}:${uiValue}`,
      uiValue,
      rawValue,
      label: String(o.label ?? o.value ?? ""),
    };
  });
}

// 将运行时 value 转换为可用于请求参数的 payload：
// - File / File[] 不适合直接 JSON 序列化（会丢失信息/导致异常）
// - 这里将 File 仅转换为摘要信息，用于后续 dispatchParams 的构建
// - 注意：真正的文件上传逻辑通常在组件自身内部完成（上传后 value 可能变为 FileMaterial 等结构）
export function valueToInputPayload(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const materialLike = value as Record<string, unknown>;
    const directUrl = readStringField(materialLike, ["accessUrl", "url", "src", "path"]);
    if (directUrl) return directUrl;
  }
  if (value instanceof File) {
    return { name: value.name, size: value.size, type: value.type };
  }
  if (Array.isArray(value)) {
    if (value.every((x) => x instanceof File)) {
      return value.map((f) => ({ name: f.name, size: f.size, type: f.type }));
    }
    return value.map((x) => valueToInputPayload(x));
  }
  return value;
}

export function getRuntimeParamAlias(component: UiComponent): string | null {
  const params = component.basic?.params ?? [];
  const alias = getParamAlias(params[0]);
  return alias ? alias : null;
}

export function readRuntimeComponentValue(
  component: UiComponent,
  values: Record<string, unknown>,
): { hasValue: boolean; value: unknown } {
  const runtimeKey = runtimeValueSlot(component);
  if (runtimeKey && runtimeKey in values) {
    return { hasValue: true, value: values[runtimeKey] };
  }

  const alias = getRuntimeParamAlias(component);
  if (alias && alias !== runtimeKey && alias in values) {
    return { hasValue: true, value: values[alias] };
  }

  return { hasValue: false, value: undefined };
}

// 用于运行时表单 Label 的展示文案：
// - 优先使用 component.title
// - 否则回退到参数别名 basic.params[0].name
// - 再回退到 component.type
export function normalizeRuntimeLabel(component: UiComponent): string {
  const t = component.title?.trim();
  if (t) return t;
  const alias = getRuntimeParamAlias(component);
  return alias || component.type;
}

// 默认的 dispatch 参数收集逻辑：
// - 读取组件 basic.params[0].name（参数别名）作为 key
// - 从 values 中取该 key 对应的运行时值，并做必要的 payload 转换
// - 若运行时值为空（undefined/null/空串/空数组），回退到 basic.params[0].defaultValue
// - 若 key 不存在且无默认值，则不输出该参数
export function defaultCollectDispatchParamsForComponent(component: UiComponent, values: Record<string, unknown>): Record<string, unknown> {
  const params = component.basic?.params ?? [];
  const key0 = getRuntimeParamAlias(component);
  if (!key0) return {};
  // defaultValue 在 schema 中以 string 存储，这里统一做字符串清洗。
  const defaultRaw = params[0]?.defaultValue;
  const defaultValue = typeof defaultRaw === "string" && defaultRaw.trim() ? normalizeInputString(defaultRaw) : undefined;

  const runtimeState = readRuntimeComponentValue(component, values);
  const runtimeHasKey = runtimeState.hasValue;
  const runtimeValue = runtimeState.value;
  // “空值”定义：
  // - string: ""
  // - array: []
  // - 以及 undefined/null
  // 命中后将使用 defaultValue（若存在）。
  const isRuntimeEmpty =
    runtimeValue === undefined ||
    runtimeValue === null ||
    (typeof runtimeValue === "string" && runtimeValue.trim() === "") ||
    (Array.isArray(runtimeValue) && runtimeValue.length === 0);

  if (!runtimeHasKey && defaultValue === undefined) return {};
  const finalValue = isRuntimeEmpty ? defaultValue : runtimeValue;
  if (finalValue === undefined) return {};
  // 统一通过 valueToInputPayload 做可序列化转换（如 File -> 摘要信息）。
  return { [key0]: valueToInputPayload(finalValue) };
}
