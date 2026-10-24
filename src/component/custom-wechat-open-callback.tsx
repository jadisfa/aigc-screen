import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, HttpError } from "@/shared/api/sys/http";
import { setAccessToken, setRefreshToken } from "@/shared/api/auth/auth";
import { consumeWechatOpenOauthState } from "@/shared/api/auth/wechat-open-oauth";
import { useSetOpenCallback } from "@/shared/hooks/use-set-open-callback";
import {
  parsePhoneBindFromHttpBody,
  peekPendingPhoneBind,
  savePendingPhoneBind,
} from "@/shared/api/auth/pending-phone-bind";
import { Spin } from "antd";
import { hasBackendErrorCode, resolveUserErrorMessage } from "@/shared/api/sys/error-message";

type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
};

type AuthFlowAction = {
  action: "bind_phone";
  bindToken: string;
  expiresAt: number;
  channel: "email" | "wechat" | "username";
};

type AuthFlowResponse = {
  status: string;
  token: TokenPair | null;
  nextAction: AuthFlowAction | null;
};

const CODE_USED_PREFIX = "wechat_open_oauth_code_used:";

function markCodeUsed(code: string) {
  try {
    sessionStorage.setItem(`${CODE_USED_PREFIX}${code}`, "1");
  } catch {
    // ignore
  }
}

function isCodeUsed(code: string): boolean {
  try {
    return sessionStorage.getItem(`${CODE_USED_PREFIX}${code}`) === "1";
  } catch {
    return false;
  }
}

function goBindPhone(navigate: ReturnType<typeof useNavigate>, bind: {
  bindToken: string;
  expiresAt: number;
  channel: string;
}) {
  const bindRequired = {
    action: "bind_phone" as const,
    bindToken: bind.bindToken,
    expiresAt: bind.expiresAt,
    channel: bind.channel,
  };
  savePendingPhoneBind({
    ...bindRequired,
    loginTab: "wechat",
  });
  navigate("/login", {
    replace: true,
    state: { bindRequired, loginTab: "wechat" as const },
  });
}

/**
 * 微信开放平台网站应用扫码回调：PC 浏览器带回 code，完成登录或引导绑定手机号。
 */
const CustomWechatOpenCallback = () => {
  const [searchParams] = useSearchParams();
  const { bindRequire, setBindRequire, clearBind  } = useSetOpenCallback();
  const navigate = useNavigate();
  const [message, setMessage] = useState("正在完成微信登录…");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      const code = (searchParams.get("code") || "").trim();
      const state = searchParams.get("state");
      if (!code) {
        setMessage("微信授权失败：缺少 code，请返回登录页重试");
        return;
      }

      // iframe + 顶层可能各进一次回调；code 只能换票一次
      if (isCodeUsed(code)) {
        const pending = peekPendingPhoneBind();
        if (pending?.bindToken) {
          navigate("/login", { replace: true });
          return;
        }
        setMessage("授权码已使用，请返回登录页重新扫码");
        return;
      }

      if (!consumeWechatOpenOauthState(state)) {
        setMessage("微信授权校验失败，请返回登录页重新扫码");
        return;
      }

      markCodeUsed(code);

      try {
        const flow = await apiFetch<AuthFlowResponse>("/api/auth/login/wechat", {
          method: "POST",
          withAuth: false,
          body: JSON.stringify({ channel: "open", code, platformCode: "ai_admin", rememberMe: true }),
        });
        console.log(115, flow, 'custom-weichat-open-callback')
        if (flow.status === "authenticated" && flow.token?.accessToken && flow.token?.refreshToken) {
          setAccessToken(flow.token.accessToken);
          setRefreshToken(flow.token.refreshToken);
          const parentHandler = (window.opener || window.parent) as any;
          // window.close();
          if (parentHandler?.__handleWechatBind) {
            // 有父级页面，无感关闭当前页并触发绑定
            parentHandler.__handleWechatBind();
            // 关闭当前回调页面
            window.close();
            return;
          }
          return;
        }
        if (flow.status === "phone_bind_required" && flow.nextAction?.bindToken) {
          setMessage("微信已确认，请绑定手机号…");
          goBindPhone(navigate, flow.nextAction);
          return;
        }
        setMessage("登录状态未识别，请返回登录页重试");
      } catch (e) {
        if (e instanceof HttpError && (hasBackendErrorCode(e, "AUTH-428-PHONE-BIND-REQUIRED") || e.status === 428)) {
          const fromBody = parsePhoneBindFromHttpBody(e.body);
          const next = fromBody ?? (() => {
            const body = e.body as { data?: AuthFlowResponse } | undefined;
            const n = body?.data?.nextAction;
            return n?.bindToken
              ? { bindToken: n.bindToken, expiresAt: n.expiresAt, channel: n.channel || "wechat" }
              : null;
          })();
          if (next?.bindToken) {
            setMessage("微信已确认，请绑定手机号…");
            console.log('未绑定')
            const parentHandler = (window.opener || window.parent) as any;
          if (parentHandler?.__handleWechatBind) {
            // 有父级页面，无感关闭当前页并触发绑定
            parentHandler.__handleWechatBind(next?.bindToken);
            // 关闭当前回调页面
            window.close();
            return;
          }
            return;
          }
        }
        setMessage(resolveUserErrorMessage(e, "微信登录失败，请返回登录页重试"));
      }
    };

    void run();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <Spin spinning={true}></Spin>
    </div>
  );
};

export default CustomWechatOpenCallback;
