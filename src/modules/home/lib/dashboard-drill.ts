import { CONSOLE_ROUTES } from "@/shared/lib/permissions";

export type DashboardDrillKey =
  | "stores"
  | "merchants"
  | "users"
  | "tasks"
  | "tasksFailed"
  | "tasksActive"
  | "orders"
  | "fund"
  | "tickets"
  | "ticketsOverdue"
  | "comfy"
  | "modelhub"
  | "taskTrend"
  | "revenueTrend"
  | "health"
  | "storeRank"
  | "failedWorkflows";

export type DashboardDrillTarget = {
  key: DashboardDrillKey;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  panel: "tasks" | "tickets" | "health" | "stores" | "revenue" | "workflows" | "none";
};

const SCHEDULER_TASKS = "/app/scheduler/tasks";
const STORES = "/ums/stores";
const MERCHANTS = "/ums/merchants";

const DRILL_MAP: Record<DashboardDrillKey, DashboardDrillTarget> = {
  stores: {
    key: "stores",
    title: "门店",
    description: "查看活跃门店与会员规模",
    href: STORES,
    hrefLabel: "打开门店管理",
    panel: "stores",
  },
  merchants: {
    key: "merchants",
    title: "商户",
    description: "查看活跃商户列表",
    href: MERCHANTS,
    hrefLabel: "打开商户管理",
    panel: "none",
  },
  users: {
    key: "users",
    title: "用户",
    description: "跳转用户列表查看账号状态",
    href: CONSOLE_ROUTES.userManagement,
    hrefLabel: "打开用户管理",
    panel: "none",
  },
  tasks: {
    key: "tasks",
    title: "任务总览",
    description: "区间任务量、成功率与异常明细",
    href: SCHEDULER_TASKS,
    hrefLabel: "打开任务列表",
    panel: "tasks",
  },
  tasksFailed: {
    key: "tasksFailed",
    title: "失败任务",
    description: "优先处理近期失败与超时任务",
    href: SCHEDULER_TASKS,
    hrefLabel: "打开任务列表",
    panel: "tasks",
  },
  tasksActive: {
    key: "tasksActive",
    title: "排队积压",
    description: "当前 status=queued 的任务",
    href: SCHEDULER_TASKS,
    hrefLabel: "打开任务列表",
    panel: "health",
  },
  orders: {
    key: "orders",
    title: "订单实收",
    description: "已支付充值订单与收入趋势",
    href: CONSOLE_ROUTES.orders,
    hrefLabel: "打开订单管理",
    panel: "revenue",
  },
  fund: {
    key: "fund",
    title: "资金消耗",
    description: "资金流水 OUT 合计与日趋势",
    href: CONSOLE_ROUTES.fundLedgers,
    hrefLabel: "打开资金流水",
    panel: "revenue",
  },
  tickets: {
    key: "tickets",
    title: "待处理工单",
    description: "未关闭工单与超时清单",
    href: CONSOLE_ROUTES.tickets,
    hrefLabel: "打开工单中心",
    panel: "tickets",
  },
  ticketsOverdue: {
    key: "ticketsOverdue",
    title: "超时工单",
    description: "超过 SLA（默认 24h）仍未关闭的工单",
    href: CONSOLE_ROUTES.tickets,
    hrefLabel: "打开工单中心",
    panel: "tickets",
  },
  comfy: {
    key: "comfy",
    title: "算力节点",
    description: "ComfyUI 节点在线与负载状态",
    href: CONSOLE_ROUTES.integrationServers,
    hrefLabel: "打开服务器管理",
    panel: "health",
  },
  modelhub: {
    key: "modelhub",
    title: "模型中枢",
    description: "渠道、调用与成本详情见模型看板",
    href: CONSOLE_ROUTES.modelHubDashboard,
    hrefLabel: "打开模型看板",
    panel: "none",
  },
  taskTrend: {
    key: "taskTrend",
    title: "任务趋势",
    description: "按日提交 / 成功 / 失败",
    href: SCHEDULER_TASKS,
    hrefLabel: "打开任务列表",
    panel: "tasks",
  },
  revenueTrend: {
    key: "revenueTrend",
    title: "收入与消耗",
    description: "订单实收与资金 OUT 日趋势",
    href: CONSOLE_ROUTES.orders,
    hrefLabel: "打开订单管理",
    panel: "revenue",
  },
  health: {
    key: "health",
    title: "运行健康",
    description: "队列、耗时与节点健康",
    href: CONSOLE_ROUTES.integrationServers,
    hrefLabel: "打开服务器管理",
    panel: "health",
  },
  storeRank: {
    key: "storeRank",
    title: "门店排行",
    description: "按绑定用户数排序的活跃门店",
    href: STORES,
    hrefLabel: "打开门店管理",
    panel: "stores",
  },
  failedWorkflows: {
    key: "failedWorkflows",
    title: "失败工作流",
    description: "区间内失败次数最多的应用",
    href: SCHEDULER_TASKS,
    hrefLabel: "打开任务列表",
    panel: "workflows",
  },
};


export function resolveDashboardDrill(key: string | null | undefined): DashboardDrillTarget | null {
  if (!key) return null;
  return DRILL_MAP[key as DashboardDrillKey] ?? null;
}
