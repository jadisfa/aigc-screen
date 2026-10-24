import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Modal, Spin, Tag, Space, Upload, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { CommonUploadImage } from "@/component/commonUploadImage";
import { fetchAllPagesConcurrent } from "@/utils/fetchAll";
import {
  listMaterialCategories,
  listMaterialTags,
} from "@/shared/api/materials/materials-taxonomy";
import { listModelMaterials } from "@/shared/api/materials/materials-model";
import { Swiper, SwiperSlide } from "swiper/react";
import "@/assets/css/scss/metrialModel.scss";

interface MetrialModalProps {
  visible: boolean;
  type: number; // 1: 款式库（道具） 2: 手模库(主体)
  title: string;
  onVisibleChange: (visible: boolean) => void;
  onSelectMetrail: (item: any) => void;
}

const ComponentMetrialModal: React.FC<MetrialModalProps> = ({
  visible,
  type,
  title,
  onVisibleChange,
  onSelectMetrail,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [materialArr, setMaterialArr] = useState<any[]>([]);
  const [materialTypes, setMaterialTypes] = useState<any[]>([]); // 分类数据
  const [activeTag, setActiveTag] = useState<string>("all");
  const [activeHandleTag, setActiveHandleTag] = useState<string>("handle");
  const [file, setFile] = useState<(string | File)[]>([]);
  const [uploadParams, setUploadParams] = useState<Record<string, string>>({});
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const metrialTypes = {
    1: "款式",
    2: "手模",
  };

  const handleTagOptions = [
    { label: "手模库", value: "handle" },
    { label: "我上传的", value: "my" },
  ];

  // 计算所有标签
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    materialArr.forEach((asset) => {
      if (asset.tags && Array.isArray(asset.tags)) {
        asset.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags);
  }, [materialArr]);

  // 标签选项
  const tagOptions = useMemo(() => {
    const options = [
      {
        value: "all",
        label: "全部",
      },
    ];

    allTags.forEach((tag) => {
      options.push({
        value: tag,
        label: tag,
      });
    });

    return options;
  }, [allTags]);

  // 根据选中的标签过滤资产
  const filteredAssets = useMemo(() => {
    if (activeTag === "all" || type === 2) {
      return materialArr;
    }
    return materialArr.filter((asset) => {
      return asset.tags && asset.tags.includes(activeTag);
    });
  }, [materialArr, activeTag, type]);

  // 标签点击处理
  const handleTagClick = useCallback((tag: string, tagType: number) => {
    if (tagType === 1) {
      setActiveTag(tag);
    }
    if (tagType === 2) {
      setActiveHandleTag(tag);
      if (tag == "my") {
        setMaterialArr([]);
      }
    }
  }, []);

  // 选择工作流项
  const handleSelectWorkflow = useCallback(
    (item: any) => {
      onVisibleChange(false);
      onSelectMetrail(item);
    },
    [onVisibleChange, onSelectMetrail],
  );

  // 关闭 Modal
  const handleModalCancel = useCallback(() => {
    setActiveTag("all");
    setLoading(true);
    setActiveHandleTag("handle");
    onVisibleChange(false);
    setMaterialArr([]);
  }, [onVisibleChange]);

  const getMetrialType = async () => {
    const allMetrialType = await listMaterialCategories({
      materialType: "model",
    });
    setMaterialTypes(allMetrialType);
  };
  //   获取分类，并根据传递的类型返回对应类型id
  const getMetrialTcategoryId = () => {
    const metrialTypsObj = materialTypes?.reduce((acc: ang, item: any) => {
      // 使用 id 或 name 作为 key，整个对象作为 value
      acc[item.name] = item.id;
      return acc;
    }, {});
    return metrialTypsObj[metrialTypes[type]];
  };

  // 获取模型素材对应的分类下标签
  const getMetrialTags = async () => {
    const categoryId = getMetrialTcategoryId();
    const allMetrialTags = await fetchAllPagesConcurrent(
      (params) =>
        listMaterialTags({
          ...params,
          materialType: "model",
          categoryId: categoryId,
        }),
      1,
      50, // 每页条数
      3, // 并发数
    );
    const metrialTypsObj = allMetrialTags.reduce((acc: ang, item: any) => {
      // 使用 id 或 name 作为 key，整个对象作为 value
      acc[item.id] = item.name;
      return acc;
    }, {});
    return metrialTypsObj;
  };

  useEffect(() => {
    getMetrialType();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      // 分类id
      const categoryId = getMetrialTcategoryId();
      const tags = await getMetrialTags();
      const metrials = await fetchAllPagesConcurrent(
        (params) =>
          listModelMaterials({
            ...params,
            categoryTypes: activeHandleTag == "my" ? ["user"] : ["system"],
            categoryId: categoryId,
          }),
        1,
        50, // 每页条数
        3, // 并发数
      );
      // 处理模型素材tag
      const metrialArray = metrials.map((item: any) => {
        const itemTags = JSON.parse(item?.tagsJson);
        const tagsArr = itemTags?.map((tag: any) => {
          return tags[tag];
        });
        return {
          ...item,
          tags: tagsArr,
        };
      });
      if (type == 2) {
        // 个人上传参数
        const uploadParams = {
          categoryType: "user",
          materialCategoryId: categoryId,
          materialName: `个人手模-${filteredAssets.length + 1}`
        };
        setUploadParams(uploadParams);
      }

      setMaterialArr(metrialArray);
      setLoading(false);
    };
    if (type && visible) {
      fetchData();
      //   const metrialData = (materialData as any[]).filter((item: any) => {
      //     const isCorrectCategory =
      //       item.category === metrialTypes[type as keyof typeof metrialTypes];
      //     const isCommonType = item?.type === "common";

      //     if (type === 2) {
      //       // 手模库需要排除"小程序官方手模"
      //       return (
      //         isCorrectCategory &&
      //         isCommonType &&
      //         item?.description !== "小程序官方手模"
      //       );
      //     }
      //     return isCorrectCategory && isCommonType;
      //   });
      //   setMaterialArr(metrialData);
    }
  }, [type, visible, activeHandleTag, uploadSuccess]);

  const handleSuccess = (val: string[]) => {
    setUploadSuccess(true);
    const item = {
      assetUrl: val[0],
    };
    handleSelectWorkflow(item);
  };

  // 渲染款式库内容 (type === 1)
  const renderModalContent = () => (
    <div className="metrial-content">
      <Spin
        spinning={loading}
        wrapperClassName="spin-wrapper"
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div className="content-wrapper">
          <Space wrap className="tag-list">
            {tagOptions.map((tag) => (
              <Tag
                key={tag.value}
                className={`tag-item color666 ${activeTag === tag.value ? "active" : ""}`}
                bordered={false}
                onClick={() => handleTagClick(tag.value, 1)}
              >
                {tag.label}
              </Tag>
            ))}
          </Space>
          <div className="workflow-grid">
            {filteredAssets.length > 0 ? (
              filteredAssets.map((item, index) => (
                <div
                  key={index}
                  className="workflow-item"
                  onClick={() => handleSelectWorkflow(item)}
                >
                  <img
                    className="workflow-img"
                    loading="lazy"
                    src={item?.assetUrl}
                    alt={item?.name || "素材"}
                  />
                </div>
              ))
            ) : (
              <div key="placeholder" className="workflow-item placeholder">
                暂无数据
              </div>
            )}
          </div>
        </div>
      </Spin>
    </div>
  );

  // 渲染手模库内容 (type === 2)
  const renderHandleModal = () => (
    <div className="handle-modal">
      <Space wrap className="tag-list">
        {handleTagOptions.map((tag) => (
          <Tag
            key={tag.value}
            className={`tag-item color666 ${activeHandleTag === tag.value ? "active" : ""}`}
            bordered={false}
            onClick={() => handleTagClick(tag.value, 2)}
          >
            {tag.label}
          </Tag>
        ))}
      </Space>

      {activeHandleTag === "handle" ? (
        <div className="content-wrapper">
          <div className="workflow-grid">
            {filteredAssets.length > 0 ? (
              filteredAssets.map((item, index) => (
                <div
                  key={index}
                  className="workflow-item"
                  onClick={() => handleSelectWorkflow(item)}
                >
                  <img
                    className="workflow-img"
                    loading="lazy"
                    src={item?.assetUrl}
                    alt={item?.name || "素材"}
                  />
                </div>
              ))
            ) : (
              <div key="placeholder" className="workflow-item placeholder">
                暂无数据
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="personal-handle-body flex flex-row justify-start gap-3">
            <div
              className="personal-handle-swiper"
            >
              <Swiper
                slidesPerView={4}
                spaceBetween={0}
                style={{ height: "120px" }}
              >
                {filteredAssets.map((item, index) => (
                  <SwiperSlide
                    key={index}
                    className="swiper-item"
                    onClick={() => handleSelectWorkflow(item)}
                  >
                    <img
                      className="swiper-img"
                      src={item?.assetUrl}
                      loading="lazy"
                      alt={item?.name || "素材"}
                    />
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
            <CommonUploadImage
              files={file as any}
              onFilesChange={(newFiles: any) => setFile([])}
              className="handle-upload"
              maxSize={5}
              limit={1}
              listType="picture-card"
              uploadParam={uploadParams}
              onUploadSuccess={(val) => handleSuccess(val)}
            >
              <div className="w-full flex flex-col items-center justify-center">
                <PlusOutlined />
                <div style={{ marginTop: "8px" }}>请上传</div>
                <div style={{ marginTop: "2px" }}>您的手模图</div>
              </div>
            </CommonUploadImage>
          </div>
          <div className="example">
            <img
              src="https://static.nailoffice.cn/homeImgs/sm.png"
              className="example-img"
              alt="示例1"
            />
            <img
              src="https://static.nailoffice.cn/homeImgs/sm1.png"
              className="example-img"
              alt="示例2"
            />
            <span className="color666 text12">手势参考（示例1、2）</span>
          </div>
        </>
      )}
    </div>
  );

  return (
    <Modal
      open={visible}
      title={title}
      footer={null}
      width={type == 1 ? 720 : 780}
      centered
      onCancel={handleModalCancel}
      destroyOnHidden
    >
      {type === 1 ? renderModalContent() : renderHandleModal()}
    </Modal>
  );
};

export default ComponentMetrialModal;
