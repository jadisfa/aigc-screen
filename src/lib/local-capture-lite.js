import { scanTransport } from "@/lib/common.js";
import { getApiBaseUrl } from "@/lib/screen-http-lite.js";
import { writeOutfitUploadId } from "@/lib/upload-flow";

const OPEN_RESOURCE = {
  outfit: "outfit-uploads",
  inspire: "outfit-uploads",
  banner: "banner-uploads",
  "hand-model": "hand-model-uploads",
  "hand-admin": "hand-model-uploads",
};

const SUCCESS_CODES = new Set(["0", "00000", "200", "OK", "SUCCESS"]);

export function isRemoteAsset(path) {
  return /^https?:\/\//i.test(String(path || "").trim());
}

export async function publishLocalCapture(intent, localPath) {
  const api = scanTransport(intent);
  const issued = await api.issue();
  const token = (issued && issued.token ? issued.token : "").trim();
  if (!token || !issued.sessionId) {
    throw new Error("出码失败：未返回上传凭证");
  }
  writeOutfitUploadId(issued.sessionId)

  try {
	// console.log(localPath, token, intent, 27)
    const session = await uploadLocalFile(intent, token, localPath);
	// console.log(session, 29)
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
    if (api.cancel) {
      api.cancel(issued.sessionId).catch(() => undefined);
    }
    throw error;
  }
}

function uploadLocalFile(intent, token, localPath) {
  if (localPath.startsWith("data:") || localPath.startsWith("blob:")) {
    return uploadBlob(intent, token, localPath);
  }
  return uploadByPath(intent, token, localPath);
  // return uploadByPath(intent, token, `file://${localPath}`);
}

async function uploadBlob(intent, token, localPath) {
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

function uploadByPath(intent, token, filePath) {
	console.log(openUploadUrl(intent, token), filePath, 74)
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: openUploadUrl(intent, token),
      filePath,
      name: "file",
	  method: "POST",  
      header: {
        Accept: "application/json",
        "X-Trace-Id": traceId(),
      },
      success: (res) => {
        try {
			console.log('uploadFile statusCode =', res.statusCode, res.code );
			  console.log('uploadFile data =', JSON.stringify(res.data));
			  console.log('uploadFile data 类型 =', typeof res.data);
			  console.log('uploadFile status  =', typeof res.statusCode || res.status);
          resolve(unwrapText(String(res.data || ""), res.statusCode || 0));
        } catch (error) {
          reject(error);
        }
      },
      fail: (err) => {
        console.error('uploadFile fail =', JSON.stringify(err));
        reject(new Error("照片上传失败"));
      }
    });
  });
}

function openUploadUrl(intent, token) {
  const base = getApiBaseUrl().replace(/\/$/, "");
  return `${base}/api/screen/open/${OPEN_RESOURCE[intent]}/${encodeURIComponent(token)}/upload`;
}

function unwrapText(raw, status) {
  const trimmed = String(raw || "").trim();
  
    // 非 2xx：后端可能返回纯文本，直接当 message
    if (status < 200 || status >= 300) {
      throw new Error(trimmed || `上传失败（HTTP ${status}）`);
    }
  
    // 2xx 且空 body
    if (!trimmed) {
      return {};
    }
  
    let envelope;
    try {
      envelope = JSON.parse(trimmed);
    } catch {
      // 2xx 但 body 不是 JSON，直接抛原始文本，方便定位
      throw new Error(trimmed);
    }
  
    const code = String(envelope.code || "").toUpperCase();
    if (code && !SUCCESS_CODES.has(code)) {
      throw new Error(envelope.message || `上传失败（code=${code}）`);
    }
    return envelope.data || {};
}

function traceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `screen-${Date.now()}`;
}