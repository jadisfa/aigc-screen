import { ArrowLeft, Plus, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { notify } from "@/shared/lib/notify";
import { EditorSection, FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import PoolBindingPickerDialog, { poolBindingKey } from "@/modules/modelhub/components/PoolBindingPickerDialog";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";
import {
  POOL_ROUTING_MODE_OPTIONS,
  getPoolScopeTypeLabel,
  getPoolScopeValue,
  loadPoolBindingCatalog,
  loadPoolEditorData,
  resolvePoolScopeType,
  savePool,
  type PoolBindingEditorItem,
  type PoolBindingOption,
  type PoolEditorValue,
  type PoolScopeSelection,
} from "@/modules/modelhub/services/pools";
import type { ModelHubScopeType } from "@/shared/api/model-hub/model-hub";
import { useGovernanceScopeChoice } from "@/shared/hooks/use-governance-scope-choice";
import { getDisplayFallback } from "@/shared/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

function applyCatalogVisuals(
  binding: PoolBindingEditorItem,
  catalog: PoolBindingOption[],
): PoolBindingEditorItem {
  const option = catalog.find(
    (item) => item.baseModelId === binding.baseModelId && item.channelId === binding.channelId,
  );
  if (!option) {
    return binding;
  }
  return {
    ...binding,
    baseModelName: option.baseModelName || binding.baseModelName,
    baseModelCode: option.baseModelCode || binding.baseModelCode,
    modelLogoUrl: option.modelLogoUrl,
    channelName: option.channelName || binding.channelName,
    channelCode: option.channelCode || binding.channelCode,
    channelIconUrl: option.channelIconUrl,
    providerName: option.providerName || binding.providerName,
    channelStatus: option.channelStatus,
  };
}

export default function ModelHubPoolEditorPage(props: {
  mode: "create" | "edit";
  editingId?: string;
  initialScope: PoolScopeSelection;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bindingCatalog, setBindingCatalog] = useState<PoolBindingOption[]>([]);
  const [scopeType, setScopeType] = useState<ModelHubScopeType>(resolvePoolScopeType(props.initialScope));
  const [form, setForm] = useState<PoolEditorValue>({
    poolCode: "",
    displayName: "",
    merchantId: props.initialScope.merchantId?.trim() || "",
    storeId: props.initialScope.storeId?.trim() || "",
    principalId: props.initialScope.principalId?.trim() || "",
    status: "启用",
    routingMode: "balanced",
    bindings: [],
  });
  const {
    canChooseMerchant,
    canChooseStore,
    fixedMerchantId,
    fixedStoreId,
    merchantOptions,
    storeOptions,
  } = useGovernanceScopeChoice({
    allowChoose: props.mode === "create",
    extraFixedMerchantId: props.initialScope.merchantId,
    extraFixedStoreId: props.initialScope.storeId,
    merchantId: form.merchantId,
    storeId: form.storeId,
    requireCanChooseStore: false,
    onMerchantLoadError: (error) => notify.error(resolveModelHubErrorMessage(error, "商户列表加载失败")),
    onStoreLoadError: (error) => notify.error(resolveModelHubErrorMessage(error, "门店列表加载失败")),
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const isPlatformScope = scopeType === "platform";

  const activeScope = useMemo<PoolScopeSelection>(() => ({
    merchantId: isPlatformScope ? null : form.merchantId || null,
    storeId: scopeType === "store" ? form.storeId || null : null,
    principalId: null,
  }), [form.merchantId, form.storeId, isPlatformScope, scopeType]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadPoolEditorData(props.mode, props.editingId, props.initialScope);
      setBindingCatalog(data.bindingCatalog);
      setForm(data.value);
      setScopeType(resolvePoolScopeType(data.value));
    } catch (error) {
      notify.error(resolveModelHubErrorMessage(error, props.mode === "edit" ? "模型池详情加载失败" : "模型池编辑器加载失败"));
    } finally {
      setLoading(false);
    }
  }, [props.editingId, props.initialScope, props.mode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (isPlatformScope) {
      void loadPoolBindingCatalog(activeScope)
        .then((items) => {
          setBindingCatalog(items);
          setForm((current) => ({
            ...current,
            bindings: current.bindings
              .filter((binding) => items.some(
                (option) => option.baseModelId === binding.baseModelId && option.channelId === binding.channelId,
              ))
              .map((binding) => applyCatalogVisuals(binding, items)),
          }));
        })
        .catch((error) => {
          notify.error(resolveModelHubErrorMessage(error, "模型池候选绑定目录加载失败"));
        });
      return;
    }
    if (!activeScope.merchantId) {
      setBindingCatalog([]);
      return;
    }
    if (scopeType === "store" && !activeScope.storeId) {
      setBindingCatalog([]);
      return;
    }
    void loadPoolBindingCatalog(activeScope)
      .then((items) => {
        setBindingCatalog(items);
        setForm((current) => ({
          ...current,
          bindings: current.bindings
            .filter((binding) => items.some(
              (option) => option.baseModelId === binding.baseModelId && option.channelId === binding.channelId,
            ))
            .map((binding) => applyCatalogVisuals(binding, items)),
        }));
      })
      .catch((error) => {
        notify.error(resolveModelHubErrorMessage(error, "模型池候选绑定目录加载失败"));
      });
  }, [activeScope, isPlatformScope, loading, scopeType]);

  const disabledBindingRows = useMemo(
    () => form.bindings.filter((binding) => binding.channelStatus === "disabled"),
    [form.bindings],
  );

  const existingBindingKeys = useMemo(
    () => new Set(form.bindings.map((binding) => poolBindingKey(binding))),
    [form.bindings],
  );

  const remainingBindingOptions = useMemo(
    () => bindingCatalog.filter(
      (item) => item.channelStatus !== "disabled" && !existingBindingKeys.has(poolBindingKey(item)),
    ),
    [bindingCatalog, existingBindingKeys],
  );

  const effectiveMerchantId = canChooseMerchant ? form.merchantId : fixedMerchantId;
  const effectiveStoreId = canChooseStore ? form.storeId : fixedStoreId;
  const scopeSummary = getPoolScopeValue({
    merchantId: isPlatformScope ? null : effectiveMerchantId,
    storeId: scopeType === "store" ? effectiveStoreId : null,
  });

  const createBindingDraft = (selected: PoolBindingOption, priority: number): PoolBindingEditorItem => ({
    baseModelId: selected.baseModelId,
    baseModelName: selected.baseModelName,
    baseModelCode: selected.baseModelCode,
    modelLogoUrl: selected.modelLogoUrl,
    channelId: selected.channelId,
    channelName: selected.channelName,
    channelCode: selected.channelCode,
    channelIconUrl: selected.channelIconUrl,
    providerName: selected.providerName,
    candidateCode: "",
    status: "启用",
    healthState: "normal",
    weight: 100,
    priority,
    channelStatus: selected.channelStatus,
  });

  const handleAddCandidateBindings = (selectedOptions: PoolBindingOption[]) => {
    const incoming = selectedOptions.filter((item) => !existingBindingKeys.has(poolBindingKey(item)));
    if (incoming.length === 0) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      bindings: [
        ...prev.bindings,
        ...incoming.map((selected, index) => createBindingDraft(selected, prev.bindings.length + index + 1)),
      ],
    }));
    setPickerOpen(false);
    notify.success(`已加入 ${incoming.length} 条绑定`);
  };

  const handleRemoveCandidateBinding = (index: number) => {
    setForm((prev) => ({
      ...prev,
      bindings: prev.bindings
        .filter((_, currentIndex) => currentIndex !== index)
        .map((item, currentIndex) => ({ ...item, priority: currentIndex + 1 })),
    }));
  };

  const updateBinding = (index: number, updater: (item: PoolBindingEditorItem) => PoolBindingEditorItem) => {
    setForm((prev) => ({
      ...prev,
      bindings: prev.bindings.map((item, currentIndex) => (
        currentIndex === index ? updater(item) : item
      )),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePool(props.mode, {
        ...form,
        merchantId: effectiveMerchantId,
        storeId: scopeType === "store" ? effectiveStoreId : "",
        principalId: "",
      });
      notify.success(props.mode === "edit" ? "保存成功" : "创建成功");
      props.onSuccess();
    } catch (error) {
      notify.error(resolveModelHubErrorMessage(error, props.mode === "edit" ? "模型池更新失败" : "模型池创建失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={props.onCancel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{props.mode === "create" ? "新增模型池" : "编辑模型池"}</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1250px] space-y-5">
        <EditorSection title="基础信息">
          <div className="grid grid-cols-1 gap-5 px-4 md:grid-cols-2 xl:grid-cols-3">
            <FieldGroup label="模型池名称" className="xl:col-span-2">
              <Input
                value={form.displayName}
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder="请输入模型池名称"
                className="workflow-form-input"
                disabled={loading || saving}
              />
            </FieldGroup>
            <FieldGroup label="模型池编码">
              <Input
                value={form.poolCode}
                onChange={(event) => setForm((prev) => ({ ...prev, poolCode: event.target.value }))}
                placeholder="请输入模型池编码"
                className="workflow-form-input font-mono"
                disabled={loading || saving}
              />
            </FieldGroup>
            <FieldGroup label="归属层级">
              <Select
                value={scopeType}
                onValueChange={(value) => {
                  const nextScopeType = value as ModelHubScopeType;
                  setScopeType(nextScopeType);
                  if (nextScopeType === "platform") {
                    setForm((prev) => ({ ...prev, merchantId: "", storeId: "", bindings: [] }));
                    setPickerOpen(false);
                    return;
                  }
                  if (nextScopeType === "merchant") {
                    setForm((prev) => ({ ...prev, storeId: "", bindings: [] }));
                    setPickerOpen(false);
                  }
                }}
                disabled={loading || saving || props.mode === "edit"}
              >
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {canChooseMerchant || scopeType === "platform" ? (
                    <SelectItem className="subpage-select-item" value="platform">{getPoolScopeTypeLabel("platform")}</SelectItem>
                  ) : null}
                  <SelectItem className="subpage-select-item" value="merchant">{getPoolScopeTypeLabel("merchant")}</SelectItem>
                  <SelectItem className="subpage-select-item" value="store">{getPoolScopeTypeLabel("store")}</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="目标商户">
              {canChooseMerchant ? (
                <Select
                  value={form.merchantId || "none"}
                  onValueChange={(value) => {
                    const nextMerchantId = value === "none" ? "" : value;
                    setForm((prev) => ({
                      ...prev,
                      merchantId: nextMerchantId,
                      storeId: "",
                      bindings: [],
                    }));
                    if (!nextMerchantId) {
                      setScopeType("platform");
                    } else if (scopeType === "platform") {
                      setScopeType("merchant");
                    }
                    setPickerOpen(false);
                  }}
                  disabled={loading || saving || props.mode === "edit"}
                >
                  <SelectTrigger className="subpage-native-select h-10 w-full">
                    <SelectValue placeholder={isPlatformScope ? "平台模型池" : "选择商户"} />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="none">平台模型池</SelectItem>
                    {merchantOptions.map((merchant) => (
                      <SelectItem key={merchant.id} className="subpage-select-item" value={merchant.id}>
                        {merchant.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={fixedMerchantId || "-"} className="workflow-form-input" disabled />
              )}
            </FieldGroup>
            <FieldGroup label="目标门店">
              {canChooseStore ? (
                <Select
                  value={form.storeId || "none"}
                  onValueChange={(value) => {
                    setForm((prev) => ({
                      ...prev,
                      storeId: value === "none" ? "" : value,
                      bindings: [],
                    }));
                    setPickerOpen(false);
                  }}
                  disabled={loading || saving || props.mode === "edit" || scopeType !== "store" || !form.merchantId}
                >
                  <SelectTrigger className="subpage-native-select h-10 w-full">
                    <SelectValue placeholder={isPlatformScope ? "平台模型池" : "选择门店"} />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="none">
                      {isPlatformScope ? "平台模型池" : "请选择门店"}
                    </SelectItem>
                    {storeOptions.map((store) => (
                      <SelectItem key={store.id} className="subpage-select-item" value={store.id}>
                        {store.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={scopeType === "store" ? (fixedStoreId || "-") : "-"} className="workflow-form-input" disabled />
              )}
            </FieldGroup>
            <FieldGroup label="路由模式">
              <Select
                value={form.routingMode}
                onValueChange={(value) => setForm((prev) => ({ ...prev, routingMode: value as PoolEditorValue["routingMode"] }))}
                disabled={loading || saving}
              >
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {POOL_ROUTING_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="启用">
              <div className="flex min-h-10 items-center justify-between bg-muted/10 px-1">
                <Switch
                  checked={form.status === "启用"}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, status: checked ? "启用" : "停用" }))}
                  disabled={loading || saving}
                  aria-label="模型池启用状态"
                />
              </div>
            </FieldGroup>
            <FieldGroup label="归属摘要" className="xl:col-span-3">
              <Input value={scopeSummary} className="workflow-form-input font-mono" disabled />
            </FieldGroup>
          </div>
        </EditorSection>

        <EditorSection title="候选绑定">
          <div className="grid grid-cols-1 gap-5 px-4">
            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm text-foreground">
                    已加入 {form.bindings.length} 条绑定
                    {remainingBindingOptions.length > 0 ? `，还可加入 ${remainingBindingOptions.length} 条` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    一次可勾选多个模型及其渠道，确认后加入下方列表。
                  </p>
                </div>
                <Button
                  type="button"
                  className="h-10 shrink-0"
                  onClick={() => setPickerOpen(true)}
                  disabled={loading || saving || remainingBindingOptions.length === 0}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  添加绑定
                </Button>
              </div>

              {disabledBindingRows.length > 0 ? (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                  当前模型池中有 {disabledBindingRows.length} 条绑定引用了已停用渠道；这些绑定已从正式接口回填，但新增候选时不会再展示停用渠道。
                </div>
              ) : null}

              {loading ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  正在加载模型池详情...
                </div>
              ) : form.bindings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                  <p>当前还没有候选绑定。</p>
                  {remainingBindingOptions.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 h-9"
                      onClick={() => setPickerOpen(true)}
                      disabled={saving}
                    >
                      选择模型与渠道
                    </Button>
                  ) : (
                    <p className="mt-2">当前范围内没有可加入的渠道部署。</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 rounded-md border border-dashed border-border/70 bg-background/80 px-3 py-3 md:grid-cols-2 xl:grid-cols-3">
                  {form.bindings.map((binding, index) => (
                    <div
                      key={binding.id || `${binding.baseModelId}:${binding.channelId}`}
                      className="rounded-xl border border-border bg-card p-2 transition-all hover:border-primary/35 hover:shadow-md"
                    >
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-[58px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
                          <div className="relative">
                            <Avatar className="h-10 w-10 rounded-xl border border-border/60">
                              <AvatarImage src={binding.modelLogoUrl || undefined} alt={binding.baseModelName} className="object-cover" />
                              <AvatarFallback className="text-[11px] font-medium">
                                {getDisplayFallback(binding.baseModelName)}
                              </AvatarFallback>
                            </Avatar>
                            <Avatar className="absolute -bottom-1 -right-1 h-5 w-5 rounded-md border-2 border-card">
                              <AvatarImage src={binding.channelIconUrl || undefined} alt={binding.channelName} className="object-cover" />
                              <AvatarFallback className="rounded-md bg-primary/10 text-[8px] font-medium text-primary">
                                {getDisplayFallback(binding.channelName)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight text-foreground">
                              {binding.baseModelName}
                            </span>
                            <Badge
                              variant={binding.status === "启用" ? "default" : "outline"}
                              className="shrink-0 whitespace-nowrap px-1.5 py-0.5 text-[11px] font-medium"
                            >
                              {binding.status}
                            </Badge>
                          </div>
                          <div className="space-y-1 text-[12px] leading-[1.45] text-muted-foreground/85">
                            <p className="truncate">渠道：{binding.channelName || "-"}</p>
                            <p className="truncate font-mono">模型：{binding.baseModelCode || "-"}</p>
                            <p className="truncate font-mono">渠道编码：{binding.channelCode || "-"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-end gap-2 pt-2">
                        <div className="min-w-0 flex-1 space-y-2 overflow-hidden">
                          <div className="flex flex-nowrap items-center gap-1.5">
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">
                              {binding.channelName || binding.channelCode}
                            </span>
                            {binding.channelStatus !== "enabled" ? (
                              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                                渠道已停用
                              </span>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-[1fr_96px] gap-2">
                            <Input
                              value={binding.candidateCode}
                              onChange={(event) => {
                                updateBinding(index, (item) => ({ ...item, candidateCode: event.target.value }));
                              }}
                              placeholder="候选编码，留空自动生成"
                              className="h-8 font-mono text-[12px]"
                              disabled={saving}
                            />
                            <Select
                              value={binding.status}
                              onValueChange={(value) => {
                                updateBinding(index, (item) => ({
                                  ...item,
                                  status: value as PoolBindingEditorItem["status"],
                                }));
                              }}
                              disabled={saving}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="subpage-select-content">
                                <SelectItem className="subpage-select-item" value="启用">启用</SelectItem>
                                <SelectItem className="subpage-select-item" value="停用">停用</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveCandidateBinding(index)}
                          disabled={saving}
                          aria-label={`移除${binding.baseModelName}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </EditorSection>

        <PoolBindingPickerDialog
          open={pickerOpen}
          options={remainingBindingOptions}
          disabled={saving}
          onOpenChange={setPickerOpen}
          onConfirm={handleAddCandidateBindings}
        />

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" className="subpage-outline-btn !h-10 !px-5" onClick={props.onCancel} disabled={saving}>
            取消
          </Button>
          <Button
            className="subpage-primary-btn !h-10 !px-5"
            onClick={() => void handleSave()}
            disabled={
              loading
              || saving
              || !form.displayName.trim()
              || !form.poolCode.trim()
              || (!isPlatformScope && !effectiveMerchantId.trim())
              || (scopeType === "store" && !effectiveStoreId.trim())
            }
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? "保存中" : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
