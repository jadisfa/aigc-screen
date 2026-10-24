import { useEffect, useState, type ReactNode } from "react";
import { HelpCircle, Wand2 } from "lucide-react";
import ProtocolSampleInferDialog from "@/modules/modelhub/components/channel-editor/ProtocolSampleInferDialog";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import { FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import {
  PROTOCOL_ASSET_TYPE_OPTIONS,
  PROTOCOL_EXTRAS_MANUAL,
  PROTOCOL_INVOCATION_OPTIONS,
  PROTOCOL_SCENE_OPTIONS,
  PROTOCOL_SUBMIT_BODY_MANUAL,
  PROTOCOL_SUBMIT_PATH_HINT,
  buildProtocolDefinition,
  emptyProtocolForm,
  extractHasContent,
  protocolFormFromItem,
  type ProtocolEditorForm,
  type ProtocolExtractForm,
} from "@/modules/modelhub/types/protocolCatalogTypes";
import {
  cloneModelHubProtocol,
  createModelHubProtocol,
  getModelHubProtocol,
  updateModelHubProtocol,
  updateModelHubProtocolStatus,
  type ModelHubProtocolCatalogItem,
} from "@/shared/api/model-hub/model-hub";
import { notify } from "@/shared/lib/notify";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";

export default function ChannelProtocolCatalogEditor(props: {
  open: boolean;
  protocolId: string | null;
  onCancel: () => void;
  onChanged?: () => void;
}) {
  const [form, setForm] = useState<ProtocolEditorForm>(emptyProtocolForm());
  const [editingItem, setEditingItem] = useState<ModelHubProtocolCatalogItem | null>(null);
  const [editingId, setEditingId] = useState(props.protocolId || "");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(props.protocolId));
  const [inferOpen, setInferOpen] = useState(false);

  const readOnly = Boolean(editingItem?.isSystem);
  const isCreate = !editingId;
  const showExtract = form.invocation === "ASYNC_POLL" || !form.passthrough;

  useEffect(() => {
    if (!props.open) {
      return;
    }
    if (!props.protocolId) {
      setEditingId("");
      setEditingItem(null);
      setForm(emptyProtocolForm());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getModelHubProtocol(props.protocolId)
      .then((detail) => {
        if (cancelled) {
          return;
        }
        setEditingId(detail.id);
        setEditingItem(detail);
        setForm(protocolFormFromItem(detail));
      })
      .catch((error) => {
        if (!cancelled) {
          notify.error("加载失败", { description: resolveModelHubErrorMessage(error, "协议详情加载失败") });
          props.onCancel();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.open, props.protocolId]);

  useEffect(() => {
    if (!props.open) {
      setInferOpen(false);
    }
  }, [props.open]);

  const patchForm = (patch: Partial<ProtocolEditorForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const patchExtract = (key: "submitExtract" | "statusExtract", patch: Partial<ProtocolExtractForm>) => {
    setForm((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const toggleScene = (code: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      sceneCodes: checked
        ? current.sceneCodes.includes(code) ? current.sceneCodes : [...current.sceneCodes, code]
        : current.sceneCodes.filter((item) => item !== code),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim() || form.sceneCodes.length === 0 || !form.submitPath.trim()) {
      notify.error("请完善必填项", { description: "名称、编码、场景和提交路径不能为空" });
      return;
    }
    let definition: Record<string, unknown>;
    try {
      definition = buildProtocolDefinition(form);
    } catch (error) {
      notify.error("保存失败", { description: error instanceof Error ? error.message : "协议定义无效" });
      return;
    }
    setSaving(true);
    try {
      if (isCreate) {
        await createModelHubProtocol({
          code: form.code.trim(),
          name: form.name.trim(),
          version: form.version.trim() || "v1",
          status: form.status,
          definition,
        });
        notify.success("协议已创建");
      } else {
        await updateModelHubProtocol(editingId, {
          code: form.code.trim(),
          name: form.name.trim(),
          version: form.version.trim() || "v1",
          status: form.status,
          definition,
        });
        notify.success("协议已保存");
      }
      props.onChanged?.();
      props.onCancel();
    } catch (error) {
      notify.error("保存失败", { description: resolveModelHubErrorMessage(error, "协议保存失败") });
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async (item: ModelHubProtocolCatalogItem) => {
    setSaving(true);
    try {
      const clonedId = await cloneModelHubProtocol(item.id, {
        code: `${item.code}-copy`,
        name: `${item.name} 副本`,
        version: "v1",
      });
      notify.success("已复制为新协议");
      props.onChanged?.();
      const detail = await getModelHubProtocol(clonedId);
      setEditingId(detail.id);
      setEditingItem(detail);
      setForm(protocolFormFromItem(detail));
    } catch (error) {
      notify.error("复制失败", { description: resolveModelHubErrorMessage(error, "请更换编码后重试") });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: ModelHubProtocolCatalogItem) => {
    const next = item.status === "enabled" ? "disabled" : "enabled";
    setSaving(true);
    try {
      await updateModelHubProtocolStatus(item.id, next);
      notify.success(next === "enabled" ? "已启用" : "已停用");
      props.onChanged?.();
      setEditingItem({ ...item, status: next });
      patchForm({ status: next });
    } catch (error) {
      notify.error("更新失败", { description: resolveModelHubErrorMessage(error, "状态更新失败") });
    } finally {
      setSaving(false);
    }
  };

  const title = isCreate ? "新增协议" : readOnly ? "查看系统协议" : "编辑协议";

  return (
    <>
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          props.onCancel();
        }
      }}
    >
      <DialogContent className="flex max-h-[86vh] w-[calc(100vw-2rem)] max-w-[960px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4 pr-12 text-left">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">加载中...</div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto scrollbar-hidden px-6 py-5">
              {readOnly ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-5 text-amber-800">
                  系统内置协议不可改定义或删除。需要调整时请复制为新协议，再让渠道改绑。
                </div>
              ) : null}

              <FormSection title="基本信息">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldGroup label="协议名称" required>
                    <Input value={form.name} disabled={readOnly} onChange={(event) => patchForm({ name: event.target.value })} placeholder="例如 KIE 通用图视频" />
                  </FieldGroup>
                  <FieldGroup label="协议编码" required>
                    <Input value={form.code} disabled={readOnly || !isCreate} onChange={(event) => patchForm({ code: event.target.value })} placeholder="例如 acme-jobs" className="font-mono" />
                  </FieldGroup>
                  <FieldGroup label="版本">
                    <Input value={form.version} disabled={readOnly} onChange={(event) => patchForm({ version: event.target.value })} placeholder="v1" className="font-mono" />
                  </FieldGroup>
                  <FieldGroup label="调用形态" required>
                    <Select
                      value={form.invocation}
                      disabled={readOnly}
                      onValueChange={(value) => {
                        const next: Partial<ProtocolEditorForm> = {
                          invocation: value,
                          passthrough: value !== "ASYNC_POLL" && form.passthrough,
                        };
                        if (value === "ASYNC_POLL" && !extractHasContent(form.submitExtract) && extractHasContent(form.statusExtract)) {
                          next.submitExtract = { ...form.statusExtract, assetUrlPath: "", assetType: form.statusExtract.assetType };
                        }
                        patchForm(next);
                      }}
                    >
                      <SelectTrigger className="subpage-native-select h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        {PROTOCOL_INVOCATION_OPTIONS.map((item) => (
                          <SelectItem className="subpage-select-item" value={item.value} key={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                  <FieldGroup label="启用">
                    <div className="flex h-10 items-center gap-2">
                      <Switch checked={form.status === "enabled"} disabled={readOnly} onCheckedChange={(checked) => patchForm({ status: checked ? "enabled" : "disabled" })} />
                      <span className="text-sm text-muted-foreground">{form.status === "enabled" ? "启用" : "停用"}</span>
                    </div>
                  </FieldGroup>
                  <FieldGroup label="适用场景" required className="sm:col-span-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {PROTOCOL_SCENE_OPTIONS.map((scene) => (
                        <label key={scene.code} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={form.sceneCodes.includes(scene.code)}
                            disabled={readOnly}
                            onCheckedChange={(checked) => toggleScene(scene.code, checked === true)}
                          />
                          {scene.label}
                        </label>
                      ))}
                    </div>
                  </FieldGroup>
                </div>
              </FormSection>

              {!readOnly ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-foreground">从样例生成</div>
                    <p className="text-[12px] leading-5 text-muted-foreground">
                      在独立对话框中指定场景并粘贴任务 / 查询样例，确认后再回填本表。
                    </p>
                  </div>
                  <Button type="button" variant="pageOutline" size="page" onClick={() => setInferOpen(true)}>
                    <Wand2 />
                    打开生成
                  </Button>
                </div>
              ) : null}

              <FormSection title="提交请求">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
                  <FieldGroup label="请求方法">
                    <Input value={form.submitMethod} disabled={readOnly} onChange={(event) => patchForm({ submitMethod: event.target.value })} className="font-mono" />
                  </FieldGroup>
                  <FieldGroup
                    label={<FieldLabelWithHint hint={PROTOCOL_SUBMIT_PATH_HINT}>提交路径</FieldLabelWithHint>}
                    required
                  >
                    <Input value={form.submitPath} disabled={readOnly} onChange={(event) => patchForm({ submitPath: event.target.value })} placeholder="/api/v1/jobs/createTask" className="font-mono" />
                  </FieldGroup>
                </div>
                <FieldGroup
                  label={<FieldLabelWithHint hint={PROTOCOL_SUBMIT_BODY_MANUAL}>请求体</FieldLabelWithHint>}
                >
                  <Textarea
                    value={form.submitBody}
                    disabled={readOnly}
                    onChange={(event) => patchForm({ submitBody: event.target.value })}
                    placeholder='{"model":"${request.model}","prompt":"${request.prompt}","duration":"${request.body.duration}"}'
                    className="min-h-[88px] font-mono text-[12px]"
                  />
                </FieldGroup>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <SwitchRow
                    label="OpenAI 兼容透传"
                    hint="同步接口原样返回渠道 JSON"
                    checked={form.passthrough}
                    disabled={readOnly || form.invocation === "ASYNC_POLL"}
                    onCheckedChange={(checked) => patchForm({ passthrough: checked })}
                  />
                  <SwitchRow
                    label="OpenAI Compatible"
                    hint="按 OpenAI 路径拼接"
                    checked={form.openaiCompatible}
                    disabled={readOnly}
                    onCheckedChange={(checked) => patchForm({ openaiCompatible: checked })}
                  />
                </div>
              </FormSection>

              {showExtract ? (
                <FormSection title="结果提取">
                  {form.invocation === "ASYNC_POLL" ? (
                    <Tabs defaultValue="status">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <TabsList className="h-9 w-full sm:w-auto">
                          <TabsTrigger value="submit">创建回包</TabsTrigger>
                          <TabsTrigger value="status">轮询回包</TabsTrigger>
                        </TabsList>
                        <p className="text-[12px] leading-5 text-muted-foreground">
                          创建回包用于取出任务 ID；成片 URL 和最终状态以轮询回包为准。
                        </p>
                      </div>
                      <TabsContent value="submit" className="mt-4">
                        <ExtractFields
                          extract={form.submitExtract}
                          readOnly={readOnly}
                          showAssets={false}
                          onChange={(patch) => patchExtract("submitExtract", patch)}
                        />
                      </TabsContent>
                      <TabsContent value="status" className="mt-4">
                        <ExtractFields
                          extract={form.statusExtract}
                          readOnly={readOnly}
                          showAssets
                          onChange={(patch) => patchExtract("statusExtract", patch)}
                        />
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <ExtractFields
                      extract={form.statusExtract}
                      readOnly={readOnly}
                      showAssets
                      onChange={(patch) => patchExtract("statusExtract", patch)}
                    />
                  )}
                </FormSection>
              ) : null}

              {form.invocation === "ASYNC_POLL" ? (
                <FormSection title="状态查询">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
                    <FieldGroup label="请求方法">
                      <Input value={form.statusMethod} disabled={readOnly} onChange={(event) => patchForm({ statusMethod: event.target.value })} className="font-mono" />
                    </FieldGroup>
                    <FieldGroup label="查询路径" required>
                      <Input value={form.statusEndpointPath} disabled={readOnly} onChange={(event) => patchForm({ statusEndpointPath: event.target.value })} placeholder="/api/v1/jobs/recordInfo?taskId=${task.taskId}" className="font-mono" />
                      <p className="text-[12px] leading-5 text-muted-foreground">拼接规则与提交路径相同；路径里可用 ${"{task.taskId}"} 引用刚创建的任务。</p>
                    </FieldGroup>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FieldGroup label="结果路径（可选）">
                      <Input value={form.resultPath} disabled={readOnly} onChange={(event) => patchForm({ resultPath: event.target.value })} placeholder="可空" className="font-mono" />
                    </FieldGroup>
                    <FieldGroup label="取消路径（可选）">
                      <Input value={form.cancelPath} disabled={readOnly} onChange={(event) => patchForm({ cancelPath: event.target.value })} placeholder="可空" className="font-mono" />
                    </FieldGroup>
                  </div>
                </FormSection>
              ) : null}

              <FormSection title="高级">
                <FieldGroup
                  label={<FieldLabelWithHint hint={PROTOCOL_EXTRAS_MANUAL}>扩展配置</FieldLabelWithHint>}
                >
                  <Textarea
                    value={form.extrasJson}
                    disabled={readOnly}
                    onChange={(event) => patchForm({ extrasJson: event.target.value })}
                    placeholder='{"poll":{"intervalMs":2000},"requireNonEmpty":["content"]}'
                    className="min-h-[96px] font-mono text-[12px]"
                  />
                </FieldGroup>
              </FormSection>
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-border/70 px-6 py-3 sm:space-x-0">
              <Button variant="pageOutline" onClick={props.onCancel} disabled={saving}>
                取消
              </Button>
              {editingItem ? (
                <>
                  <Button variant="pageOutline" disabled={saving} onClick={() => void handleClone(editingItem)}>
                    复制为新协议
                  </Button>
                  <Button variant="pageOutline" disabled={saving} onClick={() => void handleToggleStatus(editingItem)}>
                    {form.status === "enabled" ? "停用" : "启用"}
                  </Button>
                </>
              ) : null}
              {!readOnly ? (
                <Button variant="page" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? "保存中..." : "保存"}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    <ProtocolSampleInferDialog
      open={inferOpen}
      form={form}
      onOpenChange={setInferOpen}
      onConfirm={setForm}
    />
    </>
  );
}

function FormSection(props: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[13px] font-semibold text-foreground">{props.title}</h3>
      <div className="space-y-4">{props.children}</div>
    </section>
  );
}

function SwitchRow(props: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{props.label}</div>
        <div className="text-[12px] leading-5 text-muted-foreground">{props.hint}</div>
      </div>
      <Switch checked={props.checked} disabled={props.disabled} onCheckedChange={props.onCheckedChange} />
    </div>
  );
}

function FieldLabelWithHint(props: { hint: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{props.children}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex text-muted-foreground hover:text-foreground"
            aria-label="查看说明"
            onClick={(event) => event.stopPropagation()}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[80] w-[420px] max-h-[360px] overflow-y-auto whitespace-pre-wrap scrollbar-hidden text-[12px] leading-6 text-muted-foreground">
          {props.hint}
        </PopoverContent>
      </Popover>
    </span>
  );
}

function ExtractFields(props: {
  extract: ProtocolExtractForm;
  readOnly: boolean;
  showAssets: boolean;
  onChange: (patch: Partial<ProtocolExtractForm>) => void;
}) {
  const extract = props.extract;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FieldGroup label="任务 ID JSONPath">
        <Input
          value={extract.taskIdPath}
          disabled={props.readOnly}
          onChange={(event) => props.onChange({ taskIdPath: event.target.value })}
          placeholder="$.data.taskId"
          className="font-mono"
        />
      </FieldGroup>
      <FieldGroup label="状态 JSONPath">
        <Input
          value={extract.statusPath}
          disabled={props.readOnly}
          onChange={(event) => props.onChange({ statusPath: event.target.value })}
          placeholder="$.data.state"
          className="font-mono"
        />
      </FieldGroup>
      <FieldGroup label="进度 JSONPath">
        <Input
          value={extract.progressPath}
          disabled={props.readOnly}
          onChange={(event) => props.onChange({ progressPath: event.target.value })}
          placeholder="$.data.progress"
          className="font-mono"
        />
      </FieldGroup>
      <FieldGroup label="错误信息 JSONPath">
        <Input
          value={extract.errorPath}
          disabled={props.readOnly}
          onChange={(event) => props.onChange({ errorPath: event.target.value })}
          placeholder="$.data.failMsg"
          className="font-mono"
        />
      </FieldGroup>
      {props.showAssets ? (
        <>
          <FieldGroup label="资产类型">
            <Select
              value={extract.assetType || "FILE"}
              disabled={props.readOnly}
              onValueChange={(value) => props.onChange({ assetType: value })}
            >
              <SelectTrigger className="subpage-native-select h-10 w-full">
                <SelectValue placeholder="选择结果类型" />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                {assetTypeOptions(extract.assetType).map((item) => (
                  <SelectItem className="subpage-select-item" value={item.value} key={item.value}>
                    {item.label}
                    {item.hint ? ` · ${item.hint}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="结果 URL JSONPath">
            <Input
              value={extract.assetUrlPath}
              disabled={props.readOnly}
              onChange={(event) => props.onChange({ assetUrlPath: event.target.value })}
              placeholder="$.data.resultJson.resultUrls"
              className="font-mono"
            />
          </FieldGroup>
        </>
      ) : null}
      <FieldGroup label="成功码 JSONPath">
        <Input
          value={extract.successCode}
          disabled={props.readOnly}
          onChange={(event) => props.onChange({ successCode: event.target.value })}
          placeholder="$.code"
          className="font-mono"
        />
      </FieldGroup>
      <FieldGroup label="JSON 字符串字段">
        <Input
          value={extract.jsonStringFields}
          disabled={props.readOnly}
          onChange={(event) => props.onChange({ jsonStringFields: event.target.value })}
          placeholder="$.data.resultJson"
          className="font-mono"
        />
      </FieldGroup>
      <FieldGroup label="状态映射" className="sm:col-span-2">
        <Textarea
          value={extract.statusMapping}
          disabled={props.readOnly}
          onChange={(event) => props.onChange({ statusMapping: event.target.value })}
          placeholder={"waiting=QUEUED\nsuccess=SUCCEEDED\nfail=FAILED"}
          className="min-h-[88px] font-mono text-[12px]"
        />
      </FieldGroup>
    </div>
  );
}

function assetTypeOptions(current: string) {
  const selected = current.trim() || "FILE";
  const known = PROTOCOL_ASSET_TYPE_OPTIONS.map((item) => ({
    value: item.value,
    label: item.label,
    hint: item.hint,
  }));
  if (known.some((item) => item.value === selected)) {
    return known;
  }
  return [...known, { value: selected, label: selected, hint: "当前值" }];
}
