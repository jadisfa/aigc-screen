// components/inspiration-center.tsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Spin, Tag } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";
import { listWorkflowCates } from "@/shared/api/workflow/workflow-cate";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import { queryWorkMaterials } from "@/shared/api/materials/materials-work";
import { getWorkflowConfigById } from "@/shared/api/workflow/workflow";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/navigation";
import "@/assets/css/scss/inspiration-center.scss";
import { Workflow } from "lucide-react";

// 类型定义
interface WorkFlow {
  _id: string;
  id: string;
  name: string;
  title: string;
  categoryId: string;
  [key: string]: any;
}

interface DrawHistoryItem {
  output: string[];
  workflow_id: string;
  [key: string]: any;
}

interface TagItem {
  title: string;
  key: string;
  workFlow: string;
}

interface InspirationCenterProps {
  onUpdateWorkflow?: (workflow: WorkFlow, tabKey: string, src: string) => void;
}

// 初始化标签数据
const tags: TagItem[] = [
  { title: "美甲穿搭灵感", key: "mjcd", workFlow: "美甲穿搭" },
  { title: "高定婚甲灵感", key: "gdhj", workFlow: "高定婚甲" },
  { title: "复古ins美甲灵感", key: "ins", workFlow: "复古ins" },
];

// // 初始化工作流分类映射
const initWorkflow = [
  { name: "美甲设计", key: "NailArtDesign" },
  { name: "美甲设计", key: "NailArtDesign" },
  { name: "社媒爆款", key: "SocialNediaBestseller" },
];


// 获取历史数据（模拟 API）
const useHomeOutputImages = () => {
  // TODO: 替换为实际的 API 调用
  const [data, setData] = useState<DrawHistoryItem[]>([]);
  useEffect(() => {
    // 模拟数据
    setData([
      {
        output: [
          "https://static.nailoffice.cn/2025-09-23/68197499c58c28287e083e34/upload/20250923102906744-334323424.jpg",
        ],
        workflow_id: "1",
      },
      {
        output: [
          "https://static.nailoffice.cn/2025-09-23/68197499c58c28287e083e34/upload/20250923103256573-%E4%B8%BB%E7%94%B2%E8%AE%BE%E8%AE%A1.jpg",
        ],
        workflow_id: "1",
      },
      {
        output: [
          "https://static.nailoffice.cn/2025-09-22/68197499c58c28287e083e34/upload/20250922162453611-%E5%8E%9F%E5%88%9B%E8%AE%BE%E8%AE%A1.jpg",
        ],
        workflow_id: "2",
      },
      {
        output: [
          "https://static.nailoffice.cn/2025-09-22/68197499c58c28287e083e34/upload/20250922161347943-%E7%BA%BF%E7%A8%BF.jpg",
        ],
        workflow_id: "2",
      },
      {
        output: [
          "https://static.nailoffice.cn/image/temps/68932326a10bc811fc83ef83/naildoo_290-20250922084724182-20250922084724182.png",
        ],
        workflow_id: "3",
      },
      {
        output: [
          "https://static.nailoffice.cn/image/temps/68a2808da10bc811fc90da78/naildoo_987-20250919091218121-20250919091218121.png",
        ],
        workflow_id: "3",
      },
      {
        output: [
          "https://static.nailoffice.cn/image/temps/6811db59c58c28287e07e45c/naildoo_075-20250921112547337-20250921112547337.png",
        ],
        workflow_id: "1",
      },
      {
        output: [
          "https://static.nailoffice.cn/image/temps/68197499c58c28287e083e34/naildoo_061-20250802062118147.png",
        ],
        workflow_id: "1",
      },
    ]);
  }, []);
  return { data, refresh: () => {}, execute: () => {} };
};

const ComponentInspirationCenter: React.FC<InspirationCenterProps> = ({
  onUpdateWorkflow,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [checked, setChecked] = useState<number>(0);
  const [images, setImages] = useState<DrawHistoryItem[]>([]);
  const [workFlows, setWorkFlows] = useState<WorkFlow[]>([]); // tag对应的工作流
  const [workFlowsObj, setWorkFlowsObj] = useState<Record<string, string>>({});

  const swiperRef = useRef<SwiperType | null>(null);

  // 获取数据
  const [categoryList, setCategoryList] = useState([])
  const [workFlowList, setWorkFlowList] = useState([]) ;
  // const { data: historyData } = useHomeOutputImages();

  // 计算当前选中的标签
  const currentTag = useMemo(() => tags[checked], [checked]);
  const currentInitWorkflow = useMemo(() => initWorkflow[checked], [checked]);

  // 获取并渲染图片
  const fetchAndRenderImages = useCallback(async () => {
    // console.log(checked, workFlowList, workFlowsObj, 144)
    setLoading(true);
    setImages([]);
    setWorkFlows([]);

    if (!workFlowList || workFlowList.length === 0 || !workFlowsObj) {
      setLoading(false);
      return;
    }

    const currentTagData = tags[checked];
    if (!currentTagData) {
      setLoading(false);
      return;
    }

    const currentFirstLevelCategory = initWorkflow[checked]?.name;
    if (!currentFirstLevelCategory) {
      setLoading(false);
      return;
    }

    const firstLevelCategoryId = workFlowsObj[currentFirstLevelCategory];
    if (!firstLevelCategoryId) {
      setLoading(false);
      return;
    }

    // 筛选分类下的工作流
    const filteredWorkflows = workFlowList.filter(
      (workflow) => workflow?.workflowInfo?.workflow?.workflow?.cateId === firstLevelCategoryId,
    );

    // 找到目标工作流
    const targetWorkflow = filteredWorkflows.find(
      (workflow) =>
        workflow?.workflowInfo?.workflow?.workflow?.name?.toLowerCase() ===
          currentTagData.workFlow?.toLowerCase() ||
        workflow?.workflowInfo?.workflow?.workflow?.title?.toLowerCase() ===
          currentTagData.workFlow?.toLowerCase(),
    );
    // console.log(currentTag, currentTagData, currentFirstLevelCategory, firstLevelCategoryId, filteredWorkflows, targetWorkflow, 173)

    if (!targetWorkflow) {
      setImages([]);
      setLoading(false);
      return;
    }

    setWorkFlows([targetWorkflow]);

    // 从历史数据中筛选
    if (workFlowList && Array.isArray(workFlowList)) {
      const filteredData = workFlowList.filter(
        (item) => item?.workflowInfo?.workflow?.workflow?.name === '美甲穿搭0723_test',
        // (item) => item?.workflowInfo?.workflow?.workflow?.id === targetWorkflow.id,
      );
      // 取前 10 条
      const limitedData = filteredData.slice(0, 10);
      // console.log(limitedData,filteredData, '筛选10条')
      setImages(limitedData);
    } else {
      setImages([]);
    }

    setLoading(false);
  }, [checked, workFlowList, workFlowsObj]);

  // 处理标签点击
  const handleTagClick = useCallback(
    (index: number) => {
      setChecked(checked === index ? 0 : index);
    },
    [checked],
  );

  const getWorkflowById = async(id: string) => {
    const { workflow, version } =
          await getWorkflowConfigById({ appId: id });
          return { workflow: workflow, version: version }
  }

  // 处理图片选择,默认到指定分下并选中对应数据
  const handleSelect = useCallback(
    (src: string) => {
      if (workFlows.length > 0 ) {
        getWorkflowById(workFlows[0]?.workflowInfo?.workflow?.workflow?.id).then(res => {
          console.log(res.version, 232)
          const components = JSON.parse(res?.version?.uiSchema)?.components || [];
          const params = components.map((item, index) => {
            return {
              title: item?.title,
              componentName: item?.type,
              type: item.type,
              name:
                item?.type == "ImageSelectPreview"
                  ? ""
                  : item?.basic?.params[0]?.name,
              param:
                item?.type == "ImageSelectPreview"
                  ? ""
                  : item?.basic?.params[0]?.defaultValue,
              params:
                item?.type == "ImageSelectPreview" ? item?.basic?.params : undefined,
              attributes: item?.ext?.options || item?.ext,
            };
          });
          const workflow = {
            ...workFlows[0]?.workflowInfo?.workflow?.workflow,
            power: workFlows[0]?.workflowInfo?.workflow?.workflow?.computeCost || workFlows[0]?.workflowInfo?.workflow?.workflow?.price,
            params: params,
          };
          onUpdateWorkflow?.(workflow, currentInitWorkflow.key, src);
        })
        // console.log(src, workFlows, workFlows[0], currentInitWorkflow, 224)
      }
    },
    [workFlows, currentInitWorkflow, onUpdateWorkflow],
  );

  // 构建分类映射
  useEffect(() => {
    if (categoryList && categoryList.length > 0) {
      const obj = categoryList.reduce(
        (acc: Record<string, string>, item: any) => {
          acc[item.name] = item.id;
          return acc;
        },
        {},
      );
      // console.log(obj, 276, categoryList, '灵感推荐')
      setWorkFlowsObj(obj);
    }
  }, [categoryList]);

  // // 数据变化时重新获取
  // useEffect(() => {
  //   if (workFlowList && workFlowList.length > 0) {
  //     fetchAndRenderImages();
  //   }
  // }, [workFlowList, fetchAndRenderImages]);

  // checked 变化时重新获取
  useEffect(() => {
    if (workFlowList && workFlowList.length > 0 && Object.keys(workFlowsObj).length > 0) {
      fetchAndRenderImages();
    }
  }, [checked, workFlowList, workFlowsObj]);
  // }, [checked, fetchAndRenderImages]);

  useEffect(() => {
    const fetchData = async() => {
      const cates = await listWorkflowCates().finally((res) => { setLoading(false); });
      const datas = await fetchAllPagesConcurrent(
        (params) =>
          queryWorkMaterials({
            ...params,
            includeTaskExecutionInfo: true,
            publishStatus: "online",  // 在线状态
          }),
        1,
        50, // 每页条数
        3, // 并发数
      ).finally((res) => {
        setLoading(false);
      });
      // console.log(datas, 269, '获取线上公开的应用生成结果')
      setWorkFlowList(datas || [])
      setCategoryList(cates || [])
      setLoading(false);
    }
    fetchData();
  }, [])

  // 判断是否显示导航按钮
  const showNavigation = images.length > 7;

  return (
    <div className="inspiration-body">
      <Spin spinning={loading}>
        <div className="inspiration-btn-list">
          {tags.map((tag, index) => (
            <Tag
              key={index}
              className={`inspiration-btn ${checked === index ? "inspiration-btn-checked" : ""}`}
              onClick={() => handleTagClick(index)}
            >
              {tag.title}
            </Tag>
          ))}
        </div>

        <div style={{ width: "100%", height: "256px", position: "relative" }}>
          <Swiper
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            autoplay={{
              delay: 5000,
              disableOnInteraction: false,
            }}
            modules={[Autoplay, Navigation]}
            loop={false}
            grabCursor={false}
            pagination={false}
            navigation={{
              nextEl: ".swiper-button-next-custom",
              prevEl: ".swiper-button-prev-custom",
            }}
            slidesPerView={7}
            slidesPerGroup={1}
            className="inspiration-center-swiper"
          >
            {images.map((item, index) => (
              <SwiperSlide
                key={index}
                style={{
                  borderRadius: 0,
                  width: "191px !important",
                  height: "256px",
                  position: "relative",
                }}
              >
                <img
                  src={JSON.parse(item?.itemsJson)[0]?.url}
                  className="inspiration-img"
                  alt={`灵感 ${index + 1}`}
                  onClick={() => handleSelect(JSON.parse(item?.itemsJson)[0]?.url)}
                />
              </SwiperSlide>
            ))}
          </Swiper>

          {showNavigation && (
            <div className="swiper-button-prev-custom custom-btn-swiper">
              <LeftOutlined />
            </div>
          )}
          {showNavigation && (
            <div className="swiper-button-next-custom custom-btn-swiper">
              <RightOutlined />
            </div>
          )}
        </div>
      </Spin>
    </div>
  );
};

export default ComponentInspirationCenter;
