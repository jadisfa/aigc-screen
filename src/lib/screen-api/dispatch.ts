import { screenRequest } from "@/lib/screen-http";

export type ScreenDispatchDetail = {
  taskId?: string;
  sessionId?: string;
  status?: string;
  errorMessage?: string;
  errorCode?: string;
};

/** 断线兜底：APK 不 POST dispatch，只 GET 任务终态。 */
export function fetchDispatch(taskId: string) {
  return screenRequest<ScreenDispatchDetail>(`/api/scheduler/dispatch/${encodeURIComponent(taskId)}`);
}
