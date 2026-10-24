import { useRef, useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import type SwiperType from "swiper";
import type { ImageItem } from "@/modules/custom/homeConfig";
import { getAccessToken } from "@/shared/api/auth/auth";
import { Button } from "@/shared/ui/button";
import thumbIcon1 from "@/assets/img/thumb1.jpg";
import thumbIcon2 from "@/assets/img/thumb2.jpg";
import thumbIcon3 from "@/assets/img/thumb3.jpg";
import thumbIcon4 from "@/assets/img/thumb4.jpg";
import thumbIcon5 from "@/assets/img/thumb5.jpg";
import designWhiteIcon from "@/assets/img/design_icon_white.png";
import videoIcon from "@/assets/img/video.png";
import "swiper/css";
import "@/assets/css/customHome.css";

const HomeSwiper = () => {
  const swiperRef = useRef(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]); // 存储所有 video 元素的引用
  const navigate = useNavigate();
  // 当前激活下标
  const [activeIndex, setActiveIndex] = useState(0);
  const videoS: ImageItem[] = [
    {
      src: "https://static.nailoffice.cn/homeVideos/mjsj_result.mp4",
      title: "国风青花瓷元素的美甲设计",
      path: "/backendCenter/creation?tab=NailArtDesign",
      icon: thumbIcon1,
    },
    {
      src: "https://static.nailoffice.cn/homeVideos/smbk_result.mp4",
      title: "生成复古Ins风社媒爆款美甲照片",
      path: "/backendCenter/creation?tab=SocialNediaBestseller",
      icon: thumbIcon2,
    },
    {
      src: "https://static.nailoffice.cn/homeVideos/mjsd_result.mp4",
      title: "想换一副Y2k辣妹风的美甲",
      path: "/backendCenter/creation?tab=NailTrialWear",
      icon: thumbIcon3,
    },
    {
      src: "https://static.nailoffice.cn/homeVideos/wacz_result.mp4",
      title: "生成社媒平台的文案内容",
      path: "/backendCenter/creation?tab=NailTrialWear",
      icon: thumbIcon4,
    },
    {
      src: "https://static.nailoffice.cn/homeVideos/spcz_result.mp4",
      title: "生成专业级美甲TVC商业广告",
      path: "/backendCenter/creation?tab=Copywriting",
      icon: thumbIcon5,
    },
  ];

  const gotoBackendCenter = (item: any) => {
    const token = getAccessToken();
    if (!token) {
      window.dispatchEvent(
        new CustomEvent('openLogin', {
          detail: { value: true },
        })
      );
      // navigate("/login");
      return;
    } else {
      // window.top!.location.href = item?.path;
      navigate(item?.path);
    }
  };

  // 播放指定索引的视频
  const playVideoByIndex = useCallback((index: number) => {
    // 先暂停所有视频
    videoRefs.current.forEach((video) => {
      if (video) {
        video.pause();
      }
    });

    // 播放当前激活的视频
    const currentVideo = videoRefs.current[index];
    if (currentVideo) {
      currentVideo.currentTime = 0;
      currentVideo.play().catch((error) => {
        // 处理自动播放被浏览器阻止的情况
        console.log("Video autoplay prevented:", error);
      });
    }
  }, []);

  // 初始化时播放第一个视频
  const handleSwiperInit = useCallback(
    (swiper: SwiperType) => {
      swiperRef.current = swiper;
      // 延迟执行确保 DOM 渲染完成
      setTimeout(() => {
        const realIndex = swiper.realIndex;
        setActiveIndex(realIndex);
        playVideoByIndex(realIndex);
      }, 50);
    },
    [playVideoByIndex],
  );

  const handleChangeActiveIndex = (index: number) => {
    if (swiperRef.current) {
      // 因为 loop 为 true，使用 slideToLoop 方法
      swiperRef.current.slideToLoop(index);
    }
    setTimeout(() => {
      setActiveIndex(index);
      playVideoByIndex(index);
    }, 50);
  };

  const handleSlideChange = (swiper: SwiperType) => {
    // 获取真实的 slide 索引（考虑 loop 模式）
    const realIndex = swiper.realIndex;
    setActiveIndex(realIndex);
    playVideoByIndex(realIndex);
  };

  // 处理视频加载完成事件，确保视频可以播放
  const handleVideoLoaded = useCallback(
    (index: number) => {
      // 如果当前索引是激活的，则播放
      if (index === activeIndex) {
        const video = videoRefs.current[index];
        if (video) {
          video.play().catch(() => {});
        }
      }
    },
    [activeIndex],
  );

  const setVideoRef = (index: number) => (el: HTMLVideoElement | null) => {
    videoRefs.current[index] = el;
  };

  useEffect(() => {
    playVideoByIndex(activeIndex);
  }, [activeIndex, playVideoByIndex]);
  return (
    <div className="home-swiper-container">
      <Swiper
        modules={[Autoplay]}
        slidesPerView={1}
        pagination={false}
        loop={true}
        autoplay={{
          delay: 5000, // 可配置自动播放间隔
          disableOnInteraction: false, // 用户交互后不停止自动播放
        }}
        onSwiper={handleSwiperInit}
        onSlideChange={handleSlideChange}
        style={{ height: "100vh" }}
      >
        {videoS.map((item, index) => (
          <SwiperSlide
            key={index}
            style={{ borderRadius: "0", height: "100vh", position: "relative" }}
          >
            <video
              ref={setVideoRef(index)}
              className="home-bannaer"
              muted
              src={item?.src}
              webkit-playsinline="true"
              preload="metadata"
              onLoadedData={() => handleVideoLoaded(index)}
            />
            <div className="swiper-item-action">
              <div className="swiper-item-action-left">
                <img
                  src={videoIcon}
                  style={{ width: "26px", height: "26px" }}
                />
                <span className="text18">{item?.title}</span>
              </div>
              <Button
                className="home-split-btn swiper-item-action-right"
                variant="outline"
                onClick={() => gotoBackendCenter(item)}
              >
                <img
                  src={designWhiteIcon}
                  style={{ width: "19px", height: "24px", marginRight: "5px" }}
                />
                开始创作
              </Button>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      <div className="swiper-paginations">
        {videoS.map((item, index) => (
          <div
            key={index}
            className={
              activeIndex == index
                ? "swiper-pagination-item selected"
                : "swiper-pagination-item"
            }
            onClick={() => handleChangeActiveIndex(index)}
          >
            <img src={item.icon} style={{ borderRadius: "5px" }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomeSwiper;
