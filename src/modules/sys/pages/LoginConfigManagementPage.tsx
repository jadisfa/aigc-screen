import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, PageShell } from "@/shared/components/page";
import {
  listLoginProviders,
  listWechatMpConfigs,
  setLoginProviderDefault,
  setLoginProviderEnabled,
  type LoginProviderConfig,
  type WechatMpConfig,
} from "@/shared/api/sys/system-config";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { DingtalkLoginConfigDialog } from "@/modules/sys/components/login-config/DingtalkLoginConfigDialog";
import { FeishuLoginConfigDialog } from "@/modules/sys/components/login-config/FeishuLoginConfigDialog";
import { GoogleLoginConfigDialog } from "@/modules/sys/components/login-config/GoogleLoginConfigDialog";
import { LoginProviderCard } from "@/modules/sys/components/login-config/LoginProviderCard";
import { WechatOpenLoginConfigDialog } from "@/modules/sys/components/login-config/WechatOpenLoginConfigDialog";
import {
  isEditableLoginProvider,
  parseLoginProviderConfig,
  type EditableLoginProviderCode,
  type WechatMpCredentialSummary,
} from "@/modules/sys/components/login-config/login-provider-meta";
import { notify } from "@/shared/lib/notify";

function describeEnableBlocker(
  provider: LoginProviderConfig,
  wechatMpSummary: WechatMpCredentialSummary
): { title: string; description: string; openEditor?: boolean } | null {
  const code = provider.providerCode;
  const cfg = parseLoginProviderConfig(provider.configJson);

  if (code === "wechat_open") {
    const missing: string[] = [];
    if (!cfg.appId?.trim()) missing.push("AppID");
    if (!provider.hasSecret) missing.push("App Secret");
    if (!cfg.redirectDomain?.trim()) missing.push("授权回调域");
    if (missing.length === 0) return null;
    return {
      title: "请先完成配置",
      description: `启用「${provider.name}」前，需要先补全 ${missing.join("、")}。正在打开配置窗口…`,
      openEditor: true,
    };
  }

  if (code === "wechat_mp") {
    const ready = wechatMpSummary.configs.some((c) => c.enabled && c.hasSecret);
    if (ready) return null;
    return {
      title: "请先配置公众号",
      description: "启用前请先到「系统配置 → 微信公众号」配置并启用至少一个公众号凭证。",
    };
  }

  if (isEditableLoginProvider(code)) {
    const missing: string[] = [];
    if (!cfg.appId?.trim() && !cfg.clientId?.trim()) {
      missing.push(code === "feishu" ? "App ID" : "Client ID");
    }
    if (!provider.hasSecret) missing.push("密钥");
    if (!cfg.redirectUrl?.trim()) missing.push("回调地址");
    if (missing.length === 0) return null;
    return {
      title: "请先完成配置",
      description: `启用「${provider.name}」前，需要先补全 ${missing.join("、")}。正在打开配置窗口…`,
      openEditor: true,
    };
  }

  return null;
}

const LoginConfigManagement = () => {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<LoginProviderConfig[]>([]);
  const [wechatMpConfigs, setWechatMpConfigs] = useState<WechatMpConfig[]>([]);
  const [editingCode, setEditingCode] = useState<EditableLoginProviderCode | null>(null);
  const [editingProvider, setEditingProvider] = useState<LoginProviderConfig | null>(null);

  const wechatMpSummary = useMemo<WechatMpCredentialSummary>(
    () => ({
      enabledCount: wechatMpConfigs.filter((c) => c.enabled).length,
      configs: wechatMpConfigs.map((c) => ({
        appId: c.appId,
        enabled: c.enabled,
        hasSecret: c.hasSecret,
      })),
    }),
    [wechatMpConfigs]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, mpList] = await Promise.all([listLoginProviders(), listWechatMpConfigs()]);
      setProviders(list);
      setWechatMpConfigs(mpList);
    } catch (e) {
      notify.error("加载失败", { description: resolveUserErrorMessage(e, "无法加载登录方式配置") });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleEdit = (provider: LoginProviderConfig) => {
    if (!isEditableLoginProvider(provider.providerCode)) return;
    setEditingProvider(provider);
    setEditingCode(provider.providerCode);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) return;
    setEditingCode(null);
    setEditingProvider(null);
  };

  const handleToggle = async (provider: LoginProviderConfig, checked: boolean) => {
    if (checked) {
      const blocker = describeEnableBlocker(provider, wechatMpSummary);
      if (blocker) {
        notify.success(blocker.title, { description: blocker.description });
        if (blocker.openEditor) {
          handleEdit(provider);
        }
        return;
      }
    }

    try {
      await setLoginProviderEnabled(provider.providerCode, checked);
      setProviders((prev) =>
        prev.map((p) => (p.providerCode === provider.providerCode ? { ...p, enabled: checked } : p))
      );
      notify.success(checked ? "已启用" : "已关闭", { description: checked
          ? `「${provider.name}」已对登录页生效`
          : `「${provider.name}」已从登录页隐藏` });
    } catch (e) {
      notify.error(checked ? "暂时无法启用" : "暂时无法关闭", { description: resolveUserErrorMessage(e, "无法更新启用状态，请稍后重试") });
      await refresh();
    }
  };

  const handleSetDefault = async (provider: LoginProviderConfig) => {
    try {
      await setLoginProviderDefault(provider.providerCode);
      setProviders((prev) =>
        prev.map((p) => ({ ...p, isDefault: p.providerCode === provider.providerCode }))
      );
      notify.success("设置成功", { description: `已将「${provider.name}」设为默认登录方式` });
    } catch (e) {
      notify.error("暂时无法设为默认", { description: resolveUserErrorMessage(e, "请先启用该登录方式后再设为默认") });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={
          <div className="page-header-start">
            <h1 className="page-title">登录方式配置</h1>
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
          </div>
        }
        description="启用后与登录页联动；微信优先开放平台，否则回退公众号（凭证读 sys_wechat_mp）。"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
        {providers.map((provider) => (
          <LoginProviderCard
            key={provider.providerCode}
            provider={provider}
            wechatMpSummary={provider.providerCode === "wechat_mp" ? wechatMpSummary : null}
            onToggle={(p, enabled) => void handleToggle(p, enabled)}
            onSetDefault={(p) => void handleSetDefault(p)}
            onEdit={handleEdit}
          />
        ))}
      </div>

      <WechatOpenLoginConfigDialog
        open={editingCode === "wechat_open"}
        onOpenChange={handleDialogOpenChange}
        provider={editingCode === "wechat_open" ? editingProvider : null}
        onSaved={() => void refresh()}
      />
      <DingtalkLoginConfigDialog
        open={editingCode === "dingtalk"}
        onOpenChange={handleDialogOpenChange}
        provider={editingCode === "dingtalk" ? editingProvider : null}
        onSaved={() => void refresh()}
      />
      <GoogleLoginConfigDialog
        open={editingCode === "google"}
        onOpenChange={handleDialogOpenChange}
        provider={editingCode === "google" ? editingProvider : null}
        onSaved={() => void refresh()}
      />
      <FeishuLoginConfigDialog
        open={editingCode === "feishu"}
        onOpenChange={handleDialogOpenChange}
        provider={editingCode === "feishu" ? editingProvider : null}
        onSaved={() => void refresh()}
      />
    </PageShell>
  );
};

export default LoginConfigManagement;
