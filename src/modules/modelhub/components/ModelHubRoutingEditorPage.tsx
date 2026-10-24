import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { EditorSection, FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import { EntryPolicyRow } from "@/modules/modelhub/components/routing-editor/EntryPolicyRow";
import { RangeSelector } from "@/modules/modelhub/components/routing-editor/RangeSelector";
import { buildRoutingValidationIssues } from "@/modules/modelhub/components/routing-editor/buildRoutingValidationIssues";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  hasPermission,
} from "@/shared/lib/permissions";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  EMPTY_FIXED_CHANNEL_OPTION,
  ENTRY_LABEL,
  ENTRY_ORDER,
  REGION_LEVEL_OPTIONS,
  TENANT_LEVEL_OPTIONS,
  createDefaultRoutingProfileFormValue,
  toRoutingProfileFormValue,
  type FixedChannelOption,
  type PoolId,
  type RegionLevel,
  type RouteEntryCode,
  type RoutingProfileFormValue,
  type RoutingScopeSelection,
  type RoutingProfileStatus,
  type StrategySource,
  type TenantLevel,
  type UnmatchedBehavior,
} from "@/modules/modelhub/types/routingManagementTypes";
import {
  createRoutingProfile,
  listRoutingFallbackPoolOptions,
  listRoutingFixedChannelOptions,
  getRoutingProfile,
  listRoutingPoolOptions,
  listRoutingProfilesCatalog,
  updateRoutingProfile,
} from "@/modules/modelhub/services/routingProfiles";
import { buildRoutingPreviewSummary } from "@/modules/modelhub/types/routingPreview";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { useGovernanceScopeChoice } from "@/shared/hooks/use-governance-scope-choice";
import { notify } from "@/shared/lib/notify";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

export default function ModelHubRoutingEditorPage(props: {
  mode: "create" | "edit";
  editingId?: string;
  initialScope: RoutingScopeSelection;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [merchantId, setMerchantId] = useState(props.initialScope.merchantId?.trim() || "");
  const [storeId, setStoreId] = useState(props.initialScope.storeId?.trim() || "");
  const {
    canChooseMerchant,
    canChooseStore,
    fixedMerchantId,
    fixedStoreId,
    merchantOptions,
    storeOptions,
    activeScope,
    isPlatformScoped,
  } = useGovernanceScopeChoice({
    extraFixedMerchantId: props.initialScope.merchantId,
    extraFixedStoreId: props.initialScope.storeId,
    merchantId,
    storeId,
    onMerchantIdChange: setMerchantId,
    onStoreIdChange: setStoreId,
  });
  const { data: meInfo } = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const permissionSet = useMemo(
    () => buildPermissionSetForNamespace(CONSOLE_PERMISSION_NAMESPACE, meInfo?.permissions ?? []),
    [meInfo?.permissions],
  );
  const canEditSystemDefault = hasPermission(permissionSet, CONSOLE_PERMISSIONS.iamRbacManage);
  const [form, setForm] = useState<RoutingProfileFormValue>(createDefaultRoutingProfileFormValue);
  const [simulateEntry, setSimulateEntry] = useState<RouteEntryCode>("chat");
  const [simulateTenantLevel, setSimulateTenantLevel] = useState<TenantLevel>("merchant");
  const [simulateRegionLevel, setSimulateRegionLevel] = useState<RegionLevel>("domestic");
  const [simulateStrategySource, setSimulateStrategySource] = useState<StrategySource>("tenant_default");

  useEffect(() => {
    setMerchantId(props.initialScope.merchantId?.trim() || "");
    setStoreId(props.initialScope.storeId?.trim() || "");
  }, [props.initialScope]);

  const scopeReady = isPlatformScoped || !canChooseMerchant || Boolean(activeScope.merchantId?.trim());

  const detailQuery = useQuery({
    queryKey: ["modelhub", "routing-profiles", props.editingId ?? "create"],
    queryFn: () => getRoutingProfile(props.editingId as string),
    enabled: props.mode === "edit" && Boolean(props.editingId),
  });

  const profilesQuery = useQuery({
    queryKey: ["modelhub", "routing-profiles", activeScope],
    queryFn: () => listRoutingProfilesCatalog(activeScope),
    enabled: scopeReady,
  });

  const poolOptionsQuery = useQuery({
    queryKey: ["modelhub", "routing-pool-options", activeScope],
    queryFn: () => listRoutingPoolOptions(activeScope),
    enabled: scopeReady,
  });

  const fallbackPoolOptionsQuery = useQuery({
    queryKey: ["modelhub", "routing-fallback-pool-options", activeScope],
    queryFn: () => listRoutingFallbackPoolOptions(activeScope),
    enabled: scopeReady,
  });

  const fixedChannelOptionsQuery = useQuery({
    queryKey: ["modelhub", "routing-fixed-channel-options", activeScope],
    queryFn: () => listRoutingFixedChannelOptions(activeScope),
    enabled: scopeReady,
  });

  useEffect(() => {
    if (props.mode === "edit") {
      if (detailQuery.data) {
        setMerchantId(detailQuery.data.merchantId || "");
        setStoreId(detailQuery.data.storeId || "");
        setForm(toRoutingProfileFormValue(detailQuery.data));
      }
      return;
    }
    setForm((current) => {
      if (current.code || current.name) {
        return current;
      }
      return createDefaultRoutingProfileFormValue();
    });
  }, [detailQuery.data, props.mode]);

  useEffect(() => {
    const firstPoolId = poolOptionsQuery.data?.[0]?.value;
    const firstFallbackPoolId = fallbackPoolOptionsQuery.data?.[0]?.value;
    if (!firstPoolId && !firstFallbackPoolId) {
      return;
    }
    setForm((current) => {
      const next = { ...current, entries: { ...current.entries } };
      let changed = false;
      if (!next.fallbackPoolId && firstFallbackPoolId) {
        next.fallbackPoolId = firstFallbackPoolId;
        changed = true;
      }
      if (firstPoolId) {
        for (const entry of ENTRY_ORDER) {
          if (!next.entries[entry].targetPoolId) {
            next.entries[entry] = {
              ...next.entries[entry],
              targetPoolId: firstPoolId,
            };
            changed = true;
          }
        }
      }
      return changed ? next : current;
    });
  }, [fallbackPoolOptionsQuery.data, poolOptionsQuery.data]);

  const persistedEntryCodes = useMemo(() => {
    if (props.mode !== "edit" || !detailQuery.data?.entries) {
      return new Set<RouteEntryCode>();
    }
    return new Set(detailQuery.data.entries.map((item) => item.entry));
  }, [detailQuery.data, props.mode]);
  const unsavedCatalogEntries = useMemo(
    () => (props.mode === "edit" && detailQuery.data
      ? ENTRY_ORDER.filter((entry) => !persistedEntryCodes.has(entry))
      : []),
    [detailQuery.data, persistedEntryCodes, props.mode],
  );
  const poolOptions = useMemo(() => poolOptionsQuery.data ?? [], [poolOptionsQuery.data]);
  const fallbackPoolOptions = useMemo(
    () => fallbackPoolOptionsQuery.data ?? [],
    [fallbackPoolOptionsQuery.data],
  );
  const fixedChannelOptions = useMemo<FixedChannelOption[]>(() => {
    const optionMap = new Map<FixedChannelOption["value"], FixedChannelOption>();
    optionMap.set(EMPTY_FIXED_CHANNEL_OPTION.value, EMPTY_FIXED_CHANNEL_OPTION);
    for (const option of fixedChannelOptionsQuery.data ?? []) {
      optionMap.set(option.value, option);
    }
    for (const entry of ENTRY_ORDER) {
      const fixedChannelId = form.entries[entry].fixedChannelId;
      if (fixedChannelId && fixedChannelId !== EMPTY_FIXED_CHANNEL_OPTION.value && !optionMap.has(fixedChannelId)) {
        optionMap.set(fixedChannelId, {
          value: fixedChannelId,
          label: fixedChannelId,
        });
      }
    }
    return Array.from(optionMap.values());
  }, [fixedChannelOptionsQuery.data, form.entries]);
  const previewSummary = useMemo(
    () =>
      buildRoutingPreviewSummary({
        applicableTenantLevels: form.applicableTenantLevels,
        applicableRegions: form.applicableRegions,
        entries: form.entries,
        simulateEntry,
        simulateTenantLevel,
        simulateRegionLevel,
        simulateStrategySource,
        unmatchedBehavior: form.unmatchedBehavior,
        fallbackPoolId: form.fallbackPoolId,
        poolOptions: [...poolOptions, ...fallbackPoolOptions],
      }),
    [fallbackPoolOptions, form, poolOptions, simulateEntry, simulateRegionLevel, simulateStrategySource, simulateTenantLevel],
  );

  const validationIssues = useMemo(
    () =>
      buildRoutingValidationIssues({
        editingId: props.editingId,
        form,
        profiles: (profilesQuery.data ?? []).map((item) => ({ id: item.id, name: item.name, isSystemDefault: item.isSystemDefault })),
      }),
    [form, profilesQuery.data, props.editingId],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (props.mode === "edit" && props.editingId) {
        await updateRoutingProfile(props.editingId, form, activeScope);
        return;
      }
      await createRoutingProfile(form, activeScope);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["modelhub", "routing-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["modelhub", "routing-pool-options"] }),
        queryClient.invalidateQueries({ queryKey: ["modelhub", "routing-fallback-pool-options"] }),
      ]);
      notify.success(props.mode === "create" ? "创建成功" : "保存成功");
      props.onSuccess();
    },
    onError: (error) => {
      notify.error("保存失败", { description: resolveUserErrorMessage(error, "路由策略保存失败") });
    },
  });

  const handleSave = () => {
    if (!scopeReady) {
      notify.error("当前作用域尚未就绪", { description: "请先确认当前是平台级、商户级还是门店级策略，再继续保存。" });
      return;
    }
    if (validationIssues.length > 0) {
      notify.error("保存前请先处理以下问题", { description: validationIssues[0] });
      return;
    }
    saveMutation.mutate();
  };

  const loading =
    detailQuery.isLoading
    || poolOptionsQuery.isLoading
    || fallbackPoolOptionsQuery.isLoading
    || fixedChannelOptionsQuery.isLoading;
  const currentAttachCount = form.attachCount;
  const currentTenantDefaultBindingCount = form.tenantDefaultBindingCount;

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={props.onCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">
            {props.mode === "create" ? "新增路由策略" : "编辑路由策略"}
          </h1>
          {form.isSystemDefault ? <Badge variant="outline">系统默认</Badge> : null}
        </div>
      </div>

      {detailQuery.isError ? (
        <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {resolveUserErrorMessage(detailQuery.error, "路由策略详情加载失败")}
        </div>
      ) : null}

      {poolOptionsQuery.isError ? (
        <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {resolveUserErrorMessage(poolOptionsQuery.error, "模型池选项加载失败")}
        </div>
      ) : null}

      {fallbackPoolOptionsQuery.isError ? (
        <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {resolveUserErrorMessage(fallbackPoolOptionsQuery.error, "兜底池选项加载失败")}
        </div>
      ) : null}

      {fixedChannelOptionsQuery.isError ? (
        <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {resolveUserErrorMessage(fixedChannelOptionsQuery.error, "固定渠道选项加载失败")}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1080px] space-y-5">
        <EditorSection title="基础信息">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FieldGroup label="策略名称" className="xl:col-span-3" required>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="请输入策略名称"
                className="workflow-form-input"
                disabled={loading}
              />
            </FieldGroup>
              <FieldGroup label="策略编码" required>
              <Input
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                placeholder="例如 routing_default"
                className="workflow-form-input"
                disabled={loading}
              />
            </FieldGroup>
            <FieldGroup label="目标商户">
              {canChooseMerchant ? (
                <Select
                  value={merchantId || "none"}
                  onValueChange={(value) => {
                    setMerchantId(value === "none" ? "" : value);
                    setStoreId("");
                  }}
                  disabled={loading}
                >
                  <SelectTrigger className="subpage-native-select h-10 w-full">
                    <SelectValue placeholder="平台级策略或指定商户" />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="none">
                      平台级策略
                    </SelectItem>
                    {merchantOptions.map((item) => (
                      <SelectItem key={item.id} className="subpage-select-item" value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={fixedMerchantId || "-"} className="workflow-form-input font-mono" disabled />
              )}
            </FieldGroup>
            <FieldGroup label="目标门店">
              {canChooseStore ? (
                <Select
                  value={storeId || "none"}
                  onValueChange={(value) => setStoreId(value === "none" ? "" : value)}
                  disabled={loading || !(canChooseMerchant ? merchantId : fixedMerchantId)}
                >
                  <SelectTrigger className="subpage-native-select h-10 w-full">
                    <SelectValue placeholder={isPlatformScoped ? "平台级策略不指定门店" : "请选择目标门店"} />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="none">
                      {isPlatformScoped ? "平台级策略不指定门店" : "商户级策略"}
                    </SelectItem>
                    {storeOptions.map((item) => (
                      <SelectItem key={item.id} className="subpage-select-item" value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={fixedStoreId || "-"} className="workflow-form-input font-mono" disabled />
              )}
            </FieldGroup>
            <FieldGroup label="当前作用域" className="xl:col-span-2">
              <div className="flex min-h-10 items-center rounded-md border border-border/60 bg-muted/10 px-4 text-sm text-muted-foreground">
                {isPlatformScoped
                  ? "当前为平台级路由策略：直接使用平台级模型池与固定渠道。"
                  : storeId
                    ? "当前为门店级路由策略：优先作用于所选门店。"
                    : "当前为商户级路由策略：作用于所选商户下的默认路由。"}
              </div>
            </FieldGroup>
            <FieldGroup label="默认策略" className="xl:col-span-2">
              <div className="flex min-h-10 items-center gap-2 px-1">
                <Switch
                  checked={form.isSystemDefault}
                  disabled={loading || !canEditSystemDefault}
                  onCheckedChange={(checked) => {
                    if (!canEditSystemDefault) return;
                    setForm((current) => ({
                      ...current,
                      isSystemDefault: checked,
                      status: checked ? "enabled" : current.status,
                    }));
                  }}
                />
                <div className="text-left text-sm text-muted-foreground">
                  仅平台管理员可设，且全局只能存在一条系统默认策略。
                </div>
              </div>
            </FieldGroup>
            <FieldGroup label="生效状态" className="xl:col-span-2">
              {form.isSystemDefault ? (
                <div className="flex min-h-10 items-center px-1 text-sm text-muted-foreground">
                  系统默认策略固定为启用；如需替换，请先将新的策略保存为系统默认。
                </div>
              ) : (
                <div className="flex min-h-10 items-center gap-2 px-1">
                  <Switch
                    checked={form.status === "enabled"}
                    disabled={loading}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({ ...current, status: checked ? "enabled" : "disabled" as RoutingProfileStatus }))
                    }
                  />
                  <div className="text-left text-sm text-muted-foreground">
                    {form.status === "enabled" ? "当前策略已启用，可参与路由命中。" : "当前策略已停用，不参与路由命中。"}
                  </div>
                </div>
              )}
            </FieldGroup>
            
            <FieldGroup label="策略说明" className="xl:col-span-4">
              <Input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="用于说明本策略覆盖的入口、模型池与渠道选择方式"
                className="workflow-form-input"
                disabled={loading}
              />
            </FieldGroup>
            <FieldGroup label="引用提醒" className="xl:col-span-2">
              <div className="flex min-h-10 items-center rounded-md border border-border/60 bg-muted/10 px-4 text-sm text-muted-foreground">
                当前影响：{currentAttachCount} 个 API Key / {currentTenantDefaultBindingCount} 条租户默认映射
              </div>
            </FieldGroup>
          </div>
        </EditorSection>

        <EditorSection title="适用范围">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FieldGroup label="适用租户级别" required>
              <RangeSelector
                options={TENANT_LEVEL_OPTIONS}
                value={form.applicableTenantLevels}
                onChange={(nextValue) => setForm((current) => ({ ...current, applicableTenantLevels: nextValue }))}
                emptyText="未选择租户级别"
              />
            </FieldGroup>
            <FieldGroup label="适用区域级别" required>
              <RangeSelector
                options={REGION_LEVEL_OPTIONS}
                value={form.applicableRegions}
                onChange={(nextValue) => setForm((current) => ({ ...current, applicableRegions: nextValue }))}
                emptyText="未选择区域级别"
              />
            </FieldGroup>
          </div>
        </EditorSection>

        <EditorSection title="入口映射 *">
          {!isPlatformScoped ? (
            <div className="mb-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              商户/门店路由的目标模型池可选本分区池，也可选「平台 ·」公共池（全平台共用配置）。
            </div>
          ) : null}
          {unsavedCatalogEntries.length > 0 ? (
            <div className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              当前策略尚未写入入口：{unsavedCatalogEntries.map((entry) => ENTRY_LABEL[entry]).join("、")}。
              页面预填不会参与推理，请保存后再发起生成。
            </div>
          ) : null}
          <div className="space-y-4">
            {ENTRY_ORDER.map((entry) => (
              <EntryPolicyRow
                key={entry}
                entry={entry}
                poolOptions={poolOptions}
                fixedChannelOptions={fixedChannelOptions}
                value={form.entries[entry]}
                persisted={props.mode !== "edit" || persistedEntryCodes.has(entry)}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    entries: {
                      ...current.entries,
                      [entry]: nextValue,
                    },
                  }))
                }
              />
            ))}
          </div>
        </EditorSection>

        <EditorSection title="默认行为">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FieldGroup label="未命中时" required>
              <Select
                value={form.unmatchedBehavior}
                onValueChange={(value) => setForm((current) => ({ ...current, unmatchedBehavior: value as UnmatchedBehavior }))}
                disabled={loading}
              >
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="fallback_to_system_default">
                    回落系统默认
                  </SelectItem>
                  <SelectItem className="subpage-select-item" value="reject">
                    直接拒绝
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="平台统一失败策略">
              <div className="flex min-h-10 items-center rounded-md border border-border/60 bg-muted/10 px-4 text-sm text-muted-foreground">
                Retry {"->"} Failover {"->"} Fallback
              </div>
            </FieldGroup>
            <FieldGroup label="最终兜底池" className="xl:col-span-2" required>
              <Select
                value={form.fallbackPoolId}
                onValueChange={(value) => setForm((current) => ({ ...current, fallbackPoolId: value as PoolId }))}
                disabled={loading}
              >
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {fallbackPoolOptions.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>
        </EditorSection>

        <EditorSection title="策略预览">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <FieldGroup label="虚拟请求入口">
              <Select value={simulateEntry} onValueChange={(value) => setSimulateEntry(value as RouteEntryCode)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {ENTRY_ORDER.map((entry) => (
                    <SelectItem key={entry} className="subpage-select-item" value={entry}>
                      {ENTRY_LABEL[entry]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="租户级别">
              <Select value={simulateTenantLevel} onValueChange={(value) => setSimulateTenantLevel(value as TenantLevel)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {TENANT_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="区域级别">
              <Select value={simulateRegionLevel} onValueChange={(value) => setSimulateRegionLevel(value as RegionLevel)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {REGION_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="策略来源">
              <Select value={simulateStrategySource} onValueChange={(value) => setSimulateStrategySource(value as StrategySource)}>
                <SelectTrigger className="subpage-native-select h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="tenant_default">
                    租户 / 区域默认映射
                  </SelectItem>
                  <SelectItem className="subpage-select-item" value="api_key_assigned">
                    API Key 显式挂载
                  </SelectItem>
                  <SelectItem className="subpage-select-item" value="api_key_other_assigned">
                    API Key 已挂载其他策略
                  </SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="模拟结果" className="xl:col-span-4">
              <div className="space-y-2 rounded-md border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={previewSummary.matched ? "secondary" : "outline"}>
                    {previewSummary.matched ? "当前会命中" : "当前不会命中"}
                  </Badge>
                  {!previewSummary.matched && simulateStrategySource === "tenant_default" ? (
                    <Badge variant={previewSummary.rangeMatched ? "outline" : "secondary"}>
                      {previewSummary.rangeMatched ? "范围已匹配" : "范围不匹配"}
                    </Badge>
                  ) : null}
                </div>
                <div>{previewSummary.sourceSummary}</div>
                <div>{previewSummary.decisionSummary}</div>
                <div>{previewSummary.reasonSummary}</div>
                <div>{previewSummary.nextActionSummary}</div>
              </div>
            </FieldGroup>
          </div>
        </EditorSection>

        {validationIssues.length > 0 ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {validationIssues[0]}
          </div>
        ) : null}

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" className="subpage-outline-btn !h-10 !px-5" onClick={props.onCancel}>
            取消
          </Button>
          <Button className="subpage-primary-btn !h-10 !px-5" onClick={handleSave} disabled={loading || saveMutation.isPending}>
            <Save className="mr-1 h-4 w-4" />
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
