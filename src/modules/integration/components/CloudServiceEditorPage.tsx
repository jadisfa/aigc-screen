import { ArrowLeft, Mail, Plus, Save, Settings, Shield, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Switch } from "@/shared/ui/switch";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import type {
  AuditConfig,
  AvailableServiceOption,
  FormServiceCode,
  FormServiceItem,
  MailServerConfig,
  PlatformTypeOption,
  SmsTemplateConfig,
  SmsTemplateRelIssue,
} from "@/shared/types/cloud-service-form";

type CloudServiceEditorPageProps = {
  mode: "create" | "edit";
  editingHasAuth: boolean;
  platformTypeOptions: PlatformTypeOption[];
  formPlatformName: string;
  onFormPlatformNameChange: (value: string) => void;
  formPlatformType: string;
  onPlatformTypeChange: (value: string) => void;
  formAccessKeyId: string;
  onFormAccessKeyIdChange: (value: string) => void;
  formAccessKeySecret: string;
  onFormAccessKeySecretChange: (value: string) => void;
  formPriority: string;
  onFormPriorityChange: (value: string) => void;
  formEnabled: boolean;
  onFormEnabledChange: (value: boolean) => void;
  formServices: FormServiceItem[];
  onFormServicesChange: (services: FormServiceItem[]) => void;
  addServiceOpen: boolean;
  onAddServiceOpenChange: (open: boolean) => void;
  availableServices: AvailableServiceOption[];
  serviceNameMap: Record<FormServiceCode, string>;
  onAddService: (code: FormServiceCode) => void;
  onRemoveService: (id: string) => void;
  editDetailLoading: boolean;
  editDetailError: boolean;
  onBack: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  formError?: string | null;
  formExitConfirmOpen: boolean;
  onFormExitConfirmOpenChange: (open: boolean) => void;
  onConfirmDiscard: () => void;
  mailDialogOpen: boolean;
  onMailDialogOpenChange: (open: boolean) => void;
  mailConfig: MailServerConfig;
  onMailConfigChange: (next: MailServerConfig) => void;
  onSaveMailConfig: () => void;
  smsDialogOpen: boolean;
  onSmsDialogOpenChange: (open: boolean) => void;
  smsEntryDisabled: boolean;
  smsEntryDisabledReason: string;
  smsConfigLoading: boolean;
  smsTemplateOptionsLoading: boolean;
  smsTemplateOptionsError: boolean;
  smsTemplateRelIssues: Record<string, SmsTemplateRelIssue[]>;
  smsTemplateCodeOptions: { value: string; label: string }[];
  smsDomesticTemplateOptionsByCode: Record<string, { value: string; label: string }[]>;
  smsInternationalTemplateOptionsByCode: Record<string, { value: string; label: string }[]>;
  smsConfig: SmsTemplateConfig;
  onSmsConfigChange: (next: SmsTemplateConfig) => void;
  onSmsTemplateCodeChange: (relId: string, templateCode: string) => void;
  onAddSmsTemplateRel: () => void;
  onAddAllSmsTemplateRels: () => void;
  onSaveSmsConfig: () => void;
  onRetryLoadSmsResources: () => void;
  smsSaveDisabled: boolean;
  auditDialogOpen: boolean;
  onAuditDialogOpenChange: (open: boolean) => void;
  auditConfig: AuditConfig;
  onAuditConfigChange: (next: AuditConfig) => void;
  onSaveAuditConfig: () => void;
};

export default function CloudServiceEditorPage(props: CloudServiceEditorPageProps) {
  const isEdit = props.mode === "edit";
  const selectedSmsTemplateCodes = new Set(props.smsConfig.templateRels.map((rel) => rel.templateCode).filter(Boolean));
  const smsIssueCount = Object.keys(props.smsTemplateRelIssues).length;
  const smsTemplateEditingDisabled = props.smsConfigLoading || props.smsTemplateOptionsLoading || props.smsTemplateOptionsError;

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={props.onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{props.mode === "create" ? "新增云服务平台" : "编辑云服务平台"}</h1>
        </div>
      </div>

      <div className="w-full max-w-[1000px] mx-auto space-y-5">
        <div className="space-y-2">
          <label className="workflow-form-label">
            <span className="text-destructive">*</span>平台名称
          </label>
          <Input
            value={props.formPlatformName}
            onChange={(e) => props.onFormPlatformNameChange(e.target.value)}
            placeholder="请输入平台名称"
            className="workflow-form-input"
          />
        </div>

        <div className="space-y-2">
          <label className="workflow-form-label">
            <span className="text-destructive">*</span>平台类型
          </label>
          <Select value={props.formPlatformType} onValueChange={props.onPlatformTypeChange}>
            <SelectTrigger className="subpage-native-select w-full h-10">
              <SelectValue placeholder="请选择平台类型" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              {props.platformTypeOptions.map((opt) => (
                <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(props.formPlatformType === "aliyun" || props.formPlatformType === "tencent") && (
          <div className="space-y-2">
            <label className="workflow-form-label">
              <span className="text-destructive">*</span>授权信息
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                value={props.formAccessKeyId}
                onChange={(e) => props.onFormAccessKeyIdChange(e.target.value)}
                placeholder="请输入 accessKeyId"
                className="workflow-form-input"
              />
              <Input
                type="password"
                value={props.formAccessKeySecret}
                onChange={(e) => props.onFormAccessKeySecretChange(e.target.value)}
                placeholder="请输入 accessKeySecret"
                className="workflow-form-input"
              />
            </div>
            {isEdit && props.editingHasAuth && !props.formAccessKeyId.trim() && !props.formAccessKeySecret.trim() && (
              <p className="text-xs text-muted-foreground">当前已存在授权信息，留空表示不修改。</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-10 items-center">
          <div className="space-y-2">
            <label className="workflow-form-label">优先级</label>
            <Input
              type="number"
              value={props.formPriority}
              onChange={(e) => props.onFormPriorityChange(e.target.value)}
              placeholder="100"
              className="workflow-form-input"
            />
          </div>
          <div className="space-y-2">
            <label className="workflow-form-label">启用</label>
            <div className="h-10 flex items-center">
              <Switch checked={props.formEnabled} onCheckedChange={props.onFormEnabledChange} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="workflow-form-label">
            启用的服务 <span className="text-destructive">*</span>
          </label>
          {isEdit && props.editDetailLoading && <p className="text-sm text-muted-foreground">正在加载已配置服务项...</p>}
          {isEdit && props.editDetailError && <p className="text-sm text-destructive">加载历史服务项失败，请稍后重试。</p>}
          <div className="mb-2">
            <Popover open={props.addServiceOpen} onOpenChange={props.onAddServiceOpenChange}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  添加功能
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                {props.availableServices.length > 0 ? (
                  props.availableServices.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      onClick={() => props.onAddService(opt.value)}
                    >
                      添加{props.serviceNameMap[opt.value]}功能
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">所有可用服务已添加</div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {props.formServices.length > 0 && (
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
                {props.formServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="text-primary">{service.name}</TableCell>
                    <TableCell className="text-primary">{service.code}</TableCell>
                    <TableCell>
                      <Switch
                        checked={service.enabled}
                        onCheckedChange={(checked) =>
                          props.onFormServicesChange(props.formServices.map((s) => (s.id === service.id ? { ...s, enabled: checked } : s)))
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {service.code === "sms" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary hover:text-primary"
                            onClick={() => props.onSmsDialogOpenChange(true)}
                            title={props.smsEntryDisabledReason}
                            disabled={props.smsEntryDisabled}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        )}
                        {service.code === "mail" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary hover:text-primary"
                            onClick={() => props.onMailDialogOpenChange(true)}
                            title="设置邮箱服务器"
                          >
                            <Mail className="w-4 h-4" />
                          </Button>
                        )}
                        {service.code === "audit_media" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary hover:text-primary"
                            onClick={() => props.onAuditDialogOpenChange(true)}
                            title="设置内容审核"
                          >
                            <Shield className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => props.onRemoveService(service.id)}
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
          {props.formServices.length === 0 && <p className="text-sm text-muted-foreground">未添加服务时，仅保存已填写的平台配置到 authJsonEnc。</p>}
        </div>

        <div className="flex flex-col items-end gap-2 pt-3 pb-8 mt-6">
          {props.formError ? <p className="text-sm text-destructive">{props.formError}</p> : null}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" className="h-10 px-5" onClick={props.onBack}>
              取消
            </Button>
            <Button className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90" onClick={props.onSave} disabled={props.saveDisabled}>
              <Save className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={props.formExitConfirmOpen} onOpenChange={props.onFormExitConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消</AlertDialogTitle>
            <AlertDialogDescription>您已输入部分内容，确认要放弃当前编辑内容吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={props.onConfirmDiscard}>确认放弃</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={props.mailDialogOpen} onOpenChange={props.onMailDialogOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>邮箱信息设置</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm">
                  <span className="text-destructive">*</span>SMTP 主机
                </label>
                <Input
                  placeholder="smtp.qq.com"
                  value={props.mailConfig.smtpHost}
                  onChange={(e) => props.onMailConfigChange({ ...props.mailConfig, smtpHost: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">邮件服务商提供的 SMTP 地址，如 smtp.qq.com</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm">
                  <span className="text-destructive">*</span>SMTP 端口
                </label>
                <Input
                  placeholder="465"
                  value={props.mailConfig.smtpPort}
                  onChange={(e) => props.onMailConfigChange({ ...props.mailConfig, smtpPort: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">邮件服务端口，常用端口：465（SSL）、587（TLS）、25（非加密）</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm">
                  <span className="text-destructive">*</span>用户名
                </label>
                <Input
                  placeholder="no-reply@example.com"
                  value={props.mailConfig.username}
                  onChange={(e) => props.onMailConfigChange({ ...props.mailConfig, username: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">SMTP 登录账号，通常是发件人邮箱地址</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm">
                  <span className="text-destructive">*</span>密码 / 授权码
                </label>
                <Input
                  type="password"
                  placeholder="请输入密码/授权码"
                  value={props.mailConfig.passwordOrAuthCode}
                  onChange={(e) => props.onMailConfigChange({ ...props.mailConfig, passwordOrAuthCode: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">部分邮箱需使用授权码（不是登录密码）</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm">
                <span className="text-destructive">*</span>是否使用 SSL
              </label>
              <div className="h-10 flex items-center gap-3">
                <Switch
                  checked={props.mailConfig.useSsl}
                  onCheckedChange={(checked) => props.onMailConfigChange({ ...props.mailConfig, useSsl: checked })}
                />
                <span className="text-sm text-foreground">{props.mailConfig.useSsl ? "是" : "否"}</span>
              </div>
              <p className="text-sm text-muted-foreground">推荐开启，保证邮件发送安全</p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {props.formError ? <p className="mr-auto text-sm text-destructive">{props.formError}</p> : null}
            <Button onClick={props.onSaveMailConfig} className="h-10 px-5 gap-1.5 bg-foreground text-background hover:bg-foreground/90">
              <Save className="w-4 h-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.smsDialogOpen} onOpenChange={props.onSmsDialogOpenChange}>
        <DialogContent className="max-w-5xl max-h-[130vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>短信模板设置</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {props.smsConfigLoading && (
              <Alert>
                <AlertTitle>正在加载短信配置</AlertTitle>
                <AlertDescription>已保存的短信配置正在同步到当前页面，加载完成后可继续编辑和保存。</AlertDescription>
              </Alert>
            )}
            {!props.smsConfigLoading && props.smsTemplateOptionsLoading && (
              <Alert>
                <AlertTitle>正在同步短信模板列表</AlertTitle>
                <AlertDescription>模板列表加载完成后会自动恢复编辑，当前暂不支持保存。</AlertDescription>
              </Alert>
            )}
            {!props.smsConfigLoading && props.smsTemplateOptionsError && (
              <Alert variant="destructive" className="flex items-center justify-between gap-3">
                <div>
                  <AlertTitle>短信模板列表加载失败</AlertTitle>
                  <AlertDescription>请重试加载模板后再继续配置，避免保存时出现模板不匹配。</AlertDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={props.onRetryLoadSmsResources}>
                  重试加载
                </Button>
              </Alert>
            )}
            {!props.smsConfigLoading && !props.smsTemplateOptionsLoading && !props.smsTemplateOptionsError && smsIssueCount > 0 && (
              <Alert variant="destructive">
                <AlertTitle>发现 {smsIssueCount} 条短信配置需要处理</AlertTitle>
                <AlertDescription>请根据表格中的提示补全或重新选择模板，处理完成后才能保存。</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-normal">
                  <span className="text-destructive">*</span>应用ID
                </label>
                <Input
                  placeholder="请输入应用ID"
                  value={props.smsConfig.appId}
                  disabled={props.smsConfigLoading}
                  onChange={(e) => props.onSmsConfigChange({ ...props.smsConfig, appId: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">填写云平台短信应用 ID，例如腾讯云 `SdkAppId` 或对应平台应用标识。</p>
              </div>

            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-medium text-foreground">业务模板关联</h3>
                  <p className="mt-1 text-sm text-muted-foreground">添加国内/国际短信，并配置对应签名。</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={props.onAddAllSmsTemplateRels} disabled={smsTemplateEditingDisabled}>
                    添加所有
                  </Button>
                  <Button variant="outline" size="sm" onClick={props.onAddSmsTemplateRel} disabled={smsTemplateEditingDisabled}>
                    <Plus className="w-4 h-4 mr-1" />
                    添加模板
                  </Button>
                </div>
              </div>

              {smsTemplateEditingDisabled && !props.smsTemplateOptionsError ? (
                <div className="rounded-xl border bg-muted/10 px-4 py-4 space-y-3">
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : props.smsTemplateOptionsError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                  模板列表暂时不可用，请点击上方“重试加载”后再继续配置。
                </div>
              ) : props.smsConfig.templateRels.length > 0 ? (
                <Table className="table-fixed text-[13px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">业务模板</TableHead>
                      <TableHead className="w-[160px]">国内消息</TableHead>
                      <TableHead className="w-[160px]">国际消息</TableHead>
                      <TableHead className="w-[100px]">国内签名</TableHead>
                      <TableHead className="w-[100px]">国际签名</TableHead>
                      <TableHead className="w-20 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {props.smsConfig.templateRels.map((rel) => (
                      <TableRow key={rel.id}>
                        {(() => {
                          const domesticOptions = rel.templateCode ? props.smsDomesticTemplateOptionsByCode[rel.templateCode] ?? [] : [];
                          const internationalOptions = rel.templateCode
                            ? props.smsInternationalTemplateOptionsByCode[rel.templateCode] ?? []
                            : [];
                          const relIssues = props.smsTemplateRelIssues[rel.id] ?? [];

                          return (
                            <>
                        <TableCell className="align-top">
                          <Select
                            value={rel.templateCode}
                            disabled={smsTemplateEditingDisabled}
                            onValueChange={(v) => props.onSmsTemplateCodeChange(rel.id, v)}
                          >
                            <SelectTrigger className="subpage-native-select h-8 border-border/50 px-1.5 text-[12px] hover:border-border/60 focus:border-border/60 data-[state=open]:border-border/60 [&>span]:pr-0 [&>svg]:ml-0">
                              <SelectValue placeholder="选择业务模板" />
                            </SelectTrigger>
                            <SelectContent className="subpage-select-content">
                              {props.smsTemplateCodeOptions.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  className="subpage-select-item text-[12px]"
                                  value={opt.value}
                                  disabled={opt.value !== rel.templateCode && selectedSmsTemplateCodes.has(opt.value)}
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {relIssues.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {relIssues.map((issue, index) => (
                                <Badge
                                  key={`${rel.id}-${index}`}
                                  variant={issue.level === "error" ? "destructive" : "outline"}
                                  className={issue.level === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : ""}
                                >
                                  {issue.message}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Select
                            value={rel.domesticMessageTemplateId}
                            disabled={!rel.templateCode || smsTemplateEditingDisabled}
                            onValueChange={(v) =>
                              props.onSmsConfigChange({
                                ...props.smsConfig,
                                templateRels: props.smsConfig.templateRels.map((r) =>
                                  r.id === rel.id ? { ...r, domesticMessageTemplateId: v } : r
                                ),
                              })
                            }
                          >
                            <SelectTrigger className="subpage-native-select h-9 border-border/50 px-1 text-[12px] hover:border-border/60 focus:border-border/60 data-[state=open]:border-border/60 [&>span]:pr-1 [&>svg]:ml-1">
                              <SelectValue placeholder={rel.templateCode ? "选择国内模板" : "请先选择业务模板"} />
                            </SelectTrigger>
                            <SelectContent className="subpage-select-content">
                              {domesticOptions.map((opt) => (
                                <SelectItem key={opt.value} className="subpage-select-item text-[12px]" value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="align-top">
                          <Select
                            value={rel.internationalMessageTemplateId}
                            disabled={!rel.templateCode || smsTemplateEditingDisabled}
                            onValueChange={(v) =>
                              props.onSmsConfigChange({
                                ...props.smsConfig,
                                templateRels: props.smsConfig.templateRels.map((r) =>
                                  r.id === rel.id ? { ...r, internationalMessageTemplateId: v } : r
                                ),
                              })
                            }
                          >
                            <SelectTrigger className="subpage-native-select h-9 border-border/50 px-1 text-[12px] hover:border-border/60 focus:border-border/60 data-[state=open]:border-border/60 [&>span]:pr-1 [&>svg]:ml-1">
                              <SelectValue placeholder={rel.templateCode ? "选择国际模板" : "请先选择业务模板"} />
                            </SelectTrigger>
                            <SelectContent className="subpage-select-content">
                              {internationalOptions.map((opt) => (
                                <SelectItem key={opt.value} className="subpage-select-item text-[12px]" value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                            </>
                          );
                        })()}
                        <TableCell className="align-top">
                          <Input
                            className="border-border/50 px-2 text-[13px] hover:border-border/60 focus:border-border/60"
                            value={rel.domesticSignName}
                            placeholder="国内签名"
                            disabled={smsTemplateEditingDisabled}
                            onChange={(e) =>
                              props.onSmsConfigChange({
                                ...props.smsConfig,
                                templateRels: props.smsConfig.templateRels.map((r) =>
                                  r.id === rel.id ? { ...r, domesticSignName: e.target.value } : r
                                ),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            className="border-border/50 px-2 text-[13px] hover:border-border/60 focus:border-border/60"
                            value={rel.internationalSignName}
                            placeholder="国际签名"
                            disabled={smsTemplateEditingDisabled}
                            onChange={(e) =>
                              props.onSmsConfigChange({
                                ...props.smsConfig,
                                templateRels: props.smsConfig.templateRels.map((r) =>
                                  r.id === rel.id ? { ...r, internationalSignName: e.target.value } : r
                                ),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            disabled={smsTemplateEditingDisabled}
                            onClick={() =>
                              props.onSmsConfigChange({
                                ...props.smsConfig,
                                templateRels: props.smsConfig.templateRels.filter((r) => r.id !== rel.id),
                              })
                            }
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-xl border bg-muted/10 px-4 py-8 text-sm text-muted-foreground text-center">
                  暂未配置业务短信
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <div className="mr-auto space-y-1 text-sm">
              {props.formError ? <p className="text-destructive">{props.formError}</p> : null}
              <p className="text-muted-foreground">
                {props.smsSaveDisabled ? "请先等待数据加载完成，并处理表格中的提示后再保存。" : "当前短信配置已就绪，可直接保存。"}
              </p>
            </div>
            <Button
              onClick={props.onSaveSmsConfig}
              disabled={props.smsSaveDisabled}
              className="h-10 px-5 gap-1.5 bg-foreground text-background hover:bg-foreground/90"
            >
              <Save className="w-4 h-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.auditDialogOpen} onOpenChange={props.onAuditDialogOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>内容审核设置</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-normal">
                <span className="text-destructive">*</span>回调URL
              </label>
              <Input
                placeholder="https://www.example.com/api/webhook/audit-callback"
                value={props.auditConfig.callbackUrl}
                onChange={(e) => props.onAuditConfigChange({ ...props.auditConfig, callbackUrl: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-normal">
                <span className="text-destructive">*</span>图片内容安全策略
              </label>
              <Input
                placeholder="default"
                value={props.auditConfig.imagePolicy}
                onChange={(e) => props.onAuditConfigChange({ ...props.auditConfig, imagePolicy: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-normal">
                <span className="text-destructive">*</span>点播音频内容安全策略
              </label>
              <Input
                placeholder="default"
                value={props.auditConfig.audioPolicy}
                onChange={(e) => props.onAuditConfigChange({ ...props.auditConfig, audioPolicy: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-normal">
                <span className="text-destructive">*</span>点播视频内容安全策略
              </label>
              <Input
                placeholder="default"
                value={props.auditConfig.videoPolicy}
                onChange={(e) => props.onAuditConfigChange({ ...props.auditConfig, videoPolicy: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {props.formError ? <p className="mr-auto text-sm text-destructive">{props.formError}</p> : null}
            <Button onClick={props.onSaveAuditConfig} className="h-10 px-5 gap-1.5 bg-foreground text-background hover:bg-foreground/90">
              <Save className="w-4 h-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
