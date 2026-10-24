import { useMemo, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, X } from "lucide-react";
import {
  listTicketDisposalCandidatePrincipals,
  type TicketDisposalConfig,
  type TicketDisposalCandidatePrincipal,
} from "@/shared/api/ops/ops-ticket";
import {
  listMessageTemplateVariables,
  listMessageTemplates,
  updateMessageTemplate,
  type MessageTemplate,
  type VariableDict,
} from "@/shared/api/integration/message-template";
import { getMessageTemplateDictionaries } from "@/shared/api/integration/integration-dictionaries";
import MessageTemplateEditDialog from "@/modules/integration/components/MessageTemplateEditDialog";
import { listMerchants, type Merchant } from "@/shared/api/ums/ums-merchant";
import { listUsers, type User } from "@/shared/api/ums/iam";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";
import EntitySearchPickerDialog from "@/shared/components/EntitySearchPickerDialog";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";

const AUTO_ASSIGN_SCOPE = "merchant";
const AUTO_ASSIGN_TARGET_TYPE = "merchant";

type AutoAssignCandidateMode = "MERCHANT_ALL" | "PRINCIPAL_LIST";

const AUTO_ASSIGN_MODE_ITEMS: Array<{ value: AutoAssignCandidateMode; label: string; description: string }> = [
  { value: "MERCHANT_ALL", label: "按商户处理人池", description: "从配置所选商户的处理人池中自动分配（不是工单所属商户）。" },
  { value: "PRINCIPAL_LIST", label: "指定处理人列表", description: "仅从指定的处理人列表中自动分配处理人。" },
];

type NotificationStageKey = "newEnabled" | "progressEnabled" | "doneEnabled";
type TemplateKey = "smsTemplate" | "emailTemplate" | "inboxTemplate";
type TemplateChannelType = "sms" | "email" | "inbox";

const NOTIFICATION_STAGE_ITEMS: Array<{
  key: NotificationStageKey;
  title: string;
  description: string;
}> = [
  { key: "newEnabled", title: "新工单", description: "工单创建后触发通知，模板编码：ticket_new。" },
  { key: "progressEnabled", title: "进度通知", description: "工单回复、转派等过程通知，模板编码：ticket_progress。" },
  { key: "doneEnabled", title: "已完成", description: "工单关闭或完成后触发通知，模板编码：ticket_done。" },
];

const TEMPLATE_CHANNEL_ITEMS: Array<{
  key: TemplateKey;
  title: string;
  templateType: TemplateChannelType;
}> = [
  { key: "smsTemplate", title: "短信模板", templateType: "sms" },
  { key: "emailTemplate", title: "邮件模板", templateType: "email" },
  { key: "inboxTemplate", title: "站内信模板", templateType: "inbox" },
];

type Props = {
  value: TicketDisposalConfig;
  onChange: (value: TicketDisposalConfig) => void;
  onSubmit?: () => void;
  submitting?: boolean;
  formError?: string | null;
  compact?: boolean;
};

function hasAnyEnabledStage(stageSettings: TicketDisposalConfig["smsTemplate"]["stageSettings"]) {
  return stageSettings.newEnabled || stageSettings.progressEnabled || stageSettings.doneEnabled;
}

function updateNotificationStage(
  current: TicketDisposalConfig,
  templateKey: TemplateKey,
  stageKey: NotificationStageKey,
  enabled: boolean,
) {
  const currentTemplate = current[templateKey];
  const stageSettings = {
    ...currentTemplate.stageSettings,
    [stageKey]: enabled,
  };
  return {
    ...current,
    [templateKey]: {
      ...currentTemplate,
      enabled: hasAnyEnabledStage(stageSettings),
      stageSettings,
    },
  };
}

function resolveStageEnabled(current: TicketDisposalConfig, templateKey: TemplateKey, stageKey: NotificationStageKey) {
  return Boolean(current[templateKey].stageSettings?.[stageKey]);
}

function resolveTemplateCode(template: TicketDisposalConfig["smsTemplate"], stageKey: NotificationStageKey) {
  if (stageKey === "newEnabled") return template.templateCodes.newTemplateCode;
  if (stageKey === "doneEnabled") return template.templateCodes.doneTemplateCode;
  return template.templateCodes.progressTemplateCode;
}

function buildTemplateSummary(template: MessageTemplate | null | undefined, fallbackCode: string) {
  if (template?.content?.trim()) {
    return template.content.trim();
  }
  if (template?.templateName?.trim()) {
    return template.templateName.trim();
  }
  return fallbackCode;
}

function resolveAutoAssignCandidateMode(mode: string | null | undefined): AutoAssignCandidateMode {
  if (mode === "PRINCIPAL_LIST") return "PRINCIPAL_LIST";
  return "MERCHANT_ALL";
}

function getUserDisplayName(user?: Partial<User> | null) {
  return user?.nickname || user?.displayName || user?.realName || user?.phone || user?.email || user?.principalId || user?.id || "";
}

function resolvePrincipalLookupTenantId(merchantId?: string | null) {
  const normalizedMerchantId = merchantId?.trim();
  return normalizedMerchantId || "";
}

/** 与 ComfyUIServerEditorPage FormSection 保持一致 */
function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-2xl bg-background/85 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground leading-relaxed">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export default function TicketDisposalConfigForm(props: Props) {
  const queryClient = useQueryClient();
  const [merchantPickerOpen, setMerchantPickerOpen] = useState(false);
  const [principalPickerOpen, setPrincipalPickerOpen] = useState(false);
  const candidateLimit = 200;
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formTemplateCode, setFormTemplateCode] = useState("");
  const [formTemplateName, setFormTemplateName] = useState("");
  const [formTemplateType, setFormTemplateType] = useState<string>("sms");
  const [formRegion, setFormRegion] = useState<string>("domestic");
  const [formExternalTemplateId, setFormExternalTemplateId] = useState("");
  const [formContent, setFormContent] = useState("");
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);

  const autoAssignMerchantId = props.value.autoAssignTargetMerchantId ?? undefined;
  const autoAssignMode = resolveAutoAssignCandidateMode(props.value.autoAssignCandidateMode);
  const principalIds = Array.isArray(props.value.autoAssignPrincipalIds) ? props.value.autoAssignPrincipalIds.filter(Boolean) : [];
  const hasPrincipalSelection = principalIds.length > 0;
  const sessionScope = useSessionScope();
  const principalLookupTenantId = resolvePrincipalLookupTenantId(autoAssignMerchantId);

  const [principalSearch, setPrincipalSearch] = useState("");
  const debouncedPrincipalSearch = useDebounce(principalSearch.trim(), 400);
  const [principalPageNo, setPrincipalPageNo] = useState(1);
  const [principalPageSize, setPrincipalPageSize] = useState(10);

  const principalListQuery = useQuery({
    queryKey: [
      "opsTicketDisposalConfig",
      sessionScope.scope.queryScopeKey,
      "principalPicker",
      principalLookupTenantId || "current",
      debouncedPrincipalSearch,
      principalPageNo,
      principalPageSize,
    ],
    queryFn: () =>
      listUsers({
        pageNo: principalPageNo,
        pageSize: principalPageSize,
        total: principalRequestTotal,
        keyword: debouncedPrincipalSearch || undefined,
      }),
    enabled: principalPickerOpen,
  });

  const principalTotal = principalListQuery.data?.page?.total ?? 0;
  const principalRequestTotal = usePagedTotal(principalPageNo, principalListQuery.data?.page?.total);
  const principalItems = principalListQuery.data?.items ?? [];
  const principalCanNextPage = useMemo(() => {
    if (principalTotal > 0) return principalPageNo * principalPageSize < principalTotal;
    return principalItems.length === principalPageSize;
  }, [principalItems.length, principalPageNo, principalPageSize, principalTotal]);

  const candidateQuery = useQuery({
    queryKey: [
      "opsTicketDisposalCandidatePrincipals",
      sessionScope.scope.queryScopeKey,
      AUTO_ASSIGN_SCOPE,
      AUTO_ASSIGN_TARGET_TYPE,
      autoAssignMode,
      autoAssignMerchantId,
      principalIds.join(","),
    ],
    queryFn: () =>
      listTicketDisposalCandidatePrincipals({
        autoAssignScope: AUTO_ASSIGN_SCOPE,
        autoAssignTargetType: AUTO_ASSIGN_TARGET_TYPE,
        autoAssignCandidateMode: autoAssignMode,
        autoAssignMerchantId: autoAssignMode === "MERCHANT_ALL" ? autoAssignMerchantId : undefined,
        autoAssignPrincipalIds: autoAssignMode === "PRINCIPAL_LIST" ? principalIds : [],
        limit: candidateLimit,
      }),
    enabled: props.value.autoAssignEnabled && (autoAssignMode === "MERCHANT_ALL" ? Boolean(autoAssignMerchantId) : hasPrincipalSelection),
  });

  const templateMetaList = useMemo(
    () =>
      NOTIFICATION_STAGE_ITEMS.flatMap((stage) =>
        TEMPLATE_CHANNEL_ITEMS.map((channel) => ({
          id: `${channel.key}-${stage.key}`,
          templateKey: channel.key,
          templateType: channel.templateType,
          stageKey: stage.key,
          templateCode: resolveTemplateCode(props.value[channel.key], stage.key),
        })),
      ),
    [props.value],
  );

  const templateDetailQuery = useQuery({
    queryKey: ["opsTicketTemplateDetails", sessionScope.scope.queryScopeKey, templateMetaList.map((item) => `${item.templateType}:${item.templateCode}`)],
    queryFn: async () => {
      const entries = await Promise.all(
        templateMetaList.map(async (item) => {
          const response = await listMessageTemplates({
            pageNo: 1,
            pageSize: 1,
            templateType: item.templateType,
            templateCode: item.templateCode,
          });
          return [`${item.templateType}:${item.templateCode}`, response.items[0] ?? null] as const;
        }),
      );
      return new Map(entries);
    },
  });

  const dictionaryQuery = useQuery({
    queryKey: ["intMessageTemplateDictionaries", sessionScope.scope.queryScopeKey],
    queryFn: getMessageTemplateDictionaries,
  });

  const templateTypeOptions = dictionaryQuery.data?.templateTypes ?? [];
  const regionOptions = dictionaryQuery.data?.regions ?? [];

  const variablesQuery = useQuery({
    queryKey: ["opsTicketInlineTemplateVariables", sessionScope.scope.queryScopeKey, formTemplateType, formTemplateCode],
    queryFn: async () => {
      const res = await listMessageTemplateVariables({ templateType: formTemplateType, templateCode: formTemplateCode.trim() });
      if (Array.isArray(res)) {
        const entries = res.map((v) => [v.key, v] as const);
        return Object.fromEntries(entries) as VariableDict;
      }
      if (!res || typeof res !== "object") return {};
      return res as VariableDict;
    },
    enabled: templateEditorOpen && !!formTemplateCode.trim(),
  });

  const variableDict = variablesQuery.data ?? {};

  const updateTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTemplate?.id) {
        throw new Error("模板不存在");
      }
      return updateMessageTemplate(editingTemplate.id, {
        templateCode: formTemplateCode.trim(),
        templateName: formTemplateName.trim(),
        templateType: formTemplateType,
        region: formRegion,
        externalTemplateId: formExternalTemplateId.trim() ? formExternalTemplateId.trim() : null,
        content: formContent,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["opsTicketTemplateDetails", sessionScope.scope.queryScopeKey] });
      setTemplateFormError(null);
      setTemplateEditorOpen(false);
      setEditingTemplate(null);
      notify.success("模板保存成功");
    },
    onError: (error) => {
      notify.fromError(error, "请求失败", "保存模板失败");
    },
  });

  const handleTemplateEdit = (templateType: TemplateChannelType, templateCode: string) => {
    const template = templateDetailQuery.data?.get(`${templateType}:${templateCode}`);
    if (!template) {
      setTemplateFormError(null);
      notify.error("模板加载中", {
        description: "请稍后再试，或确认模板已创建。",
      });
      return;
    }
    setEditingTemplate(template);
    setFormTemplateCode(template.templateCode || "");
    setFormTemplateName(template.templateName || "");
    setFormTemplateType(template.templateType || templateType);
    setFormRegion(template.region || "domestic");
    setFormExternalTemplateId(template.externalTemplateId || "");
    setFormContent(template.content || "");
    setTemplateFormError(null);
    setTemplateEditorOpen(true);
  };

  const handleTemplateSave = async () => {
    if (!formTemplateCode.trim()) {
      setTemplateFormError("模板编码必填");
      return;
    }
    if (!formTemplateName.trim()) {
      setTemplateFormError("模板名称必填");
      return;
    }
    if (!formContent.trim()) {
      setTemplateFormError("模板内容必填");
      return;
    }
    if (!formRegion.trim()) {
      setTemplateFormError("模板区域必填");
      return;
    }
    if (formTemplateType === "sms" && !formExternalTemplateId.trim()) {
      setTemplateFormError("短信模板需要填写外部模板ID");
      return;
    }
    setTemplateFormError(null);
    await updateTemplateMutation.mutateAsync();
  };

  const handleModeChange = (mode: AutoAssignCandidateMode) => {
    if (mode === "MERCHANT_ALL") {
      const nextMerchantId = props.value.autoAssignTargetMerchantId ?? null;
      props.onChange({
        ...props.value,
        autoAssignScope: [AUTO_ASSIGN_SCOPE],
        autoAssignScopeLevel: "merchant",
        autoAssignTargetType: AUTO_ASSIGN_TARGET_TYPE,
        autoAssignCandidateMode: "MERCHANT_ALL",
        autoAssignTargetMerchantId: nextMerchantId,
        autoAssignPrincipalIds: [],
      });
      return;
    }

    props.onChange({
      ...props.value,
      autoAssignScope: [AUTO_ASSIGN_SCOPE],
      autoAssignScopeLevel: "merchant",
      autoAssignTargetType: AUTO_ASSIGN_TARGET_TYPE,
      autoAssignCandidateMode: "PRINCIPAL_LIST",
      autoAssignTargetMerchantId: null,
      autoAssignTargetName: null,
      autoAssignPrincipalIds: principalIds,
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-5">
      <FormSection
        title="自动分配"
        description="启用后，系统将基于候选范围自动分配新工单处理人；禁用时仅保留人工指派。"
        action={
          <div className="flex items-center gap-3">
            <Switch
              checked={props.value.autoAssignEnabled}
              onCheckedChange={(checked) => {
                if (!checked) {
                  props.onChange({
                    ...props.value,
                    autoAssignEnabled: false,
                    autoAssignScope: [],
                    autoAssignScopeLevel: null,
                    autoAssignTargetType: null,
                    autoAssignTargetName: null,
                    autoAssignCandidateMode: null,
                    autoAssignTargetMerchantId: null,
                    autoAssignPrincipalIds: [],
                  });
                  return;
                }
                props.onChange({
                  ...props.value,
                  autoAssignEnabled: true,
                  autoAssignScope: [AUTO_ASSIGN_SCOPE],
                  autoAssignScopeLevel: "merchant",
                  autoAssignTargetType: AUTO_ASSIGN_TARGET_TYPE,
                  autoAssignTargetName: props.value.autoAssignTargetName ?? null,
                  autoAssignCandidateMode: resolveAutoAssignCandidateMode(props.value.autoAssignCandidateMode),
                  autoAssignTargetMerchantId: props.value.autoAssignTargetMerchantId ?? null,
                  autoAssignPrincipalIds: Array.isArray(props.value.autoAssignPrincipalIds) ? props.value.autoAssignPrincipalIds : [],
                });
              }}
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {props.value.autoAssignEnabled ? "已启用" : "未启用"}
            </span>
          </div>
        }
      >
        {props.value.autoAssignEnabled ? (
          <div className="space-y-5">
            <div className="space-y-2 max-w-md">
              <label className="workflow-form-label">候选范围</label>
              <Select value={autoAssignMode} onValueChange={(v) => handleModeChange(v as AutoAssignCandidateMode)}>
                <SelectTrigger className="workflow-form-input h-10">
                  <SelectValue placeholder="请选择候选范围" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  {AUTO_ASSIGN_MODE_ITEMS.map((item) => (
                    <SelectItem key={item.value} className="subpage-select-item" value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {AUTO_ASSIGN_MODE_ITEMS.find((item) => item.value === autoAssignMode)?.description ?? ""}
              </p>
            </div>

            {autoAssignMode === "MERCHANT_ALL" ? (
              <div className="space-y-2">
                <label className="workflow-form-label">自动分配商户</label>
                <div className="flex flex-col gap-4 rounded-xl bg-muted/20 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    {props.value.autoAssignTargetMerchantId ? (
                      <>
                        <div className="text-sm font-medium text-foreground">{props.value.autoAssignTargetName || "已选择商户"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">ID：{props.value.autoAssignTargetMerchantId}</div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">请选择一个商户作为候选处理人来源。</div>
                    )}
                  </div>
                  <Button type="button" variant="outline" className="h-10 shrink-0 rounded-xl px-4" onClick={() => setMerchantPickerOpen(true)}>
                    选择商户
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">自动分配只从当前选择商户的处理人池中选择处理人。</p>
              </div>
            ) : null}

            {autoAssignMode === "PRINCIPAL_LIST" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="workflow-form-label">指定处理人</label>
                  <Button type="button" variant="outline" className="h-10 gap-2 rounded-xl px-4" onClick={() => setPrincipalPickerOpen(true)}>
                    <Plus className="h-4 w-4" />
                    添加处理人
                  </Button>
                </div>
                <div className="rounded-xl bg-muted/20 px-4 py-4">
                  {!hasPrincipalSelection ? (
                    <div className="text-sm text-muted-foreground">暂无已选择处理人，请点击“添加处理人”进行选择。</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">已选择 {principalIds.length} 人</div>
                      <div className="flex flex-wrap gap-2">
                        {principalIds.slice(0, 20).map((pid) => {
                          const matched = (candidateQuery.data ?? []).find((p) => p.principalId === pid);
                          const label = matched?.displayName || matched?.principalId || pid;
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1 rounded-md border bg-muted/20 px-2 py-1 text-xs text-foreground"
                            >
                              <span className="max-w-[220px] truncate" title={label}>
                                {label}
                              </span>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  props.onChange({
                                    ...props.value,
                                    autoAssignPrincipalIds: principalIds.filter((id) => id !== pid),
                                  })
                                }
                                title="移除"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      {principalIds.length > 20 ? <div className="text-xs text-muted-foreground">仅展示前 20 个处理人。</div> : null}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">自动分配只会从指定处理人列表中选择处理人。</p>
              </div>
            ) : null}

            {(autoAssignMode === "MERCHANT_ALL" ? Boolean(autoAssignMerchantId) : hasPrincipalSelection) ? (
              <div className="space-y-2">
                <label className="workflow-form-label">候选处理人预览</label>
                <div className="rounded-xl bg-muted/20 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">
                      {autoAssignMode === "MERCHANT_ALL" ? "已根据当前商户查询候选处理人" : "已根据处理人列表生成候选预览"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {candidateQuery.isFetching
                        ? "加载中..."
                        : (() => {
                            const count = candidateQuery.data?.length ?? 0;
                            return count >= candidateLimit ? `${candidateLimit}+ 人` : `${count} 人`;
                          })()}
                    </div>
                  </div>

                  {candidateQuery.isLoading ? (
                    <div className="mt-4 text-sm text-muted-foreground">加载候选处理人中...</div>
                  ) : (candidateQuery.data ?? []).length === 0 ? (
                    <div className="mt-4 text-sm text-muted-foreground">暂无候选处理人</div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {(candidateQuery.data ?? []).slice(0, 12).map((item: TicketDisposalCandidatePrincipal) => (
                        <div key={item.principalId} className="rounded-xl bg-background/80 px-3 py-3">
                          <div className="text-sm font-medium text-foreground">{item.displayName || item.principalId}</div>
                          <div className="mt-1 text-xs leading-5 text-muted-foreground">
                            {item.phone ? `手机：${item.phone}` : null}
                            {item.email ? `  邮箱：${item.email}` : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-xs text-muted-foreground">预览列表按展示名排序，最多拉取 {candidateLimit} 条，页面展示前 12 条。</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </FormSection>

        <FormSection title="处理时效" description="SLA 小时数会写入处置配置，当前版本暂未用于超时提醒/升级（预留字段）">
        <div className="space-y-2 max-w-md">
          <label className="workflow-form-label">SLA（小时）</label>
          <Input
            type="number"
            min={1}
            step={1}
            className="workflow-form-input"
            value={String(props.value.slaHours)}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              props.onChange({
                ...props.value,
                slaHours: Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1,
              });
            }}
          />
        </div>
      </FormSection>

      <FormSection title="消息通知" description="按工单阶段分别配置短信、邮件和站内信模板，可直接编辑对应模板内容。">
        <div className="space-y-6">
          {NOTIFICATION_STAGE_ITEMS.map((item) => (
            <div key={item.key} className="space-y-3">
              <div>
                <div className="text-sm font-medium text-foreground">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {TEMPLATE_CHANNEL_ITEMS.map((channel) => {
                  const template = props.value[channel.key];
                  const checked = resolveStageEnabled(props.value, channel.key, item.key);
                  const templateCode = resolveTemplateCode(template, item.key);
                  const templateInfo = templateDetailQuery.data?.get(`${channel.templateType}:${templateCode}`);
                  const templateSummary = buildTemplateSummary(templateInfo, templateCode);
                  return (
                    <div key={`${item.key}-${channel.key}`} className="rounded-xl bg-muted/20 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-foreground">{channel.title}</div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            onClick={() => handleTemplateEdit(channel.templateType, templateCode)}
                            title="编辑模板"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <Switch
                            checked={checked}
                            onCheckedChange={(nextChecked) =>
                              props.onChange(updateNotificationStage(props.value, channel.key, item.key, nextChecked))
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {templateDetailQuery.isLoading ? "加载模板内容中..." : templateSummary}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </FormSection>

      {props.onSubmit ? (
        <div className="flex flex-col items-end gap-2 pt-2">
          {props.formError ? <p className="text-sm text-destructive">{props.formError}</p> : null}
          <Button
            className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90"
            onClick={props.onSubmit}
            disabled={props.submitting}
          >
            <Save className="w-4 h-4 mr-1" />
            {props.submitting ? "保存中..." : "保存"}
          </Button>
        </div>
      ) : null}

      <EntitySearchPickerDialog<Merchant>
        open={merchantPickerOpen}
        onOpenChange={setMerchantPickerOpen}
        title="选择商户"
        queryKeyPrefix={["opsTicketDisposalConfig", "autoAssign", "merchantPicker"]}
        fetchPage={async (params) => {
          const resp = await listMerchants({ pageNo: params.pageNo, pageSize: params.pageSize, total: params.total, keyword: params.keyword });
          return { page: resp.page, items: resp.items };
        }}
        getId={(item) => item.id}
        getTitle={(item) => item.name}
        getDescription={(item) => <div className="text-xs text-muted-foreground">编码：{item.code}</div>}
        selectedId={autoAssignMerchantId}
        onPick={(item) =>
          props.onChange({
            ...props.value,
            autoAssignScope: [AUTO_ASSIGN_SCOPE],
            autoAssignScopeLevel: "merchant",
            autoAssignTargetType: AUTO_ASSIGN_TARGET_TYPE,
            autoAssignTargetMerchantId: item.id,
            autoAssignTargetName: item.name,
            autoAssignCandidateMode: "MERCHANT_ALL",
            autoAssignPrincipalIds: [],
          })
        }
        searchPlaceholder="搜索商户名称/编码"
        emptyText="暂无商户数据"
        pageSizeOptions={[10, 20, 50]}
      />

      <Dialog
        open={principalPickerOpen}
        onOpenChange={(open) => {
          setPrincipalPickerOpen(open);
          if (!open) {
            setPrincipalSearch("");
            setPrincipalPageNo(1);
            setPrincipalPageSize(10);
          }
        }}
      >
        <DialogContent className="max-w-[900px]">
          <DialogHeader>
            <DialogTitle>选择处理人</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Input
                className="workflow-form-input"
                placeholder="搜索昵称/姓名/手机/邮箱"
                value={principalSearch}
                onChange={(e) => {
                  setPrincipalSearch(e.target.value);
                  setPrincipalPageNo(1);
                }}
              />
              <div className="shrink-0 text-xs text-muted-foreground">已选 {principalIds.length} 人</div>
            </div>

            <div className="min-h-[320px]">
              {principalListQuery.isLoading ? (
                <div className="py-10 text-sm text-muted-foreground">加载中...</div>
              ) : principalItems.length === 0 ? (
                <div className="py-10 text-sm text-muted-foreground">暂无可选用户</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {principalItems.map((user) => {
                    const pid = user.principalId || user.id;
                    const checked = principalIds.includes(pid);
                    const title = getUserDisplayName(user) || pid;
                    return (
                      <button
                        key={pid}
                        type="button"
                        className={`rounded-xl border px-3 py-3 text-left transition-colors hover:bg-muted/20 ${
                          checked ? "border-primary bg-primary/5" : "border-border/80"
                        }`}
                        onClick={() => {
                          const nextIds = checked ? principalIds.filter((id) => id !== pid) : [...principalIds, pid];
                          props.onChange({
                            ...props.value,
                            autoAssignScope: [AUTO_ASSIGN_SCOPE],
                            autoAssignScopeLevel: "merchant",
                            autoAssignTargetType: AUTO_ASSIGN_TARGET_TYPE,
                            autoAssignCandidateMode: "PRINCIPAL_LIST",
                            autoAssignTargetMerchantId: null,
                            autoAssignTargetName: null,
                            autoAssignPrincipalIds: nextIds,
                          });
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground" title={title}>
                              {title}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">principalId：{pid}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {user.phone ? `手机：${user.phone}` : null}
                              {user.email ? `  邮箱：${user.email}` : null}
                            </div>
                          </div>
                          <div className="shrink-0 text-xs text-muted-foreground">{checked ? "已添加" : "点击添加"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <CommonPaginationBar
              total={principalTotal}
              pageNo={principalPageNo}
              pageSize={principalPageSize}
              canNextPage={principalCanNextPage}
              onPageNoChange={setPrincipalPageNo}
              onPageSizeChange={(next) => {
                setPrincipalPageSize(next);
                setPrincipalPageNo(1);
              }}
              disabled={principalListQuery.isFetching}
              showLastButton
              className="mt-0"
            />
          </div>

          <DialogFooter>
            <Button type="button" className="h-10 px-5" onClick={() => setPrincipalPickerOpen(false)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MessageTemplateEditDialog
        open={templateEditorOpen}
        onOpenChange={(open) => {
          setTemplateEditorOpen(open);
          if (!open) setTemplateFormError(null);
        }}
        savePending={updateTemplateMutation.isPending}
        onSave={() => void handleTemplateSave()}
        error={templateFormError}
        formTemplateCode={formTemplateCode}
        setFormTemplateCode={setFormTemplateCode}
        formTemplateName={formTemplateName}
        setFormTemplateName={setFormTemplateName}
        formTemplateType={formTemplateType}
        setFormTemplateType={setFormTemplateType}
        formRegion={formRegion}
        setFormRegion={setFormRegion}
        formExternalTemplateId={formExternalTemplateId}
        setFormExternalTemplateId={setFormExternalTemplateId}
        formContent={formContent}
        setFormContent={setFormContent}
        templateTypeOptions={templateTypeOptions}
        regionOptions={regionOptions}
        variableDict={variableDict}
      />
    </div>
  );
}
