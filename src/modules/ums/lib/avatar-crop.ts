export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = src;
  });
}

export async function getCroppedAvatarBlob(src: string, crop: PixelCrop, outputSize = 512): Promise<Blob> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("裁剪画布初始化失败");
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputSize,
    outputSize,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("裁剪结果生成失败"));
        return;
      }
      resolve(blob);
    }, "image/png", 0.92);
  });
}

function guessFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    return last && last.includes(".") ? last : "avatar.png";
  } catch {
    return "avatar.png";
  }
}

export function createAvatarFileName(url: string): string {
  return guessFileName(url);
}

export function isBlobAvatarUrl(url: string): boolean {
  return url.startsWith("blob:");
}

export async function createAvatarCropObjectUrl(url: string, blob: Blob): Promise<string> {
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
  const file = new File([blob], guessFileName(url), { type });
  return URL.createObjectURL(file);
}
