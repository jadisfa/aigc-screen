import { Plus, ArrowLeft, Trash2, Shield, Save, Pencil, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import {
  PageHeader,
  PageShell,
  TableSurface,
} from "@/shared/components/page";

// ── Types ────────────────────────────────────────

interface ServiceItem {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
}

interface CloudPlatform {
  id: number;
  name: string;
  platform: string;
  priority: number;
  services: ServiceItem[];
  enabled: boolean;
}

interface AuthField {
  key: string;
  value: string;
}

interface SmsTemplateConfig {
  registerTemplateId: string;
  resetPasswordTemplateId: string;
  bindPhoneTemplateId: string;
  appId: string;
  smsSignature: string;
}

interface AuditConfig {
  callbackUrl: string;
  imagePolicy: string;
  audioPolicy: string;
  videoPolicy: string;
}

// ── Mock Data ────────────────────────────────────

const platformOptions = ["阿里云", "腾讯云", "华为云", "AWS", "Azure", "Google Cloud"];

const serviceTemplates: { name: string; code: string }[] = [
  { name: "短信发送", code: "sms" },
  { name: "翻译", code: "translation" },
  { name: "内容审核", code: "audit_media" },
  { name: "对象存储", code: "oss" },
  { name: "CDN加速", code: "cdn" },
  { name: "域名解析", code: "dns" },
];

const mockPlatforms: CloudPlatform[] = [
  {
    id: 1,
    name: "阿里云",
    platform: "aliyun",
    priority: 0,
    services: [{ id: "1", name: "翻译", code: "translation", enabled: true }],
    enabled: true,
  },
  {
    id: 2,
    name: "阿里云短信（自动迁移）",
    platform: "aliyun",
    priority: 1,
    services: [{ id: "2", name: "短信发送", code: "sms", enabled: true }],
    enabled: true,
  },
];

const platformAuthFields: Record<string, string[]> = {
  阿里云: ["accessKeyId", "accessKeySecret"],
  腾讯云: ["accessKeyId", "accessKeySecret"],
  华为云: ["accessKeyId", "accessKeySecret", "projectId"],
  AWS: ["accessKeyId", "secretAccessKey", "region"],
  Azure: ["tenantId", "clientId", "clientSecret"],
  "Google Cloud": ["serviceAccountKey"],
};

const CloudPlatformManagement = () => {
  const [view, setView] = useState<"list" | "create">("list");
  const [platforms, setPlatforms] = useState<CloudPlatform[]>(mockPlatforms);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // ── Create form state ──
  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState("");
  const [formAuthFields, setFormAuthFields] = useState<AuthField[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formServices, setFormServices] = useState<ServiceItem[]>([]);
  const [formPriority, setFormPriority] = useState("0");
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── SMS Template Dialog ──
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsConfig, setSmsConfig] = useState<SmsTemplateConfig>({
    registerTemplateId: "",
    resetPasswordTemplateId: "",
    bindPhoneTemplateId: "",
    appId: "",
    smsSignature: "",
  });

  // ── Audit Dialog ──
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditConfig, setAuditConfig] = useState<AuditConfig>({
    callbackUrl: "",
    imagePolicy: "default",
    audioPolicy: "default",
    videoPolicy: "default",
  });

  const resetForm = () => {
    setFormName("");
    setFormPlatform("");
    setFormAuthFields([]);
    setFormEnabled(true);
    setFormServices([]);
    setFormPriority("0");
    setFormError(null);
  };

  const hasFormContent = () => {
    return (
      formName.trim() !== "" ||
      formPlatform !== "" ||
      formAuthFields.some((f) => f.value.trim() !== "") ||
      formServices.length > 0 ||
      formPriority !== "0"
    );
  };

  const handleBack = () => {
    if (hasFormContent()) {
      setPendingAction(() => () => {
        resetForm();
        setView("list");
      });
      setShowCancelDialog(true);
    } else {
      resetForm();
      setView("list");
    }
  };

  const handleCancel = () => {
    handleBack();
  };

  const handlePlatformChange = (value: string) => {
    setFormPlatform(value);
    const fields = platformAuthFields[value] || ["accessKeyId", "accessKeySecret"];
    setFormAuthFields(fields.map((key) => ({ key, value: "" })));
  };

  const handleAddServiceItem = (template: { name: string; code: string }) => {
    setFormServices([
      ...formServices,
      { id: Date.now().toString(), name: template.name, code: template.code, enabled: true },
    ]);
    setAddServiceOpen(false);
  };

  const handleRemoveService = (id: string) => {
    setFormServices(formServices.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    if (!formName.trim()) {
      setFormError("请输入平台名称");
      return;
    }
    if (!formPlatform) {
      setFormError("请选择平台");
      return;
    }
    if (formAuthFields.some((f) => !f.value.trim())) {
      setFormError("请填写所有认证信息");
      return;
    }
    setFormError(null);

    const newPlatform: CloudPlatform = {
      id: Date.now(),
      name: formName,
      platform: formPlatform.toLowerCase().replace(/\s+/g, ""),
      priority: parseInt(formPriority) || 0,
      services: formServices,
      enabled: formEnabled,
    };
    setPlatforms([...platforms, newPlatform]);
    resetForm();
    setView("list");
  };

  const handleDeletePlatform = (id: number) => {
    setPlatforms(platforms.filter((p) => p.id !== id));
  };

  const handleTogglePlatform = (id: number) => {
    setPlatforms(
      platforms.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSaveSmsConfig = () => {
    setSmsDialogOpen(false);
  };

  const handleSaveAuditConfig = () => {
    setAuditDialogOpen(false);
  };

  const availableServices = serviceTemplates.filter(
    (t) => !formServices.some((s) => s.code === t.code)
  );

  // ══════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════
  if (view === "list") {
    return (
      <PageShell>
        <PageHeader
          title="云服务平台"
          actions={
            <Button variant="page" onClick={() => setView("create")}>
              <Plus className="w-4 h-4" />
              添加新平台
            </Button>
          }
        />

        <TableSurface>
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">序号</TableHead>
                <TableHead className="w-80">名称</TableHead>
                <TableHead className="w-24">平台</TableHead>
                <TableHead className="w-24">优先级</TableHead>
                <TableHead className="w-80">启用的功能</TableHead>
                <TableHead className="w-20">状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platforms.map((p, idx) => (
                <TableRow key={p.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {p.platform}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-16 h-8 text-center"
                      value={p.priority}
                      readOnly
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 flex-wrap">
                      {p.services.filter((s) => s.enabled).map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-xs">
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={() => handleTogglePlatform(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary" title="编辑">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeletePlatform(p.id)}
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {platforms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    暂无云服务平台，点击"添加新平台"创建
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableSurface>

        {/* Cancel confirm dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认取消</AlertDialogTitle>
              <AlertDialogDescription>
                您已输入部分内容，确认要放弃当前编辑内容吗？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>继续编辑</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  pendingAction?.();
                  setPendingAction(null);
                }}
              >
                确认放弃
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageShell>
    );
  }

  // ══════════════════════════════════════════════════
  // CREATE VIEW
  // ══════════════════════════════════════════════════
  return (
    <PageShell>
      <PageHeader
        title={
          <div className="page-header-start">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="page-title">新增云服务平台</h1>
          </div>
        }
      />

      <div className="w-full max-w-[1000px] mx-auto space-y-6">
        {/* 平台名称 */}
        <div className="space-y-1.5">
          <label className="text-sm font-normal text-foreground">
            平台名称 <span>*</span>
          </label>
          <Input
            placeholder="请输入平台名称"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
        </div>

        {/* 平台 */}
        <div className="space-y-1.5">
          <label className="text-sm font-normal text-foreground">
            平台 <span>*</span>
          </label>
          <Select value={formPlatform} onValueChange={handlePlatformChange}>
            <SelectTrigger>
              <SelectValue placeholder="请选择平台" />
            </SelectTrigger>
            <SelectContent>
              {platformOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 认证信息 */}
        {formAuthFields.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-sm font-normal text-foreground">
              认证信息 <span>*</span>
            </label>
            <div className="space-y-2">
              {formAuthFields.map((field, idx) => (
                <div key={field.key} className="flex items-center gap-2">
                  <span className="text-sm font-medium bg-muted px-3 py-2 rounded-md min-w-[140px] text-center border border-border">
                    {field.key}
                  </span>
                  <Input
                    type="password"
                    placeholder={`请输入 ${field.key}`}
                    value={field.value}
                    onChange={(e) => {
                      const updated = [...formAuthFields];
                      updated[idx].value = e.target.value;
                      setFormAuthFields(updated);
                    }}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 是否启用 */}
        <div className="space-y-1.5">
          <label className="text-sm font-normal text-foreground">
            是否启用 <span>*</span>
          </label>
          <div>
            <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
          </div>
        </div>

        {/* 启用的服务 */}
        <div className="space-y-1.5">
          <label className="text-sm font-normal text-foreground">
            启用的服务 <span>*</span>
          </label>
          <div className="mb-2">
            <Popover open={addServiceOpen} onOpenChange={setAddServiceOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  添加功能
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {availableServices.length > 0 ? (
                  availableServices.map((t) => (
                    <button
                      key={t.code}
                      className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => handleAddServiceItem(t)}
                    >
                      添加{t.name}功能
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    所有可用服务已添加
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {formServices.length > 0 && (
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow>
                  <TableHead>服务名称</TableHead>
                  <TableHead>服务编码</TableHead>
                  <TableHead className="w-24">是否启用</TableHead>
                  <TableHead className="w-48">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="text-primary">{service.name}</TableCell>
                    <TableCell className="text-primary">{service.code}</TableCell>
                    <TableCell>
                      <Switch
                        checked={service.enabled}
                        onCheckedChange={(checked) => {
                          setFormServices(
                            formServices.map((s) =>
                              s.id === service.id ? { ...s, enabled: checked } : s
                            )
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {service.code === "sms" && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSmsDialogOpen(true)}
                            title="设置模版"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        )}
                        {service.code === "audit_media" && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setAuditDialogOpen(true)}
                            title="设置内容审核"
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveService(service.id)}
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* 优先级 */}
        <div className="space-y-1.5">
          <label className="text-sm font-normal">优先级</label>
          <Input
            type="number"
            value={formPriority}
            onChange={(e) => setFormPriority(e.target.value)}
          />
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col items-end gap-2 pt-4 pb-8">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex gap-3">
            <Button variant="outline" className="h-10 px-5" onClick={handleCancel}>
              取消
            </Button>
            <Button className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90" onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel confirm dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消</AlertDialogTitle>
            <AlertDialogDescription>
              您已输入部分内容，确认要放弃当前编辑内容吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pendingAction?.();
                setPendingAction(null);
              }}
            >
              确认放弃
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SMS Template Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>短信模版设置</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  <span className="text-foreground">●</span>注册及登录短信模板ID
                </label>
                <Input
                  placeholder="请输入短信签名"
                  value={smsConfig.registerTemplateId}
                  onChange={(e) =>
                    setSmsConfig({ ...smsConfig, registerTemplateId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  模版在相应的云平台申请短信服务功能，并申请资质和模版，获取模版ID。提交运营商审核通过方可使用，模版需要包含参数：code。模版示例：您的验证码为：${"{code}"}，请勿泄露给他人！
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  <span className="text-foreground">●</span>重置密码（或注册初始化密码）短信模板ID
                </label>
                <Input
                  placeholder="请输入短信模板"
                  value={smsConfig.resetPasswordTemplateId}
                  onChange={(e) =>
                    setSmsConfig({ ...smsConfig, resetPasswordTemplateId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  模版在相应的云平台申请短信服务功能，并申请资质和模版，获取模版ID。提交运营商审核通过方可使用，模版需要包含参数：code。模版参考：您的验证码为：${"{code}"}，您正在进行密码重置操作，如非本人操作，请忽略本短信！
                </p>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  <span className="text-foreground">●</span>绑定手机号模板ID
                </label>
                <Input
                  placeholder="请输入短信模板ID"
                  value={smsConfig.bindPhoneTemplateId}
                  onChange={(e) =>
                    setSmsConfig({ ...smsConfig, bindPhoneTemplateId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  模版在相应的云平台申请短信服务功能，并申请资质和模版，获取模版ID。提交运营商审核通过方可使用，模版需要包含参数：code。模版参考：您正在绑定手机号，验证码为：${"{code}"}，5分钟内有效，请勿泄露！
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  <span className="text-muted-foreground">○</span>应用ID
                </label>
                <Input
                  placeholder="请输入应用ID"
                  value={smsConfig.appId}
                  onChange={(e) =>
                    setSmsConfig({ ...smsConfig, appId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  应用ID。腾讯云需要配置，获取地址：
                  https://console.cloud.tencent.com/smsv2/app-manage
                </p>
              </div>
            </div>

            {/* Row 3 */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                <span className="text-muted-foreground">○</span>短信签名
              </label>
              <Input
                placeholder="请输入短信签名"
                value={smsConfig.smsSignature}
                onChange={(e) =>
                  setSmsConfig({ ...smsConfig, smsSignature: e.target.value })
                }
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                手动指定短信签名。腾讯云需要配置。签名资质要申请并且提交运营商报备后才能正常发送短信
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSaveSmsConfig} className="gap-1.5">
              <Save className="w-4 h-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Audit Dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>内容审核设置</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                <span className="text-foreground">●</span>回调URL
              </label>
              <Input
                placeholder="https://www.example.com/api/webhook/audit-callback"
                value={auditConfig.callbackUrl}
                onChange={(e) =>
                  setAuditConfig({ ...auditConfig, callbackUrl: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                审核回调URL({"{backendBaseURL}"}/webhook/audit-callback)
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                <span className="text-foreground">●</span>图片内容安全安全策略
              </label>
              <Input
                placeholder="default"
                value={auditConfig.imagePolicy}
                onChange={(e) =>
                  setAuditConfig({ ...auditConfig, imagePolicy: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                与https://console.cloud.tencent.com/cms/clouds/manage的应用Biztype保持一致
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                <span className="text-foreground">●</span>点播音频内容安全策略
              </label>
              <Input
                placeholder="default"
                value={auditConfig.audioPolicy}
                onChange={(e) =>
                  setAuditConfig({ ...auditConfig, audioPolicy: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                与https://console.cloud.tencent.com/cms/clouds/manage的应用Biztype保持一致
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                <span className="text-foreground">●</span>点播视频内容安全策略
              </label>
              <Input
                placeholder="default"
                value={auditConfig.videoPolicy}
                onChange={(e) =>
                  setAuditConfig({ ...auditConfig, videoPolicy: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                与https://console.cloud.tencent.com/cms/clouds/manage的应用Biztype保持一致
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSaveAuditConfig} className="gap-1.5">
              <Save className="w-4 h-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default CloudPlatformManagement;

