import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { updateLoginProviderConfig } from "@/shared/api/sys/system-config";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { LoginConfigFormField } from "./LoginConfigFormField";
import { LoginCallbackRemarkBlock } from "./LoginCallbackRemarkBlock";
import {
  getLoginProviderMeta,
  parseLoginProviderConfig,
  type LoginProviderDialogProps,
} from "./login-provider-meta";
import { notify } from "@/shared/lib/notify";

export function WechatOpenLoginConfigDialog({ open, onOpenChange, provider, onSaved }: LoginProviderDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [redirectDomain, setRedirectDomain] = useState("");
  const [initialSnapshot, setInitialSnapshot] = useState("");

  const meta = getLoginProviderMeta("wechat_open");

  useEffect(() => {
    if (!open || !provider || provider.providerCode !== "wechat_open") return;
    const cfg = parseLoginProviderConfig(provider.configJson);
    const nextAppId = cfg.appId || "";
    const nextDomain = (cfg.redirectDomain || cfg.redirectUrl || "").replace(/^https?:\/\//i, "").split("/")[0];
    setAppId(nextAppId);
    setAppSecret("");
    setRedirectDomain(nextDomain);
    setFormError(null);
    setInitialSnapshot(JSON.stringify({ appId: nextAppId, appSecret: "", redirectDomain: nextDomain }));
  }, [open, provider]);

  const currentSnapshot = useMemo(
    () => JSON.stringify({ appId, appSecret, redirectDomain }),
    [appId, appSecret, redirectDomain]
  );
  const hasUnsavedChanges = open && !!initialSnapshot && currentSnapshot !== initialSnapshot;

  const secretPlaceholder = provider?.hasSecret
    ? "已配置（不回显，留空表示不更新）"
    : "密钥信息保存后不再显示";

  const previewRedirectUri = useMemo(() => {
    const host = redirectDomain.trim().replace(/^https?:\/\//i, "").split("/")[0];
    if (!host) return "";
    return `https://${host}/auth/wechat/open/callback`;
  }, [redirectDomain]);

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
    if (!redirectDomain.trim()) {
      setFormError("请输入授权回调域");
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
          redirectDomain: redirectDomain.trim().replace(/^https?:\/\//i, "").split("/")[0],
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
          <p className="text-xs text-muted-foreground leading-relaxed">
            须在微信开放平台创建并认证「网站应用」，授权回调域只填域名（不带协议与路径）。
          </p>
          {meta.callbacks?.length ? <LoginCallbackRemarkBlock callbacks={meta.callbacks} /> : null}
          <LoginConfigFormField
            label="App ID"
            value={appId}
            onChange={(v) => {
              setFormError(null);
              setAppId(v);
            }}
            description="开放平台「网站应用」AppID"
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
            description="开放平台「网站应用」AppSecret"
            required={!provider?.hasSecret}
          />
          <LoginConfigFormField
            label="授权回调域"
            value={redirectDomain}
            onChange={(v) => {
              setFormError(null);
              setRedirectDomain(v);
            }}
            placeholder="admin.example.com"
            description="只填域名，须与开放平台后台配置完全一致"
            required
          />
          {previewRedirectUri ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="text-xs text-muted-foreground mb-1">完整 redirect_uri（按上方回调域拼装）</div>
              <code className="text-[12px] text-foreground break-all">{previewRedirectUri}</code>
            </div>
          ) : null}
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
