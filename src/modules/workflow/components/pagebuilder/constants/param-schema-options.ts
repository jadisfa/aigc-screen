import type { UiParamSchemaFormat, UiParamSchemaType } from "../ui-schema";

export const PARAM_SCHEMA_TYPE_OPTIONS: { value: UiParamSchemaType; label: string }[] = [
  { value: "string", label: "字符串" },
  { value: "number", label: "数字" },
  { value: "boolean", label: "布尔值" },
  { value: "object", label: "对象" },
  { value: "array", label: "数组" },
  { value: "null", label: "空值" },
  { value: "union", label: "联合" },
];

export const PARAM_SCHEMA_FORMAT_OPTIONS: { value: UiParamSchemaFormat; label: string }[] = [
  { value: "date", label: "日期（date）" },
  { value: "time", label: "时间（time）" },
  { value: "date-time", label: "日期时间（date-time）" },
  { value: "email", label: "邮箱（email）" },
  { value: "uri", label: "URL/URI（uri）" },
  { value: "regex", label: "正则（regex）" },
  { value: "json", label: "JSON（json）" },
];
