import type { LoginProviderConfig, WechatMpConfig } from "@/shared/api/sys/system-config";

export type LoginProviderFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  description?: string;
  secret?: boolean;
};

export type LoginCallbackRemark = {
  label: string;
  path: string;
  note?: string;
};

export type LoginProviderMeta = {
  icon: string;
  iconColor: string;
  hasEdit: boolean;
  dialogTitle?: string;
  fields?: LoginProviderFieldDef[];
  hint?: string;
  /** 登录页/开放平台需登记的回调路径备注 */
  callbacks?: LoginCallbackRemark[];
};

/** 与前端路由一致的固定回调路径（配置页备注 & 第三方后台登记用）。 */
export const LOGIN_CALLBACK_PATHS = {
  wechatOpen: "/auth/wechat/open/callback",
  wechatMpOauth: "/auth/wechat/callback",
  wechatMpScan: "/auth/wechat/scan",
  dingtalk: "/auth/dingtalk/callback",
  google: "/auth/google/callback",
  feishu: "/auth/feishu/callback",
} as const;

export function buildAbsoluteCallbackUrl(path: string, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin.replace(/\/$/, "")}${normalized}` : normalized;
}

export const LOGIN_PROVIDER_META: Record<string, LoginProviderMeta> = {
  account: {
    icon: "user",
    iconColor: "#f97316",
    hasEdit: false,
  },
  phone: {
    icon: "phone",
    iconColor: "#6b7280",
    hasEdit: false,
  },
  email: {
    icon: "mail",
    iconColor: "#a855f7",
    hasEdit: false,
  },
  wechat_open: {
    icon: "wechat",
    iconColor: "#07c160",
    hasEdit: true,
    dialogTitle: "微信开放平台登录设置",
    callbacks: [
      {
        label: "授权回调",
        path: LOGIN_CALLBACK_PATHS.wechatOpen,
        note: "开放平台后台只填授权回调域；完整 redirect_uri 按域名拼装。",
      },
    ],
  },
  wechat_mp: {
    icon: "wechat",
    iconColor: "#07c160",
    hasEdit: false,
    callbacks: [
      {
        label: "网页授权回调",
        path: LOGIN_CALLBACK_PATHS.wechatMpOauth,
        note: "须在微信公众平台配置网页授权域名。",
      },
      {
        label: "扫码落地页",
        path: LOGIN_CALLBACK_PATHS.wechatMpScan,
      },
    ],
  },
  dingtalk: {
    icon: "dingtalk",
    iconColor: "#3370ff",
    hasEdit: true,
    dialogTitle: "钉钉登录设置",
    callbacks: [
      {
        label: "OAuth 回调",
        path: LOGIN_CALLBACK_PATHS.dingtalk,
      },
    ],
  },
  google: {
    icon: "google",
    iconColor: "#4285f4",
    hasEdit: true,
    dialogTitle: "谷歌单点登录设置",
    callbacks: [
      {
        label: "重定向 URI",
        path: LOGIN_CALLBACK_PATHS.google,
      },
    ],
  },
  kakao: { icon: "kakao", iconColor: "#fee500", hasEdit: false },
  feishu: {
    icon: "feishu",
    iconColor: "#3370ff",
    hasEdit: true,
    dialogTitle: "飞书自动登录设置",
    callbacks: [
      {
        label: "重定向 URL",
        path: LOGIN_CALLBACK_PATHS.feishu,
      },
    ],
  },
};

export function parseLoginProviderConfig(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    Object.entries(obj).forEach(([k, v]) => {
      if (v == null) return;
      out[k] = String(v);
    });
    return out;
  } catch {
    return {};
  }
}

export function getLoginProviderMeta(providerCode: string): LoginProviderMeta {
  return (
    LOGIN_PROVIDER_META[providerCode] || {
      icon: "globe",
      iconColor: "#6b7280",
      hasEdit: false,
    }
  );
}

export type EditableLoginProviderCode = "wechat_open" | "dingtalk" | "google" | "feishu";

export function isEditableLoginProvider(code: string): code is EditableLoginProviderCode {
  return code === "wechat_open" || code === "dingtalk" || code === "google" || code === "feishu";
}

export type LoginProviderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: LoginProviderConfig | null;
  onSaved: () => void;
};

export type WechatMpCredentialSummary = {
  enabledCount: number;
  configs: Pick<WechatMpConfig, "appId" | "enabled" | "hasSecret">[];
};
