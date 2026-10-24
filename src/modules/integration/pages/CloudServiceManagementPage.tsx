import { Plus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  TableSurface,
} from "@/shared/components/page";
import {
  createCloudService,
  deleteCloudService,
  getCloudService,
  listCloudServices,
  setCloudServiceEnabled,
  updateCloudService,
  upsertCloudServiceItem,
  type CloudService,
  type CloudServiceItem,
  type CreateCloudServiceCommand,
  type UpdateCloudServiceCommand,
  type UpsertCloudServiceItemCommand,
} from "@/shared/api/integration/cloud-service";
import { getCloudServiceDictionaries } from "@/shared/api/integration/integration-dictionaries";
import { listMessageTemplates } from "@/shared/api/integration/message-template";
import CloudServiceEditorPage from "@/modules/integration/components/CloudServiceEditorPage";
import type {
  AuditConfig,
  FormServiceCode,
  FormServiceItem,
  MailServerConfig,
  SmsTemplateConfig,
  SmsTemplateRelIssue,
} from "@/shared/types/cloud-service-form";
import { notify } from "@/shared/lib/notify";

const formServiceCodeSet: Set<FormServiceCode> = new Set(["mail", "sms", "translation", "audit_media"]);

type CloudAuthShape =
  | {
      accessKeyId: string;
      accessKeySecret: string;
    };

function parseJsonObject(json: string | null | undefined): Record<string, unknown> {
  if (!json || !json.trim()) return {};
  try {
    const v = JSON.parse(json);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function safeString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function normalizePlatformType(
  v: string | null | undefined,
  platformTypeOptions: Array<{ value: string; label: string }>
): string {
  if (!v) return "aliyun";
  const normalized = String(v).trim().toLowerCase();
  if (normalized === "aws" || normalized === "xiangong" || normalized === "autodl") return "email";
  if (!platformTypeOptions.some((opt) => opt.value === normalized)) return "email";
  return normalized;
}

function normalizeServiceCode(v: string | null | undefined): FormServiceCode | null {
  if (!v) return null;
  const normalized = String(v).trim().toLowerCase() as FormServiceCode;
  return formServiceCodeSet.has(normalized) ? normalized : null;
}

function getPlatformNameByType(platformType: string, platformTypeOptions: Array<{ value: string; label: string }>): string {
  return platformTypeOptions.find((opt) => opt.value === platformType)?.label || platformType;
}

function getAllowedServiceCodes(
  platformType: string,
  platformTypeOptions: Array<{ value: string; label: string }>,
  platformServiceCodeMap: Record<string, string[]>
): FormServiceCode[] {
  const serviceCodes = platformServiceCodeMap[normalizePlatformType(platformType, platformTypeOptions)] ?? [];
  return serviceCodes.filter((code): code is FormServiceCode => formServiceCodeSet.has(code as FormServiceCode));
}

export default function CloudServiceManagementPage() {
  const queryClient = useQueryClient();

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [platformType, setPlatformType] = useState<string>("all");

  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<"list" | "create" | "edit">("list");

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    setPageNo(1);
  };
  const dictionaryQuery = useQuery({
    queryKey: ["intCloudServiceDictionaries"],
    queryFn: getCloudServiceDictionaries,
  });
  const platformTypeOptions = useMemo(() => dictionaryQuery.data?.platformTypes ?? [], [dictionaryQuery.data?.platformTypes]);
  const serviceCodeOptions = useMemo(
    () =>
      (dictionaryQuery.data?.serviceCodes ?? [])
        .filter((opt): opt is { value: FormServiceCode; label: string } => formServiceCodeSet.has(opt.value as FormServiceCode)),
    [dictionaryQuery.data]
  );
  const platformServiceCodeMap = useMemo(
    () => dictionaryQuery.data?.platformServiceCodeMap ?? {},
    [dictionaryQuery.data?.platformServiceCodeMap]
  );

  const enabledParam = enabledFilter === "all" ? undefined : enabledFilter === "enabled";
  const platformParam = platformType === "all" ? undefined : platformType;

  const listQuery = useQuery({
    queryKey: ["intCloudServices", pageNo, pageSize, appliedKeyword, enabledFilter, platformType],
    queryFn: () =>
      listCloudServices({
        pageNo,
        pageSize,
        total: requestTotal,
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
        enabled: enabledParam,
        platformType: platformParam,
      }),
  });

  const requestTotal = usePagedTotal(pageNo, listQuery.data?.page?.total);

  useEffect(() => {
    if (!listQuery.isError) return;
    notify.fromError(listQuery.error, "请求失败", "加载失败");
  }, [listQuery.error, listQuery.isError]);

  useEffect(() => {
    if (!dictionaryQuery.isError) return;
    const e = dictionaryQuery.error as unknown;
    notify.error("字典加载失败", { description: (e as Error)?.message || "请求失败" });
  }, [dictionaryQuery.error, dictionaryQuery.isError]);

  const items = listQuery.data?.items ?? [];
  const pageTotal = listQuery.data?.page?.total ?? 0;
  const canNextPage = useMemo(() => {
    if (pageTotal > 0) return pageNo * pageSize < pageTotal;
    return items.length === pageSize;
  }, [items.length, pageNo, pageSize, pageTotal]);
  const totalPages = pageTotal > 0 ? Math.ceil(pageTotal / pageSize) : 0;
  const pageFrom = pageTotal > 0 ? (pageNo - 1) * pageSize + 1 : 0;
  const pageTo = pageTotal > 0 ? Math.min(pageNo * pageSize, pageTotal) : 0;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["intCloudServices"] });
  };

  const toggleEnabledMutation = useMutation({
    mutationFn: (p: { id: string; enabled: boolean }) => setCloudServiceEnabled(p.id, p.enabled),
    onSuccess: async (_data, { enabled }) => {
      notify.success(enabled ? "已启用" : "已禁用");
      await refresh();
    },
    onError: (e) => {
      notify.error("操作失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCloudService(id),
    onSuccess: async () => {
      notify.success("删除成功");
      await refresh();
    },
    onError: (e) => {
      notify.error("删除失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (p: { mode: "create" | "edit"; id?: string; payload: CreateCloudServiceCommand | UpdateCloudServiceCommand }) => {
      if (p.mode === "create") {
        return createCloudService(p.payload as CreateCloudServiceCommand);
      }
      return updateCloudService(p.id!, p.payload as UpdateCloudServiceCommand);
    },
    onSuccess: async () => {
      await refresh();
    },
    onError: (e) => {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const upsertItemMutation = useMutation({
    mutationFn: (p: { cloudServiceId: string; serviceCode: FormServiceCode; payload: UpsertCloudServiceItemCommand }) =>
      upsertCloudServiceItem(p.cloudServiceId, p.serviceCode, p.payload),
    onError: (e) => {
      notify.error("服务项保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    },
  });

  const [editing, setEditing] = useState<CloudService | null>(null);
  const [formPlatformName, setFormPlatformName] = useState("");
  const [formPlatformType, setFormPlatformType] = useState<string>("aliyun");
  const [formPriority, setFormPriority] = useState("100");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formAccessKeyId, setFormAccessKeyId] = useState("");
  const [formAccessKeySecret, setFormAccessKeySecret] = useState("");
  const [formServices, setFormServices] = useState<FormServiceItem[]>([]);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [mailDialogOpen, setMailDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [mailConfig, setMailConfig] = useState<MailServerConfig>({
    smtpHost: "",
    smtpPort: "465",
    username: "",
    passwordOrAuthCode: "",
    useSsl: true,
  });
  const [smsConfig, setSmsConfig] = useState<SmsTemplateConfig>({
    appId: "",
    templateRels: [],
  });
  const [auditConfig, setAuditConfig] = useState<AuditConfig>({
    callbackUrl: "",
    imagePolicy: "default",
    audioPolicy: "default",
    videoPolicy: "default",
  });
  const [mailDialogSnapshot, setMailDialogSnapshot] = useState<MailServerConfig | null>(null);
  const [smsDialogSnapshot, setSmsDialogSnapshot] = useState<SmsTemplateConfig | null>(null);
  const [auditDialogSnapshot, setAuditDialogSnapshot] = useState<AuditConfig | null>(null);
  const [formExitConfirmOpen, setFormExitConfirmOpen] = useState(false);
  const [formInitialSnapshot, setFormInitialSnapshot] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const hasSmsService = formServices.some((service) => service.code === "sms");

  const smsDomesticTemplatesQuery = useQuery({
    queryKey: ["intMessageTemplates", "sms", "domestic"],
    queryFn: () => listMessageTemplates({ pageNo: 1, pageSize: 200, templateType: "sms", region: "domestic" }),
    enabled: hasSmsService && (view === "create" || view === "edit"),
  });
  const smsInternationalTemplatesQuery = useQuery({
    queryKey: ["intMessageTemplates", "sms", "international"],
    queryFn: () => listMessageTemplates({ pageNo: 1, pageSize: 200, templateType: "sms", region: "international" }),
    enabled: hasSmsService && (view === "create" || view === "edit"),
  });

  const smsDomesticTemplateOptions = useMemo(
    () =>
      (smsDomesticTemplatesQuery.data?.items ?? []).map((t) => ({
        value: t.id,
        label: `${t.templateName || t.templateCode}（${t.externalTemplateId || "-"}）`,
      })),
    [smsDomesticTemplatesQuery.data]
  );
  const smsInternationalTemplateOptions = useMemo(
    () =>
      (smsInternationalTemplatesQuery.data?.items ?? []).map((t) => ({
        value: t.id,
        label: `${t.templateName || t.templateCode}（${t.externalTemplateId || "-"}）`,
      })),
    [smsInternationalTemplatesQuery.data]
  );
  const smsDomesticTemplateOptionsByCode = useMemo(
    () =>
      (smsDomesticTemplatesQuery.data?.items ?? []).reduce<Record<string, { value: string; label: string }[]>>((acc, t) => {
        if (!t.templateCode) return acc;
        const key = t.templateCode;
        const option = {
          value: t.id,
          label: `${t.templateName || t.templateCode}（${t.externalTemplateId || "-"}）`,
        };
        acc[key] = [...(acc[key] ?? []), option];
        return acc;
      }, {}),
    [smsDomesticTemplatesQuery.data]
  );
  const smsInternationalTemplateOptionsByCode = useMemo(
    () =>
      (smsInternationalTemplatesQuery.data?.items ?? []).reduce<Record<string, { value: string; label: string }[]>>((acc, t) => {
        if (!t.templateCode) return acc;
        const key = t.templateCode;
        const option = {
          value: t.id,
          label: `${t.templateName || t.templateCode}（${t.externalTemplateId || "-"}）`,
        };
        acc[key] = [...(acc[key] ?? []), option];
        return acc;
      }, {}),
    [smsInternationalTemplatesQuery.data]
  );
  const smsTemplateCodeOptions = useMemo(() => {
    const labelMap = new Map<string, string>();
    (dictionaryQuery.data?.templateCodes ?? []).forEach((opt) => labelMap.set(opt.value, opt.label));
    const domesticCodeSet = new Set(
      (smsDomesticTemplatesQuery.data?.items ?? []).map((t) => t.templateCode).filter((code): code is string => !!code)
    );
    const internationalCodeSet = new Set(
      (smsInternationalTemplatesQuery.data?.items ?? []).map((t) => t.templateCode).filter((code): code is string => !!code)
    );
    const codeMap = new Map<string, string>();
    (smsDomesticTemplatesQuery.data?.items ?? []).forEach((t) => {
      if (t.templateCode && internationalCodeSet.has(t.templateCode)) {
        codeMap.set(t.templateCode, labelMap.get(t.templateCode) || t.templateName || t.templateCode);
      }
    });
    (smsInternationalTemplatesQuery.data?.items ?? []).forEach((t) => {
      if (t.templateCode && domesticCodeSet.has(t.templateCode)) {
        codeMap.set(t.templateCode, codeMap.get(t.templateCode) || labelMap.get(t.templateCode) || t.templateName || t.templateCode);
      }
    });
    return Array.from(codeMap.entries())
      .map(([value, label]) => ({ value, label: value === label ? label : `${label}（${value}）` }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [dictionaryQuery.data?.templateCodes, smsDomesticTemplatesQuery.data?.items, smsInternationalTemplatesQuery.data?.items]);
  const smsDomesticTemplateIdByCode = useMemo(
    () =>
      new Map(
        (smsDomesticTemplatesQuery.data?.items ?? [])
          .filter((t) => !!t.templateCode)
          .map((t) => [t.templateCode, t.id] as const)
      ),
    [smsDomesticTemplatesQuery.data?.items]
  );
  const smsInternationalTemplateIdByCode = useMemo(
    () =>
      new Map(
        (smsInternationalTemplatesQuery.data?.items ?? [])
          .filter((t) => !!t.templateCode)
          .map((t) => [t.templateCode, t.id] as const)
      ),
    [smsInternationalTemplatesQuery.data?.items]
  );
  const smsDomesticTemplateCodeById = useMemo(
    () =>
      new Map(
        (smsDomesticTemplatesQuery.data?.items ?? [])
          .filter((t) => !!t.templateCode)
          .map((t) => [t.id, t.templateCode] as const)
      ),
    [smsDomesticTemplatesQuery.data?.items]
  );
  const smsInternationalTemplateCodeById = useMemo(
    () =>
      new Map(
        (smsInternationalTemplatesQuery.data?.items ?? [])
          .filter((t) => !!t.templateCode)
          .map((t) => [t.id, t.templateCode] as const)
      ),
    [smsInternationalTemplatesQuery.data?.items]
  );

  const buildFormSnapshot = (args: {
    platformName: string;
    platformType: string;
    priority: string;
    enabled: boolean;
    services: FormServiceItem[];
    accessKeyId: string;
    accessKeySecret: string;
  }) =>
    JSON.stringify({
      platformName: args.platformName.trim(),
      platformType: args.platformType,
      priority: args.priority.trim(),
      enabled: args.enabled,
      auth: {
        accessKeyId: args.accessKeyId.trim(),
        accessKeySecret: args.accessKeySecret.trim(),
      },
      services: args.services
        .map((item) => ({ code: item.code, name: item.name, enabled: item.enabled }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      smsConfig,
      mailConfig,
      auditConfig,
    });

  const resetForm = () => {
    setFormPlatformName("");
    setFormPlatformType("aliyun");
    setFormPriority("100");
    setFormEnabled(true);
    setFormAccessKeyId("");
    setFormAccessKeySecret("");
    setFormServices([]);
    setAddServiceOpen(false);
    setMailDialogOpen(false);
    setSmsDialogOpen(false);
    setAuditDialogOpen(false);
    setMailConfig({
      smtpHost: "",
      smtpPort: "465",
      username: "",
      passwordOrAuthCode: "",
      useSsl: true,
    });
    setSmsConfig({
      appId: "",
      templateRels: [],
    });
    setAuditConfig({
      callbackUrl: "",
      imagePolicy: "default",
      audioPolicy: "default",
      videoPolicy: "default",
    });
    setMailDialogSnapshot(null);
    setSmsDialogSnapshot(null);
    setAuditDialogSnapshot(null);
  };

  const hasFormChanges = () =>
    buildFormSnapshot({
      platformName: formPlatformName,
      platformType: formPlatformType,
      priority: formPriority,
      enabled: formEnabled,
      accessKeyId: formAccessKeyId,
      accessKeySecret: formAccessKeySecret,
      services: formServices,
    }) !== formInitialSnapshot;

  const handlePlatformTypeChange = (nextType: string) => {
    const nextDefaultName = getPlatformNameByType(nextType, platformTypeOptions);
    const nextAllowedSet = new Set(getAllowedServiceCodes(nextType, platformTypeOptions, platformServiceCodeMap));
    const removedServiceNames = formServices
      .filter((s) => !nextAllowedSet.has(s.code))
      .map((s) => s.name);
    setFormPlatformType(nextType);
    setFormServices((prev) => prev.filter((s) => nextAllowedSet.has(s.code)));
    if (removedServiceNames.length > 0) {
      notify.success("提示", { description: `切换平台后，已移除不支持的服务：${removedServiceNames.join("、")}` });
    }
    setFormPlatformName((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return nextDefaultName;
      const currentDefaultName = getPlatformNameByType(formPlatformType, platformTypeOptions);
      if (trimmed === currentDefaultName) return nextDefaultName;
      return prev;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setEditDetailAppliedToken(null);
    resetForm();
    const defaultPlatformType = "aliyun";
    const defaultPlatformName = getPlatformNameByType(defaultPlatformType, platformTypeOptions);
    setFormPlatformType(defaultPlatformType);
    setFormPlatformName(defaultPlatformName);
    setFormInitialSnapshot(
      buildFormSnapshot({
        platformName: defaultPlatformName,
        platformType: defaultPlatformType,
        priority: "100",
        enabled: true,
        accessKeyId: "",
        accessKeySecret: "",
        services: [],
      })
    );
    setView("create");
  };

  const openEdit = (cs: CloudService) => {
    const normalizedPlatformType = normalizePlatformType(cs.platformType, platformTypeOptions);
    const initialPlatformName = (cs.platformName || "").trim() || getPlatformNameByType(normalizedPlatformType, platformTypeOptions);
    setEditing(cs);
    setEditDetailAppliedToken(null);
    setFormPlatformName(initialPlatformName);
    setFormPlatformType(normalizedPlatformType);
    setFormPriority(String(cs.priority ?? 100));
    setFormEnabled(cs.enabled !== false);
    setFormAccessKeyId("");
    setFormAccessKeySecret("");
    setFormServices([]);
    setAddServiceOpen(false);
    setFormInitialSnapshot(
      buildFormSnapshot({
        platformName: initialPlatformName,
        platformType: normalizedPlatformType,
        priority: String(cs.priority ?? 100),
        enabled: cs.enabled !== false,
        accessKeyId: "",
        accessKeySecret: "",
        services: [],
      })
    );
    setView("edit");
  };

  const serviceNameMap = useMemo<Record<FormServiceCode, string>>(
    () => ({
      mail: "邮件",
      sms: "短信发送",
      translation: "翻译",
      audit_media: "内容审核",
    }),
    []
  );
  const allowedServiceCodes = useMemo(
    () => getAllowedServiceCodes(formPlatformType, platformTypeOptions, platformServiceCodeMap),
    [formPlatformType, platformServiceCodeMap, platformTypeOptions]
  );

  const availableServices = useMemo(
    () =>
      serviceCodeOptions.filter(
        (opt) => allowedServiceCodes.includes(opt.value) && !formServices.some((s) => s.code === opt.value)
      ),
    [allowedServiceCodes, formServices, serviceCodeOptions]
  );

  const handleAddService = (code: FormServiceCode) => {
    if (!allowedServiceCodes.includes(code)) {
      notify.error("操作失败", { description: "当前平台不支持该服务类型" });
      return;
    }
    setFormServices((prev) => [
      ...prev,
      { id: Date.now().toString(), code, name: serviceNameMap[code], enabled: true },
    ]);
    setAddServiceOpen(false);
  };

  const handleRemoveService = (id: string) => {
    setFormServices((prev) => prev.filter((item) => item.id !== id));
  };

  const buildPlatformAuthPayload = (): CloudAuthShape | null => {
    const accessKeyId = formAccessKeyId.trim();
    const accessKeySecret = formAccessKeySecret.trim();
    if (formPlatformType === "aliyun" || formPlatformType === "tencent") {
      if (!accessKeyId && !accessKeySecret) return null;
      return {
        accessKeyId,
        accessKeySecret,
      };
    }
    return null;
  };

  const validatePlatformAuth = (mode: "create" | "edit"): boolean => {
    const accessKeyId = formAccessKeyId.trim();
    const accessKeySecret = formAccessKeySecret.trim();
    const isEdit = mode === "edit" && !!editing;
    const hasExistingAuth = isEdit ? editing!.hasAuth : false;
    const platformChanged = isEdit ? editing!.platformType !== formPlatformType : false;

    if (formPlatformType === "aliyun" || formPlatformType === "tencent") {
      const hasInput = !!accessKeyId || !!accessKeySecret;
      if (hasInput && (!accessKeyId || !accessKeySecret)) {
        setFormError("请完整填写 accessKeyId 与 accessKeySecret");
        return false;
      }
      const mustInput = mode === "create" || !hasExistingAuth || platformChanged;
      if (mustInput && (!accessKeyId || !accessKeySecret)) {
        setFormError("该平台需要填写 accessKeyId 与 accessKeySecret");
        return false;
      }
      return true;
    }

    return true;
  };

  const buildAuthJsonEnc = (): string | null => {
    const platformAuth = buildPlatformAuthPayload();
    if (!platformAuth) return null;
    return JSON.stringify({ platformAuth });
  };

  const validateMailServiceConfig = (requirePassword: boolean): boolean => {
    if (!mailConfig.smtpHost.trim()) {
      setFormError("请输入 SMTP 主机");
      return false;
    }
    const smtpPortNum = Number(mailConfig.smtpPort);
    if (Number.isNaN(smtpPortNum)) {
      setFormError("SMTP 端口必须是数字");
      return false;
    }
    if (!mailConfig.username.trim()) {
      setFormError("请输入发送邮箱");
      return false;
    }
    if (requirePassword && !mailConfig.passwordOrAuthCode.trim()) {
      setFormError("请输入密码/授权码");
      return false;
    }
    return true;
  };

  const validateSmsServiceConfig = (): boolean => {
    if (!smsConfig.appId.trim()) {
      setFormError("短信配置中的应用ID为必填");
      return false;
    }
    const usedTemplateCodes = new Set<string>();
    for (const rel of smsConfig.templateRels) {
      const templateCode = rel.templateCode.trim();
      if (!templateCode) {
        setFormError("短信模板关联中存在空的 templateCode");
        return false;
      }
      if (usedTemplateCodes.has(templateCode)) {
        setFormError(`短信模板关联中存在重复的业务模板编码：${templateCode}`);
        return false;
      }
      usedTemplateCodes.add(templateCode);
      if (rel.enabled) {
        if (!rel.domesticMessageTemplateId.trim() || !rel.internationalMessageTemplateId.trim()) {
          setFormError(`请完整配置 ${templateCode} 的国内/国际消息模板`);
          return false;
        }
      }
      if (rel.domesticMessageTemplateId.trim()) {
        const domesticTemplateCode = smsDomesticTemplateCodeById.get(rel.domesticMessageTemplateId.trim());
        if (domesticTemplateCode !== templateCode) {
          setFormError(`国内消息模板必须与业务模板编码 ${templateCode} 保持一致`);
          return false;
        }
      }
      if (rel.internationalMessageTemplateId.trim()) {
        const internationalTemplateCode = smsInternationalTemplateCodeById.get(rel.internationalMessageTemplateId.trim());
        if (internationalTemplateCode !== templateCode) {
          setFormError(`国际消息模板必须与业务模板编码 ${templateCode} 保持一致`);
          return false;
        }
      }
    }
    return true;
  };

  const validateAuditServiceConfig = (): boolean => {
    if (!auditConfig.callbackUrl.trim()) {
      setFormError("内容审核回调URL必填");
      return false;
    }
    if (!auditConfig.imagePolicy.trim() || !auditConfig.audioPolicy.trim() || !auditConfig.videoPolicy.trim()) {
      setFormError("内容审核策略必填");
      return false;
    }
    return true;
  };

  const buildSmsServicePayload = (service: FormServiceItem): UpsertCloudServiceItemCommand => ({
    serviceName: service.name,
    enabled: service.enabled,
    configJson: JSON.stringify({
      appId: smsConfig.appId.trim(),
    }),
    templateRels: smsConfig.templateRels.map((r) => ({
      templateCode: r.templateCode.trim(),
      domesticMessageTemplateId: r.domesticMessageTemplateId.trim() ? r.domesticMessageTemplateId.trim() : null,
      internationalMessageTemplateId: r.internationalMessageTemplateId.trim() ? r.internationalMessageTemplateId.trim() : null,
      domesticSignName: r.domesticSignName.trim() ? r.domesticSignName.trim() : null,
      internationalSignName: r.internationalSignName.trim() ? r.internationalSignName.trim() : null,
      enabled: true,
    })),
    secretJsonEnc: null,
    clearSecret: null,
  });

  const validateFormServiceItems = (mode: "create" | "edit"): boolean => {
    for (const service of formServices) {
      if (service.code === "mail") {
        const requirePassword = mode === "create" || (!hasExistingMailSecret && !mailConfig.passwordOrAuthCode.trim());
        if (!validateMailServiceConfig(requirePassword)) {
          return false;
        }
        continue;
      }
      if (service.code === "sms") {
        if (!validateSmsServiceConfig()) {
          return false;
        }
        continue;
      }
      if (service.code === "audit_media") {
        if (!validateAuditServiceConfig()) {
          return false;
        }
      }
    }
    return true;
  };

  const cloneMailConfig = (value: MailServerConfig): MailServerConfig => ({ ...value });
  const cloneSmsConfig = (value: SmsTemplateConfig): SmsTemplateConfig => ({
    ...value,
    templateRels: value.templateRels.map((item) => ({ ...item })),
  });
  const cloneAuditConfig = (value: AuditConfig): AuditConfig => ({ ...value });

  const reloadEditDetail = async () => {
    if (view !== "edit" || !editing?.id) {
      return;
    }
    setEditDetailAppliedToken(null);
    await queryClient.invalidateQueries({ queryKey: ["intCloudServiceEditDetail", editing.id] });
  };

  const handleMailDialogOpenChange = (open: boolean) => {
    if (open) {
      setMailDialogSnapshot(cloneMailConfig(mailConfig));
      setMailDialogOpen(true);
      void reloadEditDetail();
      return;
    }
    if (mailDialogSnapshot) {
      setMailConfig(cloneMailConfig(mailDialogSnapshot));
    }
    setMailDialogOpen(false);
    setMailDialogSnapshot(null);
    void reloadEditDetail();
  };

  const handleSmsDialogOpenChange = (open: boolean) => {
    if (open) {
      setSmsDialogSnapshot(cloneSmsConfig(smsConfig));
      setSmsDialogOpen(true);
      return;
    }
    if (smsDialogSnapshot) {
      setSmsConfig(cloneSmsConfig(smsDialogSnapshot));
    }
    setSmsDialogOpen(false);
    setSmsDialogSnapshot(null);
  };

  const handleRetrySmsResources = () => {
    if (view === "edit" && editing?.id) {
      void reloadEditDetail();
    }
    void smsDomesticTemplatesQuery.refetch();
    void smsInternationalTemplatesQuery.refetch();
  };

  const handleAuditDialogOpenChange = (open: boolean) => {
    if (open) {
      setAuditDialogSnapshot(cloneAuditConfig(auditConfig));
      setAuditDialogOpen(true);
      void reloadEditDetail();
      return;
    }
    if (auditDialogSnapshot) {
      setAuditConfig(cloneAuditConfig(auditDialogSnapshot));
    }
    setAuditDialogOpen(false);
    setAuditDialogSnapshot(null);
    void reloadEditDetail();
  };

  const upsertFormServiceItems = async (cloudServiceId: string, mode: "create" | "edit") => {
    for (const service of formServices) {
      let payload: UpsertCloudServiceItemCommand;
      if (service.code === "mail") {
        payload = {
          serviceName: service.name,
          enabled: service.enabled,
          configJson: JSON.stringify({
            smtpHost: mailConfig.smtpHost.trim(),
            smtpPort: Number(mailConfig.smtpPort),
            username: mailConfig.username.trim(),
            useSsl: mailConfig.useSsl,
          }),
          secretJsonEnc: mailConfig.passwordOrAuthCode.trim() ? mailConfig.passwordOrAuthCode.trim() : null,
          clearSecret: null,
        };
      } else if (service.code === "sms") {
        payload = buildSmsServicePayload(service);
      } else if (service.code === "audit_media") {
        payload = {
          serviceName: service.name,
          enabled: service.enabled,
          configJson: JSON.stringify({
            asyncCallbackUrl: auditConfig.callbackUrl.trim(),
            imagePolicyCode: auditConfig.imagePolicy.trim(),
            vodAudioPolicyCode: auditConfig.audioPolicy.trim(),
            vodVideoPolicyCode: auditConfig.videoPolicy.trim(),
          }),
          secretJsonEnc: null,
          clearSecret: null,
        };
      } else {
        payload = {
          serviceName: service.name,
          enabled: service.enabled,
          configJson: "{}",
          secretJsonEnc: null,
          clearSecret: null,
        };
      }
      await upsertItemMutation.mutateAsync({ cloudServiceId, serviceCode: service.code, payload });
    }
  };

  const handleSaveSmsConfig = async () => {
    if (!validateSmsServiceConfig()) {
      return;
    }
    setFormError(null);

    const smsService = formServices.find((service) => service.code === "sms");
    if (!smsService) {
      notify.error("保存失败", { description: "当前未启用短信发送服务" });
      return;
    }

    if (view === "edit" && editing?.id) {
      try {
        await upsertItemMutation.mutateAsync({
          cloudServiceId: editing.id,
          serviceCode: "sms",
          payload: buildSmsServicePayload(smsService),
        });
        notify.success("保存成功");
        await refresh();
        await queryClient.invalidateQueries({ queryKey: ["intCloudServiceEditDetail", editing.id] });
        setSmsDialogOpen(false);
      } catch {
        // Error toast is handled in upsertItemMutation.onError.
      }
      return;
    }

    setSmsDialogOpen(false);
  };

  const buildSmsTemplateRel = (templateCode = "", previousRel?: SmsTemplateConfig["templateRels"][number]) => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    templateCode,
    domesticMessageTemplateId: templateCode ? smsDomesticTemplateIdByCode.get(templateCode) || "" : "",
    internationalMessageTemplateId: templateCode ? smsInternationalTemplateIdByCode.get(templateCode) || "" : "",
    domesticSignName: previousRel?.domesticSignName || "",
    internationalSignName: previousRel?.internationalSignName || "",
    enabled: true,
  });

  const handleAddSmsTemplateRel = () => {
    const previousRel = smsConfig.templateRels[smsConfig.templateRels.length - 1];
    const usedCodes = new Set(smsConfig.templateRels.map((item) => item.templateCode).filter(Boolean));
    const nextCode = smsTemplateCodeOptions.find((opt) => !usedCodes.has(opt.value))?.value || "";
    setSmsConfig((prev) => ({
      ...prev,
      templateRels: [...prev.templateRels, buildSmsTemplateRel(nextCode, previousRel)],
    }));
  };

  const handleSmsTemplateCodeChange = (relId: string, templateCode: string) => {
    setSmsConfig((prev) => ({
      ...prev,
      templateRels: prev.templateRels.map((item) =>
        item.id === relId
          ? {
              ...item,
              templateCode,
              domesticMessageTemplateId: templateCode ? smsDomesticTemplateIdByCode.get(templateCode) || "" : "",
              internationalMessageTemplateId: templateCode ? smsInternationalTemplateIdByCode.get(templateCode) || "" : "",
            }
          : item
      ),
    }));
  };

  const handleAddAllSmsTemplateRels = () => {
    const previousRel = smsConfig.templateRels[smsConfig.templateRels.length - 1];
    const existingMap = new Map(smsConfig.templateRels.map((item) => [item.templateCode, item]));
    const merged = smsTemplateCodeOptions.map((opt) => existingMap.get(opt.value) || buildSmsTemplateRel(opt.value, previousRel));
    setSmsConfig((prev) => ({
      ...prev,
      templateRels: merged,
    }));
  };

  const handleSaveMailConfig = () => {
    const requirePassword = view === "create" || (!hasExistingMailSecret && !mailConfig.passwordOrAuthCode.trim());
    if (!validateMailServiceConfig(requirePassword)) {
      return;
    }
    setFormError(null);
    setMailDialogOpen(false);
  };

  const handleSaveAuditConfig = () => {
    if (!validateAuditServiceConfig()) {
      return;
    }
    setFormError(null);
    setAuditDialogOpen(false);
  };

  const submitCloudService = async () => {
    try {
      if (!formPlatformType) {
        setFormError("请选择平台类型");
        return;
      }
      const platformName = formPlatformName.trim() || getPlatformNameByType(formPlatformType, platformTypeOptions);
      const priorityNum = Number(formPriority);
      if (Number.isNaN(priorityNum)) {
        setFormError("优先级必须是数字");
        return;
      }
      if (!validatePlatformAuth("edit")) {
        return;
      }
      if (!validateFormServiceItems("edit")) {
        return;
      }
      const authJsonEnc = buildAuthJsonEnc();
      const payload: UpdateCloudServiceCommand = {
        platformName,
        platformType: formPlatformType,
        priority: priorityNum,
        enabled: formEnabled,
      };
      if (authJsonEnc) {
        payload.authJsonEnc = authJsonEnc;
      }

      await saveMutation.mutateAsync({
        mode: "edit",
        id: editing!.id,
        payload,
      });
      await upsertFormServiceItems(editing!.id, "edit");
      notify.success("保存成功");
      setView("list");
      setEditing(null);
    } catch {
      // Validation and mutation toasts are handled closer to the failure point.
    }
  };
  const submitCreateCloudService = async () => {
    try {
      if (!formPlatformType) {
        setFormError("请选择平台类型");
        return;
      }
      const platformName = formPlatformName.trim() || getPlatformNameByType(formPlatformType, platformTypeOptions);
      const priorityNum = Number(formPriority);
      if (Number.isNaN(priorityNum)) {
        setFormError("优先级必须是数字");
        return;
      }
      if (!validatePlatformAuth("create")) {
        return;
      }
      if (!validateFormServiceItems("create")) {
        return;
      }
      const authJsonEnc = buildAuthJsonEnc();
      const createdId = await saveMutation.mutateAsync({
        mode: "create",
        payload: {
          platformName,
          platformType: formPlatformType,
          priority: priorityNum,
          enabled: formEnabled,
          authJsonEnc,
        },
      });
      await upsertFormServiceItems(createdId as string, "create");
      notify.success("创建成功");
      resetForm();
      setEditing(null);
      setView("list");
    } catch {
      // Validation and mutation toasts are handled closer to the failure point.
    }
  };

  const handleFormBack = () => {
    if (hasFormChanges()) {
      setFormExitConfirmOpen(true);
      return;
    }
    resetForm();
    setEditing(null);
    setView("list");
  };

  const handleConfirmDiscard = () => {
    resetForm();
    setEditing(null);
    setView("list");
    setFormExitConfirmOpen(false);
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState<CloudService | null>(null);
  const [editDetailAppliedToken, setEditDetailAppliedToken] = useState<string | null>(null);
  const openDelete = (cs: CloudService) => {
    setDeleting(cs);
    setDeleteConfirmOpen(true);
  };
  const editDetailQuery = useQuery({
    queryKey: ["intCloudServiceEditDetail", editing?.id],
    queryFn: () => getCloudService(editing!.id),
    enabled: view === "edit" && !!editing?.id,
  });
  const hasExistingMailSecret = useMemo(
    () =>
      (editDetailQuery.data?.items ?? []).some(
        (it: CloudServiceItem) => normalizeServiceCode(it.serviceCode) === "mail" && it.hasSecret
      ),
    [editDetailQuery.data]
  );
  const smsConfigLoading = view === "edit" && !!editing?.id && editDetailQuery.isFetching && !editDetailQuery.data;
  const smsTemplateOptionsLoading =
    hasSmsService &&
    ((smsDomesticTemplatesQuery.isFetching && !smsDomesticTemplatesQuery.data) ||
      (smsInternationalTemplatesQuery.isFetching && !smsInternationalTemplatesQuery.data));
  const smsTemplateOptionsError = hasSmsService && (smsDomesticTemplatesQuery.isError || smsInternationalTemplatesQuery.isError);
  const smsTemplateRelsIssues = useMemo<Record<string, SmsTemplateRelIssue[]>>(() => {
    if (!hasSmsService || smsTemplateOptionsLoading || smsTemplateOptionsError) {
      return {};
    }

    const issues: Record<string, SmsTemplateRelIssue[]> = {};
    for (const rel of smsConfig.templateRels) {
      const relIssues: SmsTemplateRelIssue[] = [];
      const templateCode = rel.templateCode.trim();
      const domesticMessageTemplateId = rel.domesticMessageTemplateId.trim();
      const internationalMessageTemplateId = rel.internationalMessageTemplateId.trim();

      if (!templateCode) {
        relIssues.push({ level: "error", message: "请选择业务模板后再配置短信模板。" });
      }

      if (templateCode && !domesticMessageTemplateId) {
        relIssues.push({ level: "warning", message: "请补全国内消息模板。" });
      } else if (domesticMessageTemplateId) {
        const domesticTemplateCode = smsDomesticTemplateCodeById.get(domesticMessageTemplateId);
        if (!domesticTemplateCode) {
          relIssues.push({ level: "warning", message: "原国内模板不存在或尚未同步，请重新选择。" });
        } else if (templateCode && domesticTemplateCode !== templateCode) {
          relIssues.push({ level: "error", message: `当前国内模板与业务模板 ${templateCode} 不匹配，请重新选择。` });
        }
      }

      if (templateCode && !internationalMessageTemplateId) {
        relIssues.push({ level: "warning", message: "请补全国际消息模板。" });
      } else if (internationalMessageTemplateId) {
        const internationalTemplateCode = smsInternationalTemplateCodeById.get(internationalMessageTemplateId);
        if (!internationalTemplateCode) {
          relIssues.push({ level: "warning", message: "原国际模板不存在或尚未同步，请重新选择。" });
        } else if (templateCode && internationalTemplateCode !== templateCode) {
          relIssues.push({ level: "error", message: `当前国际模板与业务模板 ${templateCode} 不匹配，请重新选择。` });
        }
      }

      if (relIssues.length > 0) {
        issues[rel.id] = relIssues;
      }
    }

    return issues;
  }, [
    hasSmsService,
    smsConfig.templateRels,
    smsDomesticTemplateCodeById,
    smsInternationalTemplateCodeById,
    smsTemplateOptionsError,
    smsTemplateOptionsLoading,
  ]);
  const smsHasTemplateRelIssues = Object.keys(smsTemplateRelsIssues).length > 0;
  const smsDialogSaveDisabled =
    upsertItemMutation.isPending || smsConfigLoading || smsTemplateOptionsLoading || smsTemplateOptionsError || smsHasTemplateRelIssues;
  const smsEntryDisabled = view === "edit" && (smsConfigLoading || (editDetailQuery.isError && !editDetailQuery.data));
  const smsEntryDisabledReason = smsConfigLoading
    ? "短信配置正在加载，请稍候"
    : editDetailQuery.isError && !editDetailQuery.data
      ? "短信配置加载失败，请先重试页面数据"
      : "设置模板";

  useEffect(() => {
    if (view !== "edit" || !editing?.id || !editDetailQuery.data) return;
    const applyToken = `${editing.id}:${editDetailQuery.dataUpdatedAt}`;
    if (editDetailAppliedToken === applyToken) return;

    const detailItems = editDetailQuery.data.items ?? [];
    const normalizedItems = detailItems
      .map((it) => ({ ...it, normalizedServiceCode: normalizeServiceCode(it.serviceCode) }))
      .filter((it) => !!it.normalizedServiceCode);
    const nextServices: FormServiceItem[] = normalizedItems
      .filter((it) => allowedServiceCodes.includes(it.normalizedServiceCode!))
      .map((it) => ({
        id: it.id,
        code: it.normalizedServiceCode!,
        name: it.serviceName || serviceNameMap[it.normalizedServiceCode!] || it.serviceCode,
        enabled: it.enabled !== false,
      }));

    const mailItem = normalizedItems.find((it) => it.normalizedServiceCode === "mail");
    const smsItem = normalizedItems.find((it) => it.normalizedServiceCode === "sms");
    const auditItem = normalizedItems.find((it) => it.normalizedServiceCode === "audit_media");

    const mailCfg = parseJsonObject(mailItem?.configJson);
    const smsCfg = parseJsonObject(smsItem?.configJson);
    const auditCfg = parseJsonObject(auditItem?.configJson);

    const nextMailConfig: MailServerConfig = {
      smtpHost: safeString(mailCfg.smtpHost),
      smtpPort: safeString(mailCfg.smtpPort || "465"),
      username: safeString(mailCfg.username),
      passwordOrAuthCode: "",
      useSsl: Boolean(mailCfg.useSsl),
    };
    const nextSmsConfig: SmsTemplateConfig = {
      appId: safeString(smsCfg.appId),
      templateRels: (smsItem?.templateRels ?? []).map((r) => ({
        id: r.id,
        templateCode: safeString(r.templateCode),
        domesticMessageTemplateId: safeString(r.domesticMessageTemplateId),
        internationalMessageTemplateId: safeString(r.internationalMessageTemplateId),
        domesticSignName: safeString(r.domesticSignName),
        internationalSignName: safeString(r.internationalSignName),
        enabled: true,
      })),
    };
    const nextAuditConfig: AuditConfig = {
      callbackUrl: safeString(auditCfg.asyncCallbackUrl),
      imagePolicy: safeString(auditCfg.imagePolicyCode),
      audioPolicy: safeString(auditCfg.vodAudioPolicyCode),
      videoPolicy: safeString(auditCfg.vodVideoPolicyCode),
    };

    setFormServices(nextServices);
    setMailConfig(nextMailConfig);
    setSmsConfig(nextSmsConfig);
    setAuditConfig(nextAuditConfig);
    setFormInitialSnapshot(
      JSON.stringify({
        platformName: formPlatformName.trim(),
        platformType: formPlatformType,
        priority: formPriority.trim(),
        enabled: formEnabled,
        auth: {
          accessKeyId: formAccessKeyId.trim(),
          accessKeySecret: formAccessKeySecret.trim(),
        },
        services: nextServices
          .map((item) => ({ code: item.code, name: item.name, enabled: item.enabled }))
          .sort((a, b) => a.code.localeCompare(b.code)),
        mailConfig: nextMailConfig,
        smsConfig: nextSmsConfig,
        auditConfig: nextAuditConfig,
      })
    );
    setEditDetailAppliedToken(applyToken);
  }, [
    allowedServiceCodes,
    editDetailAppliedToken,
    editDetailQuery.data,
    editDetailQuery.dataUpdatedAt,
    editing?.id,
    formAccessKeyId,
    formAccessKeySecret,
    formEnabled,
    formPlatformName,
    formPlatformType,
    formPriority,
    serviceNameMap,
    view,
  ]);

  if (view === "create" || view === "edit") {
    return (
      <CloudServiceEditorPage
        mode={view}
        editingHasAuth={editing?.hasAuth === true}
        platformTypeOptions={platformTypeOptions}
        formPlatformName={formPlatformName}
        onFormPlatformNameChange={setFormPlatformName}
        formPlatformType={formPlatformType}
        onPlatformTypeChange={handlePlatformTypeChange}
        formAccessKeyId={formAccessKeyId}
        onFormAccessKeyIdChange={setFormAccessKeyId}
        formAccessKeySecret={formAccessKeySecret}
        onFormAccessKeySecretChange={setFormAccessKeySecret}
        formPriority={formPriority}
        onFormPriorityChange={setFormPriority}
        formEnabled={formEnabled}
        onFormEnabledChange={setFormEnabled}
        formServices={formServices}
        onFormServicesChange={setFormServices}
        addServiceOpen={addServiceOpen}
        onAddServiceOpenChange={setAddServiceOpen}
        availableServices={availableServices}
        serviceNameMap={serviceNameMap}
        onAddService={handleAddService}
        onRemoveService={handleRemoveService}
        editDetailLoading={editDetailQuery.isFetching}
        editDetailError={editDetailQuery.isError}
        onBack={handleFormBack}
        onSave={view === "create" ? submitCreateCloudService : submitCloudService}
        saveDisabled={saveMutation.isPending || (view === "edit" && editDetailQuery.isFetching)}
        formError={formError}
        formExitConfirmOpen={formExitConfirmOpen}
        onFormExitConfirmOpenChange={setFormExitConfirmOpen}
        onConfirmDiscard={handleConfirmDiscard}
        mailDialogOpen={mailDialogOpen}
        onMailDialogOpenChange={handleMailDialogOpenChange}
        mailConfig={mailConfig}
        onMailConfigChange={setMailConfig}
        onSaveMailConfig={handleSaveMailConfig}
        smsDialogOpen={smsDialogOpen}
        onSmsDialogOpenChange={handleSmsDialogOpenChange}
        smsEntryDisabled={smsEntryDisabled}
        smsEntryDisabledReason={smsEntryDisabledReason}
        smsConfigLoading={smsConfigLoading}
        smsTemplateOptionsLoading={smsTemplateOptionsLoading}
        smsTemplateOptionsError={smsTemplateOptionsError}
        smsTemplateRelIssues={smsTemplateRelsIssues}
        smsTemplateCodeOptions={smsTemplateCodeOptions}
        smsDomesticTemplateOptionsByCode={smsDomesticTemplateOptionsByCode}
        smsInternationalTemplateOptionsByCode={smsInternationalTemplateOptionsByCode}
        smsConfig={smsConfig}
        onSmsConfigChange={setSmsConfig}
        onSmsTemplateCodeChange={handleSmsTemplateCodeChange}
        onAddSmsTemplateRel={handleAddSmsTemplateRel}
        onAddAllSmsTemplateRels={handleAddAllSmsTemplateRels}
        onSaveSmsConfig={handleSaveSmsConfig}
        onRetryLoadSmsResources={handleRetrySmsResources}
        smsSaveDisabled={smsDialogSaveDisabled}
        auditDialogOpen={auditDialogOpen}
        onAuditDialogOpenChange={handleAuditDialogOpenChange}
        auditConfig={auditConfig}
        onAuditConfigChange={setAuditConfig}
        onSaveAuditConfig={handleSaveAuditConfig}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="云服务管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              刷新
            </Button>
            <Button variant="page" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              新增云服务
            </Button>
          </>
        }
      />

      <PageFilterBar className="!flex-nowrap overflow-x-auto">
          <Select
            value={platformType}
            onValueChange={(v) => {
              setPlatformType(v);
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-44 h-9">
              <SelectValue placeholder="平台类型" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="all">
                全部平台
              </SelectItem>
              {platformTypeOptions.map((opt) => (
                <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={enabledFilter}
            onValueChange={(v: "all" | "enabled" | "disabled") => {
              setEnabledFilter(v);
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-32 h-9">
              <SelectValue placeholder="启用状态" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="all">
                全部
              </SelectItem>
              <SelectItem className="subpage-select-item" value="enabled">
                启用
              </SelectItem>
              <SelectItem className="subpage-select-item" value="disabled">
                禁用
              </SelectItem>
            </SelectContent>
          </Select>

          <SearchField
            wrapClassName="!w-[380px] !max-w-[380px] shrink-0"
            placeholder="搜索平台名称，回车搜索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyKeywordSearch();
              }
            }}
          />
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">平台名称</TableHead>
              <TableHead className="w-40">平台类型</TableHead>
              <TableHead className="min-w-[220px]">已配置服务</TableHead>
              <TableHead className="w-36 text-center">优先级</TableHead>
              <TableHead className="w-24 text-center">授权信息</TableHead>
              <TableHead className="w-44 text-center">启用</TableHead>
              <TableHead className="w-84">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading &&
              items.map((cs) => (
                <TableRow key={cs.id}>
                  <TableCell className="font-medium">{cs.platformName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {getPlatformNameByType(normalizePlatformType(cs.platformType, platformTypeOptions), platformTypeOptions)}
                  </TableCell>
                  <TableCell>
                    {cs.serviceNames ? (
                      <div className="flex flex-wrap gap-1.5">
                        {cs.serviceNames.split("、").map((serviceName) => (
                          <Badge key={`${cs.id}-${serviceName}`} variant="secondary" className="text-xs">
                            {serviceName}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">未配置服务</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{cs.priority}</TableCell>
                  <TableCell className="text-center">
                    {cs.hasAuth ? (
                      <Badge variant="outline" className="text-xs">
                        已配置
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        未配置
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={cs.enabled !== false}
                      onCheckedChange={(v) => toggleEnabledMutation.mutate({ id: cs.id, enabled: v })}
                      disabled={toggleEnabledMutation.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:text-primary"
                        title="编辑"
                        onClick={() => openEdit(cs)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="删除"
                        onClick={() => openDelete(cs)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!listQuery.isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  暂无云服务
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={pageTotal || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageNo(1);
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将删除云服务：{deleting?.platformName || "-"}。该操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                await deleteMutation.mutateAsync(deleting.id);
                setDeleteConfirmOpen(false);
                setDeleting(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
