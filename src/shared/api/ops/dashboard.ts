import { apiFetch } from "@/shared/api/sys/http";

export type DashboardRangeDays = 7 | 30 | 90;

export type DashboardKpiCard = {
  id: string;
  label: string;
  value: number;
  unit: "count" | "currency" | string;
  delta: number | null;
  helper: string;
  drillKey: string;
};

export type DashboardAlertItem = {
  id: string;
  label: string;
  count: number;
  severity: "ok" | "info" | "warning" | "critical" | string;
  drillKey: string;
};

export type DashboardTaskTrendPoint = {
  date: string;
  dateKey: string;
  submitted: number;
  succeeded: number;
  failed: number;
};

export type DashboardRevenueTrendPoint = {
  date: string;
  dateKey: string;
  paidAmount: number;
  outflowAmount: number;
};

export type DashboardServerHealth = {
  name: string;
  onlineStatus: string;
  loadStatus: string;
  enabled: boolean;
  gpuCount: number;
  tone: "healthy" | "warning" | "error" | string;
};

export type DashboardHealth = {
  queueLength: number;
  runningCount: number;
  avgTaskDurationSec: number;
  taskSuccessRate: number;
  comfyEnabledCount: number;
  comfyOnlineCount: number;
  comfyUnhealthyCount: number;
  servers: DashboardServerHealth[];
};

export type DashboardAbnormalTask = {
  id: string;
  name: string;
  status: string;
  durationSec: number;
  submittedAt: string;
};

export type DashboardOverdueTicket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  openHours: number;
  createdAt: string;
};

export type DashboardStoreRank = {
  name: string;
  memberCount: number;
};

export type DashboardFailedWorkflow = {
  workflowId: string;
  workflowName: string;
  failedCount: number;
};

export type DashboardOverview = {
  rangeDays: number;
  timezone?: string;
  generatedAt: string;
  cacheTtlSeconds: number;
  kpis: DashboardKpiCard[];
  alerts: DashboardAlertItem[];
  taskTrend: DashboardTaskTrendPoint[];
  revenueTrend: DashboardRevenueTrendPoint[];
  health: DashboardHealth;
  abnormalTasks: DashboardAbnormalTask[];
  overdueTickets: DashboardOverdueTicket[];
  storeRank: DashboardStoreRank[];
  failedWorkflowTop?: DashboardFailedWorkflow[];
};

const BASE = "/api/admin/ops/dashboard";

export async function getDashboardOverview(rangeDays: DashboardRangeDays): Promise<DashboardOverview> {
  const qs = new URLSearchParams({ rangeDays: String(rangeDays) });
  return apiFetch<DashboardOverview>(`${BASE}/overview?${qs.toString()}`, { method: "GET" });
}

export async function refreshDashboardOverview(rangeDays: DashboardRangeDays): Promise<DashboardOverview> {
  const qs = new URLSearchParams({ rangeDays: String(rangeDays) });
  return apiFetch<DashboardOverview>(`${BASE}/overview/refresh?${qs.toString()}`, { method: "POST" });
}
