import { useCallback } from "react";
import { getAccessToken } from "@/shared/api/auth/auth";
import { getApiBaseUrl } from "@/shared/api/sys/api-base";
import { notify } from "@/shared/lib/notify";

function getBaseUrl(): string {
  return getApiBaseUrl();
}

function parseDownloadFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  const candidate = plainMatch?.[1] || plainMatch?.[2];
  return candidate?.trim() || fallback;
}

/**
 * 资源下载工具（图片 PNG / 导出 SVG）。
 *
 * 业务语义：
 * - PNG：直接下载链接资源；
 * - SVG：将图片绘制到 Fabric canvas 后导出 SVG，避免导出的 SVG 依赖 localhost 等外部 URL。
 *
 * 失败/回退：
 * - 当 fetch 被 CORS 阻止时，SVG 导出回退使用原 URL 继续尝试加载。
 */
export function useAssetDownloader() {
  const triggerDownload = useCallback((href: string, filename: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  const downloadImage = useCallback(
    (url: string) => {
      triggerDownload(url, `asset-${Date.now()}.png`);
    },
    [triggerDownload]
  );

  const downloadTaskImageArchive = useCallback(
    async (taskId: string) => {
      const normalizedTaskId = taskId.trim();
      if (!normalizedTaskId) return;
      const headers = new Headers();
      headers.set("Accept", "application/zip");
      const token = getAccessToken();
      if (token) {
        headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
      }
      try {
        const response = await fetch(`${getBaseUrl()}/api/scheduler/dispatch/${encodeURIComponent(normalizedTaskId)}/assets/archive`, {
          method: "GET",
          headers,
        });
        if (!response.ok) {
          throw new Error(`download failed: ${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const filename = parseDownloadFilename(response.headers.get("Content-Disposition"), `task-${normalizedTaskId.slice(0, 8)}.zip`);
        triggerDownload(blobUrl, filename);
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (error) {
        console.error("download task image archive failed", error);
        notify.error("批量下载失败，请稍后重试");
        throw error;
      }
    },
    [triggerDownload]
  );

  const downloadSvg = useCallback(
    async (url: string) => {
      const { StaticCanvas, FabricImage } = await import("fabric");
      const canvas = new StaticCanvas(undefined);
      try {
        let imageSource = url;
        try {
          const res = await fetch(url, { mode: "cors" });
          if (res.ok) {
            const blob = await res.blob();
            imageSource = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ""));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            });
          }
        } catch {
          void 0;
        }

        const image = await FabricImage.fromURL(imageSource, { crossOrigin: "anonymous" });
        const rawW = Math.max(1, Math.round(image.width || 0));
        const rawH = Math.max(1, Math.round(image.height || 0));
        canvas.setDimensions({ width: rawW, height: rawH });
        image.set({
          left: 0,
          top: 0,
          originX: "left",
          originY: "top",
          scaleX: 1,
          scaleY: 1,
        });
        canvas.add(image);
        canvas.renderAll();
        const svgText = canvas.toSVG();
        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        triggerDownload(blobUrl, `asset-${Date.now()}.svg`);
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } finally {
        canvas.dispose();
      }
    },
    [triggerDownload]
  );

  return { downloadImage, downloadTaskImageArchive, downloadSvg };
}
