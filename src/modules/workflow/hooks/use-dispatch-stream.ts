import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDispatch,
  getDispatchWebSocketUrl,
  listDispatchEvents,
  mergeAssetsStable,
  type Dispatch as SchedulerDispatch,
  type TaskEvent,
} from "@/shared/api/sys/scheduler";

function isTerminalStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "succeeded" || s === "failed" || s === "canceled";
}

function inFlightStatusRank(status: string | null | undefined): number {
  const s = (status || "").toLowerCase();
  if (s === "queued" || s === "submitting") return 1;
  if (s === "claimed" || s === "requeued") return 2;
  if (s === "running" || s === "submitted" || s === "pending") return 3;
  if (isTerminalStatus(s)) return 4;
  return 0;
}

function pickLaterStatus(prev: string | null | undefined, incoming: string | null | undefined): string {
  if (inFlightStatusRank(incoming) >= inFlightStatusRank(prev)) {
    return incoming || prev || "";
  }
  return prev || incoming || "";
}

function coalesceProgress(prev: number | null | undefined, incoming: number | null | undefined): number {
  const left = typeof prev === "number" && Number.isFinite(prev) ? prev : 0;
  const right = typeof incoming === "number" && Number.isFinite(incoming) ? incoming : 0;
  return Math.max(0, Math.max(left, right));
}

function mergeDetailPreservingTerminal(
  prev: SchedulerDispatch | null,
  incoming: SchedulerDispatch
): SchedulerDispatch {
  if (!prev) {
    return incoming;
  }

  const prevIsTerminal = isTerminalStatus(prev.status);
  const incomingIsTerminal = isTerminalStatus(incoming.status);
  if (!prevIsTerminal || incomingIsTerminal) {
    return {
      ...incoming,
      status: pickLaterStatus(prev.status, incoming.status),
      progress: coalesceProgress(prev.progress, incoming.progress),
      assets: mergeAssetsStable(prev.assets, incoming.assets),
      errorMessage: incoming.errorMessage ?? prev.errorMessage,
      finishedAt: incoming.finishedAt ?? prev.finishedAt,
    };
  }

  // Do not let late snapshots / polling results regress a terminal task back to running.
  return {
    ...incoming,
    status: prev.status,
    progress: coalesceProgress(prev.progress, incoming.progress),
    queuePosition: 0,
    etaSeconds: 0,
    errorMessage: prev.errorMessage ?? incoming.errorMessage,
    finishedAt: prev.finishedAt ?? incoming.finishedAt,
    assets: mergeAssetsStable(prev.assets, incoming.assets),
  };
}

function hasPendingReviewAssets(assets: SchedulerDispatch["assets"] | null | undefined): boolean {
  const items = Array.isArray(assets) ? assets : [];
  for (const a of items) {
    const v = String(a?.reviewStatus || "").toLowerCase();
    if (v === "pending") return true;
  }
  return false;
}

function shouldStopAutoRefresh(detail: SchedulerDispatch | null): boolean {
  if (!detail) return false;
  if (!isTerminalStatus(detail.status)) return false;
  return !hasPendingReviewAssets(detail.assets);
}

function extractEventErrorMessage(parsed: Record<string, unknown> | null, statusCandidate: string, eventType: string): string | null {
  if (!parsed) {
    return null;
  }
  const status = (statusCandidate || "").toLowerCase();
  const type = (eventType || "").toLowerCase();
  const isFailureLike = status === "failed" || status === "canceled" || type === "failed" || type === "canceled";

  const directError = typeof parsed.errorMessage === "string" && parsed.errorMessage.trim()
    ? parsed.errorMessage.trim()
    : null;
  if (directError) {
    return directError;
  }

  const payload = parsed.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const payloadRecord = payload as Record<string, unknown>;
    const payloadError = typeof payloadRecord.errorMessage === "string" && payloadRecord.errorMessage.trim()
      ? payloadRecord.errorMessage.trim()
      : typeof payloadRecord.userMessage === "string" && payloadRecord.userMessage.trim()
        ? payloadRecord.userMessage.trim()
        : null;
    if (payloadError) {
      return payloadError;
    }
  }

  if (!isFailureLike) {
    return null;
  }
  return typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : null;
}

/**
 * 调度任务实时刷新（WS 优先，失败回退 HTTP 轮询）。
 *
 * 业务语义：
 * - 同一 taskId：通过 WS 接收增量 event + snapshot；若 WS 不可用，则短间隔轮询 HTTP。
 * - event 去重与 lastEventId 维护：用于断线重连时的 best-effort 补齐。
 *
 * 失败策略：
 * - WS 初始化/断开/异常：提示 streamHint，并回退到 HTTP 轮询；同时以指数退避尝试重连 WS。
 * - 当任务进入终态且不再存在待审核资产时停止自动刷新，避免无意义请求。
 */
export function useDispatchStream(args: {
  taskId: string | null;
  sessionId: string;
  pollIntervalMs?: number;
}) {
  const { taskId, sessionId, pollIntervalMs = 1500 } = args;

  const [detail, setDetail] = useState<SchedulerDispatch | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [streamMode, setStreamMode] = useState<"idle" | "ws" | "http">("idle");
  const [streamHint, setStreamHint] = useState<string | null>(null);

  const taskIdRef = useRef<string | null>(taskId);
  useEffect(() => {
    taskIdRef.current = taskId;
  }, [taskId]);

  const detailRef = useRef<SchedulerDispatch | null>(null);
  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  const wsRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const eventKeySetRef = useRef<Set<string>>(new Set());
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const closeWs = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    try {
      ws.close();
    } catch {
      void 0;
    }
  }, []);

  const stopReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
  }, []);

  const mergeEvents = useCallback((incoming: TaskEvent[]) => {
    if (!incoming.length) return;
    const next: TaskEvent[] = [];
    for (const e of incoming) {
      const k = e.eventId || `${e.eventType}|${e.createdAt || ""}|${e.detailJson || ""}`;
      if (eventKeySetRef.current.has(k)) continue;
      eventKeySetRef.current.add(k);
      next.push(e);
      if (e.eventId) {
        lastEventIdRef.current = e.eventId;
      }
    }
    if (!next.length) return;
    setEvents((prev) => [...prev, ...next]);
  }, []);

  const refreshByHttp = useCallback(
    async (taskIdOverride?: string): Promise<SchedulerDispatch | null> => {
      const t = taskIdOverride ?? taskIdRef.current;
      if (!t) return null;

      const [nextDetail, nextEvents] = await Promise.all([getDispatch(t), listDispatchEvents(t)]);
      let mergedDetail: SchedulerDispatch | null = null;
      if (nextDetail) {
        setDetail((prev) => {
          mergedDetail = mergeDetailPreservingTerminal(prev, nextDetail);
          return mergedDetail;
        });
      }
      if (nextEvents) {
        mergeEvents(nextEvents);
      }
      if (shouldStopAutoRefresh(mergedDetail ?? nextDetail)) {
        stopPolling();
        stopReconnect();
        closeWs();
        setStreamMode("idle");
      }
      return mergedDetail ?? nextDetail;
    },
    [closeWs, mergeEvents, stopPolling, stopReconnect]
  );

  const startPolling = useCallback(
    (t: string) => {
      stopPolling();
      pollTimerRef.current = window.setInterval(() => {
        refreshByHttp(t).catch(() => void 0);
      }, pollIntervalMs);
    },
    [pollIntervalMs, refreshByHttp, stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    stopReconnect();
    closeWs();
    eventKeySetRef.current = new Set();
    lastEventIdRef.current = null;
    setDetail(null);
    setEvents([]);
    setStreamMode("idle");
    setStreamHint(null);
  }, [closeWs, stopPolling, stopReconnect]);

  useEffect(() => {
    reset();

    if (!taskId) {
      return () => {
        stopPolling();
        stopReconnect();
        closeWs();
      };
    }

    const t = taskId;
    let disposed = false;

    const scheduleReconnect = () => {
      if (disposed) return;
      if (reconnectTimerRef.current !== null) return;
      if (shouldStopAutoRefresh(detailRef.current)) return;
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(15000, 1500 * Math.pow(2, attempt));
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (disposed) return;
        if (shouldStopAutoRefresh(detailRef.current)) return;
        refreshByHttp(t)
          .then((d) => {
            if (disposed) return;
            if (shouldStopAutoRefresh(d)) return;
            openWs();
          })
          .catch(() => void 0);
        reconnectAttemptRef.current = Math.min(attempt + 1, 6);
      }, delay);
    };

    const openWs = () => {
      if (disposed) return;
      const existing = wsRef.current;
      if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return;

      try {
        const ws = new WebSocket(getDispatchWebSocketUrl(t, { lastEventId: lastEventIdRef.current }));
        wsRef.current = ws;
        setStreamMode("ws");
        setStreamHint("正在连接 WebSocket...");

        ws.onopen = () => {
          if (disposed) return;
          stopPolling();
          stopReconnect();
          setStreamMode("ws");
          setStreamHint(null);
        };

        ws.onmessage = (evt) => {
          if (disposed) return;
          let msg: unknown;
          try {
            msg = JSON.parse(String(evt.data || ""));
          } catch {
            return;
          }
          if (!msg || typeof msg !== "object") return;
          const obj = msg as Record<string, unknown>;
          const type = typeof obj.type === "string" ? obj.type : "";

          if (type === "event") {
            const e: TaskEvent = {
              eventId: typeof obj.eventId === "string" ? obj.eventId : null,
              eventType: typeof obj.eventType === "string" ? obj.eventType : "",
              detailJson: typeof obj.detailJson === "string" ? obj.detailJson : null,
              createdAt: typeof obj.createdAt === "string" ? obj.createdAt : null,
            };
            if (e.eventType) {
              mergeEvents([e]);

              setDetail((prev) => {
                const base: SchedulerDispatch =
                  prev ??
                  ({
                    taskId: t,
                    sessionId,
                    taskName: null,
                    status: "",
                    preview: true,
                    priority: 0,
                    submittedAt: null,
                    startedAt: null,
                    finishedAt: null,
                    computeUnits: 0,
                    errorMessage: null,
                    outputJson: null,
                    inputJson: null,
                    appId: null,
                    workflowVersionId: null,
                    serverId: null,
                    serverName: null,
                    queuePosition: 0,
                    etaSeconds: 0,
                    progress: 0,
                    assets: [],
                  } satisfies SchedulerDispatch);
                const next = { ...base };
                let updated = false;

                const typeLower = e.eventType.toLowerCase();
                const parsed = e.detailJson ? (() => {
                  try {
                    return JSON.parse(e.detailJson) as Record<string, unknown>;
                  } catch {
                    return null;
                  }
                })() : null;
                // progress 事件的 stage 多为 comfyui_generate 等业务阶段，不能当作任务生命周期状态。
                const lifecycleStatuses = ["queued", "claimed", "running", "succeeded", "failed", "canceled", "requeued"];
                const parsedStatus = typeof parsed?.status === "string" ? parsed.status.toLowerCase() : "";
                const parsedStage = typeof parsed?.stage === "string" ? parsed.stage.toLowerCase() : "";
                const statusCandidate = lifecycleStatuses.includes(typeLower)
                  ? typeLower
                  : lifecycleStatuses.includes(parsedStatus)
                    ? parsedStatus
                    : lifecycleStatuses.includes(parsedStage)
                      ? parsedStage
                      : "";
                if (statusCandidate && (next.status || "").toLowerCase() !== statusCandidate) {
                  next.status = statusCandidate;
                  updated = true;
                }
                if (
                  typeLower === "progress"
                  && !isTerminalStatus(next.status)
                  && (next.status || "").toLowerCase() !== "running"
                ) {
                  next.status = "running";
                  updated = true;
                }

                if (parsed) {
                  if (typeof parsed.progress === "number") {
                    const nextProgress = Math.max(
                      typeof next.progress === "number" ? next.progress : 0,
                      parsed.progress
                    );
                    if (nextProgress !== next.progress) {
                      next.progress = nextProgress;
                      updated = true;
                    }
                  }
                  if (typeof parsed.queuePosition === "number" && parsed.queuePosition !== next.queuePosition) {
                    next.queuePosition = parsed.queuePosition;
                    updated = true;
                  }
                  if (typeof parsed.etaSeconds === "number" && parsed.etaSeconds !== next.etaSeconds) {
                    next.etaSeconds = parsed.etaSeconds;
                    updated = true;
                  }
                  if (typeof parsed.serverId === "string" && parsed.serverId !== next.serverId) {
                    next.serverId = parsed.serverId;
                    updated = true;
                  }
                  if (typeof parsed.serverName === "string" && parsed.serverName !== next.serverName) {
                    next.serverName = parsed.serverName;
                    updated = true;
                  }
                  const errorMessage = extractEventErrorMessage(parsed, statusCandidate, typeLower);
                  if (errorMessage && errorMessage !== next.errorMessage) {
                    next.errorMessage = errorMessage;
                    updated = true;
                  }
                  const occurredAt = typeof parsed.occurredAt === "string" ? parsed.occurredAt : null;
                  if (typeof occurredAt === "string" && ["succeeded", "failed", "canceled"].includes(statusCandidate.toLowerCase()) && occurredAt !== next.finishedAt) {
                    next.finishedAt = occurredAt;
                    updated = true;
                  }
                }
                if (["succeeded", "failed", "canceled"].includes(statusCandidate.toLowerCase())) {
                  if (next.queuePosition !== 0) {
                    next.queuePosition = 0;
                    updated = true;
                  }
                  if (next.etaSeconds !== 0) {
                    next.etaSeconds = 0;
                    updated = true;
                  }
                  if (!next.finishedAt && e.createdAt) {
                    next.finishedAt = e.createdAt;
                    updated = true;
                  }
                }
                return updated ? next : prev;
              });
            }
            return;
          }

          if (type === "snapshot") {
            const base: SchedulerDispatch =
              detailRef.current ??
              ({
                taskId: t,
                sessionId,
                taskName: null,
                status: "",
                preview: true,
                priority: 0,
                submittedAt: null,
                startedAt: null,
                finishedAt: null,
                computeUnits: 0,
                errorMessage: null,
                outputJson: null,
                inputJson: null,
                appId: null,
                workflowVersionId: null,
                serverId: null,
                serverName: null,
                queuePosition: 0,
                etaSeconds: 0,
                progress: 0,
                assets: [],
              } satisfies SchedulerDispatch);

            const incomingDetail: SchedulerDispatch = {
              ...base,
              taskId: t,
              sessionId: typeof obj.sessionId === "string" ? obj.sessionId : base.sessionId,
              status: typeof obj.status === "string" ? obj.status : base.status,
              progress: typeof obj.progress === "number" ? obj.progress : base.progress,
              serverId: typeof obj.serverId === "string" ? obj.serverId : base.serverId,
              serverName: typeof obj.serverName === "string" ? obj.serverName : base.serverName,
              queuePosition: typeof obj.queuePosition === "number" ? obj.queuePosition : base.queuePosition,
              etaSeconds: typeof obj.etaSeconds === "number" ? obj.etaSeconds : base.etaSeconds,
              outputJson: typeof obj.outputJson === "string" ? obj.outputJson : base.outputJson,
              errorMessage: typeof obj.errorMessage === "string" ? obj.errorMessage : base.errorMessage,
              assets: mergeAssetsStable(base.assets, Array.isArray(obj.assets) ? (obj.assets as SchedulerDispatch["assets"]) : base.assets),
              submittedAt: typeof obj.submittedAt === "string" ? obj.submittedAt : base.submittedAt,
              startedAt: typeof obj.startedAt === "string" ? obj.startedAt : base.startedAt,
              finishedAt: typeof obj.finishedAt === "string" ? obj.finishedAt : base.finishedAt,
            };
            let nextDetail: SchedulerDispatch | null = null;
            setDetail((prev) => {
              nextDetail = mergeDetailPreservingTerminal(prev, incomingDetail);
              return nextDetail;
            });

            if (shouldStopAutoRefresh(nextDetail ?? incomingDetail)) {
              stopPolling();
              stopReconnect();
              closeWs();
              setStreamMode("idle");
            }
            return;
          }
        };

        ws.onerror = () => {
          if (disposed) return;
          wsRef.current = null;
          if (shouldStopAutoRefresh(detailRef.current)) {
            setStreamMode("idle");
            setStreamHint(null);
            stopPolling();
            stopReconnect();
            return;
          }
          setStreamHint("WebSocket 连接异常，已回退 HTTP 查询");
          setStreamMode("http");
          startPolling(t);
          scheduleReconnect();
        };

        ws.onclose = (ev) => {
          if (disposed) return;
          wsRef.current = null;
          if (shouldStopAutoRefresh(detailRef.current)) {
            setStreamMode("idle");
            setStreamHint(null);
            stopPolling();
            stopReconnect();
            return;
          }
          setStreamHint(ev.code === 1000 ? "WebSocket 已关闭，已回退 HTTP 查询" : "WebSocket 已断开，已回退 HTTP 查询");
          setStreamMode("http");
          startPolling(t);
          scheduleReconnect();
        };
      } catch (e) {
        if (disposed) return;
        setStreamHint(e instanceof Error ? e.message : "WebSocket 初始化失败，已回退 HTTP 查询");
        setStreamMode("http");
        startPolling(t);
        scheduleReconnect();
      }
    };

    refreshByHttp(t)
      .then((d) => {
        if (disposed) return;
        if (shouldStopAutoRefresh(d)) return;
        openWs();
      })
      .catch((e) => {
        if (disposed) return;
        setStreamHint(e instanceof Error ? e.message : "查询失败");
        setStreamMode("http");
        startPolling(t);
        scheduleReconnect();
      });

    return () => {
      disposed = true;
      stopPolling();
      stopReconnect();
      closeWs();
    };
  }, [closeWs, mergeEvents, refreshByHttp, reset, sessionId, startPolling, stopPolling, stopReconnect, taskId]);

  return { detail, events, streamMode, streamHint, refreshByHttp, reset };
}
