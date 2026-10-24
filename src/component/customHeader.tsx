// 自定义首页顶部内容
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "@/shared/api/auth/auth";
import CommonLogo from "@/component/commonLog";
import CommonUser from "@/component/commonUser";
import "@/assets/css/customHeader.css";

interface MenuItem {
  title: string;
  value: string;
  route: string;
  icon: string;
  items?: any[];
}
const CustomHeader = () => {
  const navigate = useNavigate();

  const navigation: MenuItem[] = [
    {
      title: "美甲设计",
      value: "NailArtDesign",
      route: "",
      icon: "",
      items: Array(0),
    },
    {
      title: "社媒爆款",
      value: "SocialNediaBestseller",
      route: "",
      icon: "",
      items: Array(0),
    },
    {
      title: "美甲试戴",
      value: "NailTrialWear",
      route: "",
      icon: "",
      items: Array(0),
    },
    {
      title: "文案创作",
      value: "Copywriting",
      route: "",
      icon: "",
      items: Array(0),
    },
    {
      title: "视频创作",
      value: "VideoCreation",
      route: "",
      icon: "",
      items: Array(0),
    },
    {
      title: "灵感画布",
      value: "",
      route: "/backendCenter/canvas",
      icon: "",
      items: Array(0),
    },
  ];

  const navigateToPath = (item: any) => {
    const token = getAccessToken();
    if (!token) {
      // return navigate("/login");
      window.dispatchEvent(
        new CustomEvent('openLogin', {
          detail: { value: true },
        })
      );
    } else {
      if (item?.route) {
        navigate(item.route);
      } else {
        // navigateTo('/backendCenter/creation?tab=' + item.value)
        navigate(`/backendCenter/creation?tab=${item.value}`);
      }
    }
  };
  return (
    <div className="custom-header z-9">
      <CommonLogo style={{ width: "136.5px", height: "30px" }} />
      {/* 菜单 */}
      <div className="nal-header-tabbar">
        {navigation.map((item, index) => (
          <div
            className="nal-tabbar-item"
            key={`menu-${index}`}
            onClick={() => navigateToPath(item)}
          >
            {item.title}
          </div>
        ))}
      </div>
      {/* 用户头像 */}
      <CommonUser />
    </div>
  );
};

export default CustomHeader;
