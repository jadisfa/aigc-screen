import { findListedProduct, formatProductPrice } from "@/data/kiosk-catalog";
import { GENERATE_LOOKS, type GenerateLook } from "./results";
import type { ScreenHandModelList } from "@/lib/screen-api/hand-models";

export const TRYON_LOOK_KEY = "kiosk.tryon.lookId";
export const TRYON_HAND_KEY = "kiosk.tryon.handId";
export const TRYON_RESULT_KEY = "kiosk.tryon.result";
export const TRYON_TASK_KEY = "kiosk.tryon.taskId";
export const TRYON_IMAGE_KEY = "kiosk.tryon.imageUrl";
export const TRYON_NAIL_KEY = "kiosk.tryon.nailUrl";

export type HandModel = {
  id: string;
  image: string;
};

export const TRYON_WAIT_LINES = [
  "正在扫描您的穿搭色系与风格...",
  "正在渲染光影质感，让美甲更逼真...",
];

export function toKioskHands(list: ScreenHandModelList | null | undefined): HandModel[] {
  const rows = [...(list?.official || []), ...(list?.custom || [])].sort(
    (a, b) => (a.sortNo ?? Number.MAX_SAFE_INTEGER) - (b.sortNo ?? Number.MAX_SAFE_INTEGER),
  );
  return rows
    .map((row) => ({
      id: row.configId || row.materialId || "",
      image: (row.previewUrl || row.assetUrl || "").trim(),
    }))
    .filter((row) => row.id && row.image);
}

export function resolveLook(lookId?: string): GenerateLook {
  const product = findListedProduct(lookId);
  if (product) {
    return {
      id: product.id,
      image: product.image,
      price: formatProductPrice(product.price),
      buyThumb: product.image,
    };
  }
  return GENERATE_LOOKS.find((item) => item.id === lookId) ?? {
    id: lookId || "",
    image: "",
    price: "",
    buyThumb: "",
  };
}

export function readTryOnLookId() {
  return (uni.getStorageSync(TRYON_LOOK_KEY) || "") as string;
}

export function writeTryOnLookId(lookId: string) {
  uni.setStorageSync(TRYON_LOOK_KEY, lookId);
}

export function readTryOnHandId() {
  return (uni.getStorageSync(TRYON_HAND_KEY) || "") as string;
}

export function writeTryOnHandId(handId: string) {
  uni.setStorageSync(TRYON_HAND_KEY, handId);
}

export function clearTryOnHandId() {
  uni.removeStorageSync(TRYON_HAND_KEY);
}

export function clearTryOnHandSelection() {
  clearTryOnHandId();
  uni.removeStorageSync(TRYON_IMAGE_KEY);
}

export function writeTryOnImageUrl(imageUrl: string) {
  uni.setStorageSync(TRYON_IMAGE_KEY, imageUrl);
}

export function readTryOnImageUrl() {
  return String(uni.getStorageSync(TRYON_IMAGE_KEY) || "");
}

export function writeTryOnNailUrl(imageUrl: string) {
  uni.setStorageSync(TRYON_NAIL_KEY, imageUrl);
}

export function readTryOnNailUrl() {
  return String(uni.getStorageSync(TRYON_NAIL_KEY) || "");
}

export function writeTryOnResult(image: string) {
  uni.setStorageSync(TRYON_RESULT_KEY, image);
}

export function readTryOnResult() {
  return (uni.getStorageSync(TRYON_RESULT_KEY) || "") as string;
}

export function writeTryOnTaskId(taskId: string) {
  uni.setStorageSync(TRYON_TASK_KEY, taskId);
}

export function readTryOnTaskId() {
  return String(uni.getStorageSync(TRYON_TASK_KEY) || "");
}
