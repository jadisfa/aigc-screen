import { getApiBaseUrl } from "@/lib/api-base";
import type { ScreenScanSession } from "@/lib/screen-api/scan";
import { scanTransport } from "@/lib/scan-session";
import type { UploadIntent } from "@/lib/upload-flow";

const OPEN_RESOURCE: Record<UploadIntent, string> = {
  outfit: "outfit-uploads",
  inspire: "outfit-uploads",
  banner: "banner-uploads",
  "hand-model": "hand-model-uploads",
  "hand-admin": "hand-model-uploads",
};

const SUCCESS_CODES = new Set(["0", "00000", "200", "OK", "SUCCESS"]);

/** 扫码回传的是 http(s) 素材地址；相机确认前是 data/blob/本地临时路径。 */
export function isRemoteAsset(path: string) {
  return /^https?:\/\//i.test(path.trim());
}

/**
 * 把相机本地图走与手机扫码相同的开放上传接口，得到 ready 的 assetUrl 和 sessionId。
 * 之后「开始生成」只认 outfitUploadId，不再区分图片从哪来。
 */
export async function publishLocalCapture(intent: UploadIntent, localPath: string) {
  const api = scanTransport(intent);
  const issued = await api.issue();
  const token = (issued.token || "").trim();
  if (!token || !issued.sessionId) {
    throw new Error("出码失败：未返回上传凭证");
  }
  try {
    const session = await uploadLocalFile(intent, token, localPath);
    if (session.status === "rejected") {
      throw new Error(session.rejectMessage || "照片未通过审核");
    }
    if (session.status !== "ready" || !session.assetUrl) {
      throw new Error(session.rejectMessage || "照片上传失败");
    }
    return {
      assetUrl: session.assetUrl,
      sessionId: session.sessionId || issued.sessionId,
    };
  } catch (error) {
    api.cancel(issued.sessionId).catch(() => undefined);
    throw error;
  }
}

function uploadLocalFile(intent: UploadIntent, token: string, localPath: string) {
  if (localPath.startsWith("data:") || localPath.startsWith("blob:")) {
    return uploadBlob(intent, token, localPath);
  }
  return uploadByPath(intent, token, localPath);
}

async function uploadBlob(intent: UploadIntent, token: string, localPath: string) {
  const source = await fetch(localPath);
  const blob = await source.blob();
  const type = blob.type || "image/jpeg";
  const ext = type.includes("png") ? "png" : "jpg";
  const body = new FormData();
  body.append("file", blob, `capture.${ext}`);
  const response = await fetch(openUploadUrl(intent, token), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Trace-Id": traceId(),
    },
    body,
  });
  return unwrapText(await response.text(), response.status);
}

function uploadByPath(intent: UploadIntent, token: string, filePath: string) {
  return new Promise<ScreenScanSession>((resolve, reject) => {
    uni.uploadFile({
      url: openUploadUrl(intent, token),
      filePath,
      name: "file",
      header: {
        Accept: "application/json",
        "X-Trace-Id": traceId(),
      },
      success: (res) => {
        try {
          resolve(unwrapText(String(res.data || ""), res.statusCode || 0));
        } catch (error) {
          reject(error);
        }
      },
      fail: () => reject(new Error("照片上传失败")),
    });
  });
}

function openUploadUrl(intent: UploadIntent, token: string) {
  const base = getApiBaseUrl().replace(/\/$/, "");
  return `${base}/api/screen/open/${OPEN_RESOURCE[intent]}/${encodeURIComponent(token)}/upload`;
}

function unwrapText(raw: string, status: number): ScreenScanSession {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("照片上传失败");
  }
  let envelope: { code?: string; message?: string; data?: ScreenScanSession };
  try {
    envelope = JSON.parse(trimmed) as { code?: string; message?: string; data?: ScreenScanSession };
  } catch {
    throw new Error("照片上传失败");
  }
  const code = String(envelope.code || "").toUpperCase();
  if (status < 200 || status >= 300 || (code && !SUCCESS_CODES.has(code))) {
    throw new Error(envelope.message || "照片上传失败");
  }
  return envelope.data || {};
}

function traceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `screen-${Date.now()}`;
}
