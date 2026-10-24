import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, HttpError } from "@/shared/api/sys/http";
import { getAccessToken, getRememberMe, setAccessToken, setRefreshToken } from "@/shared/api/auth/auth";
import { consumeWechatOpenOauthState } from "@/shared/api/auth/wechat-open-oauth";
import {
  parsePhoneBindFromHttpBody,
  peekPendingPhoneBind,
  savePendingPhoneBind,
} from "@/shared/api/auth/pending-phone-bind";
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

type LoginOutcome =
  | { kind: "authenticated" }
  | { kind: "bind_phone"; bind: { bindToken: string; expiresAt: number; channel: string } }
  | { kind: "error"; message: string };

const CODE_RESULT_PREFIX = "wechat_open_oauth_code_result:";
const INFLIGHT = "inflight";

/** 同一 JS 上下文内复用换票 Promise（Strict Mode / 同页重复 effect）。 */
const inflightByCode = new Map<string, Promise<LoginOutcome>>();

function resultKey(code: string) {
  return `${CODE_RESULT_PREFIX}${code}`;
}

function writeCodeResult(code: string, value: typeof INFLIGHT | LoginOutcome) {
  try {
    sessionStorage.setItem(resultKey(code), JSON.stringify(value === INFLIGHT ? { kind: INFLIGHT } : value));
  } catch {
    // ignore
  }
}

function readCodeResult(code: string): typeof INFLIGHT | LoginOutcome | null {
  try {
    const raw = sessionStorage.getItem(resultKey(code));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      kind?: string;
      message?: string;
      bind?: { bindToken?: string; expiresAt?: number; channel?: string };
    };
    if (parsed?.kind === INFLIGHT) return INFLIGHT;
    if (parsed?.kind === "authenticated") return { kind: "authenticated" };
    if (parsed?.kind === "bind_phone" && parsed.bind?.bindToken) {
      return {
        kind: "bind_phone",
        bind: {
          bindToken: parsed.bind.bindToken,
          expiresAt: Number(parsed.bind.expiresAt) || 0,
          channel: parsed.bind.channel || "wechat",
        },
      };
    }
    if (parsed?.kind === "error" && typeof parsed.message === "string") {
      return { kind: "error", message: parsed.message };
    }
    return null;
  } catch {
    return null;
  }
}

function clearCodeResult(code: string) {
  try {
    sessionStorage.removeItem(resultKey(code));
  } catch {
    // ignore
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** 另一窗口/上次导航已在换票时，轮询 sessionStorage 结果。 */
async function waitForCodeResult(code: string, timeoutMs = 12_000): Promise<LoginOutcome | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (getAccessToken()) return { kind: "authenticated" };
    const pending = peekPendingPhoneBind();
    if (pending?.bindToken) {
      return {
        kind: "bind_phone",
        bind: {
          bindToken: pending.bindToken,
          expiresAt: pending.expiresAt,
          channel: pending.channel || "wechat",
        },
      };
    }
    const stored = readCodeResult(code);
    if (stored && stored !== INFLIGHT) return stored;
    if (stored !== INFLIGHT) return null;
    await sleep(200);
  }
  return readCodeResult(code) === INFLIGHT
    ? { kind: "error", message: "登录处理超时，请返回登录页重新扫码" }
    : null;
}

function isEmbeddedInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** WxLogin self_redirect 时回调先落在 iframe；只提升到顶层，不在此换票。 */
function promoteCallbackToTop(): boolean {
  try {
    const topWin = window.top;
    if (!topWin || topWin === window.self) return false;
    const href = window.location.href;
    // 顶层已是同一回调则无需再 replace，避免打断换票
    if (topWin.location.href === href) return true;
    topWin.location.replace(href);
    return true;
  } catch {
    return false;
  }
}

function goBindPhone(
  navigate: ReturnType<typeof useNavigate>,
  bind: {
    bindToken: string;
    expiresAt: number;
    channel: string;
  },
) {
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

function recoverIfAlreadyDone(navigate: ReturnType<typeof useNavigate>): boolean {
  if (getAccessToken()) {
    navigate("/", { replace: true });
    return true;
  }
  const pending = peekPendingPhoneBind();
  if (pending?.bindToken) {
    navigate("/login", { replace: true });
    return true;
  }
  return false;
}

function applyOutcome(navigate: ReturnType<typeof useNavigate>, outcome: LoginOutcome, setMessage: (m: string) => void) {
  if (outcome.kind === "authenticated") {
    navigate("/", { replace: true });
    return;
  }
  if (outcome.kind === "bind_phone") {
    setMessage("微信已确认，请绑定手机号…");
    goBindPhone(navigate, outcome.bind);
    return;
  }
  setMessage(outcome.message);
}

async function doExchange(code: string, state: string | null): Promise<LoginOutcome> {
  if (!consumeWechatOpenOauthState(state)) {
    return { kind: "error", message: "微信授权校验失败，请返回登录页重新扫码" };
  }

  try {
    const flow = await apiFetch<AuthFlowResponse>("/api/auth/login/wechat", {
      method: "POST",
      withAuth: false,
      body: JSON.stringify({ channel: "open", code, platformCode: "ai_admin", rememberMe: getRememberMe() }),
    });
    if (flow.status === "authenticated" && flow.token?.accessToken && flow.token?.refreshToken) {
      setAccessToken(flow.token.accessToken);
      setRefreshToken(flow.token.refreshToken);
      return { kind: "authenticated" };
    }
    if (flow.status === "phone_bind_required" && flow.nextAction?.bindToken) {
      return {
        kind: "bind_phone",
        bind: {
          bindToken: flow.nextAction.bindToken,
          expiresAt: flow.nextAction.expiresAt,
          channel: flow.nextAction.channel || "wechat",
        },
      };
    }
    return { kind: "error", message: "登录状态未识别，请返回登录页重试" };
  } catch (e) {
    if (e instanceof HttpError && (hasBackendErrorCode(e, "AUTH-428-PHONE-BIND-REQUIRED") || e.status === 428)) {
      const fromBody = parsePhoneBindFromHttpBody(e.body);
      const next =
        fromBody ??
        (() => {
          const body = e.body as { data?: AuthFlowResponse } | undefined;
          const n = body?.data?.nextAction;
          return n?.bindToken
            ? { bindToken: n.bindToken, expiresAt: n.expiresAt, channel: n.channel || "wechat" }
            : null;
        })();
      if (next?.bindToken) {
        return {
          kind: "bind_phone",
          bind: {
            bindToken: next.bindToken,
            expiresAt: next.expiresAt,
            channel: next.channel || "wechat",
          },
        };
      }
    }
    return { kind: "error", message: resolveUserErrorMessage(e, "微信登录失败，请返回登录页重试") };
  }
}

async function exchangeWechatOpenCode(code: string, state: string | null): Promise<LoginOutcome> {
  const existing = inflightByCode.get(code);
  if (existing) return existing;

  const stored = readCodeResult(code);
  if (stored && stored !== INFLIGHT) return stored;
  if (stored === INFLIGHT) {
    const waited = await waitForCodeResult(code);
    if (waited) return waited;
  }

  const task = (async (): Promise<LoginOutcome> => {
    // 跨顶层二次 navigation：先占坑，避免另一页再打微信
    writeCodeResult(code, INFLIGHT);
    const outcome = await doExchange(code, state);
    writeCodeResult(code, outcome);
    return outcome;
  })();

  inflightByCode.set(code, task);
  try {
    return await task;
  } finally {
    window.setTimeout(() => {
      inflightByCode.delete(code);
      // 成功结果可留着防重复；错误/超时清掉，便于用户重新扫码后同码不会误伤（微信码本就一次性）
      const final = readCodeResult(code);
      if (final && final !== INFLIGHT && final.kind === "error") {
        clearCodeResult(code);
      }
    }, 15_000);
  }
}

/**
 * 微信开放平台网站应用扫码回调：PC 浏览器带回 code，完成登录或引导绑定手机号。
 */
const WechatOpenCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("正在完成微信登录…");

  useEffect(() => {
    const run = async () => {
      const code = (searchParams.get("code") || "").trim();
      const state = searchParams.get("state");
      if (!code) {
        setMessage("微信授权失败：缺少 code，请返回登录页重试");
        return;
      }

      // self_redirect：确认后先在 iframe 打开本页；此处只提升顶层，由顶层唯一换票
      if (isEmbeddedInIframe()) {
        setMessage("正在完成微信登录…");
        if (!promoteCallbackToTop()) {
          const outcome = await exchangeWechatOpenCode(code, state);
          applyOutcome(navigate, outcome, setMessage);
        }
        return;
      }

      if (recoverIfAlreadyDone(navigate)) return;

      const outcome = await exchangeWechatOpenCode(code, state);
      applyOutcome(navigate, outcome, setMessage);
    };

    void run();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-[16px] font-medium text-foreground">{message}</div>
        <button
          type="button"
          className="text-[13px] text-primary hover:underline"
          onClick={() => navigate("/login", { replace: true })}
        >
          返回登录页
        </button>
      </div>
    </div>
  );
};

export default WechatOpenCallbackPage;
