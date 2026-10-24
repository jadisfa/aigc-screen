import {
  AppWindow,
  BarChart3,
  Bell,
  BookOpenCheck,
  Bot,
  Box,
  Building2,
  ChevronUp,
  ClipboardList,
  Cloud,
  Cpu,
  CreditCard,
  FileText,
  Fingerprint,
  FolderKanban,
  Globe,
  HardDrive,
  HeadphonesIcon,
  Image,
  LogIn,
  Radio,
  MessageSquare,
  Package,
  Settings,
  Shield,
  Smartphone,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import type { ElementType } from "react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  CONSOLE_ROUTES,
  hasPermission,
  type PermissionRequirement,
} from "@/shared/lib/permissions";

interface MenuChildItem {
  icon: ElementType;
  label: string;
  to: string;
  permissionCode?: PermissionRequirement;
}

interface MenuItem {
  icon: ElementType;
  label: string;
  to?: string;
  permissionCode?: PermissionRequirement;
  children?: MenuChildItem[];
}

const SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY = "console.sidebar.expanded-groups";
const SIDEBAR_SCROLL_TOP_STORAGE_KEY = "console.sidebar.scroll-top";
const DEFAULT_EXPANDED_GROUPS = ["应用管理", "素材管理", "模型中枢", "接入管理", "用户管理", "系统配置", "运营管理"];

function readExpandedGroupsFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_EXPANDED_GROUPS;
  }
  const rawValue = window.sessionStorage.getItem(SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY);
  if (!rawValue) {
    return DEFAULT_EXPANDED_GROUPS;
  }
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {
    // Ignore malformed storage and fall back to defaults.
  }
  return DEFAULT_EXPANDED_GROUPS;
}

function writeExpandedGroupsToStorage(groups: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(SIDEBAR_EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify(groups));
}

function readSidebarScrollTopFromStorage() {
  if (typeof window === "undefined") {
    return 0;
  }
  const rawValue = window.sessionStorage.getItem(SIDEBAR_SCROLL_TOP_STORAGE_KEY);
  const parsed = rawValue ? Number(rawValue) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeSidebarScrollTopToStorage(scrollTop: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(SIDEBAR_SCROLL_TOP_STORAGE_KEY, String(scrollTop));
}

const menuItems: MenuItem[] = [
  { icon: BarChart3, label: "数据看板", to: CONSOLE_ROUTES.dashboard, permissionCode: CONSOLE_PERMISSIONS.dashboard },
  {
    icon: AppWindow,
    label: "应用管理",
    children: [
      { icon: ClipboardList, label: "应用列表", to: CONSOLE_ROUTES.workflowList, permissionCode: CONSOLE_PERMISSIONS.workflowAppManage },
      { icon: FolderKanban, label: "应用分类", to: CONSOLE_ROUTES.workflowCategories, permissionCode: CONSOLE_PERMISSIONS.workflowCategoryManage },
      { icon: Cpu, label: "应用调度", to: "/app/scheduler/tasks", permissionCode: CONSOLE_PERMISSIONS.schedulerManage },
      // { icon: Tags, label: "应用标签", to: "/app/tags", permissionCode: "workflow.manage" },
      // { icon: Bot, label: "技能管理", to: "/workflow/skills", permissionCode: "workflow.manage" },
      // { icon: Database, label: "知识库", to: "/workflow/knowledge-bases", permissionCode: "workflow.manage" },
      // { icon: BookOpenCheck, label: "智能体", to: "/workflow/agents", permissionCode: "workflow.manage" },
    ],
  },
  {
    icon: Package,
    label: "素材管理",
    children: [
      { icon: Box, label: "作品管理", to: CONSOLE_ROUTES.materialsWorks, permissionCode: CONSOLE_PERMISSIONS.materialsWorkManage },
      { icon: FileText, label: "文件管理", to: "/materials/file-materials", permissionCode: CONSOLE_PERMISSIONS.materialsFileManage },
      // { icon: Image, label: "图片素材", to: "/materials/images", permissionCode: CONSOLE_PERMISSIONS.materialsMediaManage },
      // { icon: Video, label: "视频素材", to: "/materials/videos", permissionCode: CONSOLE_PERMISSIONS.materialsMediaManage },
      { icon: Cpu, label: "模型素材", to: "/materials/models", permissionCode: CONSOLE_PERMISSIONS.materialsModelManage },
    ],
  },
  {
    icon: Wallet,
    label: "运营管理",
    children: [
      { icon: Users, label: "用户套餐", to: CONSOLE_ROUTES.userPackages, permissionCode: CONSOLE_PERMISSIONS.opsPackageManage },
      { icon: CreditCard, label: "订单管理", to: CONSOLE_ROUTES.orders, permissionCode: CONSOLE_PERMISSIONS.opsPackageManage },
      { icon: BookOpenCheck, label: "资金流水", to: CONSOLE_ROUTES.fundLedgers, permissionCode: CONSOLE_PERMISSIONS.opsBillingManage },
      { icon: HeadphonesIcon, label: "工单管理", to: CONSOLE_ROUTES.tickets, permissionCode: CONSOLE_PERMISSIONS.opsTicketManage },
      { icon: Bell, label: "消息通知", to: CONSOLE_ROUTES.notifications, permissionCode: CONSOLE_PERMISSIONS.opsNotificationManage },
      { icon: BookOpenCheck, label: "审计日志", to: CONSOLE_ROUTES.auditLogs, permissionCode: CONSOLE_PERMISSIONS.opsAuditManage },
    ],
  },
  {
    icon: Bot,
    label: "模型中枢",
    permissionCode: [
      CONSOLE_PERMISSIONS.modelHubDashboardManage,
      CONSOLE_PERMISSIONS.modelHubChannelManage,
      CONSOLE_PERMISSIONS.modelHubApiKeyManage,
      CONSOLE_PERMISSIONS.modelHubBaseModelManage,
      CONSOLE_PERMISSIONS.modelHubPoolManage,
      CONSOLE_PERMISSIONS.modelHubGuardrailManage,
      CONSOLE_PERMISSIONS.modelHubRoutingManage,
      CONSOLE_PERMISSIONS.modelHubConsumptionRecordManage,
      CONSOLE_PERMISSIONS.modelHubLogManage,
      CONSOLE_PERMISSIONS.modelHubAlertManage,
    ],
    children: [
      { icon: BarChart3, label: "模型看板", to: CONSOLE_ROUTES.modelHubDashboard, permissionCode: CONSOLE_PERMISSIONS.modelHubDashboardManage },
      { icon: Bot, label: "渠道管理", to: CONSOLE_ROUTES.modelHubChannels, permissionCode: CONSOLE_PERMISSIONS.modelHubChannelManage },
      { icon: Fingerprint, label: "API Key", to: CONSOLE_ROUTES.modelHubApiKeys, permissionCode: CONSOLE_PERMISSIONS.modelHubApiKeyManage },
      { icon: Cpu, label: "基础模型", to: CONSOLE_ROUTES.modelHubModels, permissionCode: CONSOLE_PERMISSIONS.modelHubBaseModelManage },
      { icon: Box, label: "模型池", to: CONSOLE_ROUTES.modelHubPools, permissionCode: CONSOLE_PERMISSIONS.modelHubPoolManage },
      { icon: Shield, label: "安全规则", to: CONSOLE_ROUTES.modelHubGuardrails, permissionCode: CONSOLE_PERMISSIONS.modelHubGuardrailManage },
      { icon: Globe, label: "路由管理", to: CONSOLE_ROUTES.modelHubRouting, permissionCode: CONSOLE_PERMISSIONS.modelHubRoutingManage },
      { icon: Wallet, label: "Token 消费", to: CONSOLE_ROUTES.modelHubConsumptionRecords, permissionCode: CONSOLE_PERMISSIONS.modelHubConsumptionRecordManage },
      { icon: FileText, label: "日志管理", to: CONSOLE_ROUTES.modelHubLogs, permissionCode: CONSOLE_PERMISSIONS.modelHubLogManage },
      { icon: Bell, label: "告警中心", to: CONSOLE_ROUTES.modelHubAlerts, permissionCode: CONSOLE_PERMISSIONS.modelHubAlertManage },
      { icon: Bot, label: "业务配置", to: CONSOLE_ROUTES.modelHubBizCapabilities, permissionCode: CONSOLE_PERMISSIONS.modelHubBizCapabilityManage },
    ],
  },
  {
    icon: Globe,
    label: "接入管理",
    children: [
      { icon: Cloud, label: "云服务管理", to: CONSOLE_ROUTES.integrationCloudServices, permissionCode: CONSOLE_PERMISSIONS.integrationCloudServiceManage },
      { icon: MessageSquare, label: "消息模板", to: CONSOLE_ROUTES.integrationMessageTemplates, permissionCode: CONSOLE_PERMISSIONS.integrationMessageTemplateManage },
      // { icon: BookOpenCheck, label: "知识库服务器", to: "/integration/knowledge-base-servers", permissionCode: "integration.manage" },
      // { icon: HardDrive, label: "服务器管理", to: "/integration/servers", permissionCode: "integration.manage" },
      { icon: Cpu, label: "服务器管理", to: CONSOLE_ROUTES.integrationServers, permissionCode: CONSOLE_PERMISSIONS.integrationServerManage },
    ],
  },
  {
    icon: Users,
    label: "用户管理",
    children: [
      { icon: Users, label: "用户管理", to: CONSOLE_ROUTES.userManagement, permissionCode: CONSOLE_PERMISSIONS.userAccountManage },
      { icon: Building2, label: "商户管理", to: "/ums/merchants", permissionCode: CONSOLE_PERMISSIONS.merchantManage },
      { icon: Building2, label: "门店管理", to: "/ums/stores", permissionCode: CONSOLE_PERMISSIONS.storeManage },
    ],
  },
  {
    icon: Settings,
    label: "系统配置",
    children: [
      { icon: Shield, label: "权限管理", to: CONSOLE_ROUTES.permissionManagement, permissionCode: CONSOLE_PERMISSIONS.iamRbacManage },
      { icon: Users, label: "角色管理", to: CONSOLE_ROUTES.roleManagement, permissionCode: CONSOLE_PERMISSIONS.iamRbacManage },
      { icon: HardDrive, label: "存储配置", to: CONSOLE_ROUTES.systemStorage, permissionCode: CONSOLE_PERMISSIONS.sysStorageManage },
      { icon: CreditCard, label: "支付配置", to: "/sys/payments", permissionCode: CONSOLE_PERMISSIONS.sysPaymentManage },
      { icon: MessageSquare, label: "公众号配置", to: "/sys/wechat-official", permissionCode: CONSOLE_PERMISSIONS.sysWechatManage },
      { icon: Smartphone, label: "小程序配置", to: "/sys/mini-program", permissionCode: CONSOLE_PERMISSIONS.sysMiniProgramManage },
      { icon: LogIn, label: "登录配置", to: "/sys/login-config", permissionCode: CONSOLE_PERMISSIONS.sysLoginManage },
      { icon: Shield, label: "隐私政策", to: "/sys/privacy-policy", permissionCode: CONSOLE_PERMISSIONS.sysLegalManage },
      { icon: FileText, label: "用户协议", to: "/sys/user-agreement", permissionCode: CONSOLE_PERMISSIONS.sysLegalManage },
      // { icon: Search, label: "SEO/GEO", to: "/sys/seo-geo", permissionCode: "sys.login.manage" },
      { icon: Fingerprint, label: "隐私水印", to: "/sys/watermark", permissionCode: CONSOLE_PERMISSIONS.sysWatermarkManage },
      { icon: Radio, label: "在线用户", to: CONSOLE_ROUTES.systemOnlineUsers, permissionCode: CONSOLE_PERMISSIONS.sysOnlineUserManage },
    ],
  },
];

const AppSidebar = memo(() => {
  const containerRef = useRef<HTMLElement | null>(null);
  const [expandedGroups, setExpandedGroups] = useState(() => readExpandedGroupsFromStorage());
  const permissionsQuery = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const permissionSet = useMemo(
    () => buildPermissionSetForNamespace(CONSOLE_PERMISSION_NAMESPACE, permissionsQuery.data?.permissions ?? []),
    [permissionsQuery.data?.permissions],
  );

  const visibleMenuItems = useMemo(() => {
    return menuItems
      .map((item) => {
        if (!item.children) {
          return hasPermission(permissionSet, item.permissionCode) ? item : null;
        }
        const children = item.children.filter((c) => hasPermission(permissionSet, c.permissionCode));
        if (children.length === 0) return null;
        if (!hasPermission(permissionSet, item.permissionCode)) return null;
        return { ...item, children };
      })
      .filter(Boolean) as MenuItem[];
  }, [permissionSet]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      writeExpandedGroupsToStorage(next);
      window.requestAnimationFrame(() => {
        if (containerRef.current) {
          writeSidebarScrollTopToStorage(containerRef.current.scrollTop);
        }
      });
      return next;
    });
  };

  const persistSidebarScrollPosition = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    writeSidebarScrollTopToStorage(containerRef.current.scrollTop);
  }, []);

  const setContainerRef = useCallback((node: HTMLElement | null) => {
    containerRef.current = node;
    if (!node) return;

    const persistedScrollTop = readSidebarScrollTopFromStorage();
    node.scrollTop = persistedScrollTop;

    window.requestAnimationFrame(() => {
      if (containerRef.current === node) {
        node.scrollTop = persistedScrollTop;
      }
    });
  }, []);

  return (
    <aside
      ref={setContainerRef}
      onScroll={persistSidebarScrollPosition}
      className="w-[188px] lg:w-[220px] h-[calc(100vh-56px)] border-r border-border bg-background flex flex-col shrink-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-2"
    >
      <div className="py-2">
        {visibleMenuItems.map((item) => {
          const hasChildren = !!item.children;
          const isExpanded = expandedGroups.includes(item.label);

          return (
            <div key={item.label}>
              {hasChildren ? (
                <div
                  className={hasChildren ? "sidebar-group-item" : "sidebar-nav-item"}
                  onClick={() => toggleGroup(item.label)}
                >
                  <span className="flex-1">{item.label}</span>
                  <ChevronUp
                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "" : "rotate-180"}`}
                  />
                </div>
              ) : (
                <NavLink
                  to={item.to!}
                  onClick={persistSidebarScrollPosition}
                  className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
                >
                  <item.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              )}

              {hasChildren && isExpanded && (
                <div className="ml-2 mb-2">
                  {item.children!.map((child) => (
                    <NavLink
                      key={child.label}
                      to={child.to}
                      onClick={persistSidebarScrollPosition}
                      className={({ isActive }) => `sidebar-sub-nav-item ${isActive ? "active" : ""}`}
                    >
                      <child.icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
});

export default AppSidebar;
