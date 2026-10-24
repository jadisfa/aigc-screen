import { screenRequest } from "@/lib/screen-http";

export type TrackEventItem = {
  eventCode: string;
  properties?: Record<string, unknown>;
};

export type TrackIngestResult = {
  accepted: number;
  rejected: number;
};

export function reportTrackEvents(events: TrackEventItem[]) {
  return screenRequest<TrackIngestResult>("/api/screen/track/events", {
    method: "POST",
    data: { events },
  });
}
