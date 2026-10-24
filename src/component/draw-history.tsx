// draw-history.tsx

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { queryWorkMaterials } from "@/shared/api/materials/materials-work";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  listSessions,
  getSession,
  listDispatchTimeline,
  dispatch,
} from "@/shared/api/sys/scheduler";
import { CONSOLE_PERMISSION_NAMESPACE } from "@/shared/lib/permissions";
import { HistoryItem } from "@/utils/types/common";
import { returnWorkflowList, getSessionData } from "@/utils/common";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import { formatDateTime } from "@/shared/lib/datetime";
import { FilterCondition } from "@/modules/backendCenter/component/draw-record-filter";
import { Spin } from "antd";
import TaskItemTop from "@/modules/backendCenter/component/task-top";
import TaskItemBottom from "@/modules/backendCenter/component/task-bottom";
import TaskOutput from "@/modules/backendCenter/component/task-output";

interface DrawHistoryProps {
  custom?: boolean;
  reverse?: boolean;
  load?: boolean;
  params?: FilterCondition;
  reload?: boolean;
  loadMore?: boolean;
  sessionId?: string;
  updateSts?: () => void;
}

interface PageNation {
  pageSize: number;
  pageNo: number;
  total: number;
}

type GroupedHistoryData = Record<string, HistoryItem[]>;

const DrawHistory: React.FC<DrawHistoryProps> = ({
  custom,
  reverse,
  load,
  params,
  reload,
  loadMore,
  sessionId,
  updateSts
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [historys, setHistorys] = useState<HistoryItem[]>([]);
  const [allDispatch, setAllDispatch] = useState<HistoryItem[]>([]); // 全部请求数据，用于筛选
  const [groupedData, setGroupedData] = useState<GroupedHistoryData>({});
  const [pageNation, setPageNation] = useState<PageNation>({
    pageSize: 10,
    pageNo: 1,
    total: 0,
  });

  const [hasMore, setHasMore] = useState<boolean>(true);
  const hasMoreRef = useRef(hasMore);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const isLoadingRef = useRef<boolean>(false);
  const currentParamsRef = useRef<FilterCondition | undefined>(params);
  const isFirstLoadRef = useRef<boolean>(true);

  // ✅ 滚动状态保存
  const scrollStateRef = useRef<{ scrollTop: number; scrollHeight: number }>({
    scrollTop: 0,
    scrollHeight: 0
  });
  const isRestoringRef = useRef(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const restoreTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: meInfo } = useMePermissions({
    sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode,
  });

  // 按日期分组数据
  const groupHistoryByDate = (items: HistoryItem[]): GroupedHistoryData => {
    const grouped: GroupedHistoryData = {};

    items?.forEach((item) => {
      const dateKey = formatDateTime(
        item?.created_at ||
          item?.createdAt ||
          item?.submittedAt ||
          item?.startedAt ||
          "",
        "yyyy-MM-dd",
      );
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(item);
    });

    const sortedGrouped: GroupedHistoryData = {};
    Object.keys(grouped).forEach((key) => {
      const sortedItems = [...grouped[key]].sort((a, b) => {
        const timeA = a?.created_at || a?.createdAt || a?.submittedAt || a?.startedAt || "";
        const timeB = b?.created_at || b?.createdAt || b?.submittedAt || b?.startedAt || "";

        if (reverse) {
          return timeA.localeCompare(timeB);
        } else {
          return timeB.localeCompare(timeA);
        }
      });
      sortedGrouped[key] = sortedItems;
    });

    const sortedKeys = Object.keys(sortedGrouped).sort((a, b) => {
      if (reverse) {
        return a.localeCompare(b);
      } else {
        return b.localeCompare(a);
      }
    });

    const result: GroupedHistoryData = {};
    sortedKeys.forEach((key) => {
      result[key] = sortedGrouped[key];
    });

    return result;
  };

  // 合并已有数据和新增数据
  const mergeGroupedData = useCallback((
    existing: GroupedHistoryData,
    newItems: HistoryItem[],
  ): GroupedHistoryData => {
    if (newItems.length === 0) {
      return existing;
    }

    const newGrouped = groupHistoryByDate(newItems);
    const merged: GroupedHistoryData = { ...existing };

    Object.keys(newGrouped).forEach((dateKey) => {
      if (merged[dateKey]) {
        const existingIds = new Set(
          merged[dateKey].map((item) => item.id || item.taskId)
        );
        
        const uniqueNewItems = newGrouped[dateKey].filter((item) => {
          const key = item.id || item.taskId;
          return !existingIds.has(key);
        });

        if (uniqueNewItems.length > 0) {
          // ✅ 新数据插入到前面（因为数据是倒序，新数据更早）
          merged[dateKey] = [...uniqueNewItems, ...merged[dateKey]];
        }
      } else {
        merged[dateKey] = newGrouped[dateKey];
      }
    });

    const sortedKeys = Object.keys(merged).sort((a, b) => {
      if (reverse) {
        return a.localeCompare(b);
      } else {
        return b.localeCompare(a);
      }
    });

    const result: GroupedHistoryData = {};
    sortedKeys.forEach((key) => {
      const sortedItems = [...merged[key]].sort((a, b) => {
        const timeA = a?.created_at || a?.createdAt || a?.submittedAt || a?.startedAt || "";
        const timeB = b?.created_at || b?.createdAt || b?.submittedAt || b?.startedAt || "";
        
        if (reverse) {
          return timeA.localeCompare(timeB);
        } else {
          return timeB.localeCompare(timeA);
        }
      });
      result[key] = sortedItems;
    });

    return result;
  }, [reverse]);

  // ✅ 保存滚动位置（加载更多前调用）
  const saveScrollPosition = useCallback(() => {
    const container = containerRef.current || document.getElementById("layout-content");
    if (container) {
      scrollStateRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      };
    }
  }, []);

  // ✅ 恢复滚动位置（数据插入完成后调用）
  const restoreScrollPosition = useCallback(() => {
    const container = containerRef.current || document.getElementById("layout-content");
    if (!container) return;
    
    // 防止重复执行
    if (isRestoringRef.current) return;
    isRestoringRef.current = true;

    // 使用 requestAnimationFrame 确保在下一帧执行
    requestAnimationFrame(() => {
      // 再次确保 DOM 已完全渲染
      setTimeout(() => {
        const container = containerRef.current || document.getElementById("layout-content");
        if (container) {
          // 计算高度差值
          const heightDiff = container.scrollHeight - scrollStateRef.current.scrollHeight;
          
          // 新数据插入到顶部，滚动位置下移
          const newScrollTop = scrollStateRef.current.scrollTop + heightDiff;
          
          // 应用滚动位置（使用平滑滚动减少突兀感）
          container.scrollTo({
            top: Math.min(newScrollTop, container.scrollHeight - container.clientHeight),
            behavior: 'instant' // 使用 instant 避免平滑动画导致的晃动
          });
        }
        isRestoringRef.current = false;
      }, 50);
    });
  }, []);

  // 获取容器引用
  useEffect(() => {
    const container = document.getElementById("layout-content");
    if (container) {
      containerRef.current = container as HTMLElement;
    }
  }, []);

  // 同步 hasMore 到 ref
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // 核心加载函数
  const loadHistory = useCallback(
    async (isLoadMore: boolean = false) => {
      if (isLoadingRef.current) return;
      if (!meInfo?.userId) return;
      if (isLoadMore && !hasMoreRef.current) return;
      if (isLoadMore && isInitialLoad) return;

      isLoadingRef.current = true;
      setLoading(true);

      try {
        const currentPageNo = isLoadMore ? pageNation.pageNo + 1 : 1;

        // ✅ 加载更多前保存滚动位置
        if (isLoadMore) {
          saveScrollPosition();
        }
        //
        const { pageNo, pageSize, items, hasMore: isMore } = await listDispatchTimeline({
          pageNo: currentPageNo,
          pageSize: pageNation.pageSize,
          sessionId: sessionId,
        })


        const newItems = (currentParamsRef?.current && Object.keys(currentParamsRef?.current ?? {}).length > 0 ) ? filterDispatch() : items;
        const itemsData = currentParamsRef?.current?.type == 'deleteFailed' ? newItems.filter(item => item?.status !== 'failed') : newItems;
        const workflowArr = returnWorkflowList(itemsData);

        setPageNation({
          pageSize: pageSize || pageNation.pageSize,
          pageNo: currentPageNo,
          total: items.length || 0,
        });

        const hasMoreData = isMore !== undefined ? isMore : items.length >= pageNation.pageSize;
        setHasMore(hasMoreData);
        hasMoreRef.current = hasMoreData;

        if (isLoadMore) {
          // ✅ 加载更多：合并数据
          if (workflowArr.length > 0) {
            setGroupedData((prev) => {
              const result = mergeGroupedData(prev, workflowArr);
              // ✅ 在数据更新后恢复滚动位置
              restoreScrollPosition();
              return result;
            });
            
            setHistorys((prev) => {
              // 去重
              const existingIds = new Set(prev.map(item => item.id || item.taskId));
              const newItems = workflowArr.filter(item => {
                const key = item.id || item.taskId;
                return !existingIds.has(key);
              });
              return [...newItems, ...prev];
            });
          } else {
            // 没有新数据
            setHasMore(false);
            hasMoreRef.current = false;
            if (updateSts) {
              updateSts();
            }
          }
        } else {
          // 首次加载或重新加载：重置数据
          const grouped = groupHistoryByDate(workflowArr);
          setGroupedData(grouped);
          setHistorys(workflowArr);
          setIsInitialLoad(false);
          
          // ✅ 首次加载滚动到底部（显示最新的数据）
          setTimeout(() => {
            const container = containerRef.current || document.getElementById("layout-content");
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 100);
        }
      } catch (error) {
        console.error("加载历史数据失败:", error);
      } finally {
        isLoadingRef.current = false;
        setLoading(false);
        if (isLoadMore && updateSts) {
          updateSts();
        }
      }
    },
    [meInfo, pageNation, params, isInitialLoad, sessionId, updateSts, saveScrollPosition, restoreScrollPosition, mergeGroupedData],
  );

  // 重置状态
  const resetAndReload = useCallback(() => {
    setPageNation((prev) => ({
      ...prev,
      pageNo: 1,
    }));
    setHasMore(true);
    hasMoreRef.current = true;
    setIsInitialLoad(true);
    setGroupedData({});
    setHistorys([]);
    loadHistory(false);
  }, [loadHistory]);

  // 监听外部触发重新加载
  useEffect(() => {
    if (reload && sessionId != undefined) {
      resetAndReload();
    }
  }, [reload, resetAndReload, sessionId]);

  // 监听筛选条件变化
  useEffect(() => {
    if (params && sessionId != undefined) {
      const paramsChanged = JSON.stringify(currentParamsRef.current) !== JSON.stringify(params);
      if (paramsChanged) {
        currentParamsRef.current = params;
        resetAndReload();
      }
    } else if (currentParamsRef.current !== undefined) {
      currentParamsRef.current = undefined;
      resetAndReload();
    }
  }, [params, resetAndReload, sessionId]);

  // 监听加载更多, 有筛选条件时不触发加载更多
  useEffect(() => {
    if (
      loadMore &&
      !loading &&
      hasMoreRef.current &&
      !isInitialLoad &&
      sessionId != undefined &&
      !currentParamsRef?.current &&
      !(Object.keys(currentParamsRef?.current ?? {}).length > 0)
    ) {
      loadHistory(true);
    }
  }, [loadMore, loading, isInitialLoad, loadHistory, sessionId, currentParamsRef]);

  // 初始加载
  useEffect(() => {
    if (meInfo?.userId && isFirstLoadRef.current && sessionId != undefined) {
      // console.log("初始加载，310", sessionId);
      isFirstLoadRef.current = false;
      loadHistory(false);
    } else if (sessionId == undefined) {
      setLoading(false);
    }
  }, [meInfo, loadHistory, sessionId]);

  // 监听 load prop
  useEffect(() => {
    if (load && meInfo?.userId && sessionId != undefined) {
      loadHistory(false);
    }
  }, [load, meInfo, loadHistory, sessionId]);

  const getSortedDates = useCallback(
    (dates: string[]): string[] => {
      if (reverse) {
        return dates.sort((a, b) => a.localeCompare(b));
      } else {
        return dates.sort((a, b) => b.localeCompare(a));
      }
    },
    [reverse],
  );
  
  // 从全部数据中筛选符合条件的数据,不包含操作区
  const filterDispatch = () => {
    if ((currentParamsRef.current.outputType || Object.keys(currentParamsRef?.current?.dateRange || {}).length > 0) && currentParamsRef.current?.type != 'refreshStatus') {
      const mode = currentParamsRef?.current?.outputType?.length > 0 && currentParamsRef?.current?.dateRange ? 'AND' : 'OR';
      const outputSet = new Set(currentParamsRef.current.outputType);
      return currentParamsRef?.current?.type == 'clearWorkspace' ? [] : allDispatch.filter(item => {
        const nameMatch = outputSet.has(item?.assets[0]?.kind);
        const dispatchTime = item?.startedAt || item?.createdAt || item?.created_at || item?.submittedAt;
        const dispatchDate = formatDateTime(dispatchTime);
        const dispatchTims = new Date(dispatchDate).getTime() / 1000;
        const ageMatch = dispatchTims >= currentParamsRef.current?.dateRange?.begin && dispatchTims <= currentParamsRef.current?.dateRange?.end;
        const filterFailed = currentParamsRef?.current?.type == 'deleteFailed' && item?.status != 'failed';
        if (mode === 'OR') {
          return nameMatch || ageMatch;
        }
        return nameMatch && ageMatch; // AND
      });
      // datas=[...allDispatch.filter(dispatch => outputSet.has(dispatch?.assets[0]?.kind))]
    }
  }

  useEffect(() => {
    const getAllDisptach = async () => {
      const response = await fetchAllPagesConcurrent(
        (params) => listDispatchTimeline({ ...params, sessionId: sessionId }),
        1,
        50, // 每页条数
        3, // 并发数
      );
      setAllDispatch(returnWorkflowList(response || []))
    }
    if(sessionId) {
      getAllDisptach()
    }
  }, [sessionId])

  // 渲染分组数据
  const renderGroupedData = useMemo(() => {
    const dates = Object.keys(groupedData);
    const sortedDates = getSortedDates(dates);

    if (sortedDates.length === 0 && !loading) {
      return <div className="text-center text-gray-500 py-8">暂无历史记录</div>;
    }

    return sortedDates.map((date) => (
      <div key={date} className="date-group mb-4">
        <div className="date-header text-lg font-medium text-gray-600 sticky top-0 py-1 border-b border-gray-100">
          {date} ({groupedData[date]?.length || 0}条)
        </div>
        <div className="date-content">
          {groupedData[date]?.map((item, index) => (
            <div
              key={item.id || item.taskId || index}
              className="history-item p-2 py-5 border-b border-gray-80 flex flex-col gap-[8px]"
            >
              <TaskItemTop task={item} />
              {item?.status == "failed" && (
                <div className="w-full text-sm text-[#FB8C00]">
                  {item?.errorMessage}
                </div>
              )}
              <TaskOutput task={item} sessionId={sessionId} />
              <TaskItemBottom task={item} custom={true} />
            </div>
          ))}
        </div>
      </div>
    ));
  }, [groupedData, loading, getSortedDates, sessionId]);

  return (
    <>
      <Spin spinning={loading} description="加载中...">
        <div className="draw-history max-w-[910px] mx-auto min-h-[580px]">
          {renderGroupedData}
        </div>
      </Spin>
    </>
  );
};

export default DrawHistory;