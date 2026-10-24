import { ExternalLink, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LoginProviderConfig } from "@/shared/api/sys/system-config";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { LoginProviderIcon } from "./LoginProviderIcon";
import { getLoginProviderMeta, type WechatMpCredentialSummary } from "./login-provider-meta";

type LoginProviderCardProps = {
  provider: LoginProviderConfig;
  wechatMpSummary?: WechatMpCredentialSummary | null;
  onToggle: (provider: LoginProviderConfig, enabled: boolean) => void;
  onSetDefault: (provider: LoginProviderConfig) => void;
  onEdit: (provider: LoginProviderConfig) => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-8">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center justify-end gap-2 min-w-0">{children}</div>
    </div>
  );
}

export function LoginProviderCard({
  provider,
  wechatMpSummary,
  onToggle,
  onSetDefault,
  onEdit,
}: LoginProviderCardProps) {
  const meta = getLoginProviderMeta(provider.providerCode);
  const canEdit = meta.hasEdit;
  const isWechatMp = provider.providerCode === "wechat_mp";
  const mpEnabled = wechatMpSummary?.configs.filter((c) => c.enabled) ?? [];
  const mpReady = mpEnabled.some((c) => c.hasSecret);
  const mpStatusLabel = mpReady ? "已配置" : mpEnabled.length > 0 ? "缺 Secret" : "未配置";

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LoginProviderIcon type={meta.icon} color={meta.iconColor} />
          <span className="font-semibold text-foreground truncate">{provider.name}</span>
          {provider.isDefault ? (
            <Badge variant="secondary" className="text-xs shrink-0">
              默认
            </Badge>
          ) : null}
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => onEdit(provider)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted shrink-0"
            title="配置"
          >
            <Pencil className="w-4 h-4" />
          </button>
        ) : isWechatMp ? (
          <Link
            to="/sys/wechat-official"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted shrink-0"
            title="公众号配置"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        ) : null}
      </div>

      <div className="px-4 py-2 divide-y divide-border/50">
        <Row label="启用状态">
          <Switch
            checked={provider.enabled}
            onCheckedChange={(checked) => onToggle(provider, checked)}
            aria-label={`${provider.name}启用开关`}
          />
          <Badge
            variant="outline"
            className={
              provider.enabled
                ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"
                : "bg-muted text-muted-foreground border-border text-xs"
            }
          >
            {provider.enabled ? "已启用" : "已禁用"}
          </Badge>
        </Row>

        <Row label="默认方式">
          {provider.isDefault ? (
            <Badge variant="outline" className="bg-foreground text-background text-xs border-foreground">
              当前默认
            </Badge>
          ) : (
            <button
              type="button"
              onClick={() => onSetDefault(provider)}
              disabled={!provider.enabled}
              className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
            >
              设为默认
            </button>
          )}
        </Row>

        {canEdit ? (
          <Row label="密钥">
            <Badge variant="outline" className="text-xs">
              {provider.hasSecret ? "已配置" : "未配置"}
            </Badge>
          </Row>
        ) : null}

        {isWechatMp ? (
          <>
            <Row label="公众号凭证">
              <Badge variant="outline" className="text-xs" title={mpEnabled[0]?.appId}>
                {mpStatusLabel}
              </Badge>
            </Row>
            <Row label="授权回调">
              <code className="text-xs text-muted-foreground font-mono truncate max-w-[10rem]">
                {meta.callbacks?.[0]?.path ?? "/auth/wechat/callback"}
              </code>
            </Row>
          </>
        ) : null}
      </div>
    </div>
  );
}
