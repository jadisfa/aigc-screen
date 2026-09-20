import { toDataURL as qrToDataUrl } from "qrcode";
import type { ScanStatus, UploadIntent } from "@/lib/upload-flow";
import {
  cancelBannerUpload,
  cancelHandModelUpload,
  cancelOutfitUpload,
  issueBannerUpload,
  issueHandModelUpload,
  issueOutfitUpload,
  pollBannerUpload,
  pollHandModelUpload,
  pollOutfitUpload,
  type ScreenScanIssued,
  type ScreenScanSession,
} from "@/lib/screen-api/scan";

/** 出码未带回 expiresAt 时的轮询兜底上限（略大于后台默认 TTL 300s）。 */
const FALLBACK_POLL_MS = 6 * 60_000;
/** 过期时刻之后继续轮询，等待后端 expireIfDue 落库为 expired。 */
const EXPIRE_GRACE_MS = 60_000;

export class PollAbortedError extends Error {
  constructor() {
    super("poll-aborted");
    this.name = "PollAbortedError";
  }
}

export function isPollAborted(error: unknown): boolean {
  return error instanceof PollAbortedError;
}

export async function qrImageUrl(payload: string): Promise<string> {
  try {
    return await qrToDataUrl(payload, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#191919", light: "#ffffff" },
    });
  } catch {
    return `https://api.qrserver.com/v1/create-qr-code/?size=528x528&data=${encodeURIComponent(payload)}`;
  }
}

export function mapScanStatus(status?: string): ScanStatus {
  if (status === "ready") {
    return "uploaded";
  }
  if (status === "scanned" || status === "uploading") {
    return "scanned";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  if (status === "expired") {
    return "expired";
  }
  if (status === "rejected") {
    return "failed";
  }
  return "waiting";
}

export function isTerminalScanStatus(status?: string): boolean {
  const ui = mapScanStatus(status);
  return ui === "uploaded" || ui === "failed" || ui === "cancelled" || ui === "expired";
}

/** 解析出码 / 会话上的过期时间（ISO 或 Unix 秒/毫秒）。 */
export function parseScanExpiresAtMs(expiresAt?: string | number | null): number | null {
  if (expiresAt == null || expiresAt === "") {
    return null;
  }
  if (typeof expiresAt === "number" && Number.isFinite(expiresAt)) {
    return expiresAt < 1_000_000_000_000 ? expiresAt * 1000 : expiresAt;
  }
  const ms = Date.parse(String(expiresAt));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * 轮询至后端终态（ready / rejected / expired / cancelled）。
 * 不以本地固定时长主动判超时或 cancel；截止时间对齐出码 expiresAt。
 */
export async function pollUntilTerminal(
  poll: () => Promise<ScreenScanSession>,
  options?: {
    intervalMs?: number;
    /** 出码返回的 expiresAt，与后台 SCREEN_SCAN_TTL_SECONDS 对齐 */
    expiresAt?: string | number | null;
    onTick?: (session: ScreenScanSession) => void;
    /** 返回 false 时停止轮询（换码 / 离页），不视为业务失败 */
    shouldContinue?: () => boolean;
  },
): Promise<ScreenScanSession> {
  const intervalMs = options?.intervalMs ?? 2000;
  let deadlineMs = (parseScanExpiresAtMs(options?.expiresAt) ?? Date.now() + FALLBACK_POLL_MS) + EXPIRE_GRACE_MS;

  while (true) {
    if (options?.shouldContinue && !options.shouldContinue()) {
      throw new PollAbortedError();
    }
    const session = await poll();
    options?.onTick?.(session);
    const sessionExpireMs = parseScanExpiresAtMs(session.expireAt);
    if (sessionExpireMs != null) {
      deadlineMs = Math.max(deadlineMs, sessionExpireMs + EXPIRE_GRACE_MS);
    }
    if (isTerminalScanStatus(session.status)) {
      return session;
    }
    if (Date.now() >= deadlineMs) {
      const last = await poll();
      options?.onTick?.(last);
      if (isTerminalScanStatus(last.status)) {
        return last;
      }
      // 极端时钟偏差：仍不主动 cancel，仅按过期展示，由用户点「重新扫码」
      return { ...last, status: "expired" };
    }
    await sleep(intervalMs);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ScanTransport = {
  issue: () => Promise<ScreenScanIssued>;
  poll: (sessionId: string) => Promise<ScreenScanSession>;
  cancel: (sessionId: string) => Promise<ScreenScanSession>;
};

export function scanTransport(intent: UploadIntent): ScanTransport {
  if (intent === "hand-model" || intent === "hand-admin") {
    return {
      issue: issueHandModelUpload,
      poll: pollHandModelUpload,
      cancel: cancelHandModelUpload,
    };
  }
  if (intent === "banner") {
    return {
      issue: issueBannerUpload,
      poll: pollBannerUpload,
      cancel: cancelBannerUpload,
    };
  }
  // 灵感选款与穿搭共用 outfit-uploads 扫码合同（选商品图）。
  return {
    issue: issueOutfitUpload,
    poll: pollOutfitUpload,
    cancel: cancelOutfitUpload,
  };
}
