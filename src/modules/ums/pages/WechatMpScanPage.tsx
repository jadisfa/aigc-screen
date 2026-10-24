import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  isWechatInAppBrowser,
  markWechatMpScanScanned,
  redirectWechatMpOauthForScan,
} from "@/shared/api/auth/wechat-mp-oauth";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";

/**
 * 微信扫码落地页：仅应在微信内打开，标记已扫码后跳转公众号网页授权。
 */
const WechatMpScanPage = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("正在打开微信授权…");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      const ticket = (searchParams.get("ticket") || "").trim();
      if (!ticket) {
        setMessage("无效的登录二维码，请返回电脑端刷新后重试");
        return;
      }
      if (!isWechatInAppBrowser()) {
        setMessage("请使用微信扫一扫打开此页面完成登录");
        return;
      }
      try {
        const status = await markWechatMpScanScanned(ticket);
        if (!status.appId) {
          setMessage("公众号未配置，请联系管理员");
          return;
        }
        redirectWechatMpOauthForScan(status.appId, ticket);
      } catch (e) {
        setMessage(resolveUserErrorMessage(e, "二维码已失效，请返回电脑端刷新"));
      }
    };

    void run();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-3 max-w-sm">
        <div className="text-[16px] font-medium text-foreground">{message}</div>
        <div className="text-[13px] text-muted-foreground">授权完成后请返回电脑端查看登录结果</div>
      </div>
    </div>
  );
};

export default WechatMpScanPage;
