// user-draw-history.tsx
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Tag, Pagination as AntPagination, Spin, Empty } from "antd";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectCards } from "swiper/modules";
import { queryWorkMaterials } from "@/shared/api/materials/materials-work";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import { CONSOLE_PERMISSION_NAMESPACE } from "@/shared/lib/permissions";
import { formatDateTime } from "@/shared/lib/datetime";
import WorkPreviewDialog from "./work-preview-dialog";
import "swiper/css";
import "swiper/css/autoplay";
import "swiper/css/pagination";
import "swiper/css/effect-cards";
import "@/assets/css/scss/use-draw-history.scss";

// 类型定义
export interface DrawHistoryItem {
  workflow_id: string;
  output: string[];
  params?: {
    [key: string]: any;
    positive?: string;
    positiveCN?: string;
  };
  tags?: string[]; // 对应工作流名称
  height?: number;
  created_at?: string;
  workflow?: {
    [key: string]: any;
  };
  [key: string]: any;
}

interface TagOption {
  value: string;
  label: string;
}

interface WaterfallItem {
  index: number;
  item: DrawHistoryItem;
  column: number;
  top: number;
  left: number;
  bottom: number;
  height: number;
  width: number;
}

const UserDrawHistory = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTag, setActiveTag] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [materialArr, setMaterialArr] = useState<any[]>([]);

  const [allDrawHistory, setAllDrawHistory] = useState<DrawHistoryItem[]>([]);
  const [displayData, setDisplayData] = useState<DrawHistoryItem[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const { data: meInfo, refetch: refetchMePermissions } = useMePermissions({
    sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode,
  });

  const [ visibleOpen, setVisibleOpen ] = useState(false); // 预览弹框是否打开
  const taskData = useRef<DrawHistoryItem>(); // 预览弹框传递内容

  const PAGE_SIZE = 24;

  // 模拟数据
  const mockData: DrawHistoryItem[] = [
    {
      workflow_id: "xxxxx",
      output: [
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01222_-20260629032223102.png",
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01223_-20260629032223103.png",
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01224_-20260629032223104.png",
      ],
      tags: ["美甲设计"],
      created_at: "2026-06-29 09:35:23",
      params: {
        positiveCN: "主要描述手部细节",
      },
    },
    {
      workflow_id: "bbbbb",
      output: [
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01222_-20260629032223102.png",
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01223_-20260629032223103.png",
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01204_-20260629013710720.png",
      ],
      tags: ["美甲穿搭"],
      created_at: "2026-06-29 08:20:15",
      params: {
        positiveCN: "美甲穿搭展示",
      },
    },
    {
      workflow_id: "ccccc",
      output: [
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01072_-20260627102017337.png",
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01073_-20260627102017337.png",
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01074_-20260627102017337.png",
        "https://static.nailoffice.cn/image/temps/6982b4ce4d621052e4846c9c/ComfyUI_01075_-20260627102017338.png",
      ],
      tags: ["联名"],
      created_at: "2026-06-29 07:45:10",
      params: {
        positive: "photorealistic details，masterpiece quality,主要描述手部",
        positiveCN: "主要描述手部",
      },
    },
    {
      workflow_id: "dddd",
      output: [
        "https://static.nailoffice.cn/video/temps/6982b4ce4d621052e4846c9c/ComfyUI_00017_-20260618042639240.mp4",
      ],
      tags: ["美甲设计"],
      created_at: "2026-06-29 06:30:00",
      params: {
        positiveCN: "视频生成",
      },
    },
    ...Array.from({ length: 50 }, (_, i) => ({
      workflow_id: `test_${i}`,
      output: [
        `https://static.nailoffice.cn/image/temps/test_${i}.png`,
        ...(i % 3 === 0
          ? [`https://static.nailoffice.cn/image/temps/test_${i}_2.png`]
          : []),
        ...(i % 5 === 0
          ? [`https://static.nailoffice.cn/image/temps/test_${i}_3.png`]
          : []),
      ],
      tags: i % 2 === 0 ? ["美甲设计"] : ["美甲穿搭"],
      created_at: `2026-06-${String(10 + (i % 20)).padStart(2, "0")} ${String(8 + (i % 12)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00`,
      params: i % 2 === 0 ? { positiveCN: `测试提示词 ${i}` } : undefined,
    })),
  ];

  const config = useMemo(() => {
    return {
      gap: 15,
      padding: 15,
      itemMinWidth: 220,
      maxColumnCount: 6,
      minColumnCount: 2,
    };
  }, []);

  // 获取容器宽度
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const rect = container.getBoundingClientRect();
      setContainerWidth(rect.width);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    resizeObserver.observe(container);

    window.addEventListener("resize", updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  // 初始化数据
  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const datas = await fetchAllPagesConcurrent(
        (params) =>
          queryWorkMaterials({
            ...params,
            ownerPrincipalId: meInfo?.principalId, // 根据用户id
            includeTaskExecutionInfo: true, // 返回任务执行信息
            includeWorkflowInfo: true, // 返回工作流信息
            // auditStatus: "approved", // 审核状态
            // publishStatus: "online", // 发布状态
          }).finally(() => { setLoading(false); }),
        1,
        50, // 每页条数
        3, // 并发数
      );

      const newDatas = datas.map((item: any) => {
        const outputArr = JSON.parse(item?.itemsJson).map((item) => {
          return item?.url;
        });
        return {
          ...item,
          tags: [
            item?.workflowInfo?.workflow?.workflow?.title ||
              item?.workflowInfo?.workflow?.workflow?.name,
          ], // 工作流名称
          workflow: item?.workflowInfo?.workflow?.workflow, // 工作流基础信息
          workflow_id: item?.workflowInfo?.workflow?.workflow?.id,
          params: item?.taskExecution && item?.taskExecution != null ?  JSON.parse(item?.taskExecution?.inputParams)?.params : {},
          output: outputArr,
          created_at: item?.createdAt,
        };
      });
      setAllDrawHistory(newDatas);
      setLoading(false);
    };
    if (meInfo?.userId) fetchData();
    // setTimeout(() => {
    //   setAllDrawHistory(mockData);
    //   setLoading(false);
    // }, 500);
  }, [meInfo]);

  // 所有标签
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    materialArr.forEach((asset) => {
      if (asset.tags && Array.isArray(asset.tags)) {
        asset.tags.forEach((tag) => tags.add(tag));
      }
    });
    allDrawHistory.forEach((item) => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags);
  }, [materialArr, allDrawHistory]);

  // 标签选项
  const tagOptions = useMemo(() => {
    const options: TagOption[] = [{ value: "all", label: "全部" }];
    allTags.forEach((tag) => {
      options.push({ value: tag, label: tag });
    });
    return options;
  }, [allTags]);

  // 根据标签过滤数据
  const filteredData = useMemo(() => {
    if (activeTag === "all") {
      return allDrawHistory;
    }
    return allDrawHistory.filter((item) =>
      item.tags?.some((tag) => tag === activeTag),
    );
  }, [activeTag, allDrawHistory]);

  // 分页数据
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredData.slice(start, end);
  }, [filteredData, currentPage, PAGE_SIZE]);

  const totalCount = filteredData.length;

  // 当过滤数据变化时，重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTag]);

  // 更新显示数据
  useEffect(() => {
    setDisplayData(paginatedData);
  }, [paginatedData]);

  // 计算列数
  const columnCount = useMemo(() => {
    if (!containerWidth || containerWidth === 0) return 0;
    const cWidth = containerWidth - config.padding * 2;
    if (cWidth >= config.itemMinWidth * 2) {
      const count = Math.floor(cWidth / config.itemMinWidth);
      if (config.maxColumnCount && count > config.maxColumnCount) {
        return config.maxColumnCount;
      }
      return Math.max(count, config.minColumnCount);
    }
    return config.minColumnCount;
  }, [containerWidth, config]);

  // 计算每个 item 的宽度
  const itemWidth = useMemo(() => {
    if (!containerWidth || columnCount <= 0) return 0;
    const cWidth = containerWidth - config.padding * 2;
    const gap = (columnCount - 1) * config.gap;
    return Math.floor((cWidth - gap) / columnCount);
  }, [containerWidth, columnCount, config]);

  // 计算单个 item 的高度
  const calcItemHeight = useCallback(
    (item: DrawHistoryItem, width: number): number => {
      const isVideo = item.output.some(
        (url) =>
          url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov"),
      );
      if (isVideo) {
        return Math.floor(width * (16 / 9));
      }
      // 多图时略微增加高度
      if (item.output.length > 1) {
        return Math.floor(width * (4 / 3)) + 10;
      }
      return Math.floor(width * (4 / 3));
    },
    [],
  );

  // 计算瀑布流布局
  const waterfallItems = useMemo(() => {
    if (
      !containerWidth ||
      columnCount <= 0 ||
      itemWidth <= 0 ||
      displayData.length === 0
    ) {
      return [];
    }

    const columnsTop = new Array(columnCount).fill(0);
    const result: WaterfallItem[] = [];

    for (let i = 0; i < displayData.length; i++) {
      const minHeight = Math.min(...columnsTop);
      const columnIndex = columnsTop.indexOf(minHeight);

      const item = displayData[i];
      const height = calcItemHeight(item, itemWidth);
      const top = columnsTop[columnIndex];
      const left = (itemWidth + config.gap) * columnIndex;

      result.push({
        index: i,
        item,
        column: columnIndex,
        top,
        left,
        bottom: top + height,
        height,
        width: itemWidth,
      });

      columnsTop[columnIndex] += height + config.gap;
    }

    return result;
  }, [
    containerWidth,
    columnCount,
    itemWidth,
    displayData,
    config,
    calcItemHeight,
  ]);

  // 总高度
  const totalHeight = useMemo(() => {
    if (waterfallItems.length === 0) return 0;
    const maxTop = Math.max(
      ...waterfallItems.map((item) => item.top + item.height),
    );
    return maxTop + config.padding;
  }, [waterfallItems, config]);

  // 处理标签点击
  const handleTagClick = (val: string) => {
    if (val === activeTag) return;
    setActiveTag(val);
  };

  // 处理页码变化
  const handleChangePage = (page: number) => {
    setCurrentPage(page);
    const wrapper = containerRef.current;
    if (wrapper) {
      wrapper.scrollTop = 0;
    }
  };

  // 判断是否为视频
  const isVideo = (url: string): boolean => {
    return (
      url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov")
    );
  };
  // 打开结果预览
  const handleOpenPreview = (item:DrawHistoryItem, index?:number) => {
    taskData.current = item;
    setVisibleOpen(true);
  }

  // 渲染单个图片/视频内容
  const renderMediaContent = (item: DrawHistoryItem, index: number) => {
    const outputUrl = item.output[index];
    const isVideoFile = isVideo(outputUrl);

    if (isVideoFile) {
      return (
        <video
          src={outputUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          controls={false}
          muted
          loop
          onMouseEnter={(e) => {
            const video = e.currentTarget;
            video.play().catch(() => {});
          }}
          onMouseLeave={(e) => {
            const video = e.currentTarget;
            video.pause();
            video.currentTime = 0;
          }}
          onClick={() => handleOpenPreview(item)}
        />
      );
    }

    return (
      <img
        src={outputUrl}
        alt={`作品 ${index + 1}`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        loading="lazy"
        onClick={() => handleOpenPreview(item)}
      />
    );
  };

  // 渲染瀑布流内容
  const renderWaterfallContent = () => {
    if (displayData.length === 0 && !loading) {
      return (
        <div className="waterfall-empty">
          <Empty description="暂无数据" />
        </div>
      );
    }

    return (
      <div
        className="waterfall-container"
        style={{
          position: "relative",
          height: `${totalHeight}px`,
          padding: `${config.padding}px`,
          willChange: "height",
          width: "100%",
        }}
      >
        {waterfallItems.map((item) => {
          const hasMultipleImages = item.item.output.length > 1;
          const createdTime = formatDateTime(item.item.created_at);
          return (
            <div
              key={item?.item?.id || item.index}
              className="waterfall-item"
              style={
                {
                  position: "absolute",
                  width: `${item.width}px`,
                  height: `${item.height}px`,
                  transform: `translate(${item.left}px, ${item.top}px)`,
                  "--hover-transform": `translate(${item.left}px, ${item.top}px) scale(1.04)`,
                  contentVisibility: "auto",
                  containIntrinsicSize: `${item.width}px ${item.height}px`,
                  borderRadius: "8px",
                  overflow: "hidden",
                  backgroundColor: "#f5f5f5",
                  cursor: "pointer",
                  willChange: "transform",
                } as React.CSSProperties
              }
              data-index={item.index}
            >
              {/* 媒体内容 */}
              {hasMultipleImages ? (
                <Swiper
                  modules={[Autoplay, Pagination, EffectCards]}
                  autoplay={{
                    delay: 3000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                  }}
                  pagination={{
                    clickable: true,
                    dynamicBullets: true,
                  }}
                  slidesPerView={1}
                  touchEventsTarget="wrapper"
                  allowTouchMove={true}
                  resistanceRatio={0.85}
                  loop={true}
                  speed={800}
                  className="waterfall-swiper"
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                >
                  {item.item.output.map((url, imgIndex) => (
                    <SwiperSlide key={imgIndex}>
                      {renderMediaContent(item.item, imgIndex)}
                    </SwiperSlide>
                  ))}
                </Swiper>
              ) : (
                renderMediaContent(item.item, 0)
              )}

              {/* 底部信息 */}
              <div className="waterfall-item-footer">
                <div className="waterfall-item-time">
                  <span className="time-icon">🕐</span>
                  <span>{createdTime || "未知时间"}</span>
                </div>

                {item.item.params?.positive_template && (
                  <div className="waterfall-item-prompt">
                    {item.item.params.positive_template ||
                      item.item.params.positiveCN}
                  </div>
                )}

                {/* {item.item.tags && item.item.tags.length > 0 && (
                  <div className="waterfall-item-tags">
                    {item.item.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="waterfall-item-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )} */}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="user-draw-history">
        <div className="user-draw-tags">
          {tagOptions.map((tagItem, tagIndex) => (
            <Tag
              key={tagIndex}
              className={`user-draw-tag color666 ${activeTag === tagItem.value ? "active" : ""}`}
              variant="filled"
              onClick={() => handleTagClick(tagItem.value)}
            >
              {tagItem.label}
            </Tag>
          ))}
        </div>

        <div ref={containerRef} className="user-draw-waterfall-wrapper">
          <Spin spinning={loading} description="加载中...">
            {renderWaterfallContent()}
          </Spin>
        </div>

        {totalCount > 0 && (
          <AntPagination
            align="center"
            current={currentPage}
            pageSize={PAGE_SIZE}
            total={totalCount}
            onChange={handleChangePage}
            showSizeChanger={false}
            showTotal={(total) => `共 ${total} 条`}
            className="user-draw-pagination"
          />
        )}
      </div>
      <WorkPreviewDialog task={taskData?.current} visible={visibleOpen} close={() => setVisibleOpen(false)} />
    </>
  );
};

export default UserDrawHistory;
