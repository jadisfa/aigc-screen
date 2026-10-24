import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import TicketDisposalConfigForm from "@/modules/ops/components/TicketDisposalConfigForm";
import {
  getTicketDisposalConfig,
  updateTicketDisposalConfig,
  type TicketDisposalConfig,
} from "@/shared/api/ops/ops-ticket";
import { PageHeader, PageShell } from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { notify } from "@/shared/lib/notify";

const DEFAULT_TEMPLATE_CODES = {
  newTemplateCode: "ticket_new",
  progressTemplateCode: "ticket_progress",
  doneTemplateCode: "ticket_done",
};

const DEFAULT_VARIABLE_MAPPINGS = [
  { targetKey: "ticketId", sourceKey: "ticketId" },
  { targetKey: "ticketNo", sourceKey: "ticketNo" },
  { targetKey: "ticketTitle", sourceKey: "ticketTitle" },
  { targetKey: "ticketStatus", sourceKey: "ticketStatus" },
  { targetKey: "handlerName", sourceKey: "handlerName" },
  { targetKey: "actionUrl", sourceKey: "actionUrl" },
];

const DEFAULT_PROGRESS_VARIABLE_MAPPINGS = [
  ...DEFAULT_VARIABLE_MAPPINGS,
  { targetKey: "progressNote", sourceKey: "progressNote" },
];

const DEFAULT_CONFIG: TicketDisposalConfig = {
  autoAssignEnabled: false,
  autoAssignScope: [],
  autoAssignScopeLevel: null,
  autoAssignTargetType: null,
  autoAssignTargetName: null,
  autoAssignCandidateMode: null,
  autoAssignTargetMerchantId: null,
  autoAssignPrincipalIds: [],
  slaHours: 24,
  smsTemplate: {
    enabled: true,
    stageSettings: {
      newEnabled: true,
      progressEnabled: true,
      doneEnabled: true,
    },
    templateCodes: DEFAULT_TEMPLATE_CODES,
    variableMappings: DEFAULT_PROGRESS_VARIABLE_MAPPINGS,
  },
  emailTemplate: {
    enabled: true,
    stageSettings: {
      newEnabled: true,
      progressEnabled: true,
      doneEnabled: true,
    },
    templateCodes: DEFAULT_TEMPLATE_CODES,
    variableMappings: DEFAULT_PROGRESS_VARIABLE_MAPPINGS,
  },
  inboxTemplate: {
    enabled: true,
    stageSettings: {
      newEnabled: true,
      progressEnabled: true,
      doneEnabled: true,
    },
    templateCodes: DEFAULT_TEMPLATE_CODES,
    variableMappings: DEFAULT_PROGRESS_VARIABLE_MAPPINGS,
  },
  updatedAt: null,
  updatedBy: null,
};

function hasAnyEnabledStage(template: TicketDisposalConfig["smsTemplate"]) {
  return (
    template.stageSettings.newEnabled ||
    template.stageSettings.progressEnabled ||
    template.stageSettings.doneEnabled
  );
}

function mergeNotificationTemplate(
  template: Partial<TicketDisposalConfig["smsTemplate"]> | undefined,
  fallback: TicketDisposalConfig["smsTemplate"],
): TicketDisposalConfig["smsTemplate"] {
  const stageSettings = {
    ...fallback.stageSettings,
    ...(template?.stageSettings ?? {}),
  };
  const merged = {
    ...fallback,
    ...template,
    stageSettings,
    templateCodes: {
      ...fallback.templateCodes,
      ...(template?.templateCodes ?? {}),
    },
    variableMappings:
      template?.variableMappings && template.variableMappings.length > 0 ? template.variableMappings : fallback.variableMappings,
  };
  return {
    ...merged,
    enabled: hasAnyEnabledStage(merged),
  };
}

export default function TicketDisposalConfigPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<TicketDisposalConfig>(DEFAULT_CONFIG);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getTicketDisposalConfig();
      const autoAssignEnabled = Boolean(response.autoAssignEnabled);
      const mode = response.autoAssignCandidateMode ?? null;
      const merchantId = response.autoAssignTargetMerchantId ?? null;
      const principalIds = Array.isArray(response.autoAssignPrincipalIds)
        ? response.autoAssignPrincipalIds.filter(Boolean)
        : [];

      setForm({
        ...DEFAULT_CONFIG,
        ...response,
        autoAssignEnabled,
        autoAssignScope: autoAssignEnabled ? ["merchant"] : [],
        autoAssignScopeLevel: autoAssignEnabled ? "merchant" : null,
        autoAssignTargetType: autoAssignEnabled ? "merchant" : null,
        autoAssignTargetMerchantId: autoAssignEnabled && mode === "MERCHANT_ALL" ? merchantId : null,
        autoAssignTargetName:
          autoAssignEnabled && mode === "MERCHANT_ALL" ? response.autoAssignTargetName ?? null : null,
        autoAssignCandidateMode: autoAssignEnabled ? mode : null,
        autoAssignPrincipalIds: autoAssignEnabled && mode === "PRINCIPAL_LIST" ? principalIds : [],
        smsTemplate: mergeNotificationTemplate(response.smsTemplate, DEFAULT_CONFIG.smsTemplate),
        emailTemplate: mergeNotificationTemplate(response.emailTemplate, DEFAULT_CONFIG.emailTemplate),
        inboxTemplate: mergeNotificationTemplate(response.inboxTemplate, DEFAULT_CONFIG.inboxTemplate),
      });
    } catch (error) {
      notify.error("加载处置配置失败", { description: error instanceof Error ? error.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSubmit = async () => {
    const mode = form.autoAssignCandidateMode === "PRINCIPAL_LIST" ? "PRINCIPAL_LIST" : "MERCHANT_ALL";
    const merchantId = form.autoAssignTargetMerchantId ?? null;
    const principalIds = Array.isArray(form.autoAssignPrincipalIds) ? form.autoAssignPrincipalIds.filter(Boolean) : [];
    if (form.autoAssignEnabled && mode === "MERCHANT_ALL" && !merchantId) {
      setFormError("候选范围为「按商户处理人池」时，需要选择一个商户。");
      return;
    }
    if (form.autoAssignEnabled && mode === "PRINCIPAL_LIST" && principalIds.length === 0) {
      setFormError("候选范围为「指定处理人列表」时，至少需要添加 1 个处理人。");
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      await updateTicketDisposalConfig({
        ...form,
        autoAssignScopeLevel: form.autoAssignEnabled ? "merchant" : null,
        autoAssignCandidateMode: form.autoAssignEnabled ? mode : null,
        autoAssignTargetMerchantId: form.autoAssignEnabled && mode === "MERCHANT_ALL" ? merchantId : null,
        autoAssignTargetName: form.autoAssignEnabled && mode === "MERCHANT_ALL" ? form.autoAssignTargetName ?? null : null,
        autoAssignPrincipalIds: form.autoAssignEnabled && mode === "PRINCIPAL_LIST" ? principalIds : [],
      });
      notify.success("保存成功");
      await loadConfig();
    } catch (error) {
      notify.error("保存处置配置失败", { description: error instanceof Error ? error.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={
          <div className="page-header-start">
            <Button variant="ghost" size="icon" onClick={() => navigate("/ops/tickets")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="page-title">工单处置配置</h1>
          </div>
        }
        actions={
          <Button variant="pageOutline" onClick={() => void loadConfig()} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        }
      />

      {loading ? (
        <div className="rounded-xl border bg-card px-6 py-12 text-center text-sm text-muted-foreground">加载配置中...</div>
      ) : (
        <TicketDisposalConfigForm
          value={form}
          onChange={(next) => {
            setFormError(null);
            setForm(next);
          }}
          onSubmit={() => void handleSubmit()}
          submitting={saving}
          formError={formError}
        />
      )}
    </PageShell>
  );
}
