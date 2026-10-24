// components/layout/BackendCenterLayout.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Sparkles,
  LayoutDashboard,
  Lightbulb,
  User,
  LogOut,
  Crown,
  Info,
  BookOpen,
  Headset,
} from "lucide-react";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { getAccessToken } from "@/shared/api/auth/auth";
import { Popover } from "antd";
// import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/lib/utils";
import { handleLogout } from "@/utils/common";
import CommonLogo from "@/component/commonLog";
import CommonUser from "@/component/commonUser";
import collapsedIcon from "@/assets/img/collapsed.png";

interface MenuItem {
  key: string;
  label: string;
  path?: string;
  icon?: React.ReactNode;
  divider?: boolean;
  external?: boolean;
  externalUrl?: string;
  isService?: boolean;
}

interface BackendCenterLayoutProps {
  serviceImageUrl?: string;
  serviceUrl?: string;
}

// localStorage key
const COLLAPSED_STORAGE_KEY = "backend_sidebar_collapsed";

// 从 localStorage 读取折叠状态
const getStoredCollapsed = (): boolean => {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored === null) return false;
    return JSON.parse(stored);
  } catch {
    return false;
  }
};

// 保存折叠状态到 localStorage
const setStoredCollapsed = (value: boolean): void => {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const BackendCenterLayout = ({
  serviceImageUrl = "https://static.nailoffice.cn/2026-04-29/6811db59c58c28287e07e45c/upload/20260429173347984-server-lji8oh.png",
  serviceUrl = "",
}: BackendCenterLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getAccessToken();
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const [selectedKey, setSelectedKey] = useState<string>("creation");
  const [serviceImage, setServiceImage] = useState<string>(serviceImageUrl);
  const sidebarWidth = 240;
  const collapsedWidth = 80;

  // 菜单配置 - 使用 useMemo 缓存
  const menus: MenuItem[] = useMemo(
    () => [
      {
        label: "首页",
        key: "home",
        path: "/",
        icon: <Home size={20} />,
      },
      {
        label: "创作",
        key: "creation",
        path: "creation",
        icon: <Sparkles size={20} />,
      },
      {
        label: "创作中心",
        key: "draw-record",
        path: "draw-record",
        icon: <LayoutDashboard size={20} />,
      },
      // {
      //   label: "灵感画布",
      //   key: "explore",
      //   path: "canvas",
      //   icon: <Lightbulb size={20} />,
      // },
      {
        label: "个人中心",
        key: "use-center",
        path: "use-center",
        icon: <User size={20} />,
      },
      {
        divider: true,
        key: "divider-1",
        label: "",
      },
      {
        label: "会员服务",
        key: "membership-service",
        path: "membership-service",
        icon: <Crown size={20} />,
      },
      {
        label: "关于我们",
        key: "about",
        icon: <Info size={20} />,
        external: true,
        externalUrl: "http://naildoo.net.cn/",
      },
      {
        label: "使用教程",
        key: "use",
        icon: <BookOpen size={20} />,
      },
      {
        label: "联系客服",
        key: "server",
        icon: <Headset size={20} />,
        isService: true,
      },
      {
        label: "退出登录",
        key: "log-out",
        path: "log-out",
        icon: <LogOut size={20} />,
      }
    ],
    [],
  );

  // 根据路由更新选中的菜单
  useEffect(() => {
    const path = location.pathname;
    let currentPath = "";
    if (path.startsWith("/backendCenter/")) {
      currentPath = path.replace("/backendCenter/", "").replace("/", "");
    } else if (path === "/") {
      currentPath = "";
    }

    const matchedMenu = menus.find(
      (menu) =>
        menu.path === currentPath ||
        (currentPath === "" && menu.key === "home"),
    );

    if (matchedMenu?.key) {
      setSelectedKey(matchedMenu.key);
    }
  }, [location.pathname, menus]);

  // 监听窗口变化
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 保存折叠状态到 localStorage
  useEffect(() => {
    setStoredCollapsed(collapsed);
  }, [collapsed]);

  // 切换折叠 - 使用 useCallback 缓存
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // 菜单点击处理 - 使用 useCallback 缓存
  const handleMenuClick = useCallback(
    (menu: MenuItem) => {
      if (menu.key === "log-out") {
        handleLogout();
        navigate("/");
        return;
      }

      if (menu.external && menu.externalUrl) {
        window.open(menu.externalUrl, "_blank");
        return;
      }

      if (menu.isService) {
        if (serviceUrl) {
          window.open(serviceUrl, "_blank");
        }
        return;
      }

      if (menu.path === "/") {
        navigate("/");
        return;
      }

      if (menu.path) {
        setSelectedKey(menu.key);
        // ✅ 使用 navigate 进行客户端路由跳转，不会刷新页面
        navigate(`/backendCenter/${menu.path}`);
      }
    },
    [navigate, serviceUrl],
  );

  const handleReturnHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // 判断菜单是否激活
  const isActive = useCallback(
    (menu: MenuItem) => {
      if (menu.key === selectedKey) return true;
      if (menu.key === "creation" && location.pathname.includes("/creation")) {
        return true;
      }
      return false;
    },
    [selectedKey, location.pathname],
  );

  // 渲染菜单项
  const renderMenuItem = useCallback(
    (menu: MenuItem) => {
      const active = isActive(menu);
      const showLabel = !collapsed;

      if (menu.divider) {
        return (
          <div
            key={menu.key}
            className="menu-divider mx-auto my-2 h-px w-[80%] bg-gray-200"
          />
        );
      }

      const buttonContent = (
        <div
          className={cn(
            "menu-item group flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-sm font-medium transition-all",
            active ? "text-[#7d33ff]" : "text-gray-600 hover:text-[#7d33ff]",
            collapsed && "justify-center px-0",
          )}
          key={menu.key}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleMenuClick(menu);
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <span className="menu-icon flex-shrink-0 !text-current">{menu.icon}</span>
          {showLabel && !menu.isService && (
            <span className="menu-label text-left">{menu.label}</span>
          )}
          {showLabel && menu.isService && (
            <Popover
              placement="bottom"
              content={
                <img
                  src={serviceImage}
                  alt="客服二维码"
                  className="h-[120px] w-[120px]"
                />
              }
            >
              <span className="menu-label text-left">{menu.label}</span>
            </Popover>
          )}
        </div>
      );

      // 普通菜单项 - 折叠时显示 Tooltip
      if (collapsed) {
        return (
          <TooltipProvider key={menu.key} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {menu.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      return buttonContent;
    },
    [collapsed, isActive, handleMenuClick, serviceImage],
  );

  const currentWidth = collapsed ? collapsedWidth : sidebarWidth;

  return (
    <div className="backendCenter-layout flex min-h-screen bg-white">
      {/* 侧边栏 */}
      <div
        className={cn(
          "sider fixed left-0 top-0 z-50 flex h-screen flex-col overflow-auto border-r border-gray-200 bg-white shadow-[2px_0_8px_rgba(0,0,0,0.05)] transition-all duration-200",
          collapsed && "collapsed",
        )}
        style={{
          width: collapsed ? 80 : sidebarWidth,
        }}
      >
        {/* 头部 */}
        <div className="header-left flex h-[62px] items-center justify-between px-[31.5px] pt-[31.5px]">
          {!collapsed && (
            <CommonLogo
              custom
              style={{
                width: "100px",
                height: "30px",
                cursor: "pointer",
              }}
            />
          )}
          <img
            src={collapsedIcon}
            alt="toggle"
            className="h-[13px] w-[13px] cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapsed();
            }}
          />
        </div>

        {/* 菜单 */}
        <div
          className="table-menu flex-1 bg-white px-0 py-4 pt-8"
          onClick={(e) => e.stopPropagation()}
        >
          <ScrollArea className="h-full">
            <div className="bottom-menu space-y-1 border-r-0">
              {menus.map((menu) => renderMenuItem(menu))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* 主内容区 */}
      <div
        className="content-layout relative max-h-screen bg-[#f8f8f8] transition-[margin-left] duration-200"
        id="layout-content"
        style={{
          marginLeft: currentWidth,
          width: `calc(100% - ${currentWidth}px)`,
          height: "100vh",
          overflowY: "scroll",
        }}
      >
        {token && (
          <div className="custom-user-body fixed right-4 top-5 z-[10000]">
            <CommonUser />
          </div>
        )}
        <div
          className="content rounded-lg bg-[#f8f8f8] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
          style={{
            height: location.pathname?.includes("draw-record")
              ? "auto"
              : "100%",
          }}
        >
          <Outlet />
        </div>
      </div>

      <style>{`
        .sider .menu-item {
          margin: 4px 0;
          border-radius: 4px;
          padding-left: 31.5px !important;
          height: 40px;
          background: transparent;
          border: none;
          outline: none;
        }

        .sider .menu-item:hover {
          background: transparent;
          color: #7d33ff;
        }

        .sider .menu-item .menu-icon {
          transition: all 0.3s;
          color: #9ca3af;
        }

        .sider .menu-item.active .menu-icon,
        .sider .menu-item:hover .menu-icon {
          color: #7d33ff;
        }

        .sider .menu-item.active {
          color: #7d33ff !important;
          background: transparent;
        }

        .sider .menu-item .menu-label {
          transition: opacity 0.2s;
          white-space: nowrap;
        }

        .sider .menu-divider {
          margin: 8px auto;
          width: 80%;
          background: #e5e7eb;
        }

        .header-left .common-logo {
          flex-shrink: 0;
        }

        .sider .bottom-menu .menu-item {
          padding-left: 31.5px !important;
        }

        .sider ::-webkit-scrollbar {
          width: 4px;
        }

        .sider ::-webkit-scrollbar-track {
          background: transparent;
        }

        .sider ::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 2px;
        }

        .sider ::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        .sider.collapsed .menu-item {
          padding-left: 0 !important;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default BackendCenterLayout;
