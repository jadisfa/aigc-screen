import { reportTrackEvents, type TrackEventItem } from "@/lib/screen-api/track";

export type TrackProperties = Record<string, unknown>;

const FLUSH_SIZE = 20;
const FLUSH_MS = 5000;
const MAX_QUEUE = 100;

const queue: TrackEventItem[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function enqueue(eventCode: string, properties?: TrackProperties) {
  const code = eventCode?.trim();
  if (!code) {
    return;
  }
  queue.push({ eventCode: code, properties: properties ?? {} });
  if (queue.length > MAX_QUEUE) {
    queue.splice(0, queue.length - MAX_QUEUE);
  }
  if (queue.length >= FLUSH_SIZE) {
    void flush();
    return;
  }
  schedule();
}

async function flush() {
  if (flushing || queue.length === 0) {
    return;
  }
  flushing = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = queue.splice(0, FLUSH_SIZE);
  try {
    await reportTrackEvents(batch);
  } catch {
    queue.unshift(...batch);
    if (queue.length > MAX_QUEUE) {
      queue.splice(0, queue.length - MAX_QUEUE);
    }
  } finally {
    flushing = false;
    if (queue.length >= FLUSH_SIZE) {
      void flush();
    } else if (queue.length > 0) {
      schedule();
    }
  }
}

function schedule() {
  if (timer || flushing) {
    return;
  }
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_MS);
}

/** 屏端埋点唯一入口。只传 eventCode 与定义内参数，设备身份由服务端盖章。 */
export const trackSdk = {
  track: enqueue,
  flush,
};

installTrackSdk();

function installTrackSdk() {
  const host = uni as Uni & { $track?: typeof trackSdk };
  host.$track = trackSdk;
}
