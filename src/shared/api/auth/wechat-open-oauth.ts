import { apiFetch } from "@/shared/api/sys/http";

export type WechatScanMode = {
  mode: "open" | "mp" | "none" | string;
  appId?: string | null;
  redirectUri?: string | null;
};

export type WechatOpenOauthConfig = {
  appId: string;
  redirectUri: string;
};

const OPEN_CALLBACK_PATH = "/auth/wechat/open/callback";
const OPEN_STATE_KEY = "wechat_open_oauth_state";
const OPEN_STATE_OK_KEY = "wechat_open_oauth_state_ok";

/** 32 位 hex；兼容无 randomUUID 的非安全上下文（如局域网 HTTP）。 */
function randomHexId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 登录页扫码模式：优先开放平台，否则公众号。
 */
export async function fetchWechatScanMode(): Promise<WechatScanMode> {
  return apiFetch<WechatScanMode>("/api/auth/login/wechat/scan-mode", {
    method: "GET",
    withAuth: false,
  });
}

/**
 * 开放平台扫码，指定回调
*/
export async function fetchWetchatScanModeRedirect(url: string): Promise<WechatScanMode> {
  return apiFetch<WechatScanMode>(`/api/auth/login/wechat/scan-mode/integrate?redirectUri=${url}`, {
    method: "GET",
    withAuth: false,
  });
}

/**
 * 开放平台 OAuth 公开配置。
 */
export async function fetchWechatOpenOauthConfig(): Promise<WechatOpenOauthConfig> {
  return apiFetch<WechatOpenOauthConfig>("/api/auth/login/wechat/open/oauth-config", {
    method: "GET",
    withAuth: false,
  });
}

/**
 * 生成并缓存 CSRF state。
 */
export function createWechatOpenOauthState(): string {
  const state = `open_${randomHexId()}`;
  sessionStorage.setItem(OPEN_STATE_KEY, state);
  sessionStorage.removeItem(OPEN_STATE_OK_KEY);
  return state;
}

/**
 * 校验并消费 CSRF state。
 * 允许同一 state 短时二次通过：self_redirect 时 iframe 与顶层可能各跑一遍回调。
 */
export function consumeWechatOpenOauthState(state: string | null): boolean {
  if (!state) return false;
  const expected = sessionStorage.getItem(OPEN_STATE_KEY);
  if (expected && state === expected) {
    sessionStorage.removeItem(OPEN_STATE_KEY);
    sessionStorage.setItem(OPEN_STATE_OK_KEY, state);
    return true;
  }
  const accepted = sessionStorage.getItem(OPEN_STATE_OK_KEY);
  if (accepted && accepted === state) {
    sessionStorage.removeItem(OPEN_STATE_OK_KEY);
    return true;
  }
  // 本地态丢失时：仅接受本系统 open_ 前缀
  if (!expected && !accepted && state.startsWith("open_") && state.length >= 20) {
    console.warn("[wechat-open-oauth] session state missing; accept open_* callback state");
    return true;
  }
  return false;
}

/**
 * 拼开放平台 qrconnect URL（完整 redirect_uri + snsapi_login）。
 */
export function buildWechatOpenQrConnectUrl(appId: string, redirectUri: string, state: string): string {
  const query = new URLSearchParams({
    appid: appId.trim(),
    redirect_uri: redirectUri.trim(),
    response_type: "code",
    scope: "snsapi_login",
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${query.toString()}#wechat_redirect`;
}

/** 登录卡内官方码展示边长（可扫且与表单面板高度对齐）。 */
export const WECHAT_OPEN_QR_DISPLAY_PX = 200;

/**
 * WxLogin iframe 内嵌样式：放大二维码、隐藏多余文案，避免默认 300×400 被小框裁切后“又密又遮挡”。
 */
function buildWxLoginStyleHref(qrPx: number, type?: number): string {
  const css = [
    "html,body{margin:0;padding:0;background:#fff;}",
    ".impowerBox{width:100%!important;margin:0 auto!important;border:none!important;}",
    ".impowerBox .title,.impowerBox .info,.impowerBox .status,.status_icon{display:none!important;}",
    `.impowerBox .qrcode{width:${qrPx}px!important;margin:8px auto 0!important;border:none!important;}`,
    `.impowerBox .qrcode img{width:${qrPx}px!important;height:${qrPx}px!important;border:none!important;}`,
  ].join("");

  const css1 = [
    "html,body{margin:0;padding:0;background:#fff;}",
    ".impowerBox{width:100%!important;margin:0 auto!important;border:none!important;}",
    ".old-template{margin-top: 10px !important;}",
    ".js_quick_login{margin-top: 120px !important;}",
    `.js_quick_login .qlogin_mod::before{content: 'NDMY AI\\7F8E\\7532\\52A9\\624B'; margin-bottom: 18px;font-size:22px;font-weight:bold;display:block !important;text-align:center !important;}`,
    ".impowerBox .web_qrcode_switch_wrp {margin-top: 5px !important; display: block !important;}",
    ".impowerBox .qlogin_mod {margin-top: 100px !important;}",
    `.impowerBox .qrcode{width:${320}px!important;margin:8px auto 0!important;border:none!important;}`,
    `.impowerBox .qrcode img{width:${320}px!important;height:${320}px!important;border:none!important;}`,
  ].join("");

  return `data:text/css;base64,${btoa(css1)}`;
}

function fitWxLoginIframe(container: HTMLElement, sizePx: number) {
  const apply = () => {
    const iframe = container.querySelector("iframe");
    if (!iframe) return false;
    iframe.setAttribute("width", String(sizePx));
    iframe.setAttribute("height", String(sizePx));
    iframe.style.width = `${sizePx}px`;
    iframe.style.height = `${sizePx}px`;
    iframe.style.maxWidth = "100%";
    iframe.style.border = "0";
    iframe.style.outline = "none";
    iframe.style.display = "block";
    iframe.style.margin = "0 auto";
    iframe.style.background = "#fff";

    if (!iframe.dataset.wxNavFixed) {
      iframe.dataset.wxNavFixed = "1";
      // 扫码确认后 iframe 内会跳到本站 callback；检测到后提升到顶层，规避浏览器拦截 top navigation
      iframe.addEventListener("load", () => {
        try {
          if (iframe.dataset.wxPromoted === "1") return;
          const href = iframe.contentWindow?.location?.href;
          if (!href || href === "about:blank") return;
          if (href.includes(OPEN_CALLBACK_PATH) && href.includes("code=")) {
            iframe.dataset.wxPromoted = "1";
            // 已在回调路径则不再 replace，避免顶层换票中途被二次导航打断
            if (window.location.pathname.includes(OPEN_CALLBACK_PATH) && window.location.search.includes("code=")) {
              return;
            }
            window.location.replace(href);
          }
        } catch {
          // 仍在 open.weixin.qq.com 跨域阶段，忽略
        }
      });
    }
    return true;
  };
  if (apply()) return;
  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect();
  });
  observer.observe(container, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 5000);
}

/**
 * 用 WxLogin 在容器内嵌入官方二维码。
 * 若容器尚未挂载，短暂重试，避免 React setState 与 DOM 竞态导致空白框。
 */
export function mountWechatOpenQr(params: {
  containerId: string;
  appId: string;
  redirectUri: string;
  state: string;
  /** 展示区边长，默认 {@link WECHAT_OPEN_QR_DISPLAY_PX} */
  sizePx?: number;
  stylelite?: number; // 新旧ui
}): void {
  const sizePx = params.sizePx ?? WECHAT_OPEN_QR_DISPLAY_PX;
  const w = window as Window & {
    WxLogin?: new (opts: Record<string, unknown>) => void;
  };

  const tryMount = (attempt: number) => {
    const el = document.getElementById(params.containerId);
    if (!el) {
      if (attempt >= 20) return;
      window.setTimeout(() => tryMount(attempt + 1), 50);
      return;
    }
    const run = () => {
      if (!w.WxLogin) return;
      el.innerHTML = "";
      // eslint-disable-next-line no-new
      new w.WxLogin({
        // true：确认后先在 iframe 内跳转 callback，再由 load 监听提升到顶层（比 false 更少被浏览器拦截）
        self_redirect: true,
        id: params.containerId,
        appid: params.appId,
        scope: "snsapi_login",
        redirect_uri: encodeURIComponent(params.redirectUri),
        state: params.state,
        style: "black",
        href: buildWxLoginStyleHref(sizePx - 24, params?.stylelite),
      });
      fitWxLoginIframe(el, sizePx);
    };

    if (w.WxLogin) {
      run();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-wechat-wxlogin="1"]');
    if (existing) {
      existing.addEventListener("load", run, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js";
    script.async = true;
    script.dataset.wechatWxlogin = "1";
    script.addEventListener("load", run, { once: true });
    document.head.appendChild(script);
  };

  tryMount(0);
}

export { OPEN_CALLBACK_PATH };
