import { Pencil } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader, PageShell, StatusBadge } from "@/shared/components/page";
import { Switch } from "@/shared/ui/switch";
import { Badge } from "@/shared/ui/badge";
import {
  listPaymentGatewayConfigs,
  setPaymentGatewayConfigEnabled,
  type PaymentGatewayConfig,
} from "@/shared/api/sys/system-config";
import { notify } from "@/shared/lib/notify";

type PaymentChannel = "wechat" | "alipay" | "paypal";

type FixedGatewayCard = {
  channel: PaymentChannel;
  gatewayCode: string;
  name: string;
  item: PaymentGatewayConfig | null;
};

function guessChannel(gatewayCode: string): PaymentChannel | null {
  const v = gatewayCode.toLowerCase();
  if (v.includes("wechat")) return "wechat";
  if (v.includes("alipay")) return "alipay";
  if (v.includes("paypal")) return "paypal";
  return null;
}

/** 列表页展示：密钥类凭证是否已保存（不回显具体内容）。 */
function secretCredentialLabel(channel: PaymentChannel): { label: string; hint: string } {
  if (channel === "alipay") {
    return { label: "应用密钥", hint: "应用私钥、支付宝公钥" };
  }
  if (channel === "paypal") {
    return { label: "Client Secret", hint: "PayPal Client Secret" };
  }
  return { label: "支付凭证", hint: "按 APIv2/APIv3 配置对应密钥与证书" };
}

export default function PaymentManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PaymentGatewayConfig[]>([]);

  const fixedCards = useMemo<FixedGatewayCard[]>(() => {
    const defaults: Array<{ channel: PaymentChannel; gatewayCode: string; name: string }> = [
      { channel: "wechat", gatewayCode: "wechat", name: "微信支付" },
      { channel: "alipay", gatewayCode: "alipay", name: "支付宝" },
      { channel: "paypal", gatewayCode: "paypal", name: "PayPal" },
    ];
    return defaults.map((d) => {
      const matched = items.find((it) => guessChannel(it.gatewayCode || "") === d.channel) ?? null;
      return { ...d, item: matched };
    });
  }, [items]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPaymentGatewayConfigs();
      setItems(res);
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleToggleEnabled(item: PaymentGatewayConfig, next: boolean) {
    setItems((prev) => prev.map((it) => (it.gatewayCode === item.gatewayCode ? { ...it, enabled: next } : it)));
    try {
      await setPaymentGatewayConfigEnabled(item.gatewayCode, next);
      notify.success(next ? "已启用" : "已禁用");
    } catch (e) {
      setItems((prev) => prev.map((it) => (it.gatewayCode === item.gatewayCode ? { ...it, enabled: item.enabled } : it)));
      notify.error("更新失败", { description: e instanceof Error ? e.message : "请求失败" });
    }
  }

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const state = (location.state || null) as { paymentGatewaySaved?: boolean } | null;
    if (!state?.paymentGatewaySaved) return;
    void refresh();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, refresh]);

  return (
    <PageShell>
      <PageHeader title="支付配置" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {fixedCards.map((card) => {
          const secret = secretCredentialLabel(card.channel);
          const secretConfigured = !!card.item?.hasSecretJson;
          return (
          <div key={card.gatewayCode} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{card.item?.name || card.name}</span>
                <Badge variant="outline" className="text-xs">
                  {card.gatewayCode}
                </Badge>
              </div>
              <button
                onClick={() => {
                  navigate(`/sys/payments/${encodeURIComponent(card.gatewayCode)}`);
                }}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                title="编辑"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">启用状态</span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!card.item?.enabled}
                    disabled={!card.item || loading}
                    onCheckedChange={(checked) => {
                      if (!card.item) return;
                      void handleToggleEnabled(card.item, checked);
                    }}
                  />
                  <StatusBadge tone={card.item?.enabled ? "success" : "neutral"}>
                    {!card.item ? "关闭" : card.item.enabled ? "已启用" : "已禁用"}
                  </StatusBadge>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-muted-foreground">{secret.label}</div>
                  <div className="text-xs text-muted-foreground/80 truncate" title={secret.hint}>
                    {secret.hint}
                  </div>
                </div>
                <StatusBadge tone={secretConfigured ? "success" : "warning"} className="shrink-0">
                  {secretConfigured ? "已配置" : "待配置"}
                </StatusBadge>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </PageShell>
  );
}
