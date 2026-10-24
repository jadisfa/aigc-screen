import { apiFetch } from "@/shared/api/sys/http";

export type WechatMpScanTicket = {
  ticket: string;
  appId: string;
  expiresAt: number;
};

export type WechatMpScanBindAction = {
  action: "bind_phone";
  bindToken: string;
  expiresAt: number;
  channel: "wechat";
};

export type WechatMpScanToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
};

export type WechatMpScanStatus = {
  ticket: string;
  status:
    | "pending"
    | "scanned"
    | "authenticated"
    | "phone_bind_required"
    | "expired"
    | "failed";
  appId?: string | null;
  expiresAt?: number | null;
  token?: WechatMpScanToken | null;
  nextAction?: WechatMpScanBindAction | null;
};

const SCAN_PATH = "/auth/wechat/scan";
const CALLBACK_PATH = "/auth/wechat/callback";

/**
 * 创建 PC 扫码登录 ticket。
 * @param platformCode 登录来源，如 ai_admin / store_ops
 */
export async function createWechatMpScanTicket(
  platformCode?: string,
  rememberMe?: boolean
): Promise<WechatMpScanTicket> {
  return apiFetch<WechatMpScanTicket>("/api/auth/login/wechat/mp/scan/ticket", {
    method: "POST",
    withAuth: false,
    body: JSON.stringify({
      platformCode: platformCode?.trim() || undefined,
      rememberMe: rememberMe !== false,
    }),
  });
}

/**
 * 轮询扫码状态。
 */
export async function fetchWechatMpScanStatus(ticket: string): Promise<WechatMpScanStatus> {
  return apiFetch<WechatMpScanStatus>(
    `/api/auth/login/wechat/mp/scan/status?ticket=${encodeURIComponent(ticket)}`,
    { method: "GET", withAuth: false }
  );
}

/**
 * 手机扫码落地标记。
 */
export async function markWechatMpScanScanned(ticket: string): Promise<WechatMpScanStatus> {
  return apiFetch<WechatMpScanStatus>("/api/auth/login/wechat/mp/scan/scanned", {
    method: "POST",
    withAuth: false,
    body: JSON.stringify({ ticket }),
  });
}

/**
 * 手机 OAuth 回调后提交 code。
 */
export async function completeWechatMpScan(ticket: string, code: string): Promise<WechatMpScanStatus> {
  return apiFetch<WechatMpScanStatus>("/api/auth/login/wechat/mp/scan/complete", {
    method: "POST",
    withAuth: false,
    body: JSON.stringify({ ticket, code }),
  });
}

/**
 * PC 取走结果后消费 ticket。
 */
export async function consumeWechatMpScan(ticket: string): Promise<void> {
  await apiFetch<null>("/api/auth/login/wechat/mp/scan/consume", {
    method: "POST",
    withAuth: false,
    body: JSON.stringify({ ticket }),
  });
}

/**
 * 拼扫码落地页 URL（二维码内容）。
 */
export function buildWechatMpScanPageUrl(ticket: string): string {
  return `${window.location.origin}${SCAN_PATH}?ticket=${encodeURIComponent(ticket)}`;
}

/**
 * 本地生成扫码登录二维码 Data URL。
 * 避免依赖国外图床（国内常加载失败/画质差导致微信无法识别），并保证静区与模块清晰度。
 */
export async function buildWechatMpQrDataUrl(scanPageUrl: string, size = 320): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(scanPageUrl, {
    // L：模块更少、更疏，手机/微信更容易对焦识别（登录短链场景足够）
    errorCorrectionLevel: "L",
    margin: 4,
    width: Math.max(280, size),
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * 手机端跳转公众号网页授权（扫码后在微信内打开）。
 */
export function redirectWechatMpOauthForScan(appId: string, ticket: string): void {
  const redirectUri = `${window.location.origin}${CALLBACK_PATH}`;
  const query = new URLSearchParams({
    appid: appId.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_userinfo",
    state: `scan:${ticket}`,
  });
  window.location.href = `https://open.weixin.qq.com/connect/oauth2/authorize?${query.toString()}#wechat_redirect`;
}

/**
 * 从 OAuth state 解析扫码 ticket。
 */
export function parseWechatMpScanTicketFromState(state: string | null): string | null {
  if (!state) return null;
  const value = state.trim();
  if (value.startsWith("scan:")) {
    const ticket = value.slice("scan:".length).trim();
    return ticket || null;
  }
  return null;
}

/**
 * 粗略判断是否微信内置浏览器。
 */
export function isWechatInAppBrowser(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent || "");
}
