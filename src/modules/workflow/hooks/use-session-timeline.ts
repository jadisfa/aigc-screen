import { useCallback, useEffect, useRef, useState } from "react";
import { listDispatchTimeline, type DispatchTimelineItem } from "@/shared/api/sys/scheduler";

/**
 * 会话任务 timeline 拉取与分页。
 *
 * 业务约束：
 * - timeline 按 sessionId 分页拉取（pageNo 从 1 开始），用于“预览页历史任务”展示。
 *
 * 失败策略：
 * - 失败时仅通过 onError 回调上抛给页面决定如何提示；不在 hook 内写 UI 副作用。
 * - 并发保护：同一时刻最多进行一次请求，避免滚动触发重复加载导致乱序/重复。
 */
export function useSessionTimeline(args: {
  sessionId: string;
  pageSize?: number;
  onError?: (e: unknown) => void;
}) {
  const { sessionId, pageSize = 10, onError } = args;

  const [items, setItems] = useState<DispatchTimelineItem[]>([]);
  const [pageNo, setPageNo] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const totalRef = useRef<number | undefined>(undefined);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const loadPage = useCallback(
    async (nextPageNo: number, append: boolean) => {
      if (!sessionId) return;
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const data = await listDispatchTimeline({ sessionId, pageNo: nextPageNo, pageSize, total: totalRef.current });
        totalRef.current = data.total;
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setPageNo(data.pageNo);
        setHasMore(data.hasMore);
      } catch (e) {
        onErrorRef.current?.(e);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [pageSize, sessionId]
  );

  const refresh = useCallback(async () => {
    await loadPage(1, false);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    if (loadingRef.current) return;
    await loadPage(pageNo + 1, true);
  }, [hasMore, loadPage, pageNo]);

  const reset = useCallback(() => {
    loadingRef.current = false;
    totalRef.current = undefined;
    setItems([]);
    setPageNo(1);
    setHasMore(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    reset();
    refresh().catch(() => void 0);
  }, [refresh, reset, sessionId]);

  return { items, pageNo, hasMore, loading, refresh, loadMore, reset };
}
