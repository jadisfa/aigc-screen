import { useEffect, useMemo, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";
import { HelpCircle, Plus, Trash2 } from "lucide-react";
import { type ParsedWorkflowNode } from "@/shared/api/workflow/workflow";
import type {
  UiComponent,
  UiComponentMcp,
  UiParam,
  UiParamSchema,
  UiParamSchemaFormat,
  UiParamSchemaType,
} from "./ui-schema";
import { PARAM_SCHEMA_FORMAT_OPTIONS, PARAM_SCHEMA_TYPE_OPTIONS } from "./constants/param-schema-options";
import { createDefaultComponent } from "./definition/default-ext";
import { renderUiComponentExtEditor } from "./ui-component-registry";
import { WorkflowComponentParamsEditor } from "./WorkflowComponentParamsEditor";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isEmptyObject(value: unknown): boolean {
  if (!isPlainObject(value)) return true;
  return Object.keys(value).length === 0;
}

function coerceUiParamSchema(value: unknown): UiParamSchema | null {
  if (!isPlainObject(value)) return null;
  const typeRaw = value.type;
  if (typeof typeRaw !== "string") return null;
  const type = PARAM_SCHEMA_TYPE_OPTIONS.map((x) => x.value).includes(typeRaw as UiParamSchemaType) ? (typeRaw as UiParamSchemaType) : null;
  if (!type) return null;

  const constraintRaw = isPlainObject(value.constraint) ? value.constraint : null;
  const metaRaw = isPlainObject(value.meta) ? value.meta : null;

  const minLength = typeof value.minLength === "number" ? value.minLength : undefined;
  const maxLength = typeof value.maxLength === "number" ? value.maxLength : undefined;
  const pattern = typeof value.pattern === "string" ? value.pattern : undefined;

  const formatRaw = value.format;
  const format =
    typeof formatRaw === "string" && PARAM_SCHEMA_FORMAT_OPTIONS.map((x) => x.value).includes(formatRaw as UiParamSchemaFormat)
      ? (formatRaw as UiParamSchemaFormat)
      : undefined;

  const enumValuesRaw = Array.isArray(value.enumValues)
    ? value.enumValues
    : Array.isArray(value.enum)
      ? value.enum
      : undefined;

  const enumValues = Array.isArray(enumValuesRaw)
    ? enumValuesRaw.map((x) => String(x)).map((x) => x.trim()).filter((x) => x)
    : undefined;

  const requiredRaw =
    typeof constraintRaw?.required === "boolean" ? constraintRaw.required : typeof (value as Record<string, unknown>).required === "boolean" ? ((value as Record<string, unknown>).required as boolean) : undefined;
  const nullableRaw =
    typeof constraintRaw?.nullable === "boolean" ? constraintRaw.nullable : typeof (value as Record<string, unknown>).nullable === "boolean" ? ((value as Record<string, unknown>).nullable as boolean) : undefined;

  const labelRaw =
    typeof metaRaw?.label === "string" ? metaRaw.label : typeof (value as Record<string, unknown>).label === "string" ? ((value as Record<string, unknown>).label as string) : undefined;
  const descriptionRaw =
    typeof metaRaw?.description === "string"
      ? metaRaw.description
      : typeof (value as Record<string, unknown>).description === "string"
        ? ((value as Record<string, unknown>).description as string)
        : undefined;
  const tagsRaw = Array.isArray(metaRaw?.tags) ? metaRaw?.tags : undefined;
  const tags = Array.isArray(tagsRaw) ? tagsRaw.map((x) => String(x)).map((x) => x.trim()).filter((x) => x) : undefined;

  return {
    ...(value as Record<string, unknown>),
    type,
    constraint: { ...(constraintRaw ?? {}), required: requiredRaw, nullable: nullableRaw },
    meta: { ...(metaRaw ?? {}), label: labelRaw, description: descriptionRaw, tags },
    minLength,
    maxLength,
    pattern,
    format,
    enumValues,
  };
}

function createDefaultParamSchema(): UiParamSchema {
  return { type: "string" };
}

function parseOptionalIntOrEmpty(text: string): { ok: true; value: number | undefined } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: undefined };
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: "请输入数字或留空" };
  const v = Number(trimmed);
  if (!Number.isFinite(v)) return { ok: false, message: "请输入数字或留空" };
  return { ok: true, value: v };
}

function ensureMcp(mcp: UiComponentMcp | undefined): UiComponentMcp {
  return {
    description: mcp?.description ?? "",
    ignore: mcp?.ignore ?? false,
    dataType: mcp?.dataType ?? "string",
    required: mcp?.required ?? false,
    defaultValue: mcp?.defaultValue ?? "",
  };
}

/**
 * PageBuilder 组件属性面板。
 *
 * 业务流程：
 * - Basic：编辑组件参数（参数与 workflow 节点输入的映射），并通过 onChange 回写到 ui_schema。
 * - MCP：编辑对接 MCP 的描述/忽略/类型/必填/默认值，用于后续能力暴露与自动对接。
 * - Schema：为参数补充 Schema（类型/约束/元信息），供校验与表单生成；支持从空状态一键初始化。
 * - More：渲染组件扩展属性（按不同组件类型注册的扩展编辑器）。
 *
 * 异常/回退：
 * - Schema 的数字输入（min/max）允许留空；非法输入只展示本地错误提示，不阻断其它编辑。
 * - rawJson 解析或节点输入提取失败时，参数编辑器会回退为“无可选属性/请先解析”提示。
 */
export default function WorkflowComponentPropertyPanel(props: {
  component: UiComponent;
  nodes: ParsedWorkflowNode[];
  rawJson?: unknown;
  onChange: (next: UiComponent) => void;
}) {
  const [activeTab, setActiveTab] = useState("basic");
  const component = props.component;

  const [schemaEditorOpen, setSchemaEditorOpen] = useState(() => !isEmptyObject(component.schema));
  const [minLengthText, setMinLengthText] = useState("");
  const [maxLengthText, setMaxLengthText] = useState("");
  const [lengthError, setLengthError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = coerceUiParamSchema(component.schema);
    setSchemaEditorOpen(!isEmptyObject(component.schema));
    setMinLengthText(parsed?.minLength == null ? "" : String(parsed.minLength));
    setMaxLengthText(parsed?.maxLength == null ? "" : String(parsed.maxLength));
    setLengthError(null);
  }, [component.id, component.schema]);

  const update = (patch: Partial<UiComponent>) => {
    props.onChange({ ...component, ...patch } as UiComponent);
  };

  const updateParams = (params: UiParam[]) => {
    update({ basic: { ...component.basic, params } });
  };

  const resetToDefaults = () => {
    const d = createDefaultComponent(component.type, component.position);
    props.onChange({ ...d, id: component.id, position: component.position });
  };

  const renderExt = () => {
    return renderUiComponentExtEditor(component, props.onChange);
  };

  const renderExtBlock = () => (
    <div className="border-border">
      {renderExt()}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 space-y-4 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">组件类型</span>
          <span className="text-sm font-medium text-primary border border-primary rounded-md px-3 py-0.5">
            {component.type}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">组件标题</span>
          <Input value={component.title} onChange={(e) => update({ title: e.target.value })} placeholder="组件标题" className="h-9 flex-1" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 min-h-0 flex flex-col">
        <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none h-auto p-0 gap-0 shrink-0">
          <TabsTrigger
            value="basic"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm data-[state=active]:text-foreground data-[state=active]:font-medium"
          >
            基本属性
          </TabsTrigger>
          <TabsTrigger
            value="mcp"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm data-[state=active]:text-foreground data-[state=active]:font-medium"
          >
            MCP属性
          </TabsTrigger>
          <TabsTrigger
            value="schema"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm data-[state=active]:text-foreground data-[state=active]:font-medium"
          >
            参数Schema
          </TabsTrigger>
          <TabsTrigger
            value="more"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm data-[state=active]:text-foreground data-[state=active]:font-medium"
          >
            扩展属性
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-0 flex-1 min-h-0 overflow-y-auto scrollbar-hidden space-y-4">
          <WorkflowComponentParamsEditor component={component} nodes={props.nodes} rawJson={props.rawJson} onChangeParams={updateParams} />
        </TabsContent>

        <TabsContent value="mcp" className="mt-0 flex-1 min-h-0 overflow-y-auto scrollbar-hidden pt-4 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">描述</span>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Textarea
              value={ensureMcp(component.mcp).description}
              onChange={(e) => update({ mcp: { ...ensureMcp(component.mcp), description: e.target.value } })}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm text-foreground">是否忽略</span>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Switch
              checked={ensureMcp(component.mcp).ignore}
              onCheckedChange={(v) => update({ mcp: { ...ensureMcp(component.mcp), ignore: v } })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm text-foreground">数据类型</span>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <select
              value={ensureMcp(component.mcp).dataType}
              onChange={(e) => update({ mcp: { ...ensureMcp(component.mcp), dataType: e.target.value as UiComponentMcp["dataType"] } })}
              className="w-32 h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="string">字符串</option>
              <option value="number">数字</option>
              <option value="boolean">布尔值</option>
              <option value="array">数组</option>
              <option value="object">对象</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm text-foreground">是否必须</span>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Switch
              checked={ensureMcp(component.mcp).required}
              onCheckedChange={(v) => update({ mcp: { ...ensureMcp(component.mcp), required: v } })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">默认值</span>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Textarea
              value={ensureMcp(component.mcp).defaultValue}
              onChange={(e) => update({ mcp: { ...ensureMcp(component.mcp), defaultValue: e.target.value } })}
              rows={3}
            />
          </div>
        </TabsContent>

        <TabsContent value="schema" className="mt-0 flex-1 min-h-0 overflow-y-auto scrollbar-hidden pt-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            可选。用于描述该参数值的 Schema，便于校验与表单生成；在工作流节点之间进行参数交接时，也可用于自动对接和处理参数。
          </p>

          {!schemaEditorOpen && (
            <Button
              variant="outline"
              className="gap-1.5 w-full justify-center"
              onClick={() => {
                setSchemaEditorOpen(true);
                if (isEmptyObject(component.schema)) {
                  update({ schema: createDefaultParamSchema() });
                }
              }}
            >
              <Plus className="w-4 h-4" />
              添加参数 SCHEMA
            </Button>
          )}

          {schemaEditorOpen && (
            <div className="space-y-4">
              {(() => {
                const current = coerceUiParamSchema(component.schema) ?? createDefaultParamSchema();

                const commit = (next: UiParamSchema) => update({ schema: next });

                const commitLengths = () => {
                  const minParsed = parseOptionalIntOrEmpty(minLengthText);
                  const maxParsed = parseOptionalIntOrEmpty(maxLengthText);
                  if (minParsed.ok === false) {
                    setLengthError(minParsed.message);
                    return;
                  }
                  if (maxParsed.ok === false) {
                    setLengthError(maxParsed.message);
                    return;
                  }
                  const minV = minParsed.value;
                  const maxV = maxParsed.value;
                  if (minV != null && maxV != null && minV > maxV) {
                    setLengthError("最小长度不能大于最大长度");
                    return;
                  }
                  setLengthError(null);
                  commit({ ...current, minLength: minV, maxLength: maxV });
                };

                const required = !!current.constraint?.required;
                const nullable = !!current.constraint?.nullable;

                return (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">类型</span>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <select
                        value={current.type}
                        onChange={(e) => commit({ ...current, type: e.target.value as UiParamSchemaType })}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PARAM_SCHEMA_TYPE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">约束</span>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={required}
                            onCheckedChange={(v) =>
                              commit({
                                ...current,
                                constraint: { ...(current.constraint ?? {}), required: v },
                              })
                            }
                          />
                          <span className="text-sm text-foreground">必填</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={nullable}
                            onCheckedChange={(v) =>
                              commit({
                                ...current,
                                constraint: { ...(current.constraint ?? {}), nullable: v },
                              })
                            }
                          />
                          <span className="text-sm text-foreground">可空</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-sm text-muted-foreground">元信息</span>
                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">标签</label>
                        <Input
                          value={(current.meta?.label ?? "") as string}
                          onChange={(e) => commit({ ...current, meta: { ...(current.meta ?? {}), label: e.target.value } })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">描述</label>
                        <Textarea
                          value={(current.meta?.description ?? "") as string}
                          onChange={(e) => commit({ ...current, meta: { ...(current.meta ?? {}), description: e.target.value } })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">元信息标签（每行一个）</label>
                        <Textarea
                          value={((current.meta?.tags ?? []) as string[]).join("\n")}
                          onChange={(e) => {
                            const tags = e.target.value
                              .split("\n")
                              .map((x) => x.trim())
                              .filter((x) => x);
                            commit({ ...current, meta: { ...(current.meta ?? {}), tags } });
                          }}
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">最小长度</label>
                        <Input
                          value={minLengthText}
                          onChange={(e) => {
                            setMinLengthText(e.target.value);
                            setLengthError(null);
                          }}
                          onBlur={commitLengths}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">最大长度</label>
                        <Input
                          value={maxLengthText}
                          onChange={(e) => {
                            setMaxLengthText(e.target.value);
                            setLengthError(null);
                          }}
                          onBlur={commitLengths}
                          className="h-9"
                        />
                      </div>
                    </div>

                    {lengthError && <div className="text-xs text-destructive">{lengthError}</div>}

                    <div className="space-y-1.5">
                      <label className="text-sm text-muted-foreground">正则 pattern</label>
                      <Input
                        value={(current.pattern ?? "") as string}
                        onChange={(e) => commit({ ...current, pattern: e.target.value })}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm text-muted-foreground">格式 format</label>
                      <select
                        value={current.format ?? ""}
                        onChange={(e) => commit({ ...current, format: (e.target.value || undefined) as UiParamSchemaFormat | undefined })}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">无</option>
                        {PARAM_SCHEMA_FORMAT_OPTIONS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">枚举 enum</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            const next = [...(current.enumValues ?? []), ""];
                            commit({ ...current, enumValues: next });
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          添加枚举
                        </Button>
                      </div>

                      {(current.enumValues ?? []).length === 0 && <div className="text-sm text-muted-foreground">暂无枚举</div>}

                      {(current.enumValues ?? []).map((v, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={v}
                            onChange={(e) => {
                              const next = (current.enumValues ?? []).map((x, i) => (i === idx ? e.target.value : x));
                              commit({ ...current, enumValues: next });
                            }}
                            className="h-9 flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const next = (current.enumValues ?? []).filter((_, i) => i !== idx);
                              commit({ ...current, enumValues: next });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="more" className="mt-0 flex-1 min-h-0 overflow-y-auto scrollbar-hidden space-y-4">
          {/* <p className="text-sm text-muted-foreground">更多属性配置...</p> */}
          {renderExtBlock()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
