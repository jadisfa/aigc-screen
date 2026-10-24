/**
 * 非手机号登录（微信 / 邮箱 / SSO 等）在 428 后需补绑手机号。
 * 用 sessionStorage + 内存 handoff 传递，避免：
 * - router location.state 在 iframe/顶层跳转中丢失
 * - React Strict Mode 双挂载导致 take 后二次初始化为空
 */

export type PendingPhoneBind = {
  action: "bind_phone";
  bindToken: string;
  expiresAt: number;
  channel: string;
  loginTab?: string;
};

const STORAGE_KEY = "auth_pending_phone_bind";

/** 进程内 handoff：claim 后保留，直至 clear，抵御 Strict Mode remount */
let handoff: PendingPhoneBind | null = null;

function normalizePending(raw: Partial<PendingPhoneBind> | null | undefined): PendingPhoneBind | null {
  if (
    !raw ||
    raw.action !== "bind_phone" ||
    !raw.bindToken ||
    !raw.expiresAt ||
    !raw.channel
  ) {
    return null;
  }
  return {
    action: "bind_phone",
    bindToken: String(raw.bindToken),
    expiresAt: Number(raw.expiresAt),
    channel: String(raw.channel),
    loginTab: raw.loginTab ? String(raw.loginTab) : undefined,
  };
}

export function savePendingPhoneBind(payload: PendingPhoneBind): void {
  const normalized = normalizePending(payload);
  if (!normalized) return;
  handoff = normalized;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * 登录页首屏读取：优先内存，否则从 sessionStorage 读入并保留在内存。
 * 不清除，避免 Strict Mode 二次挂载丢失。
 */
export function claimPendingPhoneBind(): PendingPhoneBind | null {
  if (handoff) return handoff;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    handoff = normalizePending(JSON.parse(raw) as Partial<PendingPhoneBind>);
    return handoff;
  } catch {
    return null;
  }
}

/** @deprecated 使用 claimPendingPhoneBind；保留别名兼容旧调用 */
export function takePendingPhoneBind(): PendingPhoneBind | null {
  return claimPendingPhoneBind();
}

export function peekPendingPhoneBind(): PendingPhoneBind | null {
  if (handoff) return handoff;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizePending(JSON.parse(raw) as Partial<PendingPhoneBind>);
  } catch {
    return null;
  }
}

/** 绑定成功或用户主动返回登录时清除 */
export function clearPendingPhoneBind(): void {
  handoff = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * 从 428 响应体解析补绑动作（ApiResp.data = AuthFlowResp）。
 */
export function parsePhoneBindFromHttpBody(body: unknown): PendingPhoneBind | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  if (data.status !== "phone_bind_required") return null;
  const next = data.nextAction as Record<string, unknown> | null | undefined;
  if (!next || next.action !== "bind_phone") return null;
  const bindToken = next.bindToken;
  const expiresAt = next.expiresAt;
  const channel = next.channel;
  if (typeof bindToken !== "string" || !bindToken) return null;
  if (typeof expiresAt !== "number" && typeof expiresAt !== "string") return null;
  if (typeof channel !== "string" || !channel) return null;
  return {
    action: "bind_phone",
    bindToken,
    expiresAt: Number(expiresAt),
    channel,
  };
}

const BIND_CHANNELS = new Set(["email", "wechat", "username", "dingtalk", "google", "feishu"]);

/** 将 pending 转为登录页可用的绑定态；非法 channel 返回 null。 */
export function pendingBindToAction(pending: PendingPhoneBind | null): {
  action: "bind_phone";
  bindToken: string;
  expiresAt: number;
  channel: "email" | "wechat" | "username" | "dingtalk" | "google" | "feishu";
  loginTab?: string;
} | null {
  if (!pending?.bindToken || !BIND_CHANNELS.has(pending.channel)) return null;
  return {
    action: "bind_phone",
    bindToken: pending.bindToken,
    expiresAt: pending.expiresAt,
    channel: pending.channel as "email" | "wechat" | "username" | "dingtalk" | "google" | "feishu",
    loginTab: pending.loginTab,
  };
}
