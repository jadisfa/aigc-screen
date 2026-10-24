import { trackSdk } from "@/lib/track-sdk";

export const TRACK_EVENTS = {
  outfitEntry: "ss_outfit_entry",
  outfitSubmit: "ss_outfit_submit",
  matchEntry: "ss_match_entry",
  matchSubmit: "ss_match_submit",
  tryonEntry: "ss_tryon_entry",
  tryonSubmit: "ss_tryon_submit",
} as const;

/** 业务页只调这些方法；采集失败不能打断页面。 */
export function trackOutfitEntry() {
  trackScreen(TRACK_EVENTS.outfitEntry);
}

export function trackOutfitSubmit() {
  trackScreen(TRACK_EVENTS.outfitSubmit);
}

export function trackMatchEntry() {
  trackScreen(TRACK_EVENTS.matchEntry);
}

export function trackMatchSubmit() {
  trackScreen(TRACK_EVENTS.matchSubmit);
}

export function trackTryonEntry() {
  trackScreen(TRACK_EVENTS.tryonEntry);
}

export function trackTryonSubmit() {
  trackScreen(TRACK_EVENTS.tryonSubmit);
}

function trackScreen(eventCode: string) {
  try {
    trackSdk.track(eventCode);
  } catch {
    /* 队列失败不影响业务 */
  }
}
