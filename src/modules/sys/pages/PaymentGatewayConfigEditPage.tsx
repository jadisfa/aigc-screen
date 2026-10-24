import { ArrowLeft, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader, PageShell } from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { getApiBaseUrl } from "@/shared/api/sys/api-base";
import { HttpError } from "@/shared/api/sys/http";
import {
  createPaymentGatewayConfig,
  getPaymentGatewayConfig,
  updatePaymentGatewayConfig,
  type PaymentGatewayConfig,
} from "@/shared/api/sys/system-config";
import { notify } from "@/shared/lib/notify";

type PaymentChannel = "wechat" | "alipay" | "paypal";
/** 微信支付接口版本：一期仅落地 APIv3 Native。 */
type WechatApiVersion = "v3" | "v2";

function guessChannel(gatewayCode: string): PaymentChannel | null {
  const v = gatewayCode.toLowerCase();
  if (v.includes("wechat")) return "wechat";
  if (v.includes("alipay")) return "alipay";
  if (v.includes("paypal")) return "paypal";
  return null;
}

function parseJsonObject(v: string | null | undefined): Record<string, unknown> {
  if (!v) return {};
  try {
    const obj = JSON.parse(v) as unknown;
    if (obj && typeof obj === "object") return obj as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

function channelDefaults(channel: PaymentChannel): { gatewayCode: string; name: string } {
  if (channel === "alipay") return { gatewayCode: "alipay", name: "支付宝" };
  if (channel === "paypal") return { gatewayCode: "paypal", name: "PayPal" };
  return { gatewayCode: "wechat", name: "微信支付" };
}

function resolveWechatApiVersion(cfg: Record<string, unknown>, gatewayCode: string): WechatApiVersion {
  const raw = String(cfg.apiVersion || cfg.apiVer || "").toLowerCase();
  if (raw === "v2" || raw.includes("api_v2") || raw.includes("apiv2")) return "v2";
  if (raw === "v3" || raw.includes("api_v3") || raw.includes("apiv3")) return "v3";
  // 历史 gateway_code=wechat_pay_v3 明确为 v3；其余默认 v3（与后端 WechatNativePayClient 一致）
  if (gatewayCode.toLowerCase().includes("v2")) return "v2";
  return "v3";
}

/** 当前系统对外 API 基址 + 公开支付回调路径。 */
function defaultNotifyUrl(channel: PaymentChannel): string {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  if (channel === "alipay") return `${base}/api/pay/notify/alipay`;
  if (channel === "paypal") return `${base}/api/pay/notify/paypal`;
  return `${base}/api/pay/notify/wechat`;
}

function defaultGatewayUrl(channel: PaymentChannel, wechatApiVersion: WechatApiVersion = "v3"): string {
  if (channel === "wechat") {
    return wechatApiVersion === "v2" ? "https://api.mch.weixin.qq.com/pay" : "https://api.mch.weixin.qq.com";
  }
  if (channel === "alipay") return "https://openapi.alipay.com/gateway.do";
  if (channel === "paypal") return "https://api-m.paypal.com";
  return "";
}

function resolveNotifyUrl(channel: PaymentChannel, saved: string | null | undefined): string {
  const trimmed = (saved || "").trim();
  return trimmed || defaultNotifyUrl(channel);
}

function resolveGatewayUrl(
  channel: PaymentChannel,
  saved: string | null | undefined,
  wechatApiVersion: WechatApiVersion = "v3",
): string {
  const trimmed = (saved || "").trim();
  return trimmed || defaultGatewayUrl(channel, wechatApiVersion);
}

export default function PaymentGatewayConfigEditPage() {
  const navigate = useNavigate();
  const params = useParams();
  const gatewayCode = decodeURIComponent(params.gatewayCode || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [existing, setExisting] = useState<PaymentGatewayConfig | null>(null);

  const [channel, setChannel] = useState<PaymentChannel>("wechat");
  const [name, setName] = useState("微信支付");
  const [enabled, setEnabled] = useState(false);
  const [notifyUrl, setNotifyUrl] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [description, setDescription] = useState("");
  const [clearSecretJson, setClearSecretJson] = useState(false);

  const [wechatApiVersion, setWechatApiVersion] = useState<WechatApiVersion>("v3");
  const [wechatAppId, setWechatAppId] = useState("");
  const [wechatMchId, setWechatMchId] = useState("");
  /** APIv3：平台 APIv3 密钥；字段名 paySignKey 与后端约定对齐。 */
  const [wechatApiV3Key, setWechatApiV3Key] = useState("");
  const [wechatApiclientCertPem, setWechatApiclientCertPem] = useState("");
  const [wechatApiclientKeyPem, setWechatApiclientKeyPem] = useState("");
  /** APIv2：商户 API 密钥（MD5/HMAC）。 */
  const [wechatApiV2Key, setWechatApiV2Key] = useState("");
  const [wechatSignType, setWechatSignType] = useState("MD5");

  const [alipayAppId, setAlipayAppId] = useState("");
  const [alipaySignType, setAlipaySignType] = useState("");
  const [alipayPrivateKey, setAlipayPrivateKey] = useState("");
  const [alipayPublicKey, setAlipayPublicKey] = useState("");

  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalSecret, setPaypalSecret] = useState("");

  const secretPlaceholder = useMemo(() => {
    if (!existing) return "保存后不回显";
    if (existing.hasSecretJson) return "已配置（不回显，留空表示不更新）";
    return "留空表示不设置";
  }, [existing]);

  const suggestedNotifyUrl = useMemo(() => defaultNotifyUrl(channel), [channel]);
  const suggestedGatewayUrl = useMemo(
    () => defaultGatewayUrl(channel, wechatApiVersion),
    [channel, wechatApiVersion],
  );

  const resetChannelFields = useCallback((nextChannel: PaymentChannel) => {
    setWechatApiVersion("v3");
    setWechatAppId("");
    setWechatMchId("");
    setWechatApiV3Key("");
    setWechatApiclientCertPem("");
    setWechatApiclientKeyPem("");
    setWechatApiV2Key("");
    setWechatSignType("MD5");

    setAlipayAppId("");
    setAlipaySignType("");
    setAlipayPrivateKey("");
    setAlipayPublicKey("");

    setPaypalClientId("");
    setPaypalSecret("");

    const defaults = channelDefaults(nextChannel);
    setName(defaults.name);
    setNotifyUrl(defaultNotifyUrl(nextChannel));
    setGatewayUrl(defaultGatewayUrl(nextChannel, "v3"));
  }, []);

  const loadDetail = useCallback(async () => {
    if (!gatewayCode.trim()) {
      navigate("/sys/payments", { replace: true });
      return;
    }

    setLoading(true);
    try {
      const detail = await getPaymentGatewayConfig(gatewayCode);
      setExisting(detail?.id ? detail : null);

      const nextChannel = guessChannel(detail.gatewayCode || gatewayCode) || "wechat";
      setChannel(nextChannel);
      setName(detail.name || channelDefaults(nextChannel).name);
      setEnabled(!!detail.enabled);
      setDescription(detail.description || "");
      setClearSecretJson(false);

      const cfg = parseJsonObject(detail.configJson);
      if (nextChannel === "wechat") {
        const apiVersion = resolveWechatApiVersion(cfg, detail.gatewayCode || gatewayCode);
        setWechatApiVersion(apiVersion);
        setWechatAppId((cfg.appId as string) || "");
        setWechatMchId((cfg.mchId as string) || "");
        setWechatSignType(((cfg.signType as string) || "MD5").toUpperCase() === "HMAC-SHA256" ? "HMAC-SHA256" : "MD5");
        setNotifyUrl(resolveNotifyUrl(nextChannel, detail.notifyUrl));
        setGatewayUrl(resolveGatewayUrl(nextChannel, detail.gatewayUrl, apiVersion));
      } else if (nextChannel === "alipay") {
        setAlipayAppId((cfg.appId as string) || "");
        setAlipaySignType((cfg.signType as string) || "");
        setNotifyUrl(resolveNotifyUrl(nextChannel, detail.notifyUrl));
        setGatewayUrl(resolveGatewayUrl(nextChannel, detail.gatewayUrl));
      } else if (nextChannel === "paypal") {
        setPaypalClientId((cfg.clientId as string) || "");
        setNotifyUrl(resolveNotifyUrl(nextChannel, detail.notifyUrl));
        setGatewayUrl(resolveGatewayUrl(nextChannel, detail.gatewayUrl));
      }
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) {
        const nextChannel = guessChannel(gatewayCode) || "wechat";
        setExisting(null);
        setChannel(nextChannel);
        resetChannelFields(nextChannel);
        setEnabled(false);
        setDescription("");
        setClearSecretJson(false);
        return;
      }
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [gatewayCode, navigate, resetChannelFields]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  function onWechatApiVersionChange(next: WechatApiVersion) {
    setWechatApiVersion(next);
    setWechatApiV3Key("");
    setWechatApiclientCertPem("");
    setWechatApiclientKeyPem("");
    setWechatApiV2Key("");
    if (next === "v2") {
      setWechatSignType("MD5");
    }
    const nextDefault = defaultGatewayUrl("wechat", next);
    if (!gatewayUrl.trim() || gatewayUrl === suggestedGatewayUrl) {
      setGatewayUrl(nextDefault);
    }
  }

  function buildConfigJson(): string {
    let obj: Record<string, unknown> = {};
    if (channel === "wechat") {
      obj = {
        apiVersion: wechatApiVersion,
        appId: wechatAppId || "",
        mchId: wechatMchId || "",
      };
      if (wechatApiVersion === "v2") {
        obj.signType = wechatSignType || "MD5";
      }
    } else if (channel === "alipay") {
      obj = { appId: alipayAppId || "", signType: alipaySignType || "", gatewayUrl: gatewayUrl || "" };
    } else if (channel === "paypal") {
      obj = { clientId: paypalClientId || "" };
    }
    return JSON.stringify(obj);
  }

  function buildSecretJson(): { value?: string; valid: boolean; message?: string } {
    if (clearSecretJson) return { valid: true };
    if (channel === "wechat") {
      if (wechatApiVersion === "v2") {
        if (!wechatApiV2Key) return { valid: true };
        return { valid: true, value: JSON.stringify({ apiKey: wechatApiV2Key }) };
      }
      const any = !!(wechatApiV3Key || wechatApiclientCertPem || wechatApiclientKeyPem);
      if (!any) return { valid: true };
      if (!wechatApiV3Key || !wechatApiclientCertPem || !wechatApiclientKeyPem) {
        return {
          valid: false,
          message: "微信支付 APIv3 敏感字段需一次性完整填写（APIv3密钥 / 商户证书 / 商户私钥）",
        };
      }
      // 后端 PaymentGatewayCredentialSrv 读取 paySignKey / apiV3Key 作为 APIv3Key
      return {
        valid: true,
        value: JSON.stringify({
          paySignKey: wechatApiV3Key,
          apiV3Key: wechatApiV3Key,
          apiclientCertPem: wechatApiclientCertPem,
          apiclientKeyPem: wechatApiclientKeyPem,
        }),
      };
    }
    if (channel === "alipay") {
      const any = !!(alipayPrivateKey || alipayPublicKey);
      if (!any) return { valid: true };
      if (!alipayPrivateKey || !alipayPublicKey) {
        return { valid: false, message: "支付宝敏感字段需一次性完整填写（应用私钥/支付宝公钥）" };
      }
      return { valid: true, value: JSON.stringify({ privateKey: alipayPrivateKey, alipayPublicKey: alipayPublicKey }) };
    }
    if (channel === "paypal") {
      const any = !!paypalSecret;
      if (!any) return { valid: true };
      if (!paypalSecret) {
        return { valid: false, message: "请填写 PayPal secret" };
      }
      return { valid: true, value: JSON.stringify({ secret: paypalSecret }) };
    }
    return { valid: true };
  }

  async function handleSave() {
    if (saving || loading) return;
    if (!gatewayCode.trim()) return;

    if (!name.trim()) {
      setFormError("请输入名称");
      return;
    }

    if (channel === "wechat") {
      if (!wechatAppId.trim() || !wechatMchId.trim()) {
        setFormError("请填写微信 APPID 与商户号");
        return;
      }
      if (wechatApiVersion === "v2" && !existing?.hasSecretJson && !wechatApiV2Key.trim() && !clearSecretJson) {
        setFormError("请填写 APIv2 API 密钥");
        return;
      }
    }

    const secret = buildSecretJson();
    if (!secret.valid) {
      setFormError(secret.message || "敏感字段填写不完整");
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      const cfg = buildConfigJson();
      if (existing) {
        await updatePaymentGatewayConfig(gatewayCode, {
          name: name.trim(),
          enabled,
          notifyUrl: notifyUrl || undefined,
          gatewayUrl: gatewayUrl || undefined,
          configJson: cfg,
          secretJsonEnc: secret.value,
          clearSecretJson,
          description: description || undefined,
        });
      } else {
        await createPaymentGatewayConfig({
          gatewayCode,
          name: name.trim(),
          enabled,
          notifyUrl: notifyUrl || undefined,
          gatewayUrl: gatewayUrl || undefined,
          configJson: cfg,
          secretJsonEnc: secret.value,
          description: description || undefined,
        });
      }
      navigate("/sys/payments", { state: { paymentGatewaySaved: true } });
    } catch (e) {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={
          <div className="page-header-start">
            <Button variant="ghost" size="icon" onClick={() => navigate("/sys/payments")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="page-title">编辑支付配置</h1>
          </div>
        }
      />

      <div className="w-full max-w-[1000px] mx-auto">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-normal">名称</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">启用</label>
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} disabled={loading} />
              <span className="text-sm text-muted-foreground">{enabled ? "启用" : "禁用"}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-normal">回调通知地址</label>
            <Input
              value={notifyUrl}
              onChange={(e) => setNotifyUrl(e.target.value)}
              placeholder={suggestedNotifyUrl}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              须为公网可访问地址。本系统 API 地址为：
              <span className="font-mono break-all"> {suggestedNotifyUrl}</span>
              {notifyUrl.trim() !== suggestedNotifyUrl ? (
                <button
                  type="button"
                  className="ml-2 text-primary underline-offset-2 hover:underline"
                  disabled={loading}
                  onClick={() => setNotifyUrl(suggestedNotifyUrl)}
                >
                  恢复默认
                </button>
              ) : null}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-normal">网关地址</label>
            <Input
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder={suggestedGatewayUrl}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              渠道官方接口地址。系统默认：
              <span className="font-mono break-all"> {suggestedGatewayUrl}</span>
              {suggestedGatewayUrl && gatewayUrl.trim() !== suggestedGatewayUrl ? (
                <button
                  type="button"
                  className="ml-2 text-primary underline-offset-2 hover:underline"
                  disabled={loading}
                  onClick={() => setGatewayUrl(suggestedGatewayUrl)}
                >
                  恢复默认
                </button>
              ) : null}
            </p>
          </div>

          {channel === "wechat" && (
            <>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-normal">微信支付接口版本</label>
                <Select
                  value={wechatApiVersion}
                  onValueChange={(v) => onWechatApiVersionChange(v as WechatApiVersion)}
                  disabled={loading}
                >
                  <SelectTrigger className="workflow-form-select max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="subpage-select-content">
                    <SelectItem className="subpage-select-item" value="v3">
                      APIv3（Native 扫码）
                    </SelectItem>
                    <SelectItem className="subpage-select-item" value="v2">
                      APIv2（统一下单 Native）
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  APIv3 走 `/v3/pay/transactions/native`；APIv2 走 `/pay/unifiedorder`（trade_type=NATIVE）。版本决定凭证字段与回调格式，请与商户平台配置一致。
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-normal">APPID</label>
                <Input
                  value={wechatAppId}
                  onChange={(e) => setWechatAppId(e.target.value)}
                  placeholder="微信公众号/小程序/开放平台 AppID"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-normal">商户号（mchid）</label>
                <Input
                  value={wechatMchId}
                  onChange={(e) => setWechatMchId(e.target.value)}
                  placeholder="微信支付商户号"
                  disabled={loading}
                />
              </div>

              {wechatApiVersion === "v3" ? (
                <>
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-normal">APIv3 密钥</label>
                    <Input
                      type="password"
                      value={wechatApiV3Key}
                      onChange={(e) => setWechatApiV3Key(e.target.value)}
                      placeholder={secretPlaceholder}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      商户平台「账户中心 → API 安全 → APIv3 密钥」，用于回调资源解密（AEAD_AES_256_GCM）。不是 APIv2 的 API 密钥。
                    </p>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-normal">商户 API 证书（apiclient_cert.pem）</label>
                    <Textarea
                      value={wechatApiclientCertPem}
                      onChange={(e) => setWechatApiclientCertPem(e.target.value)}
                      className="min-h-[120px] font-mono text-xs"
                      placeholder={secretPlaceholder || "-----BEGIN CERTIFICATE-----"}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      商户平台下载的 API 证书公钥 PEM；请求签名会从证书解析序列号。
                    </p>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-normal">商户 API 私钥（apiclient_key.pem）</label>
                    <Textarea
                      value={wechatApiclientKeyPem}
                      onChange={(e) => setWechatApiclientKeyPem(e.target.value)}
                      className="min-h-[120px] font-mono text-xs"
                      placeholder={secretPlaceholder || "-----BEGIN PRIVATE KEY-----"}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      与证书配套的商户私钥 PEM，用于 APIv3 请求签名（WECHATPAY2-SHA256-RSA2048）。
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-normal">签名方式（signType）</label>
                    <Select
                      value={wechatSignType}
                      onValueChange={setWechatSignType}
                      disabled={loading}
                    >
                      <SelectTrigger className="workflow-form-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="subpage-select-content">
                        <SelectItem className="subpage-select-item" value="MD5">
                          MD5
                        </SelectItem>
                        <SelectItem className="subpage-select-item" value="HMAC-SHA256">
                          HMAC-SHA256
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2" />
                  <div className="space-y-2 col-span-2">
                    <label className="text-sm font-normal">API 密钥（APIv2）</label>
                    <Input
                      type="password"
                      value={wechatApiV2Key}
                      onChange={(e) => setWechatApiV2Key(e.target.value)}
                      placeholder={secretPlaceholder}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      商户平台「账户中心 → API 安全 → API 密钥」，用于 APIv2 统一下单/查单/回调验签。Native 扫码走
                      `/pay/unifiedorder`（trade_type=NATIVE）。
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {channel === "alipay" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-normal">APPID</label>
                <Input value={alipayAppId} onChange={(e) => setAlipayAppId(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-normal">签名方式（signType）</label>
                <Input value={alipaySignType} onChange={(e) => setAlipaySignType(e.target.value)} placeholder="RSA2" disabled={loading} />
              </div>

              <div className="space-y-2 col-span-2">
                <label className="text-sm font-normal">应用私钥（privateKey）</label>
                <Textarea
                  value={alipayPrivateKey}
                  onChange={(e) => setAlipayPrivateKey(e.target.value)}
                  className="min-h-[120px]"
                  placeholder={secretPlaceholder}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-normal">支付宝公钥（alipayPublicKey）</label>
                <Textarea
                  value={alipayPublicKey}
                  onChange={(e) => setAlipayPublicKey(e.target.value)}
                  className="min-h-[120px]"
                  placeholder={secretPlaceholder}
                  disabled={loading}
                />
              </div>
            </>
          )}

          {channel === "paypal" && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-normal">clientId</label>
                <Input value={paypalClientId} onChange={(e) => setPaypalClientId(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-normal">secret</label>
                <Input
                  type="password"
                  value={paypalSecret}
                  onChange={(e) => setPaypalSecret(e.target.value)}
                  placeholder={secretPlaceholder}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="space-y-2 col-span-2">
            <label className="text-sm font-normal">清空敏感字段</label>
            <div className="flex items-center gap-3">
              <Switch checked={clearSecretJson} onCheckedChange={setClearSecretJson} disabled={loading || !existing} />
              <span className="text-sm text-muted-foreground">{clearSecretJson ? "将清空已保存敏感字段" : "不清空"}</span>
            </div>
          </div>

          <div className="space-y-2 col-span-2">
            <label className="text-sm font-normal">描述</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px]" disabled={loading} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <div className="flex justify-end gap-3">
            <Button variant="pageOutline" onClick={() => navigate("/sys/payments")} disabled={saving}>
              返回
            </Button>
            <Button variant="page" onClick={handleSave} disabled={saving || loading}>
              <Save className="w-4 h-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
