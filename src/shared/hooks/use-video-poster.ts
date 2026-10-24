import { useEffect, useState } from "react";

export type UseVideoPosterOptions = {
  seekRatio?: number;
  quality?: number;
};

const posterCache = new Map<string, string>();
const posterFailed = new Set<string>();

function capturePoster(video: HTMLVideoElement, quality: number): string | null {
  try {
    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;
    if (w <= 0 || h <= 0) return null;
    const scale = Math.min(1, 480 / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}

function releaseVideo(video: HTMLVideoElement) {
  video.removeAttribute("src");
  video.load();
}

/**
 * 从视频 URL 生成列表封面 dataURL。
 * 失败返回 null；同一 src 复用成功/失败缓存，避免反复截帧。
 */
export function useVideoPoster(src: string, options?: UseVideoPosterOptions) {
  const seekRatio = typeof options?.seekRatio === "number" ? options.seekRatio : 0.01;
  const quality = typeof options?.quality === "number" ? options.quality : 0.72;
  const [poster, setPoster] = useState<string | null>(() => (src ? posterCache.get(src) ?? null : null));

  useEffect(() => {
    if (!src) {
      setPoster(null);
      return;
    }
    const cached = posterCache.get(src);
    if (cached) {
      setPoster(cached);
      return;
    }
    if (posterFailed.has(src)) {
      setPoster(null);
      return;
    }

    let cancelled = false;
    let settled = false;
    let seekStarted = false;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.crossOrigin = "anonymous";

    const finish = (data: string | null) => {
      if (settled) return;
      settled = true;
      v.removeEventListener("loadedmetadata", onReady);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onError);
      window.clearTimeout(timer);
      releaseVideo(v);
      if (cancelled) return;
      if (data) {
        posterCache.set(src, data);
        posterFailed.delete(src);
        setPoster(data);
        return;
      }
      posterFailed.add(src);
      setPoster(null);
    };

    const tryCapture = () => {
      if (cancelled || settled) return false;
      const data = capturePoster(v, quality);
      if (!data) return false;
      finish(data);
      return true;
    };

    const onReady = () => {
      if (cancelled || settled || seekStarted) return;
      seekStarted = true;
      try {
        const duration = Number.isFinite(v.duration) ? v.duration : 0;
        const target = Math.min(0.25, duration > 0 ? Math.max(0, duration * seekRatio) : 0);
        if (v.videoWidth > 0 && Math.abs(v.currentTime - target) < 0.04 && tryCapture()) return;
        v.currentTime = target;
      } catch {
        if (!tryCapture()) finish(null);
      }
    };

    const onSeeked = () => {
      if (!tryCapture()) finish(null);
    };

    const onError = () => finish(null);

    v.addEventListener("loadedmetadata", onReady);
    v.addEventListener("loadeddata", onReady);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("error", onError);

    const timer = window.setTimeout(() => {
      if (!tryCapture()) finish(null);
    }, 4000);

    v.src = src;

    return () => {
      cancelled = true;
      if (settled) return;
      v.removeEventListener("loadedmetadata", onReady);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("error", onError);
      window.clearTimeout(timer);
      releaseVideo(v);
    };
  }, [quality, seekRatio, src]);

  return poster;
}
