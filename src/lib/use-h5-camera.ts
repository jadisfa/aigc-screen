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

  let session = 0;

  async function start() {
    const ticket = ++session;
    const host = await waitForHost();
    if (ticket !== session) {
      return;
    }
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
    releaseStream();
    try {
      const next = await openStream();
      if (ticket !== session) {
        stopStream(next);
        return;
      }
      stream = next;
      mountVideo(host, next);
      await video?.play();
      if (ticket !== session) {
        releaseStream();
        return;
      }
      liveFallback.value = false;
      failed.value = false;
    } catch {
      if (ticket !== session) {
        return;
      }
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
    session += 1;
    releaseStream();
  }

  function releaseStream() {
    stopStream(stream);
    stream = null;
    if (video) {
      video.pause();
      video.srcObject = null;
      video.remove();
      video = null;
    }
    releaseOrphanStreams();
  }

  function stopStream(target: MediaStream | null) {
    target?.getTracks().forEach((track) => track.stop());
  }

  function releaseOrphanStreams() {
    if (typeof document === "undefined") {
      return;
    }
    document.querySelectorAll("video").forEach((node) => {
      const media = node.srcObject;
      if (!media || typeof (media as MediaStream).getTracks !== "function") {
        return;
      }
      stopStream(media as MediaStream);
      node.srcObject = null;
    });
  }

  return { liveFallback, failed, start, stop, capture };
}
