import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { updateLoginProviderConfig } from "@/shared/api/sys/system-config";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { LoginConfigFormField } from "./LoginConfigFormField";
import { LoginCallbackRemarkBlock } from "./LoginCallbackRemarkBlock";
import {
  buildAbsoluteCallbackUrl,
  getLoginProviderMeta,
  LOGIN_CALLBACK_PATHS,
  parseLoginProviderConfig,
  type LoginProviderDialogProps,
} from "./login-provider-meta";
import { notify } from "@/shared/lib/notify";

export function FeishuLoginConfigDialog({ open, onOpenChange, provider, onSaved }: LoginProviderDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [initialSnapshot, setInitialSnapshot] = useState("");

  const meta = getLoginProviderMeta("feishu");

  useEffect(() => {
    if (!open || !provider || provider.providerCode !== "feishu") return;
    const cfg = parseLoginProviderConfig(provider.configJson);
    const suggested = buildAbsoluteCallbackUrl(LOGIN_CALLBACK_PATHS.feishu);
    const next = {
      appId: cfg.appId || "",
      appSecret: "",
      redirectUrl: cfg.redirectUrl || suggested,
    };
    setAppId(next.appId);
    setAppSecret(next.appSecret);
    setRedirectUrl(next.redirectUrl);
    setFormError(null);
    setInitialSnapshot(JSON.stringify(next));
  }, [open, provider]);

  const currentSnapshot = useMemo(
    () => JSON.stringify({ appId, appSecret, redirectUrl }),
    [appId, appSecret, redirectUrl]
  );
  const hasUnsavedChanges = open && !!initialSnapshot && currentSnapshot !== initialSnapshot;
  const secretPlaceholder = provider?.hasSecret
    ? "已配置（不回显，留空表示不更新）"
    : "密钥信息保存后不再显示";

  const requestClose = () => {
    if (saving) return;
    if (hasUnsavedChanges) {
      const ok = window.confirm("您已输入内容，确定要取消吗？未保存的内容将会丢失。");
      if (!ok) return;
    }
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!provider || saving) return;
    if (!appId.trim()) {
      setFormError("请输入 App ID");
      return;
    }
    if (!redirectUrl.trim()) {
      setFormError("请输入重定向 URL");
      return;
    }
    if (!provider.hasSecret && !appSecret.trim()) {
      setFormError("请输入 App Secret");
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      await updateLoginProviderConfig(provider.providerCode, {
        configJson: JSON.stringify({
          appId: appId.trim(),
          redirectUrl: redirectUrl.trim(),
        }),
        secretEnc: appSecret.trim() || undefined,
      });
      notify.success("保存成功");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      notify.error("保存失败", { description: resolveUserErrorMessage(e, "无法保存登录配置") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl p-0 gap-0 flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="px-6 pt-6">{meta.dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {meta.callbacks?.length ? <LoginCallbackRemarkBlock callbacks={meta.callbacks} /> : null}
          <LoginConfigFormField
            label="App ID"
            value={appId}
            onChange={(v) => {
              setFormError(null);
              setAppId(v);
            }}
            description="飞书开放平台应用 App ID"
            required
          />
          <LoginConfigFormField
            label="App Secret"
            value={appSecret}
            onChange={(v) => {
              setFormError(null);
              setAppSecret(v);
            }}
            secret
            placeholder={secretPlaceholder}
            description="飞书开放平台应用 App Secret"
            required={!provider?.hasSecret}
          />
          <LoginConfigFormField
            label="重定向 URL"
            value={redirectUrl}
            onChange={(v) => {
              setFormError(null);
              setRedirectUrl(v);
            }}
            placeholder={buildAbsoluteCallbackUrl(LOGIN_CALLBACK_PATHS.feishu)}
            description={`固定路径 ${LOGIN_CALLBACK_PATHS.feishu}，须与飞书开放平台后台重定向 URL 一致`}
            required
          />
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 border-t border-border mt-auto flex-col items-stretch sm:flex-col sm:space-x-0 gap-2">
          {formError ? <p className="text-sm text-destructive text-right">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={requestClose} disabled={saving}>
              取消
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
