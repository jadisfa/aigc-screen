import { ADMIN_PAGES, KIOSK_PAGES } from "./kiosk-routes";

/** 扫码/拍照上传入口。同一套页面靠 intent 区分文案、预览缓存和完成后的去向。 */
export type UploadIntent = "outfit" | "inspire" | "banner" | "hand-model" | "hand-admin";

export type ScanStatus = "waiting" | "scanned" | "failed" | "cancelled" | "expired" | "uploaded";

export type UploadFlow = {
  title: string;
  lead: string;
  confirmText: string;
  cameraHint: string;
  skipRecognize: boolean;
  previewKey: string;
  /** 点确认后：生成匹配 / 仅回上一页 */
  confirmKind: "generate" | "accept";
  nextAfterConfirm: string;
};

const generatingThenResults = `${KIOSK_PAGES.generating}?next=${encodeURIComponent(KIOSK_PAGES.results)}`;

export const UPLOAD_FLOWS: Record<UploadIntent, UploadFlow> = {
  outfit: {
    title: "扫码上传穿搭照片",
    lead: "请上传穿搭实拍照片，以便获得更好的展示效果",
    confirmText: "开始生成",
    cameraHint: "请拍摄全身/半身穿搭，确保衣物清晰",
    skipRecognize: false,
    previewKey: "kiosk.preview.outfit",
    confirmKind: "generate",
    nextAfterConfirm: generatingThenResults,
  },
  inspire: {
    title: "扫码上传穿搭照片",
    lead: "请上传穿搭实拍照片，以便获得更好的展示效果",
    confirmText: "开始生成",
    cameraHint: "请拍摄全身/半身穿搭，确保衣物清晰",
    skipRecognize: true,
    previewKey: "kiosk.preview.inspire",
    confirmKind: "generate",
    nextAfterConfirm: generatingThenResults,
  },
  banner: {
    title: "扫码上传banner轮播图",
    lead: "最多上传 5 张图片，支持 JPEG、JPG、PNG 格式，单张图片大小≤10M",
    confirmText: "确定",
    cameraHint: "请拍摄清晰的 Banner 画面",
    skipRecognize: true,
    previewKey: "kiosk.preview.banner",
    confirmKind: "accept",
    nextAfterConfirm: ADMIN_PAGES.banner,
  },
  "hand-model": {
    title: "扫码上传手部照片",
    lead: "请上传清晰手部照片，以便获得更好的展示效果",
    confirmText: "确定",
    cameraHint: "请拍摄手部，确保指甲清晰",
    skipRecognize: true,
    previewKey: "kiosk.preview.hand-model",
    confirmKind: "accept",
    nextAfterConfirm: KIOSK_PAGES.tryOn,
  },
  "hand-admin": {
    title: "扫码上传手部照片",
    lead: "请上传清晰手部照片，以便获得更好的展示效果",
    confirmText: "确定",
    cameraHint: "请拍摄手部，确保指甲清晰",
    skipRecognize: true,
    previewKey: "kiosk.preview.hand-admin",
    confirmKind: "accept",
    nextAfterConfirm: ADMIN_PAGES.hand,
  },
};

export function parseUploadIntent(query?: Record<string, string>): UploadIntent {
  const raw = query?.intent || query?.mode;
  if (raw === "inspire" || raw === "banner" || raw === "hand-model" || raw === "hand-admin") {
    return raw;
  }
  return "outfit";
}

export function scanUploadUrl(intent: UploadIntent) {
  return `${KIOSK_PAGES.scanUpload}?intent=${intent}`;
}

/** 扫码上传页「返回」的上一页，不依赖页面栈是否还在。 */
export function scanBackUrl(intent: UploadIntent) {
  if (intent === "hand-admin") {
    return ADMIN_PAGES.hand;
  }
  if (intent === "hand-model") {
    return KIOSK_PAGES.tryOn;
  }
  if (intent === "banner") {
    return ADMIN_PAGES.banner;
  }
  return KIOSK_PAGES.home;
}

export function cameraUrl(intent: UploadIntent) {
  return `${KIOSK_PAGES.camera}?intent=${intent}`;
}

export const OUTFIT_UPLOAD_ID_KEY = "kiosk.outfitUploadId";

export function generatingUrl(next = KIOSK_PAGES.results) {
  return `${KIOSK_PAGES.generating}?next=${encodeURIComponent(next)}`;
}

export function readOutfitUploadId() {
  return String(uni.getStorageSync(OUTFIT_UPLOAD_ID_KEY) || "");
}

export function writeOutfitUploadId(sessionId: string) {
  uni.setStorageSync(OUTFIT_UPLOAD_ID_KEY, sessionId);
}

export function clearOutfitUploadId() {
  uni.removeStorageSync(OUTFIT_UPLOAD_ID_KEY);
}

export function readPreview(intent: UploadIntent) {
  return (uni.getStorageSync(UPLOAD_FLOWS[intent].previewKey) || "") as string;
}

export function writePreview(intent: UploadIntent, path: string) {
  uni.setStorageSync(UPLOAD_FLOWS[intent].previewKey, path);
}

export function clearPreview(intent: UploadIntent) {
  uni.removeStorageSync(UPLOAD_FLOWS[intent].previewKey);
}

/** 放弃本次未确认的上传（新顾客 / 点返回）。穿搭与灵感共用 outfitUploadId。 */
export function discardUploadDraft(intent: UploadIntent) {
  clearPreview(intent);
  if (intent === "outfit" || intent === "inspire") {
    clearOutfitUploadId();
  }
}
