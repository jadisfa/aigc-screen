// ComponentHistoryInfo.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Popover, Spin, Tabs, Empty, message, Space, Button } from "antd";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { CONSOLE_PERMISSION_NAMESPACE } from "@/shared/lib/permissions";
import { formatDateTime } from "@/shared/lib/datetime";
import { queryWorkMaterials } from "@/shared/api/materials/materials-work";
import { returnWorkflowList, getMetrialTcategoryId } from "@/utils/common";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import { listMaterialCategories } from "@/shared/api/materials/materials-taxonomy";
import { listModelMaterials } from "@/shared/api/materials/materials-model";
import {
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { WorkFlow } from "@/utils/comfyuiApi";
import "@/assets/css/scss/history-info.scss";

// 类型定义
interface WorkflowItem {
  _id: string;
  title?: string;
  name?: string;
}

interface HistoryItem {
  _id: string;
  workflow_id: string;
  type: "image" | "video";
  output: string[];
  finished_at?: string;
  created_at: string;
  workflow_type?: string;
  workflow?: WorkFlow;
}

interface MaterialItem {
  id: string;
  assetUrl: string;
  [key: string]: string;
}

interface PageNation {
  pageSize: number;
  pageNo: number;
  total: number;
}

// Props 类型
interface ComponentHistoryInfoProps {
  userId?: string;
  onRefresh?: () => void;
}

const useCategoryGetAllByType = (type: string) => {
  // 这里需要替换为实际的 API 调用
  const [data] = useState<any[]>([]);
  return { data };
};

const useHomeGetWorkFlowApps = () => {
  // 这里需要替换为实际的 API 调用
  const [data] = useState<WorkflowItem[]>([]);
  return { data };
};

const useMaterialGetList = (params: { fileType: string }) => {
  // 这里需要替换为实际的 API 调用
  const [data] = useState<any[]>([]);
  const refresh = () => {};
  return { data, refresh };
};

const useAuthIsLoginComputeRef = () => {
  // 这里需要替换为实际的登录状态判断
  return true;
};

// 视频播放组件（需要根据实际实现调整）
const VideoPlayer: React.FC<{ src: string }> = ({ src }) => {
  return (
    <video
      src={src}
      controls
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        borderRadius: "10px",
      }}
    />
  );
};

const ComponentHistoryInfo: React.FC<ComponentHistoryInfoProps> = ({
  userId,
  onRefresh,
}) => {
  // ============ State ============
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false); // 加载更多状态
  const [activeTab, setActiveTab] = useState<string>("history");
  const [historys, setHistorys] = useState<HistoryItem[]>([]);
  const [materialArr, setMaterialArr] = useState<MaterialItem[]>([]);
  const [activeMaterialType, setActiveMaterialType] = useState<number>(1);
  // 用于控制滚动加载的标志
  const [hasMore, setHasMore] = useState(true);
  const isLoadingRef = useRef(false); // 防止重复请求
  const historyContainerRef = useRef<HTMLDivElement>(null); // 滚动容器引用

  const { data: meInfo, refetch: refetchMePermissions } = useMePermissions({
    sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode,
  });

  const [pageNation] = useState<PageNation>({
    pageSize: 10,
    pageNo: 1,
    total: 0,
  });

  // ============ Constants ============
  const tabsItems: { key: string; label: string }[] = [
    { key: "history", label: "绘画历史" },
    { key: "metrial", label: "官方素材" },
  ];

  const spaceList = [
    { label: "款式库", value: 1 },
    { label: "手模库", value: 2 },
  ];

  // ============ Methods ============
  // const getWorkflow = useCallback(
  //   (draw: HistoryItem): string => {
  //     const filterData = workFlowList.filter(
  //       (item) => item._id === draw.workflow_id,
  //     );
  //     return filterData[0]?.title || filterData[0]?.name || "";
  //   },
  //   [workFlowList],
  // );

  // 获取用户历史绘画记录（支持分页参数）
  const fetchHistory = useCallback(
    async (pageNo: number, append: boolean = false) => {
      // if (!meInfo.userId) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const { page, items } = await queryWorkMaterials({
          // ownerPrincipalId: meInfo.userId,
          pageNo: pageNo,
          pageSize: pageNation.pageSize,
          includeTaskExecutionInfo: true,
        });

        const workflowArr = returnWorkflowList(items);

        if (items) {
          pageNation.total = page.total;

          if (append) {
            // 追加数据
            setHistorys((prev) => [...prev, ...workflowArr]);
          } else {
            // 替换数据
            setHistorys(workflowArr);
          }

          // 判断是否还有更多数据
          const totalLoaded = append
            ? historys.length + workflowArr.length
            : workflowArr.length;

          setHasMore(totalLoaded < page.total);
        }

        // console.log(workflowArr, page, pageNo, "用户绘画历史");
      } catch (error) {
        console.error("获取历史记录失败:", error);
        message.error("获取历史记录失败");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        isLoadingRef.current = false;
      }
    },
    [pageNation.pageSize, meInfo],
  );

  // 获取用户历史绘画记录
  // const handleGetHistory = useCallback(async () => {
  //   // if (!meInfo.userId) return;

  //   setLoading(true);
  //   try {
  //     const { page, items } = await queryWorkMaterials({
  //       // ownerPrincipalId: meInfo.userId,  // 用户id
  //       pageNo: pageNation.pageNo,
  //       pageSize: pageNation.pageSize,
  //       includeTaskExecutionInfo: true,
  //     });
  //     const workflowArr = returnWorkflowList(items);
  //     if (items) {
  //       pageNation.total = page.total;
  //       setHistorys(workflowArr);
  //     }
  //     console.log(workflowArr, page, 155, pageNation, "用户绘画历史");
  //     //   const res = await getHistoryByUserIdAndPageNumber();
  //     //   if (res) {
  //     //     pageNation.total = res.total;
  //     //     setHistorys(res.items || []);
  //     //   }
  //   } catch (error) {
  //     console.error("获取历史记录失败:", error);
  //     message.error("获取历史记录失败");
  //   } finally {
  //     setLoading(false);
  //   }
  // }, [visible, meInfo]);

  // 获取历史记录（首次加载）
  const handleGetHistory = useCallback(async () => {
    pageNation.pageNo = 1;
    setHasMore(true);
    await fetchHistory(1, false);
  }, [fetchHistory]);

  // 加载更多历史记录
  const loadMoreHistory = useCallback(async () => {
    // 防止重复请求
    if (isLoadingRef.current || loadingMore || !hasMore) return;

    const nextPage = pageNation.pageNo + 1;
    // 检查是否还有更多数据
    if (historys.length >= pageNation.total) {
      setHasMore(false);
      return;
    }

    isLoadingRef.current = true;
    pageNation.pageNo = nextPage;
    await fetchHistory(nextPage, true);
  }, [fetchHistory, hasMore, loadingMore, historys.length, pageNation]);

  // 获取素材内容
  const loadMaterialData = useCallback(
    async (type?: number) => {
      setLoading(true);
      try {
        // 获取模型素材类型
        const allMaterialTypes = await listMaterialCategories({
          materialType: "model",
        });
        const materialId = getMetrialTcategoryId(
          allMaterialTypes,
          type ? type : activeMaterialType,
        );
        const metrials = await fetchAllPagesConcurrent(
          (params) =>
            listModelMaterials({
              ...params,
              categoryTypes: ["system"],
              categoryId: materialId,
              // publishStatus: "online",  // 在线状态
            }),
          1,
          50, // 每页条数
          3, // 并发数
        );
        // console.log(activeMaterialType, allMaterialTypes, metrials, 255);
        setMaterialArr(metrials as MaterialItem[]);
      } catch (error) {
        console.error("获取素材失败:", error);
        message.error("获取素材失败");
      } finally {
        setLoading(false);
      }
    },
    [activeMaterialType, visible],
  );

  const loadData = useCallback(() => {
    if (activeTab === "history") {
      handleGetHistory();
    } else {
      loadMaterialData();
    }
  }, [activeTab, meInfo]);

  //   const handleDelete = useCallback(
  //     async (item: HistoryItem) => {
  //       try {
  //         await deleteHistoryById(item._id);
  //         message.success("删除成功");
  //         handleGetHistory();
  //       } catch (error) {
  //         console.error("删除失败:", error);
  //         message.error("删除失败");
  //       }
  //     },
  //     [deleteHistoryById, handleGetHistory],
  //   );

  const handleReload = useCallback(() => {
    loadData();
    onRefresh?.();
  }, [loadData, onRefresh]);

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  const handleTabChange = useCallback(
    (key: string) => {
      setActiveTab(key);
      if (key === "metrial") {
        loadMaterialData();
      }
    },
    [loadMaterialData],
  );

  const handleMaterialTypeChange = useCallback(
    (type: number) => {
      setActiveMaterialType(type);
      loadMaterialData(type);
    },
    [loadMaterialData],
  );

  // ============ 滚动事件处理 ============
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const scrollTop = target.scrollTop;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;

      // 当滚动到距离底部 100px 时触发加载更多
      if (scrollHeight - scrollTop - clientHeight < 100) {
        if (activeTab === "history") {
          loadMoreHistory();
        }
      }
    },
    [loadMoreHistory, activeTab],
  );

  // ============ Effects ============
  useEffect(() => {
    if (visible && meInfo?.userId) {
      // 重置分页和列表
      pageNation.pageNo = 1;
      setHasMore(true);
      loadData();
    }
  }, [meInfo, visible]);

  useEffect(() => {
    if (!visible) {
      isLoadingRef.current = false;
    }
  }, [visible]);

  // ============ Render Functions ============
  const renderHistoryContent = () => (
    <Spin spinning={loading}>
      <div
        className="user-draw-history-info"
        ref={historyContainerRef}
        onScroll={handleScroll}
      >
        {historys.length === 0 ? (
          <Empty description="暂无绘画历史" />
        ) : (
          historys.map((drawItem, index) => (
            <div key={drawItem._id || index} className="user-draw-item">
              <div className="draw-info">
                <span>工作流：{drawItem?.workflow?.name}</span>
                <span>
                  创建时间：
                  {formatDateTime(drawItem?.finished_at || drawItem.created_at)}
                </span>
                <DeleteOutlined
                  style={{ cursor: "pointer" }}
                  onClick={() => handleDelete(drawItem)}
                />
              </div>
              {drawItem?.workType === "image" ? (
                <div className="draw-img-list">
                  {drawItem.output.map((drawImg, drawIndex) => (
                    <div key={drawIndex} className="draw-img-item">
                      <img src={drawImg} alt="" className="draw-img" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="draw-video-item">
                  <VideoPlayer src={drawItem.output[0]} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Spin>
  );

  const renderMaterialContent = () => (
    <>
      <div className="metrial-tab">
        {spaceList.map((item) => (
          <Space
            key={item.value}
            className={`metrial-item ${activeMaterialType === item.value ? "actived" : ""}`}
            onClick={() => handleMaterialTypeChange(item.value)}
          >
            {item.label}
          </Space>
        ))}
      </div>
      <Spin spinning={loading}>
        <div className="metrial-list">
          {materialArr.length === 0 ? (
            <Empty description="暂无素材" style={{ gridColumn: "1 / -1" }} />
          ) : (
            materialArr.map((item, index) => (
              <div key={item.id || index} className="workflow-item material">
                <img
                  className="workflow-img material"
                  src={item?.assetUrl}
                  alt="素材"
                />
              </div>
            ))
          )}{" "}
        </div>
      </Spin>
    </>
  );

  // ============ Popover Content ============
  const popoverContent = (
    <div className="custom-history">
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: "history",
            label: "绘画历史",
            children: renderHistoryContent(),
          },
          {
            key: "metrial",
            label: "官方素材",
            children: renderMaterialContent(),
          },
        ]}
        className="custom-tabs"
      />
    </div>
  );

  // ============ Popover Title ============
  const popoverTitle = (
    <div className="custom-popover-title">
      <ReloadOutlined className="popover-title-icon" onClick={handleReload} />
      <CloseOutlined className="popover-title-icon" onClick={handleClose} />
    </div>
  );

  // ============ Main Render ============
  return (
    <div className="custom-history-dropdown">
      <Popover
        open={visible}
        onOpenChange={setVisible}
        trigger="click"
        placement="right"
        title={popoverTitle}
        content={popoverContent}
        overlayClassName="custom-history-popover"
        getPopupContainer={(triggerNode) =>
          triggerNode.parentNode as HTMLElement
        }
        destroyTooltipOnHide
      >
        <ClockCircleOutlined
          style={{ fontSize: "20px", lineHeight: "32px", cursor: "pointer" }}
          onClick={() => setVisible(true)}
        />
      </Popover>
    </div>
  );
};

export default ComponentHistoryInfo;
