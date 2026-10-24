import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, HttpError } from "@/shared/api/sys/http";
import { getRememberMe, setAccessToken, setRefreshToken } from "@/shared/api/auth/auth";
import {
  consumeSsoOauthState,
  isSsoProviderCode,
  ssoProviderLabel,
  type SsoProviderCode,
} from "@/shared/api/auth/sso-oauth";
import { hasBackendErrorCode, resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import {
  parsePhoneBindFromHttpBody,
  savePendingPhoneBind,
} from "@/shared/api/auth/pending-phone-bind";

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
  channel: string;
};

type AuthFlowResponse = {
  status: string;
  token: TokenPair | null;
  nextAction: AuthFlowAction | null;
};

type SsoOauthCallbackPageProps = {
  providerCode: SsoProviderCode;
};

function goBindPhone(
  navigate: ReturnType<typeof useNavigate>,
  providerCode: SsoProviderCode,
  bind: { bindToken: string; expiresAt: number; channel?: string }
) {
  const channel = bind.channel || providerCode;
  const bindRequired = {
    action: "bind_phone" as const,
    bindToken: bind.bindToken,
    expiresAt: bind.expiresAt,
    channel,
  };
  savePendingPhoneBind({
    ...bindRequired,
    loginTab: providerCode,
  });
  navigate("/login", {
    replace: true,
    state: { bindRequired, loginTab: providerCode },
  });
}

/**
 * 第三方 OAuth 回调：校验 state → POST 换票 → 登录或跳转绑手机。
 */
export function SsoOauthCallbackPage({ providerCode }: SsoOauthCallbackPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const label = ssoProviderLabel(providerCode);
  const [message, setMessage] = useState(`正在完成${label}登录…`);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      const code = (searchParams.get("code") || "").trim();
      const state = searchParams.get("state");
      if (!code) {
        setMessage(`${label}授权失败：缺少 code，请返回登录页重试`);
        return;
      }
      if (!consumeSsoOauthState(providerCode, state)) {
        setMessage(`${label}授权校验失败，请返回登录页重新授权`);
        return;
      }
      try {
        const flow = await apiFetch<AuthFlowResponse>(`/api/auth/login/${encodeURIComponent(providerCode)}`, {
          method: "POST",
          withAuth: false,
          body: JSON.stringify({ code, platformCode: "ai_admin", rememberMe: getRememberMe() }),
        });
        if (flow.status === "authenticated" && flow.token?.accessToken && flow.token?.refreshToken) {
          setAccessToken(flow.token.accessToken);
          setRefreshToken(flow.token.refreshToken);
          navigate("/", { replace: true });
          return;
        }
        if (flow.status === "phone_bind_required" && flow.nextAction?.bindToken) {
          goBindPhone(navigate, providerCode, flow.nextAction);
          return;
        }
        setMessage("登录状态未识别，请返回登录页重试");
      } catch (e) {
        if (e instanceof HttpError && (hasBackendErrorCode(e, "AUTH-428-PHONE-BIND-REQUIRED") || e.status === 428)) {
          const fromBody = parsePhoneBindFromHttpBody(e.body);
          const next = fromBody ?? (e.body as { data?: AuthFlowResponse } | undefined)?.data?.nextAction;
          if (next?.bindToken) {
            goBindPhone(navigate, providerCode, {
              bindToken: next.bindToken,
              expiresAt: next.expiresAt,
              channel: next.channel || providerCode,
            });
            return;
          }
        }
        setMessage(resolveUserErrorMessage(e, `${label}登录失败，请返回登录页重试`));
      }
    };

    void run();
  }, [navigate, providerCode, label, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-3 max-w-sm">
        <div className="text-[16px] font-medium text-foreground">{message}</div>
      </div>
    </div>
  );
}

export function DingtalkCallbackPage() {
  return <SsoOauthCallbackPage providerCode="dingtalk" />;
}

export function GoogleCallbackPage() {
  return <SsoOauthCallbackPage providerCode="google" />;
}

export function FeishuCallbackPage() {
  return <SsoOauthCallbackPage providerCode="feishu" />;
}

export function resolveSsoProviderFromPath(pathname: string): SsoProviderCode | null {
  if (pathname.includes("/auth/dingtalk/")) return "dingtalk";
  if (pathname.includes("/auth/google/")) return "google";
  if (pathname.includes("/auth/feishu/")) return "feishu";
  return null;
}

export function isValidSsoProviderParam(value: string | undefined): value is SsoProviderCode {
  return !!value && isSsoProviderCode(value);
}

export default SsoOauthCallbackPage;
