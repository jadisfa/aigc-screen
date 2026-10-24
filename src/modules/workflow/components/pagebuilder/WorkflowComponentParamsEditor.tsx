import { useMemo } from "react";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import { Plus, HelpCircle, Trash2 } from "lucide-react";
import { type ParsedWorkflowNode, extractNodeInputs } from "@/shared/api/workflow/workflow";
import type { UiComponent, UiParam } from "./ui-schema";
import { defaultParamNameByType } from "./definition/defaults";
import {
  applyNodeInputSelection,
  getNodeInputDisplayLabel,
  getParamAlias,
  getParamInputKey,
  getUiParamNameValidationState,
} from "./param-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/shared/ui/dropdown-menu";
type NodeOption = { nodeId: string; label: string };

function updateAt<T>(arr: T[], idx: number, next: T): T[] {
  return arr.map((x, i) => (i === idx ? next : x));
}

function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

function addAt<T>(arr: T[], next: T): T[] {
  return [...arr, next];
}

/**
 * PageBuilder 组件参数编辑器。
 *
 * 业务含义：
 * - 用于将“页面组件的参数”映射到工作流节点输入（nodeId + inputKey），以便运行时能从工作流执行上下文取值。
 * - 参数 marks 用于标注统计维度（如计数/时长/分辨率），供预览页/统计面板在渲染和聚合时识别。
 *
 * 异常/回退：
 * - 当 workflow JSON 尚未上传/解析（nodes 为空）时，节点选择入口展示提示，不阻断用户继续编辑其它字段。
 * - rawJson 解析失败或格式不符合预期时，extractNodeInputs 返回空 map，此时“无可选属性”作为兜底展示。
 */
export function WorkflowComponentParamsEditor(props: {
  component: UiComponent;
  nodes: ParsedWorkflowNode[];
  rawJson?: unknown;
  onChangeParams: (next: UiParam[]) => void;
}) {
  const component = props.component;
  const params = useMemo(() => component.basic.params ?? [], [component.basic.params]);

  const nodeOptions: NodeOption[] = useMemo(() => {
    return (props.nodes ?? []).map((n) => ({
      nodeId: String(n.nodeId ?? "").trim(),
      label: (() => {
        const normalizedNodeId = String(n.nodeId ?? "").trim();
        const nodeLabel = (n.label ?? "").trim();
        return nodeLabel ? `[${normalizedNodeId}]${nodeLabel}` : `[${normalizedNodeId}]`;
      })(),
    }));
  }, [props.nodes]);

  const nodeInputsById = useMemo(() => {
    return extractNodeInputs(props.rawJson);
  }, [props.rawJson]);

  const paramNameValidation = useMemo(() => getUiParamNameValidationState(params), [params]);
  const componentLabel = component.title?.trim() ? `“${component.title.trim()}”控件` : `第 ${component.position} 个控件`;

  const getNodeInputDisplayText = (p: UiParam) => {
    const nodeId = p.nodeId?.trim();
    const inputKey = getParamInputKey(p);
    if (!nodeId || !inputKey) return "选择工作流节点和输入参数";
    const nodeLabel = nodeOptions.find((n) => n.nodeId === nodeId)?.label ?? `[${nodeId}]`;
    return getNodeInputDisplayLabel(nodeLabel, inputKey);
  };

  const updateParams = (next: UiParam[]) => props.onChangeParams(next);

  return (
    <div className="space-y-4 mx-2">
      <div className="sticky top-0 z-10 -mx-2 bg-background px-3 pt-3 pb-3 border-b border-border/60 shadow-[0_1px_0_0_hsl(var(--background))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">基本属性</span>
            <span className="text-xs text-muted-foreground">位置：{component.position}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const next: UiParam = {
                name: defaultParamNameByType(component.type, params.length),
                nodeId: "",
                required: false,
                defaultValue: "",
                marks: {},
              };
              updateParams(addAt(params, next));
            }}
          >
            <Plus className="w-4 h-4" />
            添加参数
          </Button>
        </div>
      </div>

      {paramNameValidation.duplicateIndexes.size > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {componentLabel}的参数与{componentLabel}的参数名称重复，请检查并重命名。
        </div>
      )}

      {params.length === 0 && <div className="text-sm text-muted-foreground">暂无参数</div>}

      {params.map((p, idx) => (
        <div key={idx} className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">参数 {idx + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => updateParams(removeAt(params, idx))}
              disabled={params.length <= 1}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">参数名称</span>
              <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Input value={p.name} onChange={(e) => updateParams(updateAt(params, idx, { ...p, name: e.target.value }))} className="h-9" />
            {paramNameValidation.emptyIndexes.has(idx) && <div className="text-xs text-destructive">参数名称不能为空</div>}
            {paramNameValidation.duplicateIndexes.has(idx) && (
              <div className="text-xs text-destructive">{componentLabel}的参数与{componentLabel}的参数名称重复，请检查并重命名</div>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground">选择节点</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="w-full h-9 justify-start font-normal text-sm px-3 truncate">
                  <span className="truncate">{props.nodes.length ? getNodeInputDisplayText(p) : "请先上传并解析 workflow JSON"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[320px] max-h-[360px] overflow-y-auto p-1 z-[150]">
                {props.nodes.map((n) => (
                  <DropdownMenuSub key={n.nodeId}>
                    <DropdownMenuSubTrigger className="text-sm">
                      [{n.nodeId}]{n.label}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-[260px] max-h-[320px] overflow-y-auto z-[150]">
                      {(nodeInputsById.get(n.nodeId) ?? []).length === 0 ? (
                        <DropdownMenuItem disabled>无可选属性</DropdownMenuItem>
                      ) : (
                        (nodeInputsById.get(n.nodeId) ?? []).map((input) => (
                          <DropdownMenuItem
                            key={`${n.nodeId}-${input.key}`}
                            onClick={() => {
                              updateParams(updateAt(params, idx, applyNodeInputSelection(p, { nodeId: n.nodeId, inputKey: input.key })));
                            }}
                          >
                            {input.key}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">必须项</span>
            <Checkbox checked={p.required} onCheckedChange={(checked) => updateParams(updateAt(params, idx, { ...p, required: checked as boolean }))} />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground">默认值</span>
            <Textarea
              value={p.defaultValue ?? ""}
              onChange={(e) => updateParams(updateAt(params, idx, { ...p, defaultValue: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">标识</span>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2">
              <label className="flex items-center gap-1.5 text-sm text-foreground">
                <Checkbox
                  checked={!!p.marks?.count}
                  onCheckedChange={(v) => updateParams(updateAt(params, idx, { ...p, marks: { ...p.marks, count: v as boolean } }))}
                />
                计数
              </label>
              <label className="flex items-center gap-1.5 text-sm text-foreground">
                <Checkbox
                  checked={!!p.marks?.duration}
                  onCheckedChange={(v) => updateParams(updateAt(params, idx, { ...p, marks: { ...p.marks, duration: v as boolean } }))}
                />
                时长
              </label>
              <label className="flex items-center gap-1.5 text-sm text-foreground">
                <Checkbox
                  checked={!!p.marks?.resolution}
                  onCheckedChange={(v) => updateParams(updateAt(params, idx, { ...p, marks: { ...p.marks, resolution: v as boolean } }))}
                />
                分辨率
              </label>
              <label className="flex items-center gap-1.5 text-sm text-foreground">
                <Checkbox
                  checked={!!p.marks?.ratio}
                  onCheckedChange={(v) => updateParams(updateAt(params, idx, { ...p, marks: { ...p.marks, ratio: v as boolean } }))}
                />
                比例
              </label>
              <label className="flex items-center gap-1.5 text-sm text-foreground col-span-2">
                <Checkbox
                  checked={!!p.marks?.audioVideo}
                  onCheckedChange={(v) => updateParams(updateAt(params, idx, { ...p, marks: { ...p.marks, audioVideo: v as boolean } }))}
                />
                音画同出开关
              </label>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
