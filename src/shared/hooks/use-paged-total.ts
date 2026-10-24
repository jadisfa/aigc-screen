import { useCallback, useEffect, useRef, useState } from "react";

export function resolvePagedTotal(pageNo: number, total?: number) {
  return pageNo > 1 ? total : undefined;
}

export function usePagedTotal(pageNo: number, currentTotal?: number | null) {
  const [lastTotal, setLastTotal] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (typeof currentTotal !== "number") return;
    setLastTotal(currentTotal);
  }, [currentTotal]);

  return resolvePagedTotal(pageNo, lastTotal);
}

/**
 * 列表分页：已有 total 则随请求带上，避免后端重复 COUNT。
 * 筛选变化用 resetPage（清 total 并回第 1 页）；增删改用 invalidateTotal。
 * 刷新 / 翻页 / 改页大小不清理 total。
 * queryFn 里调用 getTotalParam()，以便读到当前缓存。
 */
export function usePagedListQuery(initialPageSize = 20) {
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const lastTotalRef = useRef<number | undefined>(undefined);

  const invalidateTotal = useCallback(() => {
    lastTotalRef.current = undefined;
  }, []);

  const resetPage = useCallback(() => {
    lastTotalRef.current = undefined;
    setPageNo(1);
  }, []);

  const changePageSize = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPageNo(1);
  }, []);

  const rememberTotal = useCallback((total?: number) => {
    if (typeof total === "number") {
      lastTotalRef.current = total;
    }
  }, []);

  const getTotalParam = useCallback(() => lastTotalRef.current, []);

  return {
    pageNo,
    setPageNo,
    pageSize,
    setPageSize,
    getTotalParam,
    resetPage,
    invalidateTotal,
    changePageSize,
    rememberTotal,
  };
}

