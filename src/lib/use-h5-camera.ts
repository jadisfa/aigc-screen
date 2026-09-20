import { nextTick, ref } from "vue";

/** H5 预览与抓拍。App 端仍用 uni.createCameraContext，不走这里。 */
export function useH5Camera(hostSelector: string) {
  const liveFallback = ref(true);
  const failed = ref(false);
  let video: HTMLVideoElement | null = null;
  let stream: MediaStream | null = null;

  function resolveHost(): HTMLElement | null {
    if (typeof document === "undefined") {
      return null;
    }
    return (
      document.querySelector<HTMLElement>(hostSelector) ||
      document.getElementById(hostSelector.replace(/^#/, "")) ||
      document.querySelector<HTMLElement>(".cam__live") ||
      document.querySelector<HTMLElement>(".cam")
    );
  }

  async function waitForHost() {
    for (let i = 0; i < 10; i++) {
      await nextTick();
      const host = resolveHost();
      if (host) {
        return host;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return resolveHost();
  }

  async function openStream() {
    const constraints: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 1920 } }, audio: false },
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 1920 } }, audio: false },
      { video: true, audio: false },
    ];
    let lastError: unknown;
    for (const next of constraints) {
      try {
        return await navigator.mediaDevices.getUserMedia(next);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  function mountVideo(host: HTMLElement, nextStream: MediaStream) {
    host.style.position = "absolute";
    video = document.createElement("video");
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.setAttribute("muted", "true");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = nextStream;
    video.className = "cam__video";
    video.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0;background:#000;pointer-events:none;";
    host.insertBefore(video, host.firstChild);
    video.addEventListener("loadedmetadata", () => {
      void video?.play().catch(() => undefined);
    });
  }

  async function start() {
    const host = await waitForHost();
    if (!host || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      liveFallback.value = true;
      failed.value = true;
      return;
    }
    if (video && stream?.active) {
      liveFallback.value = false;
      failed.value = false;
      return;
    }
    stop();
    try {
      stream = await openStream();
      mountVideo(host, stream);
      await video?.play();
      liveFallback.value = false;
      failed.value = false;
    } catch {
      liveFallback.value = true;
      failed.value = true;
    }
  }

  function capture(fallbackSrc: string) {
    if (video && video.videoWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        return canvas.toDataURL("image/jpeg", 0.92);
      }
    }
    return fallbackSrc;
  }

  function stop() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (video) {
      video.srcObject = null;
      video.remove();
      video = null;
    }
  }

  return { liveFallback, failed, start, stop, capture };
}
