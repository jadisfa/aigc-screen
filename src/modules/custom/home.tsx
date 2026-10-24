import { Ref, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "@/assets/css/customHome.css";
import { Button } from "@/shared/ui/button";
import { useVideoScrollEffect } from "@/shared/hooks/use-video-scrollEffect";
import { getAccessToken } from "@/shared/api/auth/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import type { pageFooter, text, icon, ImageItem } from "./homeConfig";
import HoverMask from "./component/hoverMask";
import CommonLogo from "@/component/commonLog";
import CustomHeader from "@/component/customHeader";
import HomeSwiper from "@/component/homeSwiper";
import designIcon from "@/assets/img/design_icon.png";
import designWhiteIcon from "@/assets/img/design_icon_white.png";
import lightIcon from "@/assets/img/light.png";
import videoIcon from "@/assets/img/video.png";
import frameUrl from "@/assets/img/Frame.png";
import vectorUrl from "@/assets/img/vector.png";
import xhsIcon from "@/assets/img/icon_xhs.png";
import xhsHoverIcon from "@/assets/img/icon_xhs_hover.png";

const CustomHome = () => {
  const navigate = useNavigate();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // 使用视频滚动动效 Hook
  const { setVideoRef, setContainerRef, initializeVideos } =
    useVideoScrollEffect();

  const splitList = [
    {
      left: {
        icon: vectorUrl,
        h: "",
        text: "支持文/图生成图片、视频",
      },
      right: {
        type: "text",
        h: "灵感创意成真",
        text: "NDMY自动完成专业的美甲自媒体内容流程,从概念灵感到美甲款式设计、照片、视频等。",
      },
    },
    {
      left: {
        icon: "",
        h: "穿搭灵感转化",
        text: "NDMY将像真正的美甲设计师一样设计和创作--选择调用不同风格的美甲设计师，私人定制,将您的创意变为现实。",
        path: "/backendCenter/creation?tab=NailArtDesign",
      },
      right: {
        type: "video",
        src: "https://static.nailoffice.cn/homeVideos/cdlg_result.mp4",
        h: "",
        text: "",
      },
    },
    {
      left: {
        icon: "",
        h: "网感图轻松Get",
        text: "通过AI技术分析图片的色彩、风格、元素等信息，智能生成符合复古ins风格的美甲上手效果图。",
        path: "/backendCenter/creation?tab=SocialNediaBestseller",
      },
      right: {
        type: "video",
        src: "https://static.nailoffice.cn/homeVideos/wgt_result.mp4",
        h: "灵感创意成真",
        text: "",
      },
    },
    {
      left: {
        icon: "",
        h: "数据决策内容",
        text: "一键输出专业自媒体体渠道的文案内容基于美甲款式特点与热点，自动生成带热门标签、emoji的社媒内容。",
        path: "/backendCenter/creation?tab=Copywriting",
      },
      right: {
        type: "video",
        src: "https://static.nailoffice.cn/homeVideos/sjjc_result.mp4",
        h: "",
        text: "",
      },
    },
  ];

  const homeExplore = [
    {
      type: "large",
      attrs: [
        {
          path: "https://static.nailoffice.cn/homeImgs/home-lgts-1.png",
          class: "lgts-1",
        },
        {
          path: "https://static.nailoffice.cn/homeImgs/home-lgts-2.png",
          class: "lgts-2",
        },
      ],
    },
    {
      path: "https://static.nailoffice.cn/homeImgs/home-lgts-3.png",
      class: "lgts-3",
      type: "middle",
    },
    {
      path: "https://static.nailoffice.cn/homeImgs/home-lgts-4.png",
      class: "lgts-4",
      type: "main",
    },
    {
      path: "https://static.nailoffice.cn/homeImgs/home-lgts-5.png",
      class: "lgts-4",
      type: "main",
    },
    {
      path: "https://static.nailoffice.cn/homeImgs/home-lgts-6.png",
      class: "lgts-4",
      type: "main",
    },
    {
      path: "https://static.nailoffice.cn/homeImgs/home-lgts-7.png",
      class: "lgts-3",
      type: "middle",
    },
    {
      type: "large",
      attrs: [
        {
          path: "https://static.nailoffice.cn/homeImgs/home-lgts-8.png",
          class: "lgts-2",
        },
        {
          path: "https://static.nailoffice.cn/homeImgs/home-lgts-9.png",
          class: "lgts-1",
        },
      ],
    },
  ];

  const pageFooterData: pageFooter = {
    texts: [
      { text: "用户协议", href: true, path: "/public/service" }, // 用户协议
      { text: "隐私政策", href: true, path: "/public/privacy" }, // 隐私政策
      {
        text: "浙ICP备2025176986号-1",
        href: true,
        path: "https://beian.miit.gov.cn/#/Integrated/index",
      }, // icp备案
      {
        text: "浙公网安备33010902004164号",
        href: true,
        path: "https://beian.mps.gov.cn/#/query/webSearch",
      }, // 公安备案
      { text: "杭州艾智汇科技有限公司", href: false },
      { text: "浙江省杭州市临平区乔司街180号1幢2层213-568室", href: false },
      { text: "版本号：", label: "Beta1.2.4" },
    ],
    icons: [
      {
        icon: xhsIcon,
        hover: xhsHoverIcon,
        href: true,
        path: "https://www.xiaohongshu.com/user/profile/6891c213000000002900a4a2?xsec_token=ABDo-FwfptJVptfODaKVJoM_V6rZ6ncgfgDcKn0b8wC2o%3D&xsec_source=pc_search&m_source=360_sem",
      },
    ],
  };

  const handleStartCreating = () => {
    const token = getAccessToken();
    if (!token) {
      handeleEvent()
    } else {
      navigate('/backendCenter/creation')
    }
  };

  /**
   * 底部调转
   * 文本站内跳转，icon站外跳转
   */
  const handleClick = (item: text | icon) => {
    if ("text" in item && item.text) {
      if (item.href && item.path && !item.path.includes("https")) {
        //   const path = localePath(item.path)
        navigate(`${item.path}`);
        //   window.top!.location.href = item.path
        return;
      } else {
        window.open(item.path, "_blank");
      }
    } else if ("icon" in item && item.icon) {
      // 如果是icon类型（站外跳转）
      if (item.href && item.path) {
        window.open(item.path, "_blank");
      }
    }
  };

  const handleGoto = (path:string) => {
    const token = getAccessToken();
    if (!token) {
      handeleEvent();
    } else {
      navigate(path);
    }
  }

  useEffect(() => {
    // 给一点时间让 DOM 渲染完成
    const timer = setTimeout(() => {
      initializeVideos();
    }, 200);

    return () => clearTimeout(timer);
  }, [initializeVideos]);

  const gotoBackendCenter = (item: any) => {
  const token = getAccessToken();
  if (!token) {
    handeleEvent()
  } else {
    navigate(item?.path)
  }
}

const handeleEvent = () => {
  window.dispatchEvent(
    new CustomEvent('openLogin', {
      detail: { value: true },
    })
  );
}

  return (
    <>
      <div className="home-container " ref={setContainerRef}>
        {/* 头部logo、菜单、用户头像 */}
        <CustomHeader />
        {/* 视频 */}
        <HomeSwiper />
        {/* 第二部分 */}
        <div className="home-split-list">
          {splitList.map((item, index) => {
            const keyId = item.right.src || `split${index}`;
            // 筛选当前条目是否是视频类型，生成全局视频索引
            const videoGlobalIndex = splitList
              .slice(0, index)
              .filter((v) => v.right.type === "video").length;

            return (
              <div
                className="home-split-item"
                key={keyId}
                style={{ height: index === 0 ? "220px" : "504px" }}
              >
                <div className="home-split-item-inner left-content">
                  <div
                    className={
                      index === 0 ? "split-item-left flex" : "split-item-left"
                    }
                  >
                    {item.left.icon && (
                      <img
                        src={item.left.icon}
                        style={{
                          width: "13px",
                          height: "14px",
                          marginRight: "5px",
                          marginTop: "4px",
                        }}
                      />
                    )}
                    {item.left.h && (
                      <div className="split-item-title">{item.left.h}</div>
                    )}
                    <p className="split-item-text">{item?.left?.text}</p>
                    {index != 0 && (
                      <Button
                        className="home-split-btn"
                        variant="outline"
                        onClick={() => gotoBackendCenter(item?.left)}
                      >
                        <img
                          src={designIcon}
                          style={{
                            width: "19px",
                            height: "24px",
                            marginRight: "5px",
                          }}
                        />
                        开始创作
                      </Button>
                    )}
                  </div>
                  {index != 0 && (
                    <div className="split-item-right">{`0${index}`}</div>
                  )}
                </div>

                <div className="home-split-item-inner right-content">
                  {item?.right?.type === "text" && (
                    <div className="home-split-item-text">
                      <div className="title65 pingMedium">{item?.right?.h}</div>
                      <p className="title22">{item?.right?.text}</p>
                    </div>
                  )}
                  {item?.right?.type === "video" && (
                    <div className="home-split-item-text">
                      <video
                        ref={setVideoRef(videoGlobalIndex)}
                        className="transform-video"
                        loop
                        muted
                        preload="metadata"
                        src={item.right.src}
                        style={{
                          borderRadius: "10px",
                          width: "100%",
                          height: "100%",
                          willChange: "transform",
                          backfaceVisibility: "hidden",
                          transformStyle: "preserve-3d",
                          // 无css transition，完全JS逐帧控制，杜绝闪烁跳变
                          transition: "none",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* 第三部分 */}
        <div className="manicure-info">
          <div className="manicure-info-text">
            <img
              src={frameUrl}
              style={{ width: "22px", height: "22px", marginRight: "5px" }}
            />
            <span>支持首、尾帧图片生视频</span>
          </div>
          <div className="manicure-video-info">
            <div className="text56 pingMedium">重新定义美甲视频</div>
            <div className="text20">
              创新的首帧图片和尾帧图片输入方式，增强视频生成的可控性，轻松打造高品质素材，提升你的视频内容创作效率生成广告概念并将脚本转换为电影级创作内容
            </div>
          </div>
          <div className="manicure-video-body">
            <div className="manicure-video-item">
              <img
                src="https://static.nailoffice.cn/homeImgs/mj.png"
                style={{ width: "100%", height: "100%" }}
                loading="lazy"
              />
              <div className="swiper-item-action mjsp">
                <div className="swiper-item-action-left">
                  <img
                    src={videoIcon}
                    style={{ width: "26px", height: "26px" }}
                    loading="lazy"
                  />
                  <span className="text18">
                    生成符合Instagram平台风格的美甲视频
                  </span>
                </div>
                <Button
                  className="home-split-btn swiper-item-action-right"
                  variant="outline"
                  onClick={() =>
                    handleGoto("/backendCenter/creation?tab=VideoCreation")
                  }
                >
                  <img
                    src={designWhiteIcon}
                    loading="lazy"
                    style={{
                      width: "19px",
                      height: "24px",
                      marginRight: "5px",
                    }}
                  />
                  开始创作
                </Button>
              </div>
            </div>
            <div className="manicure-video-item">
              <img
                src="https://static.nailoffice.cn/homeImgs/mj1.png"
                style={{ width: "100%", height: "100%" }}
                loading="lazy"
              />
              <div className="swiper-item-action mjsp">
                <div className="swiper-item-action-left">
                  <img
                    src={videoIcon}
                    style={{ width: "26px", height: "26px" }}
                    loading="lazy"
                  />
                  <span className="text18">生成专业级美甲人像的TVC</span>
                </div>
                <Button
                  className="home-split-btn swiper-item-action-right"
                  variant="outline"
                  onClick={() =>
                    handleGoto("/backendCenter/creation?tab=VideoCreation")
                  }
                >
                  <img
                    src={designWhiteIcon}
                    loading="lazy"
                    style={{
                      width: "19px",
                      height: "24px",
                      marginRight: "5px",
                    }}
                  />
                  开始创作
                </Button>
              </div>
            </div>
          </div>
          <div className="manicure-video-info">
            <div className="text56 pingMedium">为美甲内容创作而生</div>
            <div className="text20">简单到新手能用，强大到专业人士爱用</div>
          </div>
          <Button
            className="home-split-btn marginAuto fixWidth hover:!text-[#7d33ff]"
            variant="outline"
            onClick={() =>
            handleGoto("/backendCenter/creation?tab=NailTrialWear")
            }
          >
            <img
              src={designIcon}
              loading="lazy"
              style={{ width: "19px", height: "24px", marginRight: "5px" }}
            />
            开始创作
          </Button>
          <Tabs defaultValue="nail" className="material-tabs w-full">
            <TabsList className="w-full h-auto p-1 grid gap-1 custom-home-tabs">
              <TabsTrigger
                value="nail"
                className="material-tabs-item text-block h-9"
              >
                美甲款式库
              </TabsTrigger>
              <TabsTrigger
                value="handle"
                className="material-tabs-item text-block h-9 "
              >
                网感手模库
              </TabsTrigger>
            </TabsList>
            <TabsContent value="nail" className="custom-home-tabContent">
              <img
                src="https://static.nailoffice.cn/homeImgs/ksk.jpg"
                style={{ width: "100%", height: "100%" }}
                loading="lazy"
              />
            </TabsContent>
            <TabsContent value="handle" className="custom-home-tabContent">
              <img
                src="https://static.nailoffice.cn/homeImgs/smk.png"
                style={{ width: "100%", height: "100%" }}
                loading="lazy"
              />
            </TabsContent>
          </Tabs>
          <div className="creation-body">
            <div className="creation-info home">
              <div className="text56 pingMedium">无限创意 灵活创作</div>
              <div className="text16">
                在NDMY的灵感空间中探索丰富的创意作品吧
              </div>
              <Button
                className="home-split-btn marginAuto creation-btn fixWidth hover:!text-[#7d33ff]"
                variant="outline"
                onClick={() => handleGoto("/backendCenter/explore")}
              >
                <img
                  src={lightIcon}
                  loading="lazy"
                  style={{ width: "19px", height: "24px", marginRight: "5px" }}
                />
                获取创作灵感
              </Button>
            </div>
            <div className="creation-animation-body">
              {homeExplore.map((explore, index) => {
                if (explore?.type == "large") {
                  return (
                    <div className="creation-animation-large" key={index}>
                      {explore?.attrs.map((attr, attrIndex) => {
                        return (
                          <div
                            key={attrIndex}
                            className={
                              attrIndex == 0
                                ? "creation-animation-large-top animation-img"
                                : "creation-animation-large-bottom animation-img"
                            }
                          >
                            <HoverMask
                              overlayText="创作同款 ->"
                              onClick={() =>
                                handleGoto("/backendCenter/explore")
                              }
                            >
                              <img
                                src={attr?.path}
                                loading="lazy"
                                className={`home-lgts-img ${attr.class}`}
                              />
                            </HoverMask>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                if (explore?.type == "middle") {
                  return (
                    <div className="creation-animation-middle" key={index}>
                      <HoverMask
                        overlayText="创作同款 ->"
                        onClick={() => handleGoto("/backendCenter/explore")}
                      >
                        <img
                          src={explore?.path}
                          className={`home-lgts-img ${explore.class}`}
                          loading="lazy"
                        />
                      </HoverMask>
                    </div>
                  );
                }
                if (explore?.type == "main") {
                  return (
                    <div className="creation-animation-main" key={index}>
                      <HoverMask
                        overlayText="创作同款 ->"
                        onClick={() => handleGoto("/backendCenter/explore")}
                      >
                        <img
                          src={explore?.path}
                          className={`home-lgts-img ${explore.class}`}
                          loading="lazy"
                        />
                      </HoverMask>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        </div>
        {/* 底部信息 */}
        <div className="home-bottom">
          <div className="home-bottom-icon">
            <CommonLogo
              home={true}
              custom={true}
              style={{ width: "149px", height: "55px" }}
            />
            <Button
              className="home-split-btn custom-bg fixWidth"
              onClick={handleStartCreating}
            >
              <img
                src={designWhiteIcon}
                loading="lazy"
                style={{ width: "19px", height: "24px", marginRight: "5px" }}
              />
              开始创作
            </Button>
          </div>
          <div className="home-bottom-infos">
            <div className="home-bottom-top">
              {pageFooterData.texts.map((itemText, index) => (
                <div className="home-bottom-info-item" key={index}>
                  <span
                    style={{ cursor: itemText?.href ? "pointer" : "auto" }}
                    onClick={() => handleClick(itemText)}
                  >
                    {itemText?.text || ""}
                  </span>
                  <span v-if="itemText?.label">{itemText?.label}</span>
                  <div
                    className="home-info-split"
                    style={{
                      display:
                        index == pageFooterData?.texts?.length - 1
                          ? "none"
                          : "inline-block",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="home-bottom-icons">
              {pageFooterData.icons.map((itemIcon, index) => {
                // 动态判断当前用哪个地址
                const imgSrc =
                  hoverIndex === index ? itemIcon.hover : itemIcon.icon;
                return (
                  <img
                    key={index}
                    className="footer-icon"
                    src={imgSrc}
                    style={{ width: "24px", height: "24px" }}
                    loading="lazy"
                    onClick={() => handleClick(itemIcon)}
                    onMouseEnter={() => setHoverIndex(index)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomHome;
