import { ArrowLeft, ChevronDown, ChevronRight, Copy, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { EditorSection, FieldGroup } from "@/modules/modelhub/components/EditorFormSection";
import {
  createApiKey,
  getApiKey,
  getApiKeyEditorOptions,
  rotateApiKey,
  updateApiKey,
} from "@/modules/modelhub/services/apiKeyManagement";
import {
  API_KEY_BINDING_LABEL,
  formatApiKeyDate,
  formatScopeSummary,
  getApiKeyStatusMeta,
  type ApiKeyBindingType,
  type ApiKeySecret,
  type ApiKeyScopeSelection,
} from "@/modules/modelhub/types/apiKeyManagementTypes";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { useGovernanceScopeChoice } from "@/shared/hooks/use-governance-scope-choice";
import { Badge } from "@/shared/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { notify } from "@/shared/lib/notify";

function isoToLocalInput(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function localInputToIso(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }
  return date.toISOString();
}

function deriveBindingType(scope: ApiKeyScopeSelection): ApiKeyBindingType {
  if (scope.principalId?.trim()) {
    return "user";
  }
  if (scope.storeId?.trim()) {
    return "store";
  }
  if (scope.merchantId?.trim()) {
    return "merchant";
  }
  return "platform";
}

function deriveBindingTypeLabel(scope: ApiKeyScopeSelection): string {
  return API_KEY_BINDING_LABEL[deriveBindingType(scope)];
}

function addDaysToLocalInput(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function isValidIpv4OrCidr(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  const matched = trimmed.match(/^(\d{1,3})(?:\.(\d{1,3})){3}(?:\/(\d{1,2}))?$/);
  if (!matched) {
    return false;
  }
  const [ipPart, cidrPart] = trimmed.split("/");
  const segments = ipPart.split(".").map(Number);
  if (segments.some((segment) => Number.isNaN(segment) || segment < 0 || segment > 255)) {
    return false;
  }
  if (!cidrPart) {
    return true;
  }
  const cidr = Number(cidrPart);
  return Number.isInteger(cidr) && cidr >= 0 && cidr <= 32;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export default function ModelHubApiKeyEditorPage(props: {
  mode: "create" | "edit";
  editingId?: string;
  initialScope: ApiKeyScopeSelection;
  onCancel: () => void;
  onSuccess: () => void;
}) {
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
  } = useGovernanceScopeChoice({
    extraFixedMerchantId: props.initialScope.merchantId,
    extraFixedStoreId: props.initialScope.storeId,
    merchantId,
    storeId,
    onMerchantIdChange: setMerchantId,
    onStoreIdChange: setStoreId,
  });
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [routingStrategyId, setRoutingStrategyId] = useState("");
  const [guardrailIds, setGuardrailIds] = useState<string[]>([]);
  const [requestsPerMinute, setRequestsPerMinute] = useState("");
  const [concurrencyLimit, setConcurrencyLimit] = useState("");
  const [sourceCode, setSourceCode] = useState("");
  const [alertContact, setAlertContact] = useState("");
  const [ipWhitelistText, setIpWhitelistText] = useState("");
  const [policySectionOpen, setPolicySectionOpen] = useState(props.mode === "edit");
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<ApiKeySecret | null>(null);
  const [secretDialogReason, setSecretDialogReason] = useState<"create" | "rotate" | null>(null);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);

  useEffect(() => {
    setMerchantId(props.initialScope.merchantId?.trim() || "");
    setStoreId(props.initialScope.storeId?.trim() || "");
  }, [props.initialScope]);

  const selectedMerchantId = (activeScope.merchantId || "").trim();
  const scopeReady = props.mode === "edit" || !canChooseMerchant || Boolean(selectedMerchantId);

  const optionsQuery = useQuery({
    queryKey: ["modelhub", "api-keys", "editor-options", activeScope],
    queryFn: () => getApiKeyEditorOptions(activeScope),
    enabled: scopeReady,
  });

  const detailQuery = useQuery({
    queryKey: ["modelhub", "api-keys", props.editingId],
    queryFn: () => getApiKey(props.editingId ?? ""),
    enabled: props.mode === "edit" && Boolean(props.editingId),
  });

  useEffect(() => {
    if (props.mode === "create" || !detailQuery.data) {
      return;
    }
    const detail = detailQuery.data;
    setName(detail.keyName);
    setExpiresAt(isoToLocalInput(detail.expiresAt));
    setRoutingStrategyId(detail.assignedRoutingProfileId ?? "");
    setGuardrailIds(detail.assignedGuardrailRuleIds);
    setRequestsPerMinute(String(detail.rateLimit.requestsPerMinute ?? ""));
    setConcurrencyLimit(detail.concurrencyLimit == null ? "" : String(detail.concurrencyLimit));
    setSourceCode(detail.sourceCode ?? "");
    setAlertContact(detail.alertContact ?? "");
    setIpWhitelistText(detail.ipWhitelist.join("\n"));
    setPolicySectionOpen(Boolean(detail.assignedRoutingProfileId || detail.assignedGuardrailRuleIds.length > 0));
  }, [detailQuery.data, props.mode]);

  useEffect(() => {
    if (props.mode !== "create" || !optionsQuery.data) {
      return;
    }
    setRoutingStrategyId((current) => current || "");
  }, [optionsQuery.data, props.mode]);

  const canSelectNonDefaultRouting = optionsQuery.data?.canSelectNonDefaultRouting ?? false;
  const routingOptions = optionsQuery.data?.routingProfiles ?? [];
  const guardrailOptions = optionsQuery.data?.guardrails ?? [];
  const systemDefaultRouting = routingOptions.find((item) => item.systemDefault) ?? null;
  const selectedRoutingProfile =
    routingOptions.find((item) => item.id === routingStrategyId) ??
    detailQuery.data?.effectiveRoutingProfile ??
    (routingStrategyId ? null : systemDefaultRouting);

  const effectiveGuardrailPreview = useMemo(() => {
    if (guardrailIds.length > 0) {
      return guardrailOptions.filter((item) => guardrailIds.includes(item.id)).map((item) => item.name);
    }
    if (detailQuery.data?.effectiveGuardrails.length) {
      return detailQuery.data.effectiveGuardrails.map((item) => item.name);
    }
    const baseline = guardrailOptions.find((item) => item.systemBaseline);
    return baseline ? [baseline.name] : [];
  }, [detailQuery.data?.effectiveGuardrails, guardrailIds, guardrailOptions]);

  const ipWhitelistLines = useMemo(
    () => ipWhitelistText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    [ipWhitelistText],
  );
  const invalidIpLines = useMemo(
    () => ipWhitelistLines.filter((item) => !isValidIpv4OrCidr(item)),
    [ipWhitelistLines],
  );

  const bindingType = detailQuery.data?.bindingType ?? optionsQuery.data?.bindingType ?? deriveBindingType(activeScope);
  const bindingTypeLabel = detailQuery.data?.bindingType
    ? API_KEY_BINDING_LABEL[detailQuery.data.bindingType]
    : (optionsQuery.data ? API_KEY_BINDING_LABEL[optionsQuery.data.bindingType] : deriveBindingTypeLabel(activeScope));
  const isLegacyPlatformKey = props.mode === "edit" && bindingType === "platform";
  const metadataScopeSummary = formatScopeSummary({
    merchantId: detailQuery.data?.merchantId ?? activeScope.merchantId,
    storeId: detailQuery.data?.storeId ?? activeScope.storeId,
    principalId: detailQuery.data?.principalId ?? activeScope.principalId,
  });
  const editPermissionLabel = isLegacyPlatformKey
    ? "只读（历史平台级凭证）"
    : props.mode === "edit" && detailQuery.data && !detailQuery.data.editable
    ? "只读（继承或越级资源）"
    : "可编辑";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!scopeReady) {
        throw new Error("请先选择所属商户");
      }
      if (!name.trim()) {
        throw new Error("请输入 API Key 名称");
      }
      if (invalidIpLines.length > 0) {
        throw new Error("IP 白名单中存在格式不正确的 IP 或 CIDR");
      }
      const normalizedContact = alertContact.trim();
      if (normalizedContact && !/^(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|1\d{10})$/.test(normalizedContact)) {
        throw new Error("告警联系人仅支持邮箱或手机号");
      }
      const normalizedRpm = requestsPerMinute.trim();
      const normalizedConcurrency = concurrencyLimit.trim();
      const rpmValue = normalizedRpm ? Number(normalizedRpm) : null;
      const concurrencyValue = normalizedConcurrency ? Number(normalizedConcurrency) : null;
      if (normalizedRpm && (!Number.isFinite(rpmValue) || rpmValue <= 0)) {
        throw new Error("速率限制必须为正整数");
      }
      if (normalizedConcurrency && (!Number.isFinite(concurrencyValue) || concurrencyValue <= 0)) {
        throw new Error("并发限制必须为正整数");
      }
      const payload = {
        keyName: name.trim(),
        expiresAt: localInputToIso(expiresAt),
        ipWhitelist: ipWhitelistLines,
        rateLimit: rpmValue == null ? {} : { requestsPerMinute: rpmValue },
        concurrencyLimit: concurrencyValue,
        sourceCode: sourceCode.trim() || null,
        alertContact: normalizedContact || null,
        assignedRoutingProfileId: canEditMountedPolicies
          ? (canSelectNonDefaultRouting ? routingStrategyId || null : null)
          : (detailQuery.data?.assignedRoutingProfileId ?? null),
        guardrailRuleIds: canEditMountedPolicies
          ? guardrailIds
          : (detailQuery.data?.assignedGuardrailRuleIds ?? []),
      };
      if (props.mode === "create") {
        return createApiKey(payload, activeScope);
      }
      return updateApiKey(props.editingId ?? "", payload, activeScope);
    },
    onSuccess: (result) => {
      if (props.mode === "create") {
        setRevealedSecret(result as ApiKeySecret);
        setSecretDialogReason("create");
        return;
      }
      notify.success("保存成功");
      props.onSuccess();
    },
    onError: (error) => {
      notify.error("保存失败", { description: resolveUserErrorMessage(error, "API Key 保存失败") });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async () => {
      if (!props.editingId) {
        throw new Error("API Key 不存在");
      }
      if (invalidIpLines.length > 0) {
        throw new Error("IP 白名单中存在格式不正确的 IP 或 CIDR");
      }
      const normalizedRpm = requestsPerMinute.trim();
      const rpmValue = normalizedRpm ? Number(normalizedRpm) : null;
      if (normalizedRpm && (!Number.isFinite(rpmValue) || rpmValue <= 0)) {
        throw new Error("速率限制必须为正整数");
      }
      return rotateApiKey(props.editingId, {
        expiresAt: localInputToIso(expiresAt),
        ipWhitelist: ipWhitelistLines,
        rateLimit: rpmValue == null ? {} : { requestsPerMinute: rpmValue },
      });
    },
    onSuccess: (result) => {
      setRotateDialogOpen(false);
      setRevealedSecret(result);
      setSecretDialogReason("rotate");
      void detailQuery.refetch();
    },
    onError: (error) => {
      notify.error("重新生成失败", { description: resolveUserErrorMessage(error, "API Key 重新生成失败") });
    },
  });

  const toggleGuardrail = (guardrailId: string, checked: boolean | "indeterminate") => {
    setGuardrailIds((prev) => {
      if (checked === true) {
        return prev.includes(guardrailId) ? prev : [...prev, guardrailId];
      }
      return prev.filter((item) => item !== guardrailId);
    });
  };

  const detailLoading = props.mode === "edit" && detailQuery.isLoading;
  const optionsLoading = scopeReady && optionsQuery.isLoading;
  const detailLoadError = detailQuery.error;
  const optionsLoadError = optionsQuery.error;
  const canEditMountedPolicies = Boolean(optionsQuery.data) && !optionsLoadError;
  const isReadOnly =
    isLegacyPlatformKey ||
    (props.mode === "edit" && detailQuery.data != null && !detailQuery.data.editable);
  const canSave =
    !saveMutation.isPending &&
    !detailLoading &&
    !isReadOnly &&
    scopeReady &&
    !(props.mode === "edit" && detailLoadError);
  const canRotate =
    props.mode === "edit" &&
    !detailLoading &&
    !detailLoadError &&
    !isReadOnly &&
    detailQuery.data?.status === "active" &&
    !saveMutation.isPending &&
    !rotateMutation.isPending;

  const statusMeta = props.mode === "edit" && detailQuery.data
    ? getApiKeyStatusMeta(detailQuery.data.status)
    : getApiKeyStatusMeta("active");
  const routingPreviewLabel = selectedRoutingProfile?.name ?? "系统默认路由";
  const routingPreviewSourceLabel =
    detailQuery.data?.effectiveRoutingProfile?.source === "explicit" || (canSelectNonDefaultRouting && routingStrategyId)
      ? "显式挂载"
      : "自动回落";
  const guardrailPreviewLabel = effectiveGuardrailPreview.length > 0 ? effectiveGuardrailPreview.join("、") : "系统治理规则";
  const guardrailPreviewSourceLabel = guardrailIds.length > 0
    ? "显式挂载"
    : "自动回落";

  const closeSecretDialog = () => {
    const reason = secretDialogReason;
    setRevealedSecret(null);
    setSecretDialogReason(null);
    if (reason === "create") {
      props.onSuccess();
    }
  };

  const handleCopySecret = async () => {
    if (!revealedSecret) {
      return;
    }
    try {
      await copyText(revealedSecret.plainSecret);
      notify.success("复制成功", { description: "明文 API Key 已复制到剪贴板，请尽快妥善保存。" });
    } catch {
      notify.error("复制失败", { description: "当前环境暂时无法访问剪贴板，请手动复制并保存这条明文 API Key。" });
    }
  };

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={props.onCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">
            {props.mode === "create" ? "创建API Key" : "编辑API Key"}
          </h1>
          {props.mode === "edit" ? <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge> : null}
        </div>
      </div>

      {detailLoading ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">API Key 编辑数据加载中...</div>
      ) : props.mode === "edit" && detailLoadError ? (
        <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-destructive">
          {resolveUserErrorMessage(detailLoadError, "API Key 编辑数据加载失败")}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[1080px] space-y-5">
          {!scopeReady && props.mode === "create" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              请先选择所属商户。当前页面不再支持新建平台级 API Key。
            </div>
          ) : null}

          {isLegacyPlatformKey ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              这是一条历史平台级 API Key。为避免扩大风险范围，当前仅允许查看，不再支持继续编辑或新建同类凭证。
            </div>
          ) : null}

          {optionsLoading ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
              路由与安全规则加载中，基础信息可先编辑。
            </div>
          ) : null}

          {optionsLoadError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div>路由与安全规则暂时无法加载，您仍可修改名称、到期时间和访问限制等基础信息。</div>
              <Button variant="outline" className="h-8 border-amber-300 bg-transparent px-3 text-amber-900" onClick={() => void optionsQuery.refetch()}>
                重试加载
              </Button>
            </div>
          ) : null}

          <EditorSection title="基础信息">
            <div className="grid grid-cols-1 gap-5 px-4 md:grid-cols-2">
              <FieldGroup label="API Key 名称" required>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如 商城前台调用"
                  className="workflow-form-input"
                  disabled={isReadOnly}
                />
              </FieldGroup>

              <FieldGroup label="到期时间">
                <div className="space-y-2">
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="workflow-form-input"
                    disabled={isReadOnly}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setExpiresAt(addDaysToLocalInput(30))} disabled={isReadOnly}>
                      30 天
                    </Button>
                    <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setExpiresAt(addDaysToLocalInput(90))} disabled={isReadOnly}>
                      90 天
                    </Button>
                    <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setExpiresAt("")} disabled={isReadOnly}>
                      永不过期
                    </Button>
                  </div>
                </div>
              </FieldGroup>
              {props.mode === "create" ? (
                <>
                  <FieldGroup label="所属商户" required>
                    {canChooseMerchant ? (
                      <Select
                        value={merchantId || "__unset__"}
                        onValueChange={(value) => {
                          setMerchantId(value === "__unset__" ? "" : value);
                          setStoreId("");
                        }}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="subpage-native-select h-10 w-full">
                          <SelectValue placeholder="请选择所属商户" />
                        </SelectTrigger>
                        <SelectContent className="subpage-select-content">
                          <SelectItem className="subpage-select-item" value="__unset__">
                            请选择所属商户
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

                  <FieldGroup label="所属门店（可选）">
                    {canChooseStore ? (
                      <Select
                        value={storeId || "__merchant__"}
                        onValueChange={(value) => setStoreId(value === "__merchant__" ? "" : value)}
                        disabled={isReadOnly || !(canChooseMerchant ? merchantId : fixedMerchantId)}
                      >
                        <SelectTrigger className="subpage-native-select h-10 w-full">
                          <SelectValue placeholder="不选则创建为商户级 API Key" />
                        </SelectTrigger>
                        <SelectContent className="subpage-select-content">
                          <SelectItem className="subpage-select-item" value="__merchant__">
                            不指定门店（商户级）
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
                </>
              ) : (
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-4 md:col-span-2">
                  <div className="text-sm font-medium text-foreground">归属信息</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {bindingTypeLabel} / {formatScopeSummary(detailQuery.data ?? activeScope)}
                  </div>
                </div>
              )}

             
            </div>
          </EditorSection>

          <EditorSection title="路由与安全规则">
            <div className="space-y-4 px-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-foreground">系统治理策略</div>
                </div>
                <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setPolicySectionOpen((prev) => !prev)}>
                  {policySectionOpen ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
                  {policySectionOpen ? "收起高级配置" : "展开高级配置"}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="text-sm font-medium text-foreground">当前生效路由</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {routingPreviewLabel}
                  </div>
                  <div className="mt-2 text-[12px] text-muted-foreground">
                    {routingPreviewSourceLabel}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="text-sm font-medium text-foreground">当前生效安全规则</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {guardrailPreviewLabel}
                  </div>
                  <div className="mt-2 text-[12px] text-muted-foreground">
                    {guardrailPreviewSourceLabel}
                  </div>
                </div>
              </div>

              {policySectionOpen ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <FieldGroup label="路由策略">
                    {scopeReady ? (
                      canEditMountedPolicies && canSelectNonDefaultRouting ? (
                        <Select value={routingStrategyId || "__system_default__"} onValueChange={(value) => setRoutingStrategyId(value === "__system_default__" ? "" : value)} disabled={isReadOnly}>
                          <SelectTrigger className="subpage-native-select h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="subpage-select-content">
                            <SelectItem className="subpage-select-item" value="__system_default__">
                              使用系统默认路由
                            </SelectItem>
                            {routingOptions.map((item) => (
                              <SelectItem key={item.id} className="subpage-select-item" value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                          {optionsLoadError
                            ? "路由策略暂时无法加载，当前保留原有生效结果。"
                            : "当前角色仅允许使用系统默认路由，无需额外配置。"}
                        </div>
                      )
                    ) : (
                      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                        请先选择所属商户，再配置路由策略。
                      </div>
                    )}
                  </FieldGroup>

                  <FieldGroup label="安全规则（可多选）" className="md:col-span-2">
                    <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 px-4 py-3">
                      {scopeReady && canEditMountedPolicies ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {guardrailOptions.map((item) => (
                            <label key={item.id} className="flex items-center gap-3 text-sm text-foreground">
                              <Checkbox
                                checked={guardrailIds.includes(item.id)}
                                onCheckedChange={(checked) => toggleGuardrail(item.id, checked)}
                                disabled={isReadOnly}
                              />
                              <span>{item.name}</span>
                              {item.systemBaseline ? <Badge variant="outline">系统基线</Badge> : null}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {scopeReady
                            ? "安全规则暂时不可编辑，当前保留已有生效结果。"
                            : "请先选择所属商户，再加载安全规则选项。"}
                        </div>
                      )}
                    </div>
                  </FieldGroup>
                </div>
              ) : null}
            </div>
          </EditorSection>

          <EditorSection title="访问约束">
            <div className="grid grid-cols-1 gap-5 px-4 md:grid-cols-2">
              <FieldGroup label="速率限制（req/min）">
                <Input
                  value={requestsPerMinute}
                  onChange={(event) => setRequestsPerMinute(event.target.value)}
                  placeholder="例如 1000"
                  className="workflow-form-input"
                  disabled={isReadOnly}
                />
              </FieldGroup>

              <FieldGroup label="并发限制">
                <Input
                  value={concurrencyLimit}
                  onChange={(event) => setConcurrencyLimit(event.target.value)}
                  placeholder="例如 50"
                  className="workflow-form-input"
                  disabled={isReadOnly}
                />
              </FieldGroup>
            </div>
          </EditorSection>

          <EditorSection title="高级设置">
            <div className="space-y-4 px-4">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-muted/10 px-4 py-3 text-left"
                onClick={() => setAdvancedSettingsOpen((prev) => !prev)}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">来源标识、告警联系人与 IP 白名单</div>
                </div>
                {advancedSettingsOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {advancedSettingsOpen ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <FieldGroup label="来源标识">
                    <Input
                      value={sourceCode}
                      onChange={(event) => setSourceCode(event.target.value)}
                      placeholder="例如 mall-web"
                      className="workflow-form-input"
                      disabled={isReadOnly}
                    />
                  </FieldGroup>

                  <FieldGroup label="告警联系人">
                    <Input
                      value={alertContact}
                      onChange={(event) => setAlertContact(event.target.value)}
                      placeholder="邮箱或手机号"
                      className="workflow-form-input"
                      disabled={isReadOnly}
                    />
                  </FieldGroup>

                  <FieldGroup label="IP 白名单" className="md:col-span-2">
                    <div className="space-y-3">
                      <Textarea
                        value={ipWhitelistText}
                        onChange={(event) => setIpWhitelistText(event.target.value)}
                        className="workflow-form-textarea min-h-[140px]"
                        placeholder={"一行一个 IP 或 CIDR\n例如：192.168.1.10\n10.0.0.0/24"}
                        disabled={isReadOnly}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
                        <div>
                          已录入 {ipWhitelistLines.length} 条
                          {invalidIpLines.length > 0 ? `，其中 ${invalidIpLines.length} 条格式不正确` : ""}
                        </div>
                        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setIpWhitelistText("")} disabled={isReadOnly}>
                          一键清空
                        </Button>
                      </div>
                    </div>
                  </FieldGroup>
                </div>
              ) : null}
            </div>
          </EditorSection>

          {props.mode === "edit" && !isLegacyPlatformKey ? (
            <EditorSection title="秘钥操作">
              <div className="space-y-4 px-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/10 px-4 py-4">
                  <div>
                    <div className="text-sm font-medium text-foreground">重新生成 API Key</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-4 text-destructive hover:text-destructive"
                    disabled={!canRotate}
                    onClick={() => setRotateDialogOpen(true)}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    重新生成秘钥
                  </Button>
                </div>
              </div>
            </EditorSection>
          ) : null}

          {props.mode === "edit" ? (
            <div className="rounded-2xl border border-border/70 bg-background/85 px-5 py-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setMetadataOpen((prev) => !prev)}
              >
                <div>
                  <div className="text-[15px] font-semibold text-foreground">更多信息</div>
                </div>
                {metadataOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {metadataOpen ? (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                    <div className="text-[12px] text-muted-foreground">编辑权限</div>
                    <div className="mt-1 text-sm text-foreground">{editPermissionLabel}</div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                    <div className="text-[12px] text-muted-foreground">最近使用时间</div>
                    <div className="mt-1 text-sm text-foreground">{formatApiKeyDate(detailQuery.data?.lastUsedAt)}</div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                    <div className="text-[12px] text-muted-foreground">当前角色</div>
                    <div className="mt-1 text-sm text-foreground">
                      {optionsQuery.data?.currentRole ?? (optionsLoading ? "加载中..." : "加载失败")}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                    <div className="text-[12px] text-muted-foreground">归属摘要</div>
                    <div className="mt-1 text-sm text-foreground">{bindingTypeLabel}</div>
                    <div className="mt-1 font-mono text-[12px] text-muted-foreground">{metadataScopeSummary}</div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3 pb-8">
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="subpage-outline-btn !h-10 !px-5" onClick={props.onCancel}>
                取消
              </Button>
              <Button
                className="subpage-primary-btn !h-10 !px-5"
                onClick={() => saveMutation.mutate()}
                disabled={!canSave}
              >
                <Save className="mr-1 h-4 w-4" />
                {saveMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={rotateDialogOpen} onOpenChange={setRotateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重新生成 API Key？</AlertDialogTitle>
            <AlertDialogDescription>旧秘钥会立即失效，新秘钥明文仅展示一次。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotateMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                rotateMutation.mutate();
              }}
              disabled={rotateMutation.isPending}
            >
              {rotateMutation.isPending ? "重新生成中..." : "确认重新生成"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(revealedSecret)}
        onOpenChange={(open) => {
          if (!open && revealedSecret) {
            closeSecretDialog();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{secretDialogReason === "rotate" ? "API Key 已重新生成" : "API Key 创建成功"}</DialogTitle>
            <DialogDescription>明文仅展示一次，请立即复制保存。</DialogDescription>
          </DialogHeader>

          {revealedSecret ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="text-[12px] text-muted-foreground">API Key 名称</div>
                  <div className="mt-1 text-sm text-foreground">{revealedSecret.keyName}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="text-[12px] text-muted-foreground">前缀</div>
                  <div className="mt-1 font-mono text-sm text-foreground">{revealedSecret.keyPrefix}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-3">
                  <div className="text-[12px] text-muted-foreground">有效期</div>
                  <div className="mt-1 text-sm text-foreground">{formatApiKeyDate(revealedSecret.expiresAt)}</div>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 px-4 py-4">
                <div className="text-[12px] text-muted-foreground">明文 API Key</div>
                <div className="mt-2 break-all rounded-lg bg-background px-4 py-3 font-mono text-sm text-foreground">
                  {revealedSecret.plainSecret}
                </div>
                <div className="mt-2 text-[12px] text-muted-foreground">
                  脱敏展示：{revealedSecret.secretMasked}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" className="subpage-outline-btn !h-10 !px-5" onClick={() => void handleCopySecret()}>
              <Copy className="mr-1 h-4 w-4" />
              复制 API Key
            </Button>
            <Button className="subpage-primary-btn !h-10 !px-5" onClick={closeSecretDialog}>
              {secretDialogReason === "rotate" ? "我已保存，继续编辑" : "我已保存，返回列表"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
