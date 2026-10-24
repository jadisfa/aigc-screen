import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Cpu, ListTodo, Ticket, Wallet } from "lucide-react";
import { getModelHubDashboard } from "@/shared/api/model-hub/model-hub";
import { useMePermissions } from "@/shared/hooks/use-me-permissions";
import {
  buildPermissionSetForNamespace,
  CONSOLE_PERMISSION_NAMESPACE,
  CONSOLE_PERMISSIONS,
  CONSOLE_ROUTES,
  hasPermission,
} from "@/shared/lib/permissions";
import { formatCurrency, formatNumber, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

const QUICK_LINKS = [
  { to: CONSOLE_ROUTES.modelHubDashboard, label: "模型看板", icon: Cpu },
  { to: "/app/scheduler/tasks", label: "任务列表", icon: ListTodo },
  { to: CONSOLE_ROUTES.tickets, label: "工单中心", icon: Ticket },
  { to: CONSOLE_ROUTES.fundLedgers, label: "资金流水", icon: Wallet },
] as const;

type DashboardModelHubSummaryProps = {
  enabled?: boolean;
};

export function DashboardModelHubSummary({ enabled = true }: DashboardModelHubSummaryProps) {
  const permissionsQuery = useMePermissions({ sourceCode: CONSOLE_PERMISSION_NAMESPACE.sourceCode });
  const permissionSet = useMemo(
    () => buildPermissionSetForNamespace(CONSOLE_PERMISSION_NAMESPACE, permissionsQuery.data?.permissions ?? []),
    [permissionsQuery.data?.permissions],
  );
  const canView = hasPermission(permissionSet, CONSOLE_PERMISSIONS.modelHubDashboardManage);

  const query = useQuery({
    queryKey: ["modelhub", "dashboard", "platform-embed"],
    queryFn: () => getModelHubDashboard(),
    enabled: enabled && canView,
    staleTime: 45_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const stats = query.data?.stats;
  const highlights = query.data?.highlights;
  const loading = query.isLoading && !query.data;

  const metrics = canView
    ? [
        {
          label: "今日调用",
          value: formatNumber(stats?.todayCallCount),
          helper: `成功率 ${formatPercent(stats?.todaySuccessRate)}`,
          hot: false,
        },
        {
          label: "今日成本",
          value: formatCurrency(stats?.todayCost, stats?.currency),
          helper: `渠道 ${formatNumber(stats?.onlineChannelCount)}`,
          hot: false,
        },
        {
          label: "余额告警",
          value: formatNumber(highlights?.balanceAlertCount),
          hot: (highlights?.balanceAlertCount ?? 0) > 0,
        },
        {
          label: "护栏命中",
          value: formatNumber(highlights?.guardrailEventCount),
          hot: (highlights?.guardrailEventCount ?? 0) > 0,
        },
        {
          label: "路由异常",
          value: formatNumber(highlights?.routingAnomalyCount),
          hot: (highlights?.routingAnomalyCount ?? 0) > 0,
        },
      ]
    : [];

  return (
    <section className="dashboard-block">
      <div className="dashboard-section-bar mb-0">
        <h2 className="dashboard-section-title">模型中枢</h2>
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Button key={link.to} asChild variant="pageOutline" size="sm">
                <Link to={link.to} className="gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </div>

      {!canView ? null : loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-[76px] animate-pulse rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="mt-3 text-[13px] text-muted-foreground">模型看板暂不可用</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((item) => (
            <div key={item.label} className="flex min-h-[76px] flex-col justify-center rounded-lg bg-muted/25 px-3.5 py-3.5">
              <div className="text-[14px] leading-none text-muted-foreground">{item.label}</div>
              <div
                className={cn(
                  "mt-2.5 text-[18px] font-semibold leading-none tabular-nums",
                  item.hot ? "text-destructive" : "text-foreground",
                )}
              >
                {item.value}
              </div>
              {item.helper ? (
                <div className="mt-2.5 truncate text-[13px] text-muted-foreground">{item.helper}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
