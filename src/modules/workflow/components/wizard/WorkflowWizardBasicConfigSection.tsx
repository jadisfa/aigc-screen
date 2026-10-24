import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Switch } from "@/shared/ui/switch";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import FileMaterialPickerDialog from "@/shared/components/FileMaterialPickerDialog";
import type { WorkflowCate } from "@/shared/api/workflow/workflow-cate";
import { type ParsedWorkflowNode, extractNodeInputs } from "@/shared/api/workflow/workflow";
import type { WorkflowOutputNodeConfigRow, WorkflowOutputType } from "@/modules/workflow/components/WorkflowWizard";
import { executionBackendLabel } from "@/modules/workflow/lib/workflow-exec";
import { getFileMaterialByHash, uploadFileMaterialForm } from "@/shared/api/materials/materials-file-material";
import { md5HexFromFile } from "@/shared/lib/md5";
import { CateIcon } from "@/modules/workflow/components/CateIcon";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { getSessionScopeReadyError, useSessionScope, withSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

export default function WorkflowWizardBasicConfigSection(props: {
  mode: "workflow" | "version";
  cates: WorkflowCate[];
  nodes: ParsedWorkflowNode[];
  rawJson?: unknown;

  versionNo: string;
  onVersionNoChange: (next: string) => void;
  changelog: string;
  onChangelogChange: (next: string) => void;

  code: string;
  onCodeChange: (next: string) => void;
  codeCheck?: { status: "idle" | "checking" | "available" | "unavailable" | "error"; message: string };
  type: WorkflowExecution | string;
  onTypeChange: (next: string) => void;
  typeLabelLocked?: boolean;
  typeDisplayLabel?: string;
  outputLocked?: boolean;
  allowedOutputTypes?: WorkflowOutputType[];
  cateId: string;
  onCateIdChange: (next: string) => void;

  title: string;
  onTitleChange: (next: string) => void;
  coverUrl: string;
  onCoverUrlChange: (url: string) => void;
  iconUrl: string;
  onIconUrlChange: (url: string) => void;
  timeoutSec: string;
  onTimeoutSecChange: (v: string) => void;
  generateTimeSec: string;
  onGenerateTimeSecChange: (v: string) => void;
  status: "online" | "offline";
  onStatusChange: (v: "online" | "offline") => void;

  outputNodes: WorkflowOutputNodeConfigRow[];
  onOutputNodesChange: (next: WorkflowOutputNodeConfigRow[]) => void;
}) {
  const sessionScope = useSessionScope();
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialPickerFor, setMaterialPickerFor] = useState<"cover" | "icon">("cover");
  const [uploadingLocalCover, setUploadingLocalCover] = useState(false);
  const [uploadingLocalIcon, setUploadingLocalIcon] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const cateOptionGroups = useMemo(() => {
    const topLevel = props.cates.filter((c) => c.level === 1 || !c.parentId);
    const childMap = new Map<string, WorkflowCate[]>();
    for (const c of props.cates) {
      if (!c.parentId) continue;
      const current = childMap.get(c.parentId) ?? [];
      current.push(c);
      childMap.set(c.parentId, current);
    }
    return topLevel.map((parent) => ({
      parent,
      children: childMap.get(parent.id) ?? [],
    }));
  }, [props.cates]);
  const cateById = useMemo(() => {
    const map = new Map<string, WorkflowCate>();
    for (const c of props.cates) {
      map.set(c.id, c);
    }
    return map;
  }, [props.cates]);
  const categoryOptions = useMemo(() => {
    const options: Array<{
      key: string;
      value: string;
      cateId: string;
      label: string;
      iconUrl?: string | null;
      isChild: boolean;
      parentName?: string;
    }> = [
      {
        key: "__empty__",
        value: "__empty__ 未选择",
        cateId: "",
        label: "未选择",
        iconUrl: null,
        isChild: false,
      },
    ];
    for (const { parent, children } of cateOptionGroups) {
      options.push({
        key: parent.id,
        value: parent.name,
        cateId: parent.id,
        label: parent.name,
        iconUrl: parent.iconUrl,
        isChild: false,
      });
      for (const child of children) {
        options.push({
          key: child.id,
          value: `${parent.name} ${child.name}`,
          cateId: child.id,
          label: child.name,
          iconUrl: child.iconUrl,
          isChild: true,
          parentName: parent.name,
        });
      }
    }
    return options;
  }, [cateOptionGroups]);
  const getCateDisplayText = () => {
    const cateId = props.cateId.trim();
    if (!cateId) return "选择分类";
    const current = cateById.get(cateId);
    if (!current) return cateId;
    const parent = current.parentId ? cateById.get(current.parentId) : null;
    if (parent) return `${parent.name} / ${current.name}`;
    return current.name;
  };
  const nodeInputsById = useMemo(() => {
    return extractNodeInputs(props.rawJson);
  }, [props.rawJson]);
  const nodeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of props.nodes) {
      map.set(n.nodeId, `[${n.nodeId}]${n.label}`);
    }
    return map;
  }, [props.nodes]);

  const setOutputNodeField = (rowId: string, patch: Partial<Pick<WorkflowOutputNodeConfigRow, "nodeId" | "outputType" | "inputKey">>) => {
    props.onOutputNodesChange(props.outputNodes.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const getOutputDisplayText = (row: WorkflowOutputNodeConfigRow) => {
    const nodeId = row.nodeId.trim();
    const inputKey = row.inputKey?.trim() || "";
    if (!nodeId || !inputKey) return "选择节点属性";
    const nodeLabel = nodeLabelById.get(nodeId) ?? `[${nodeId}]`;
    return `${nodeLabel} / ${inputKey}`;
  };

  const addOutputNode = () => {
    const rowId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    props.onOutputNodesChange([...props.outputNodes, { rowId, nodeId: "", outputType: "image", inputKey: undefined }]);
  };

  const removeOutputNode = (rowId: string) => {
    if (props.outputNodes.length <= 1) return;
    props.onOutputNodesChange(props.outputNodes.filter((r) => r.rowId !== rowId));
  };

  const outputTypeOptions: Array<{ value: WorkflowOutputType; label: string }> = [
    { value: "image", label: "图片" },
    { value: "video", label: "视频" },
    { value: "image_video", label: "图片+视频" },
    { value: "3d", label: "3D" },
    { value: "text", label: "文本" },
    { value: "audio", label: "音频" },
  ].filter((o) => !props.allowedOutputTypes || props.allowedOutputTypes.includes(o.value));
  const handleUploadLocalImage = async (
    file: File | undefined,
    onUrlChange: (url: string) => void,
    setUploading: (next: boolean) => void,
  ) => {
    if (!file) return;
    const uploadBlockReason = getSessionScopeReadyError(sessionScope);
    if (uploadBlockReason) {
      notify.error("上传暂不可用", { description: uploadBlockReason });
      return;
    }
    setUploading(true);
    try {
      const fileHash = await md5HexFromFile(file);
      const existed = await getFileMaterialByHash(withSessionScope(sessionScope.scope, { fileHash }));
      if (existed?.accessUrl) {
        onUrlChange(existed.accessUrl);
        return;
      }
      const uploaded = await uploadFileMaterialForm(withSessionScope(sessionScope.scope, {
        file,
        fileType: "image",
        fileHash,
      }));
      onUrlChange(uploaded.file.accessUrl);
    } catch (e) {
      notify.error("上传失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setUploading(false);
    }
  };

  const openMaterialPicker = (target: "cover" | "icon") => {
    setMaterialPickerFor(target);
    setMaterialPickerOpen(true);
  };

  return (
    <div className="space-y-6 mb-7">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="workflow-form-label">
            版本号
          </label>
          <Input
            value={props.versionNo}
            className="workflow-form-input bg-muted/50"
            disabled
          />
        </div>

        <div className="space-y-2">
          <label className="workflow-form-label">应用类型</label>
          <Input
            value={
              props.typeDisplayLabel ||
              executionBackendLabel(
                String(props.type).trim().toLowerCase() === "runninghub"
                  ? "runninghub"
                  : String(props.type).trim().toLowerCase() === "template"
                    ? "template"
                    : "comfyui",
              )
            }
            onChange={(e) => props.onTypeChange(e.target.value)}
            className="workflow-form-input"
            disabled={props.typeLabelLocked !== false}
          />
        </div>
      </div>

      {/* <div className="space-y-2">
        <label className="workflow-form-label">更新日志</label>
        <Textarea
          value={props.changelog}
          onChange={(e) => props.onChangelogChange(e.target.value)}
          placeholder="选填"
          rows={3}
          className="workflow-form-textarea"
        />
      </div> */}

      {props.mode === "workflow" && (
        <>
          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>应用编码（code）
              </label>

              <div className="space-y-3">
                <Input
                  value={props.code}
                  onChange={(e) => props.onCodeChange(e.target.value)}
                  placeholder="全局唯一，建议英文小写"
                  className={`workflow-form-input ${props.codeCheck?.status === "available" ? "pr-10" : ""}`}
                />
                {props.codeCheck?.status === "available" && (
                  <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-emerald-600">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
              {props.codeCheck && props.codeCheck.status !== "idle" && props.codeCheck.status !== "available" && (
                <div
                  className={`text-xs ${
                    props.codeCheck.status === "checking" ? "text-muted-foreground" : "text-destructive"
                  }`}
                >
                  {props.codeCheck.message}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>应用标题
              </label>
              <Input
                value={props.title}
                onChange={(e) => props.onTitleChange(e.target.value)}
                placeholder="展示给用户的标题"
                className="workflow-form-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>选择分类
              </label>
              <div className="space-y-3">
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="workflow-form-select w-[360px] max-w-full justify-start font-normal px-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                        {(() => {
                          const current = props.cateId ? cateById.get(props.cateId.trim()) : null;
                          return current?.iconUrl ? (
                            <CateIcon url={current.iconUrl} alt={current.name} className="h-4 w-4 shrink-0" />
                          ) : null;
                        })()}
                        <span className="truncate">{getCateDisplayText()}</span>
                      </div>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[360px] p-0">
                    <Command>
                      <CommandInput placeholder="搜索分类..." />
                      <CommandList className="max-h-[360px]">
                        <CommandEmpty>未找到分类</CommandEmpty>
                        <CommandGroup>
                          {categoryOptions.map((option) => {
                            const isSelected = props.cateId.trim() === option.cateId;
                            return (
                              <CommandItem
                                key={option.key}
                                value={option.value}
                                onSelect={() => {
                                  props.onCateIdChange(option.cateId);
                                  setCategoryOpen(false);
                                }}
                                className={option.isChild ? "pl-8" : ""}
                              >
                                <Check className={`mr-2 h-4 w-4 shrink-0 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  {option.iconUrl ? (
                                    <CateIcon url={option.iconUrl} alt={option.label} className="h-4 w-4 shrink-0" />
                                  ) : null}
                                  <div className="min-w-0 flex flex-col">
                                    <span className={`truncate ${option.isChild ? "text-sm" : ""}`}>{option.label}</span>
                                    {option.isChild && option.parentName ? (
                                      <span className="truncate text-xs text-muted-foreground">{option.parentName}</span>
                                    ) : null}
                                  </div>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <label className="workflow-form-label">上线状态</label>
              <div className="h-10 flex items-center">
                <Switch checked={props.status === "online"} onCheckedChange={(checked) => props.onStatusChange(checked ? "online" : "offline")} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-2">
              <label className="workflow-form-label">超时时间（秒）</label>
              <Input
                value={props.timeoutSec}
                onChange={(e) => props.onTimeoutSecChange(e.target.value)}
                placeholder="60"
                className="workflow-form-input"
              />
            </div>

            <div className="space-y-2">
              <label className="workflow-form-label">生成耗时时长（秒/图）</label>
              <Input
                type="number"
                value={props.generateTimeSec}
                onChange={(e) => props.onGenerateTimeSecChange(e.target.value)}
                placeholder="配置单张图片的预计生成耗时"
                className="workflow-form-input"
              />
            </div>
          </div>

           <div className="grid grid-cols-2 gap-10 items-start">
            <div className="space-y-2">
              <label className="workflow-form-label">应用封面</label>
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => openMaterialPicker("cover")}
                  className="w-[120px] h-[150px] rounded-xl border border-dashed border-border bg-background hover:bg-muted/20 overflow-hidden flex items-center justify-center transition-colors"
                >
                  {props.coverUrl.trim() ? (
                    <img src={props.coverUrl.trim()} alt="应用封面" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-foreground">
                      <Plus className="w-5 h-5" />
                      <span className="text-sm">上传</span>
                    </div>
                  )}
                </button>
                <div className="flex-1 space-y-2">
                  <Input
                    value={props.coverUrl}
                    onChange={(e) => props.onCoverUrlChange(e.target.value)}
                    placeholder="https://... 或 data:image/..."
                    className="workflow-form-input"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("workflow-cover-upload-input")?.click()}
                      disabled={uploadingLocalCover}
                    >
                      {uploadingLocalCover ? "上传中..." : "上传"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => props.onCoverUrlChange("")}>
                      清空
                    </Button>
                    <input
                      id="workflow-cover-upload-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        void handleUploadLocalImage(file, props.onCoverUrlChange, setUploadingLocalCover);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2 mb-4">
                <label className="workflow-form-label">应用图标</label>
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => openMaterialPicker("icon")}
                    className="w-[80px] h-[80px] rounded-xl border border-dashed border-border bg-background hover:bg-muted/20 overflow-hidden flex items-center justify-center transition-colors"
                  >
                    {props.iconUrl.trim() ? (
                      <img src={props.iconUrl.trim()} alt="应用图标" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-foreground">
                        <Plus className="w-5 h-5" />
                        <span className="text-sm">上传</span>
                      </div>
                    )}
                  </button>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={props.iconUrl}
                      onChange={(e) => props.onIconUrlChange(e.target.value)}
                      placeholder="https://... 或 data:image/..."
                      className="workflow-form-input"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("workflow-icon-upload-input")?.click()}
                        disabled={uploadingLocalIcon}
                      >
                        {uploadingLocalIcon ? "上传中..." : "上传"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => props.onIconUrlChange("")}>
                        清空
                      </Button>
                      <input
                        id="workflow-icon-upload-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          void handleUploadLocalImage(file, props.onIconUrlChange, setUploadingLocalIcon);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>产出节点配置
              </label>
              <div className="space-y-3">
                {props.outputNodes.map((r) => (
                  <div key={r.rowId} className="grid grid-cols-[minmax(0,360px)_140px_auto] gap-2 items-center">
                    {props.outputLocked ? (
                      <Input value="结束（节点 2）" disabled className="workflow-form-input bg-muted/50 w-[360px] max-w-full" />
                    ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="workflow-form-select w-[360px] max-w-full justify-start font-normal">
                          <span className="truncate font-normal">{props.nodes.length ? getOutputDisplayText(r) : "请先上传并解析 workflow JSON"}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[320px] max-h-[360px] overflow-y-auto p-1">
                        {props.nodes.map((n) => (
                          <DropdownMenuSub key={n.nodeId}>
                            <DropdownMenuSubTrigger className="text-sm">
                              [{n.nodeId}]{n.label}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-[260px] max-h-[320px] overflow-y-auto">
                              {(nodeInputsById.get(n.nodeId) ?? []).length === 0 ? (
                                <DropdownMenuItem disabled>无可选属性</DropdownMenuItem>
                              ) : (
                                (nodeInputsById.get(n.nodeId) ?? []).map((input) => (
                                  <DropdownMenuItem
                                    key={`${n.nodeId}-${input.key}`}
                                    onClick={() => {
                                      setOutputNodeField(r.rowId, { nodeId: n.nodeId, inputKey: input.key });
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
                    )}

                    <Select value={r.outputType} onValueChange={(v) => setOutputNodeField(r.rowId, { outputType: v as WorkflowOutputType })}>
                      <SelectTrigger className="workflow-form-select">
                        <SelectValue placeholder="产出类型" />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        {outputTypeOptions.map((o) => (
                          <SelectItem key={o.value} className="subpage-select-item" value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {props.outputLocked ? (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">已锁定</span>
                    ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeOutputNode(r.rowId)}
                      disabled={props.outputNodes.length <= 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    )}
                  </div>
                ))}

                {props.outputLocked ? null : (
                <Button type="button" size="sm" onClick={addOutputNode} className="bg-primary text-primary-foreground hover:bg-primary/90 w-fit">
                  添加新的产出节点
                </Button>
                )}
              </div>
            </div>
          </div>
          <FileMaterialPickerDialog
            open={materialPickerOpen}
            onOpenChange={setMaterialPickerOpen}
            title={materialPickerFor === "icon" ? "选择应用图标" : "选择图片素材"}
            fileType="image"
            onPick={(url) => {
              if (materialPickerFor === "icon") {
                props.onIconUrlChange(url);
                return;
              }
              props.onCoverUrlChange(url);
            }}
          />
        </>
      )}
    </div>
  );
}
