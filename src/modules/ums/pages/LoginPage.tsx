import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent } from "@/shared/ui/tabs";
import { notify } from "@/shared/lib/notify";
import { apiFetch } from "@/shared/api/sys/http";
import { setAccessToken, setRefreshToken, setRememberMe, getRememberMe, getAccessToken, getRefreshToken, clearAuthSession } from "@/shared/api/auth/auth";
import {
  fetchLoginProviders,
  isSsoLoginTab,
  resolveLoginPageTabs,
  type LoginPageTab,
} from "@/shared/api/auth/login-providers";
import {
  startSsoAuthorize,
  ssoProviderLabel,
  type SsoProviderCode,
} from "@/shared/api/auth/sso-oauth";
import {
  buildWechatMpQrDataUrl,
  buildWechatMpScanPageUrl,
  consumeWechatMpScan,
  createWechatMpScanTicket,
  fetchWechatMpScanStatus,
  type WechatMpScanStatus,
} from "@/shared/api/auth/wechat-mp-oauth";
import {
  createWechatOpenOauthState,
  fetchWechatScanMode,
  mountWechatOpenQr,
  WECHAT_OPEN_QR_DISPLAY_PX,
} from "@/shared/api/auth/wechat-open-oauth";
import {
  claimPendingPhoneBind,
  clearPendingPhoneBind,
  pendingBindToAction,
  savePendingPhoneBind,
} from "@/shared/api/auth/pending-phone-bind";
import { resolveUserErrorMessage, resolveUserErrorNotice } from "@/shared/api/sys/error-message";
import { isAccessTokenExpired, tryRefreshToken } from "@/shared/api/auth/token-refresh";
import { getMePermissions } from "@/shared/api/ums/iam";
import { getMePermissionsQueryKey } from "@/shared/hooks/use-me-permissions";
import { CONSOLE_SOURCE_CODE } from "@/shared/lib/permissions";
import { shouldForceLoginOnPermissionsError } from "@/shared/lib/session-guards";
import { LoginBackdrop } from "@/modules/ums/components/login/LoginBackdrop";
import {
  LoginAccountPanel,
  LoginBindPanel,
  LoginChannelTabs,
  LoginEmailPanel,
  LoginPhonePanel,
  LoginSsoPanel,
  LoginWechatPanel,
} from "@/modules/ums/components/login/LoginFormPanels";
import { LoginLegalLinks } from "@/modules/ums/components/login/LoginLegalLinks";
import { LoginSessionOverlay } from "@/modules/ums/components/login/LoginSessionOverlay";
import { LoginBrandHeader, LoginMobileBrand, LoginShowcase } from "@/modules/ums/components/login/LoginShowcase";
import {
  LOGIN_PLATFORM_CODE,
  extractAuthenticatedToken,
  getBindRequiredFromError,
  isOtpSendTooFrequent,
  isValidEmail,
  isValidOtp,
  isValidPhone,
  resolveLoginRedirect,
  type AuthFlowAction,
  type AuthFlowResponse,
  type OtpSendResponse,
  type TokenPair,
} from "@/modules/ums/components/login/loginFlow";
import {
  LOGIN_LAYOUT_CSS,
  LOGIN_TAB_PANEL,
  PAGE_BG,
  TEXT_BODY,
  TEXT_MUTED,
} from "@/modules/ums/components/login/loginTheme";
import { beginOtpCooldown, remainingOtpCooldown } from "@/modules/ums/components/login/otpCooldown";

const LoginLayoutStyle = memo(function LoginLayoutStyle() {
  return <style>{LOGIN_LAYOUT_CSS}</style>;
});

function loginCardSubtitle(tab: LoginPageTab, binding: boolean): string {
  if (binding) return "请验证手机号以完成登录；若该手机号已注册将自动合并账号。";
  if (tab === "phone") return "使用手机号验证码登录";
  if (tab === "email") return "使用邮箱验证码登录";
  if (tab === "account") return "使用账号密码登录";
  return "非手机号渠道首次登录需绑定手机号";
}

/**
 * 登录页（多渠道 + 强制手机号绑定）。
 *
 * 业务流程：
 * - 手机号登录：验证码校验通过后直接登录（手机号是账号统一入口，不需要绑定步骤）。
 * - 邮箱/微信登录：若后端返回 428（PHONE_BIND_REQUIRED），进入“绑定手机号”流程；
 *   绑定成功后后端会完成账号合并/创建并签发 token。
 *
 * 异常处理：
 * - 428：安静进入绑定手机号 UI（不弹错误 toast）
 * - 其它错误：统一 toast 提示，保持页面状态可继续操作
 */
const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [loginTab, setLoginTab] = useState<LoginPageTab>("phone");
  const [visibleTabs, setVisibleTabs] = useState<LoginPageTab[]>(["phone", "email", "wechat"]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wechatQrUrl, setWechatQrUrl] = useState("");
  const [wechatTicket, setWechatTicket] = useState("");
  const [wechatScanHint, setWechatScanHint] = useState("请使用微信扫一扫");
  const [wechatOauthLoading, setWechatOauthLoading] = useState(false);
  const [wechatScanMode, setWechatScanMode] = useState<"open" | "mp" | "none">("none");
  const [ssoStarting, setSsoStarting] = useState<SsoProviderCode | null>(null);
  const [openQrMount, setOpenQrMount] = useState<{
    appId: string;
    redirectUri: string;
    state: string;
    seq: number;
  } | null>(null);
  const [rememberMe, setRememberMeState] = useState(getRememberMe());
  const [sessionChecking, setSessionChecking] = useState(() => Boolean(getAccessToken() || getRefreshToken()));

  const handleRememberMeChange = useCallback((checked: boolean | "indeterminate") => {
    const next = checked === true;
    setRememberMeState(next);
    setRememberMe(next);
  }, []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");

  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");

  const [bindRequired, setBindRequired] = useState<AuthFlowAction | null>(() => {
    const action = pendingBindToAction(claimPendingPhoneBind());
    if (!action) return null;
    return {
      action: "bind_phone",
      bindToken: action.bindToken,
      expiresAt: action.expiresAt,
      channel: action.channel,
    };
  });
  const [bindPassword, setBindPassword] = useState("");
  const [showBindPassword, setShowBindPassword] = useState(false);
  const enteredWithPhoneBindRef = useRef(!!bindRequired);

  const togglePassword = useCallback(() => setShowPassword((v) => !v), []);
  const toggleBindPassword = useCallback(() => setShowBindPassword((v) => !v), []);

  const loginValuesRef = useRef({
    loginTab,
    username,
    password,
    phone,
    smsCode,
    email,
    emailCode,
    rememberMe,
    bindRequired,
    bindPassword,
  });
  loginValuesRef.current = {
    loginTab,
    username,
    password,
    phone,
    smsCode,
    email,
    emailCode,
    rememberMe,
    bindRequired,
    bindPassword,
  };

  useEffect(() => {
    if (bindRequired) {
      setSessionChecking(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const access = getAccessToken();
      const refresh = getRefreshToken();
      if (!access && !refresh) {
        if (!cancelled) setSessionChecking(false);
        return;
      }
      try {
        if (!access || isAccessTokenExpired(access)) {
          if (!refresh) {
            clearAuthSession();
            if (!cancelled) setSessionChecking(false);
            return;
          }
          const outcome = await tryRefreshToken(true);
          if (outcome === "invalid") {
            clearAuthSession();
            if (!cancelled) setSessionChecking(false);
            return;
          }
          if (!getAccessToken()) {
            if (!cancelled) setSessionChecking(false);
            return;
          }
        }
        await queryClient.fetchQuery({
          queryKey: getMePermissionsQueryKey(getAccessToken(), CONSOLE_SOURCE_CODE),
          queryFn: () => getMePermissions(),
          staleTime: 5 * 60 * 1000,
        });
        if (cancelled) return;
        const from = (location.state as { from?: string } | null)?.from;
        navigate(resolveLoginRedirect(from), { replace: true });
      } catch (error) {
        if (shouldForceLoginOnPermissionsError(error)) {
          clearAuthSession();
        }
        if (!cancelled) setSessionChecking(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [bindRequired, location.state, navigate, queryClient]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const providers = await fetchLoginProviders();
        if (cancelled) return;
        const resolved = resolveLoginPageTabs(providers);
        setVisibleTabs(resolved.tabs);
        if (!enteredWithPhoneBindRef.current) {
          setLoginTab(resolved.defaultTab);
        }
      } catch {
        if (!cancelled) {
          setVisibleTabs(["phone", "email", "wechat"]);
          if (!enteredWithPhoneBindRef.current) {
            setLoginTab("phone");
          }
        }
      } finally {
        if (!cancelled) setProvidersLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const state = location.state as { bindRequired?: AuthFlowAction; loginTab?: LoginPageTab } | null;
    if (!state?.bindRequired?.bindToken) return;
    enteredWithPhoneBindRef.current = true;
    setBindRequired(state.bindRequired);
    setBindPassword("");
    const preferred = state.loginTab || "wechat";
    setLoginTab(visibleTabs.includes(preferred) ? preferred : visibleTabs[0] || "phone");
    savePendingPhoneBind({
      action: "bind_phone",
      bindToken: state.bindRequired.bindToken,
      expiresAt: state.bindRequired.expiresAt,
      channel: state.bindRequired.channel,
      loginTab: preferred,
    });
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, visibleTabs]);

  const refreshWechatMpQr = async () => {
    console.log(352, refreshWechatMpQr)
    setWechatOauthLoading(true);
    setWechatScanHint("正在生成…");
    try {
      const created = await createWechatMpScanTicket(LOGIN_PLATFORM_CODE, rememberMe);
      const scanUrl = buildWechatMpScanPageUrl(created.ticket);
      setWechatTicket(created.ticket);
      setWechatQrUrl(await buildWechatMpQrDataUrl(scanUrl, 320));
      setWechatScanMode("mp");
      setWechatScanHint("请使用微信扫一扫");
    } catch (e) {
      setWechatTicket("");
      setWechatQrUrl("");
      setWechatScanHint(resolveUserErrorMessage(e, "二维码生成失败"));
      notify.error(resolveUserErrorMessage(e, "无法生成微信登录二维码"));
    } finally {
      setWechatOauthLoading(false);
    }
  };

  const refreshWechatOpenQr = async (appId: string, redirectUri: string) => {
    console.log(refreshWechatOpenQr, 374)
    setWechatOauthLoading(true);
    setWechatScanHint("正在生成…");
    setWechatTicket("");
    setWechatQrUrl("");
    try {
      const state = createWechatOpenOauthState();
      setWechatScanMode("open");
      setOpenQrMount({ appId, redirectUri, state, seq: Date.now() });
      setWechatScanHint("请使用微信扫一扫");
    } catch (e) {
      setWechatScanHint(resolveUserErrorMessage(e, "二维码生成失败"));
      notify.error(resolveUserErrorMessage(e, "无法生成微信登录二维码"));
    } finally {
      setWechatOauthLoading(false);
    }
  };

  const refreshWechatQr = async () => {
    setWechatOauthLoading(true);
    setWechatScanHint("正在生成…");
    try {
      const mode = await fetchWechatScanMode();
      console.log(mode, 398)
      if (mode.mode === "open" && mode.appId && mode.redirectUri) {
        await refreshWechatOpenQr(mode.appId, mode.redirectUri);
        return;
      }
      if (mode.mode === "mp") {
        setOpenQrMount(null);
        await refreshWechatMpQr();
        return;
      }
      setOpenQrMount(null);
      setWechatScanMode("none");
      setWechatTicket("");
      setWechatQrUrl("");
      setWechatScanHint("微信登录未启用");
      setWechatOauthLoading(false);
    } catch (e) {
      setOpenQrMount(null);
      setWechatScanMode("none");
      setWechatScanHint(resolveUserErrorMessage(e, "二维码生成失败"));
      notify.error(resolveUserErrorMessage(e, "无法生成微信登录二维码"));
      setWechatOauthLoading(false);
    }
  };

  useEffect(() => {
    if (loginTab !== "wechat" || bindRequired || sessionChecking) return;
    void refreshWechatQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginTab, bindRequired, sessionChecking]);

  useEffect(() => {
    if (loginTab !== "wechat" || wechatScanMode !== "open" || !openQrMount || bindRequired) return;
    console.log(433, '微信')
    const timer = window.setTimeout(() => {
      mountWechatOpenQr({
        containerId: "wechat-open-qr",
        appId: openQrMount.appId,
        redirectUri: openQrMount.redirectUri,
        state: openQrMount.state,
        sizePx: WECHAT_OPEN_QR_DISPLAY_PX,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loginTab, wechatScanMode, openQrMount, bindRequired]);

  useEffect(() => {
    if (loginTab !== "wechat" || wechatScanMode !== "mp" || !wechatTicket || bindRequired) return;
    let stopped = false;
    const timer = window.setInterval(async () => {
      try {
        console.log(wechatScanMode, 451)
        const status = await fetchWechatMpScanStatus(wechatTicket);
        if (stopped) return;
        await handleWechatScanStatus(status);
      } catch {
        // 轮询失败不打断，等待下次
      }
    }, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginTab, wechatTicket, wechatScanMode, bindRequired]);

  const finishLogin = useCallback((pair: TokenPair) => {
    if (!pair.accessToken.trim() || !pair.refreshToken.trim()) {
      notify.error("登录响应缺少有效 token，请联系管理员检查认证接口返回");
      return;
    }
    setAccessToken(pair.accessToken);
    setRefreshToken(pair.refreshToken);
    navigate("/");
  }, [navigate]);

  const handleSendSms = useCallback(async () => {
    const { phone, bindRequired } = loginValuesRef.current;
    if (!isValidPhone(phone)) {
      notify.error("请输入正确的手机号");
      return false;
    }
    if (remainingOtpCooldown("sms") > 0) {
      notify.error("验证码发送过于频繁，请稍后再试");
      return false;
    }
    const scene = bindRequired ? "bind_phone" : "login";
    try {
      await apiFetch<OtpSendResponse>("/api/auth/sms/send", {
        method: "POST",
        withAuth: false,
        body: JSON.stringify({ phone, platformCode: LOGIN_PLATFORM_CODE, scene }),
      });
      notify.success("验证码已发送");
    } catch (e) {
      const notice = resolveUserErrorNotice(e, "验证码发送失败，请稍后重试", "发送失败");
      notify.error(notice.title ?? "发送失败", { description: notice.description });
      if (isOtpSendTooFrequent(e)) {
        beginOtpCooldown("sms");
      }
      return false;
    }
  }, []);

  const handleSendEmail = useCallback(async () => {
    const { email } = loginValuesRef.current;
    if (!isValidEmail(email)) {
      notify.error("请输入正确的邮箱");
      return false;
    }
    try {
      await apiFetch<OtpSendResponse>("/api/auth/email/send", {
        method: "POST",
        withAuth: false,
        body: JSON.stringify({ email }),
      });
      notify.success("验证码已发送");
    } catch (e) {
      const notice = resolveUserErrorNotice(e, "验证码发送失败，请稍后重试", "发送失败");
      notify.error(notice.title ?? "发送失败", { description: notice.description });
      return false;
    }
  }, []);

  const handleWechatMpOauth = useCallback(() => {
    void refreshWechatQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberMe]);

  const handleSsoAuthorize = useCallback(async (providerCode: SsoProviderCode) => {
    setSsoStarting(providerCode);
    try {
      await startSsoAuthorize(providerCode);
    } catch (e) {
      notify.error(resolveUserErrorMessage(e, `${ssoProviderLabel(providerCode)}登录暂不可用`));
      setSsoStarting(null);
    }
  }, []);

  const showLoginError = (e: unknown) => {
    const br = getBindRequiredFromError(e);
    if (br) {
      enteredWithPhoneBindRef.current = true;
      savePendingPhoneBind({
        action: "bind_phone",
        bindToken: br.bindToken,
        expiresAt: br.expiresAt,
        channel: br.channel,
      });
      setBindRequired(br);
      setBindPassword("");
      return;
    }
    notify.fromError(e, "登录失败", "登录失败");
  };

  const handleLogin = useCallback(async () => {
    const {
      loginTab: tab,
      username: account,
      password: pwd,
      phone: phoneNo,
      smsCode: otp,
      email: mail,
      emailCode: mailOtp,
      rememberMe: keep,
    } = loginValuesRef.current;
    if (tab === "wechat") {
      await refreshWechatQr();
      return;
    }
    if (isSsoLoginTab(tab)) {
      await handleSsoAuthorize(tab);
      return;
    }
    setLoading(true);
    try {
      let flow: AuthFlowResponse | null = null;
      if (tab === "account") {
        if (!account.trim()) {
          notify.error("请输入账号");
          return;
        }
        if (!pwd.trim()) {
          notify.error("请输入密码");
          return;
        }
        flow = await apiFetch<AuthFlowResponse>("/api/auth/login/password", {
          method: "POST",
          withAuth: false,
          body: JSON.stringify({
            username: account.trim(),
            password: pwd,
            platformCode: LOGIN_PLATFORM_CODE,
            rememberMe: keep,
          }),
        });
      } else if (tab === "phone") {
        if (!isValidPhone(phoneNo)) {
          notify.error("请输入正确的手机号");
          return;
        }
        if (!isValidOtp(otp)) {
          notify.error("请输入验证码");
          return;
        }
        flow = await apiFetch<AuthFlowResponse>("/api/auth/login/phone", {
          method: "POST",
          withAuth: false,
          body: JSON.stringify({ phone: phoneNo, code: otp, platformCode: LOGIN_PLATFORM_CODE, rememberMe: keep }),
        });
      } else {
        if (!isValidEmail(mail)) {
          notify.error("请输入正确的邮箱");
          return;
        }
        if (!isValidOtp(mailOtp)) {
          notify.error("请输入验证码");
          return;
        }
        flow = await apiFetch<AuthFlowResponse>("/api/auth/login/email", {
          method: "POST",
          withAuth: false,
          body: JSON.stringify({ email: mail, code: mailOtp, platformCode: LOGIN_PLATFORM_CODE, rememberMe: keep }),
        });
      }
      if (!flow) return;
      const pair = extractAuthenticatedToken(flow);
      if (!pair) {
        notify.error("登录流程返回了未识别状态，请重试");
        return;
      }
      finishLogin(pair);
    } catch (e) {
      showLoginError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishLogin, handleSsoAuthorize, rememberMe]);

  const handleBindLogin = useCallback(async () => {
    const { bindRequired: bind, phone: phoneNo, smsCode: otp, bindPassword: pwd, rememberMe: keep } = loginValuesRef.current;
    if (!bind) return;
    if (!isValidPhone(phoneNo)) {
      notify.error("请输入正确的手机号");
      return;
    }
    if (!isValidOtp(otp)) {
      notify.error("请输入验证码");
      return;
    }
    if (bind.channel === "username" && (!pwd || pwd.length < 6)) {
      notify.error("请设置至少 6 位的登录密码");
      return;
    }
    setLoading(true);
    try {
      const flow = await apiFetch<AuthFlowResponse>("/api/auth/login/phone/bind", {
        method: "POST",
        withAuth: false,
        body: JSON.stringify({
          bindToken: bind.bindToken,
          phone: phoneNo,
          code: otp,
          password: bind.channel === "username" ? pwd : null,
          platformCode: LOGIN_PLATFORM_CODE,
          rememberMe: keep,
        }),
      });
      const pair = extractAuthenticatedToken(flow);
      if (!pair) {
        notify.error("绑定流程返回了未识别状态，请重新登录后再试");
        return;
      }
      clearPendingPhoneBind();
      setBindRequired(null);
      finishLogin(pair);
    } catch (e) {
      notify.fromError(e, "绑定失败", "绑定失败");
    } finally {
      setLoading(false);
    }
  }, [finishLogin]);

  const handleWechatScanStatus = async (status: WechatMpScanStatus) => {
    if (status.status === "scanned") {
      setWechatScanHint("已扫码，请在手机确认");
      return;
    }
    if (status.status === "expired" || status.status === "failed") {
      setWechatScanHint(status.status === "expired" ? "已过期，请刷新" : "失败，请刷新");
      return;
    }
    if (status.status === "phone_bind_required" && status.nextAction?.bindToken) {
      enteredWithPhoneBindRef.current = true;
      const next = {
        action: "bind_phone" as const,
        bindToken: status.nextAction.bindToken,
        expiresAt: status.nextAction.expiresAt,
        channel: "wechat" as const,
      };
      savePendingPhoneBind({ ...next, loginTab: "wechat" });
      setBindRequired(next);
      setBindPassword("");
      void consumeWechatMpScan(status.ticket).catch(() => undefined);
      return;
    }
    if (status.status === "authenticated" && status.token?.accessToken && status.token?.refreshToken) {
      void consumeWechatMpScan(status.ticket).catch(() => undefined);
      finishLogin({
        accessToken: status.token.accessToken,
        refreshToken: status.token.refreshToken,
        expiresAt: status.token.expiresAt || 0,
        tokenType: status.token.tokenType || "Bearer",
      });
    }
  };

  const handleBindBack = useCallback(() => {
    enteredWithPhoneBindRef.current = false;
    clearPendingPhoneBind();
    setBindRequired(null);
  }, []);

  return (
    <div className="login-page relative flex h-dvh w-full flex-col overflow-hidden" style={{ background: PAGE_BG }}>
      <LoginLayoutStyle />
      <LoginBackdrop />
      <div className="login-shell">
      <LoginBrandHeader />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hidden">
        <div className="login-stage">
          <div className="login-stage-grid">
            <LoginShowcase />

            <section className="login-panel">
          <LoginMobileBrand />

          <div className="login-card">
            <div className="login-card-head">
              <h2 className="login-card-title">
                {bindRequired ? "绑定手机号" : "欢迎回来"}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: TEXT_MUTED }}>
                {loginCardSubtitle(loginTab, !!bindRequired)}
              </p>
            </div>

          {bindRequired ? (
            <div className="login-card-body">
            <LoginBindPanel
              bindRequired={bindRequired}
              phone={phone}
              smsCode={smsCode}
              bindPassword={bindPassword}
              showBindPassword={showBindPassword}
              rememberMe={rememberMe}
              loading={loading}
              onPhoneChange={setPhone}
              onSmsCodeChange={setSmsCode}
              onBindPasswordChange={setBindPassword}
              onToggleBindPassword={toggleBindPassword}
              onRememberMeChange={handleRememberMeChange}
              onSendSms={handleSendSms}
              onBind={handleBindLogin}
              onBack={handleBindBack}
            />
            </div>
          ) : (
            <div className="login-card-body">
            <Tabs
              value={loginTab}
              onValueChange={(v) => setLoginTab(v as LoginPageTab)}
              className="w-full"
            >
              <LoginChannelTabs visibleTabs={visibleTabs} />

            <div className="login-tab-panel">
            {visibleTabs.includes("account") ? (
            <TabsContent value="account" className={LOGIN_TAB_PANEL}>
              <LoginAccountPanel
                username={username}
                password={password}
                showPassword={showPassword}
                rememberMe={rememberMe}
                loading={loading}
                providersLoaded={providersLoaded}
                onUsernameChange={setUsername}
                onPasswordChange={setPassword}
                onTogglePassword={togglePassword}
                onRememberMeChange={handleRememberMeChange}
                onLogin={handleLogin}
              />
            </TabsContent>
            ) : null}

            {visibleTabs.includes("phone") ? (
            <TabsContent value="phone" className={LOGIN_TAB_PANEL}>
              <LoginPhonePanel
                phone={phone}
                smsCode={smsCode}
                rememberMe={rememberMe}
                loading={loading}
                providersLoaded={providersLoaded}
                onPhoneChange={setPhone}
                onSmsCodeChange={setSmsCode}
                onRememberMeChange={handleRememberMeChange}
                onSendSms={handleSendSms}
                onLogin={handleLogin}
              />
            </TabsContent>
            ) : null}

            {visibleTabs.includes("email") ? (
            <TabsContent value="email" className={LOGIN_TAB_PANEL}>
              <LoginEmailPanel
                email={email}
                emailCode={emailCode}
                rememberMe={rememberMe}
                loading={loading}
                providersLoaded={providersLoaded}
                onEmailChange={setEmail}
                onEmailCodeChange={setEmailCode}
                onRememberMeChange={handleRememberMeChange}
                onSendEmail={handleSendEmail}
                onLogin={handleLogin}
              />
            </TabsContent>
            ) : null}

            {visibleTabs.includes("wechat") ? (
            <TabsContent value="wechat" className={LOGIN_TAB_PANEL}>
              <LoginWechatPanel
                wechatScanMode={wechatScanMode}
                wechatQrUrl={wechatQrUrl}
                wechatScanHint={wechatScanHint}
                wechatOauthLoading={wechatOauthLoading}
                rememberMe={rememberMe}
                loading={loading}
                providersLoaded={providersLoaded}
                onRememberMeChange={handleRememberMeChange}
                onRefresh={handleWechatMpOauth}
              />
            </TabsContent>
            ) : null}

            {(["dingtalk", "google", "feishu"] as const).map((providerCode) =>
              visibleTabs.includes(providerCode) ? (
                <TabsContent
                  key={providerCode}
                  value={providerCode}
                  className={LOGIN_TAB_PANEL}
                >
                  <LoginSsoPanel
                    providerCode={providerCode}
                    rememberMe={rememberMe}
                    loading={loading}
                    providersLoaded={providersLoaded}
                    ssoStarting={ssoStarting}
                    onRememberMeChange={handleRememberMeChange}
                    onAuthorize={handleSsoAuthorize}
                  />
                </TabsContent>
              ) : null
            )}
            </div>
            </Tabs>
            </div>
          )}

            <div className="login-legal">
              <LoginLegalLinks />
            </div>
          </div>
        </section>
          </div>
        </div>
      </div>

      {sessionChecking ? <LoginSessionOverlay /> : null}

      <footer className="relative z-10 shrink-0 py-3 text-center text-[12px] max-[720px]:py-2" style={{ color: TEXT_BODY }}>
        © 2026 奈杜AIGC 创作平台 · AI Creation Middle Platform
      </footer>
      </div>
    </div>
  );
};

export default Login;
