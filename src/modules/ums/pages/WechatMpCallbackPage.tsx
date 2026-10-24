import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  completeWechatMpScan,
  parseWechatMpScanTicketFromState,
} from "@/shared/api/auth/wechat-mp-oauth";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";

/**
 * 微信公众号扫码 OAuth 回调：写回 ticket，提示用户返回电脑端。
 */
const WechatMpCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("正在完成微信登录…");
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      const code = (searchParams.get("code") || "").trim();
      const ticket = parseWechatMpScanTicketFromState(searchParams.get("state"));
      if (!code || !ticket) {
        setMessage("微信授权失败，请返回电脑端刷新二维码后重试");
        setDone(true);
        return;
      }
      try {
        const status = await completeWechatMpScan(ticket, code);
        if (status.status === "authenticated") {
          setMessage("登录成功，请返回电脑端继续");
        } else if (status.status === "phone_bind_required") {
          setMessage("需绑定手机号，请返回电脑端完成绑定");
        } else {
          setMessage("授权已处理，请返回电脑端查看结果");
        }
      } catch (e) {
        setMessage(resolveUserErrorMessage(e, "微信登录失败，请返回电脑端重试"));
      } finally {
        setDone(true);
      }
    };

    void run();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-3 max-w-sm">
        <div className="text-[16px] font-medium text-foreground">{message}</div>
        <div className="text-[13px] text-muted-foreground">
          {done ? "可关闭本页面" : "请稍候，不要关闭页面"}
        </div>
      </div>
    </div>
  );
};

export default WechatMpCallbackPage;
