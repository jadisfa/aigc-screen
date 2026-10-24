import { memo, type FormEvent, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Mail,
  MessageSquare,
  Phone,
  ArrowLeft,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  User,
} from "lucide-react";
import type { LoginPageTab } from "@/shared/api/auth/login-providers";
import { ssoProviderLabel, type SsoProviderCode } from "@/shared/api/auth/sso-oauth";
import { LoginRememberMe } from "./LoginRememberMe";
import { OtpSendButton } from "./OtpSendButton";
import {
  BIND_CHANNEL_LABEL,
  type AuthFlowAction,
} from "./loginFlow";
import {
  BRAND_PURPLE,
  SOFT_INPUT,
  SOFT_LABEL,
  SOFT_OTP_ROW,
  SOFT_PRIMARY_BTN,
  SOFT_TAB_TRIGGER,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "./loginTheme";

type RememberProps = {
  rememberMe: boolean;
  onRememberMeChange: (checked: boolean | "indeterminate") => void;
};

type LoginSubmitProps = RememberProps & {
  loading: boolean;
  providersLoaded: boolean;
  onLogin: () => void;
};

function LoginSubmitForm({
  onSubmit,
  children,
}: {
  onSubmit: () => void;
  children: ReactNode;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {children}
    </form>
  );
}

export const LoginChannelTabs = memo(function LoginChannelTabs({
  visibleTabs,
}: {
  visibleTabs: LoginPageTab[];
}) {
  if (visibleTabs.length <= 1) return null;
  return (
    <TabsList
      className="grid w-full mb-4 h-10 items-stretch p-1 rounded-2xl bg-[#F3F0F8]"
      style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
    >
      {visibleTabs.includes("account") ? (
        <TabsTrigger value="account" className={SOFT_TAB_TRIGGER}>
          <User className="w-3.5 h-3.5" />
          账号登录
        </TabsTrigger>
      ) : null}
      {visibleTabs.includes("phone") ? (
        <TabsTrigger value="phone" className={SOFT_TAB_TRIGGER}>
          <Phone className="w-3.5 h-3.5" />
          手机登录
        </TabsTrigger>
      ) : null}
      {visibleTabs.includes("email") ? (
        <TabsTrigger value="email" className={SOFT_TAB_TRIGGER}>
          <Mail className="w-3.5 h-3.5" />
          邮箱登录
        </TabsTrigger>
      ) : null}
      {visibleTabs.includes("wechat") ? (
        <TabsTrigger value="wechat" className={SOFT_TAB_TRIGGER}>
          <MessageSquare className="w-3.5 h-3.5" />
          微信
        </TabsTrigger>
      ) : null}
      {visibleTabs.includes("dingtalk") ? (
        <TabsTrigger value="dingtalk" className={SOFT_TAB_TRIGGER}>钉钉</TabsTrigger>
      ) : null}
      {visibleTabs.includes("google") ? (
        <TabsTrigger value="google" className={SOFT_TAB_TRIGGER}>谷歌</TabsTrigger>
      ) : null}
      {visibleTabs.includes("feishu") ? (
        <TabsTrigger value="feishu" className={SOFT_TAB_TRIGGER}>飞书</TabsTrigger>
      ) : null}
    </TabsList>
  );
});

export const LoginBindPanel = memo(function LoginBindPanel({
  bindRequired,
  phone,
  smsCode,
  bindPassword,
  showBindPassword,
  rememberMe,
  loading,
  onPhoneChange,
  onSmsCodeChange,
  onBindPasswordChange,
  onToggleBindPassword,
  onRememberMeChange,
  onSendSms,
  onBind,
  onBack,
}: RememberProps & {
  bindRequired: AuthFlowAction;
  phone: string;
  smsCode: string;
  bindPassword: string;
  showBindPassword: boolean;
  loading: boolean;
  onPhoneChange: (value: string) => void;
  onSmsCodeChange: (value: string) => void;
  onBindPasswordChange: (value: string) => void;
  onToggleBindPassword: () => void;
  onSendSms: () => Promise<boolean | void>;
  onBind: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[13px] transition-colors"
          onClick={onBack}
          disabled={loading}
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <span className="text-[12px] text-muted-foreground">
          绑定来源：{BIND_CHANNEL_LABEL[bindRequired.channel]}
        </span>
      </div>

      <div className="rounded-2xl border border-[#E0D8F0] border-l-4 border-l-[#7C3AED] bg-[#F7F4FC] p-4">
        <div className="text-[14px] font-medium mb-1" style={{ color: TEXT_PRIMARY }}>绑定手机号</div>
        <div className="text-[13px] leading-relaxed" style={{ color: TEXT_MUTED }}>
          微信 / 邮箱等非手机号方式登录时，需先验证手机号。若该手机号已注册将自动合并账号。
        </div>
      </div>

      <LoginSubmitForm onSubmit={onBind}>
        <div className="space-y-2">
          <label className={SOFT_LABEL}>手机号</label>
          <div className="relative">
            <Phone className="pointer-events-none w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className={`pl-9 ${SOFT_INPUT}`}
              maxLength={11}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              autoFocus
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className={SOFT_LABEL}>验证码</label>
          <div className={SOFT_OTP_ROW}>
            <div className="relative min-w-0">
              <MessageSquare className="w-4 h-4 text-[#A78BFA] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="6 位验证码"
                value={smsCode}
                onChange={(e) => onSmsCodeChange(e.target.value)}
                className={`pl-9 ${SOFT_INPUT}`}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>
            <OtpSendButton channel="sms" onSend={onSendSms} />
          </div>
        </div>

        {bindRequired.channel === "username" && (
          <div className="space-y-2">
            <label className={SOFT_LABEL}>设置登录密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type={showBindPassword ? "text" : "password"}
                placeholder="至少 6 位"
                value={bindPassword}
                onChange={(e) => onBindPasswordChange(e.target.value)}
                className={`pl-9 pr-9 ${SOFT_INPUT}`}
              />
              <button
                type="button"
                onClick={onToggleBindPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showBindPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <LoginRememberMe id="remember-bind" checked={rememberMe} onCheckedChange={onRememberMeChange} />

        <Button
          type="submit"
          className={SOFT_PRIMARY_BTN}
          style={{ background: BRAND_PURPLE }}
          disabled={loading}
        >
          {loading ? "处理中..." : "绑定并登录"}
        </Button>
      </LoginSubmitForm>
    </div>
  );
});

export const LoginAccountPanel = memo(function LoginAccountPanel({
  username,
  password,
  showPassword,
  rememberMe,
  loading,
  providersLoaded,
  onUsernameChange,
  onPasswordChange,
  onTogglePassword,
  onRememberMeChange,
  onLogin,
}: LoginSubmitProps & {
  username: string;
  password: string;
  showPassword: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
}) {
  return (
    <LoginSubmitForm onSubmit={onLogin}>
      <div className="space-y-2">
        <label className={SOFT_LABEL}>账号</label>
        <div className="relative">
          <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="请输入用户名"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            className={`pl-9 ${SOFT_INPUT}`}
            autoComplete="username"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className={SOFT_LABEL}>密码</label>
        <div className="relative">
          <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="请输入密码"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className={`pl-9 pr-10 ${SOFT_INPUT}`}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={onTogglePassword}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <LoginRememberMe id="remember-account" checked={rememberMe} onCheckedChange={onRememberMeChange} />
      <Button
        type="submit"
        className={SOFT_PRIMARY_BTN}
        style={{ background: BRAND_PURPLE }}
        disabled={loading || !providersLoaded}
      >
        {loading ? "登录中..." : (<><span>登录</span><ArrowRight className="w-4 h-4" /></>)}
      </Button>
    </LoginSubmitForm>
  );
});

export const LoginPhonePanel = memo(function LoginPhonePanel({
  phone,
  smsCode,
  rememberMe,
  loading,
  providersLoaded,
  onPhoneChange,
  onSmsCodeChange,
  onRememberMeChange,
  onSendSms,
  onLogin,
}: LoginSubmitProps & {
  phone: string;
  smsCode: string;
  onPhoneChange: (value: string) => void;
  onSmsCodeChange: (value: string) => void;
  onSendSms: () => Promise<boolean | void>;
}) {
  return (
    <LoginSubmitForm onSubmit={onLogin}>
      <div className="space-y-2">
        <label className={SOFT_LABEL}>手机号</label>
        <div className="relative">
          <Phone className="pointer-events-none w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className={`pl-9 ${SOFT_INPUT}`}
            maxLength={11}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className={SOFT_LABEL}>验证码</label>
        <div className={SOFT_OTP_ROW}>
          <div className="relative min-w-0">
            <MessageSquare className="w-4 h-4 text-[#A78BFA] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="6 位验证码"
              value={smsCode}
              onChange={(e) => onSmsCodeChange(e.target.value)}
              className={`pl-9 ${SOFT_INPUT}`}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
          <OtpSendButton channel="sms" onSend={onSendSms} />
        </div>
      </div>
      <LoginRememberMe id="remember-phone" checked={rememberMe} onCheckedChange={onRememberMeChange} />
      <Button
        type="submit"
        className={SOFT_PRIMARY_BTN}
        style={{ background: BRAND_PURPLE }}
        disabled={loading || !providersLoaded}
      >
        {loading ? "登录中..." : (<><span>登录</span><ArrowRight className="w-4 h-4" /></>)}
      </Button>
    </LoginSubmitForm>
  );
});

export const LoginEmailPanel = memo(function LoginEmailPanel({
  email,
  emailCode,
  rememberMe,
  loading,
  providersLoaded,
  onEmailChange,
  onEmailCodeChange,
  onRememberMeChange,
  onSendEmail,
  onLogin,
}: LoginSubmitProps & {
  email: string;
  emailCode: string;
  onEmailChange: (value: string) => void;
  onEmailCodeChange: (value: string) => void;
  onSendEmail: () => Promise<boolean | void>;
}) {
  return (
    <LoginSubmitForm onSubmit={onLogin}>
      <div className="space-y-2">
        <label className={SOFT_LABEL}>邮箱</label>
        <div className="relative">
          <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="请输入邮箱"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className={`pl-9 ${SOFT_INPUT}`}
            autoComplete="email"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className={SOFT_LABEL}>验证码</label>
        <div className={SOFT_OTP_ROW}>
          <div className="relative min-w-0">
            <Mail className="w-4 h-4 text-[#A78BFA] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="6 位验证码"
              value={emailCode}
              onChange={(e) => onEmailCodeChange(e.target.value)}
              className={`pl-9 ${SOFT_INPUT}`}
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
          <OtpSendButton channel="email" onSend={onSendEmail} />
        </div>
      </div>
      <LoginRememberMe id="remember-email" checked={rememberMe} onCheckedChange={onRememberMeChange} />
      <Button
        type="submit"
        className={SOFT_PRIMARY_BTN}
        style={{ background: BRAND_PURPLE }}
        disabled={loading || !providersLoaded}
      >
        {loading ? "登录中..." : (<><span>登录</span><ArrowRight className="w-4 h-4" /></>)}
      </Button>
    </LoginSubmitForm>
  );
});

export const LoginWechatPanel = memo(function LoginWechatPanel({
  wechatScanMode,
  wechatQrUrl,
  wechatScanHint,
  wechatOauthLoading,
  rememberMe,
  loading,
  providersLoaded,
  onRememberMeChange,
  onRefresh,
}: RememberProps & {
  wechatScanMode: "open" | "mp" | "none";
  wechatQrUrl: string;
  wechatScanHint: string;
  wechatOauthLoading: boolean;
  loading: boolean;
  providersLoaded: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-0.5">
        <div
          className={
            wechatScanMode === "open"
              ? "w-[190px] h-[190px] rounded-xl flex items-center justify-center bg-white shrink-0 relative overflow-hidden"
              : "w-[190px] h-[190px] rounded-xl flex items-center justify-center bg-white shrink-0 relative border border-border p-1"
          }
        >
          <div
            id="wechat-open-qr"
            className={
              wechatScanMode === "open"
                ? "w-full h-full flex items-center justify-center overflow-hidden [&_iframe]:border-0"
                : "hidden"
            }
          />
          {wechatScanMode !== "open" ? (
            wechatQrUrl ? (
              <img
                src={wechatQrUrl}
                alt="微信扫码登录"
                className="w-full h-full object-contain bg-white"
                draggable={false}
              />
            ) : (
              <span className="text-[12px] text-muted-foreground px-3 text-center">
                {wechatOauthLoading ? "生成中…" : wechatScanMode === "none" ? "未启用" : "加载失败"}
              </span>
            )
          ) : null}
        </div>
        <p className="text-[13px] text-muted-foreground text-center leading-none">{wechatScanHint}</p>
      </div>
      <LoginRememberMe id="remember-wechat" checked={rememberMe} onCheckedChange={onRememberMeChange} />
      <Button
        className={SOFT_PRIMARY_BTN}
        style={{ background: BRAND_PURPLE }}
        onClick={onRefresh}
        disabled={wechatOauthLoading || loading || wechatScanMode === "none" || !providersLoaded}
      >
        {wechatOauthLoading ? "刷新中..." : "刷新二维码"}
      </Button>
    </div>
  );
});

export const LoginSsoPanel = memo(function LoginSsoPanel({
  providerCode,
  rememberMe,
  loading,
  providersLoaded,
  ssoStarting,
  onRememberMeChange,
  onAuthorize,
}: RememberProps & {
  providerCode: SsoProviderCode;
  loading: boolean;
  providersLoaded: boolean;
  ssoStarting: SsoProviderCode | null;
  onAuthorize: (providerCode: SsoProviderCode) => void;
}) {
  const label = ssoProviderLabel(providerCode);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-9 text-center space-y-2 min-h-[190px] flex flex-col justify-center">
        <p className="text-[15px] font-medium text-foreground">使用{label}账号登录</p>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          将跳转到{label}授权页；授权成功后返回本站完成登录。首次登录需绑定手机号。
        </p>
      </div>
      <LoginRememberMe
        id={`remember-${providerCode}`}
        checked={rememberMe}
        onCheckedChange={onRememberMeChange}
      />
      <Button
        className={SOFT_PRIMARY_BTN}
        style={{ background: BRAND_PURPLE }}
        onClick={() => onAuthorize(providerCode)}
        disabled={loading || ssoStarting === providerCode || !providersLoaded}
      >
        {ssoStarting === providerCode ? "跳转中…" : `前往${label}授权`}
      </Button>
    </div>
  );
});
