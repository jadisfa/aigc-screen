import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
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
import { checkComfyUIServerBaseUrl, type ComfyUIServerProvider } from "@/shared/api/comfyui/comfyui-server";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";

type MultiSelectOption = { value: string; label: string };
export type ComfyUIServerAuthMethod = "token" | "basic";

type RenderMultiSelect = (args: {
  placeholder: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  widthClassName?: string;
}) => React.ReactNode;

type BaseUrlCheckState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "available"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

type ComfyUIServerEditorPageProps = {
  mode: "create" | "edit";
  /** 修改场景用于排除当前服务自身，避免误报地址冲突 */
  editServerId?: string | null;
  hasAuthOnEdit: boolean;
  formName: string;
  setFormName: (v: string) => void;
  formGpuCount: string;
  setFormGpuCount: (v: string) => void;
  formBaseUrl: string;
  setFormBaseUrl: (v: string) => void;
  formProvider: ComfyUIServerProvider;
  setFormProvider: (v: ComfyUIServerProvider) => void;
  groupOptions: MultiSelectOption[];
  formGroupId: string;
  setFormGroupId: (v: string) => void;
  formAuthEnabled: boolean;
  setFormAuthEnabled: (v: boolean) => void;
  formAuthMethod: ComfyUIServerAuthMethod;
  setFormAuthMethod: (v: ComfyUIServerAuthMethod) => void;
  /** 编辑态已配置的认证类型：none | bearer | basic | unknown */
  authTypeOnEdit?: string | null;
  formAuthUsername: string;
  setFormAuthUsername: (v: string) => void;
  formAuthPassword: string;
  setFormAuthPassword: (v: string) => void;
  formAuthToken: string;
  setFormAuthToken: (v: string) => void;
  merchantOptions: MultiSelectOption[];
  merchantIds: string[];
  setMerchantIds: (next: string[]) => void;
  storeOptions: MultiSelectOption[];
  storeIds: string[];
  setStoreIds: (next: string[]) => void;
  workflowOptions: MultiSelectOption[];
  includeWorkflowIds: string[];
  setIncludeWorkflowIds: (next: string[]) => void;
  excludeWorkflowIds: string[];
  setExcludeWorkflowIds: (next: string[]) => void;
  renderMultiSelect: RenderMultiSelect;
  editDetailIsFetching: boolean;
  editDetailIsError: boolean;
  savePending: boolean;
  onBack: () => void;
  onSave: () => void;
  formError?: string | null;
  formExitConfirmOpen: boolean;
  setFormExitConfirmOpen: (open: boolean) => void;
  onConfirmDiscard: () => void;
};

/** 与 ModelHub EditorSection 保持一致的分区容器 */
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

export default function ComfyUIServerEditorPage(props: ComfyUIServerEditorPageProps) {
  const {
    mode,
    editServerId,
    hasAuthOnEdit,
    formName,
    setFormName,
    formGpuCount,
    setFormGpuCount,
    formBaseUrl,
    setFormBaseUrl,
    formProvider,
    setFormProvider,
    groupOptions,
    formGroupId,
    setFormGroupId,
    formAuthEnabled,
    setFormAuthEnabled,
    formAuthMethod,
    setFormAuthMethod,
    authTypeOnEdit,
    formAuthUsername,
    setFormAuthUsername,
    formAuthPassword,
    setFormAuthPassword,
    formAuthToken,
    setFormAuthToken,
    merchantOptions,
    merchantIds,
    setMerchantIds,
    storeOptions,
    storeIds,
    setStoreIds,
    workflowOptions,
    includeWorkflowIds,
    setIncludeWorkflowIds,
    excludeWorkflowIds,
    setExcludeWorkflowIds,
    renderMultiSelect,
    editDetailIsFetching,
    editDetailIsError,
    savePending,
    onBack,
    onSave,
    formError,
    formExitConfirmOpen,
    setFormExitConfirmOpen,
    onConfirmDiscard,
  } = props;

  const [baseUrlCheck, setBaseUrlCheck] = useState<BaseUrlCheckState>({ status: "idle", message: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const baseUrlCheckSeqRef = useRef(0);

  useEffect(() => {
    setShowPassword(false);
    setShowToken(false);
  }, [mode, editServerId]);

  const runBaseUrlCheck = async (raw: string) => {
    const url = raw.trim();
    if (!url) {
      setBaseUrlCheck({ status: "idle", message: "" });
      return;
    }
    const seq = ++baseUrlCheckSeqRef.current;
    setBaseUrlCheck({ status: "checking", message: "检测中..." });
    try {
      const r = await checkComfyUIServerBaseUrl({
        baseUrl: url,
        excludeId: mode === "edit" ? editServerId : null,
      });
      if (seq !== baseUrlCheckSeqRef.current) return;
      setBaseUrlCheck(
        r.available
          ? { status: "available", message: "地址可用" }
          : { status: "unavailable", message: "该地址已被其他服务占用，请更换后重试" }
      );
    } catch (e) {
      if (seq !== baseUrlCheckSeqRef.current) return;
      setBaseUrlCheck({
        status: "error",
        message: resolveUserErrorMessage(e, "地址检测失败，请稍后重试"),
      });
    }
  };

  const handleBaseUrlChange = (value: string) => {
    setFormBaseUrl(value);
    if (baseUrlCheck.status !== "idle") {
      setBaseUrlCheck({ status: "idle", message: "" });
    }
  };

  const handleAuthEnabledChange = (next: boolean) => {
    setFormAuthEnabled(next);
    if (!next) {
      setFormAuthUsername("");
      setFormAuthPassword("");
      setFormAuthToken("");
      setShowPassword(false);
      setShowToken(false);
      setFormAuthMethod("token");
      return;
    }
    // 重新打开时：若编辑态已有认证配置，回显原方式；否则默认 Token
    if (mode === "edit" && hasAuthOnEdit && authTypeOnEdit === "basic") {
      setFormAuthMethod("basic");
    } else {
      setFormAuthMethod("token");
    }
  };

  const handleAuthMethodChange = (next: ComfyUIServerAuthMethod) => {
    if (next === formAuthMethod) return;
    setFormAuthMethod(next);
    if (next === "token") {
      setFormAuthUsername("");
      setFormAuthPassword("");
      setShowPassword(false);
    } else {
      setFormAuthToken("");
      setShowToken(false);
    }
  };

  const configuredAuthLabel =
    authTypeOnEdit === "basic" ? "用户名密码" : authTypeOnEdit === "bearer" ? "Bearer Token" : null;

  const baseUrlHintClassName =
    baseUrlCheck.status === "available"
      ? "text-xs text-green-600"
      : baseUrlCheck.status === "unavailable" || baseUrlCheck.status === "error"
        ? "text-xs text-destructive"
        : "text-xs text-muted-foreground";

  const saveDisabled =
    savePending ||
    (mode === "edit" && editDetailIsFetching) ||
    baseUrlCheck.status === "checking" ||
    baseUrlCheck.status === "unavailable";

  const keepExistingAuth =
    mode === "edit" &&
    hasAuthOnEdit &&
    formAuthEnabled &&
    !formAuthUsername.trim() &&
    !formAuthPassword &&
    !formAuthToken.trim();

  const willClearAuth = mode === "edit" && hasAuthOnEdit && !formAuthEnabled;
  const authRequiredMark = mode === "create" || !hasAuthOnEdit;

  return (
    <div className="page-content-shell">
      <div className="subpage-toolbar mb-7">
        <div className="subpage-toolbar-start">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-[18px] font-semibold text-foreground">{mode === "create" ? "新增服务" : "编辑服务"}</h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1080px] space-y-5">
        <FormSection title="基本信息">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>名称
              </label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="请输入名称" className="workflow-form-input" />
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">GPU 数量</label>
              <Input type="number" min={0} value={formGpuCount} onChange={(e) => setFormGpuCount(e.target.value)} placeholder="0" className="workflow-form-input" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>服务器地址（baseUrl）
              </label>
              <Input
                value={formBaseUrl}
                onChange={(e) => handleBaseUrlChange(e.target.value)}
                onBlur={() => void runBaseUrlCheck(formBaseUrl)}
                placeholder={
                  formProvider === "runninghub"
                    ? "例如：https://www.runninghub.ai/openapi/v2"
                    : "例如：http://192.168.1.10:8188"
                }
                className="workflow-form-input"
              />
              {baseUrlCheck.message ? <p className={baseUrlHintClassName}>{baseUrlCheck.message}</p> : null}
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">
                <span className="text-destructive">*</span>提供商
              </label>
              <Select value={formProvider} onValueChange={(v) => setFormProvider(v === "runninghub" ? "runninghub" : "self_hosted")}>
                <SelectTrigger className="workflow-form-input h-10">
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="self_hosted">
                    自建服务器
                  </SelectItem>
                  <SelectItem className="subpage-select-item" value="runninghub">
                    RunningHub
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">分组</label>
              <Select value={formGroupId} onValueChange={setFormGroupId}>
                <SelectTrigger className="workflow-form-input h-10">
                  <SelectValue placeholder="选择分组" />
                </SelectTrigger>
                <SelectContent className="subpage-select-content">
                  <SelectItem className="subpage-select-item" value="none">
                    不分组
                  </SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g.value} className="subpage-select-item" value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="认证配置"
          description={
            mode === "edit" && hasAuthOnEdit && configuredAuthLabel
              ? `已配置：${configuredAuthLabel}（留空表示不修改）`
              : "Bearer Token 与用户名密码二选一"
          }
          action={<Switch checked={formAuthEnabled} onCheckedChange={handleAuthEnabledChange} />}
        >
          {willClearAuth || formAuthEnabled ? (
            <div className="space-y-5">
              {willClearAuth ? <p className="text-xs text-destructive">保存后将清空已有认证信息</p> : null}

              {formAuthEnabled ? (
                <>
                  <div className="space-y-2">
                    <label className="workflow-form-label">认证方式</label>
                    <Select value={formAuthMethod} onValueChange={(v) => handleAuthMethodChange(v as ComfyUIServerAuthMethod)}>
                      <SelectTrigger className="workflow-form-input h-10 max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        <SelectItem className="subpage-select-item" value="token">
                          Bearer Token
                        </SelectItem>
                        <SelectItem className="subpage-select-item" value="basic">
                          用户名密码
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formAuthMethod === "token" ? (
                    <div className="space-y-2 max-w-xl">
                      <label className="workflow-form-label">
                        {authRequiredMark ? <span className="text-destructive">*</span> : null}
                        Token
                      </label>
                      <div className="relative">
                        <Input
                          type={showToken ? "text" : "password"}
                          value={formAuthToken}
                          onChange={(e) => setFormAuthToken(e.target.value)}
                          placeholder={keepExistingAuth ? "留空则保留现有 Token" : "请输入 Token"}
                          className="workflow-form-input pr-10"
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowToken((v) => !v)}
                          aria-label={showToken ? "隐藏 Token" : "显示 Token"}
                        >
                          {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 max-w-xl">
                      <div className="space-y-2">
                        <label className="workflow-form-label">
                          {authRequiredMark ? <span className="text-destructive">*</span> : null}
                          用户名
                        </label>
                        <Input
                          value={formAuthUsername}
                          onChange={(e) => setFormAuthUsername(e.target.value)}
                          placeholder={keepExistingAuth ? "留空则保留现有认证" : "请输入用户名"}
                          className="workflow-form-input"
                          autoComplete="username"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="workflow-form-label">
                          {authRequiredMark ? <span className="text-destructive">*</span> : null}
                          密码
                        </label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={formAuthPassword}
                            onChange={(e) => setFormAuthPassword(e.target.value)}
                            placeholder={keepExistingAuth ? "留空则保留现有认证" : "请输入密码"}
                            className="workflow-form-input pr-10"
                            autoComplete="new-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "隐藏密码" : "显示密码"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {keepExistingAuth ? (
                    <p className="text-xs text-muted-foreground">当前已存在认证信息，留空表示不修改；填写表示覆盖</p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </FormSection>

        <FormSection title="访问范围">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="workflow-form-label">专属组织</label>
              {renderMultiSelect({ placeholder: "选择组织", options: merchantOptions, value: merchantIds, onChange: setMerchantIds })}
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">专属门店</label>
              {renderMultiSelect({ placeholder: "选择门店", options: storeOptions, value: storeIds, onChange: setStoreIds })}
            </div>
          </div>
        </FormSection>

        <FormSection title="应用绑定">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="workflow-form-label">指定应用（工作流）</label>
              {renderMultiSelect({
                placeholder: "选择应用",
                options: workflowOptions,
                value: includeWorkflowIds,
                onChange: (next) => {
                  setIncludeWorkflowIds(next);
                  setExcludeWorkflowIds(excludeWorkflowIds.filter((x) => !next.includes(x)));
                },
              })}
            </div>
            <div className="space-y-2">
              <label className="workflow-form-label">排除应用（工作流）</label>
              {renderMultiSelect({
                placeholder: "选择应用",
                options: workflowOptions,
                value: excludeWorkflowIds,
                onChange: (next) => setExcludeWorkflowIds(next.filter((x) => !includeWorkflowIds.includes(x))),
              })}
            </div>
          </div>
        </FormSection>

        {mode === "edit" && editDetailIsFetching && <p className="text-sm text-muted-foreground">加载配置中...</p>}
        {mode === "edit" && editDetailIsError && <p className="text-sm text-destructive">加载服务器详情失败，请稍后重试</p>}

        <div className="flex flex-col items-end gap-2 pt-2">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex justify-end gap-4">
            <Button variant="outline" className="h-10 px-5" onClick={onBack}>
              取消
            </Button>
            <Button className="h-10 px-5 bg-foreground text-background hover:bg-foreground/90" onClick={onSave} disabled={saveDisabled}>
              <Save className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={formExitConfirmOpen} onOpenChange={setFormExitConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消</AlertDialogTitle>
            <AlertDialogDescription>您已输入部分内容，确认要放弃当前编辑内容吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDiscard}>确认放弃</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
