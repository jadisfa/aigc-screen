import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import type { DashboardRangeDays } from "@/shared/api/ops/dashboard";
import { DashboardDrillSheet } from "@/modules/home/components/DashboardDrillSheet";
import { DashboardFailedWorkflowPanel } from "@/modules/home/components/DashboardFailedWorkflowPanel";
import { DashboardHealthPanel } from "@/modules/home/components/DashboardHealthPanel";
import { DashboardKpiRow } from "@/modules/home/components/DashboardKpiRow";
import { DashboardModelHubSummary } from "@/modules/home/components/DashboardModelHubSummary";
import { DashboardStoreRankPanel } from "@/modules/home/components/DashboardStoreRankPanel";
import { DashboardTrendCharts } from "@/modules/home/components/DashboardTrendCharts";
import {
  useDashboardOverview,
  useDashboardOverviewActions,
} from "@/modules/home/hooks/useDashboardOverview";
import { resolveDashboardDrill, type DashboardDrillTarget } from "@/modules/home/lib/dashboard-drill";
import { PageHeader, PageShell } from "@/shared/components/page";
import { formatDateTime } from "@/shared/lib/datetime";
import { notify } from "@/shared/lib/notify";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export default function DashboardPage() {
  const [rangeDays, setRangeDays] = useState<DashboardRangeDays>(30);
  const [drill, setDrill] = useState<DashboardDrillTarget | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, startTransition] = useTransition();
  const lastErrorKeyRef = useRef<string | null>(null);

  const overviewQuery = useDashboardOverview(rangeDays);
  const actions = useDashboardOverviewActions(rangeDays);

  useEffect(() => {
    if (!overviewQuery.error) {
      lastErrorKeyRef.current = null;
      return;
    }
    const key =
      overviewQuery.error instanceof Error
        ? `${overviewQuery.error.name}:${overviewQuery.error.message}`
        : String(overviewQuery.error);
    if (lastErrorKeyRef.current === key) return;
    lastErrorKeyRef.current = key;
    notify.fromError(overviewQuery.error, "无法加载运营概览，请稍后重试");
  }, [overviewQuery.error]);

  const data = overviewQuery.data;
  const loading = overviewQuery.isLoading && !data;

  const openDrill = (drillKey: string) => {
    const target = resolveDashboardDrill(drillKey);
    if (!target) return;
    startTransition(() => {
      setDrill(target);
      setSheetOpen(true);
    });
  };

  const handleRangeChange = (value: string) => {
    const next = Number(value) as DashboardRangeDays;
    if (next === 7 || next === 30 || next === 90) {
      startTransition(() => setRangeDays(next));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await actions.refresh();
    } catch (error) {
      notify.fromError(error, "刷新概览失败，请稍后重试");
    } finally {
      setRefreshing(false);
    }
  };

  const generatedLabel = useMemo(() => {
    if (!data?.generatedAt) return null;
    return formatDateTime(data.generatedAt);
  }, [data?.generatedAt]);

  return (
    <PageShell>
      <PageHeader
        title="数据看板"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {generatedLabel ? (
              <span className="mr-1 text-[13px] leading-8 text-muted-foreground">
                更新于 {generatedLabel}
              </span>
            ) : null}
            <Select value={String(rangeDays)} onValueChange={handleRangeChange}>
              <SelectTrigger className="subpage-native-select h-8 w-[110px] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="subpage-select-content">
                <SelectItem className="subpage-select-item" value="7">
                  近 7 天
                </SelectItem>
                <SelectItem className="subpage-select-item" value="30">
                  近 30 天
                </SelectItem>
                <SelectItem className="subpage-select-item" value="90">
                  近 90 天
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="pageOutline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={refreshing || overviewQuery.isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing || overviewQuery.isFetching ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>
        }
      />

      <div className="dashboard-stack">
        <DashboardKpiRow
          items={data?.kpis ?? []}
          alerts={data?.alerts ?? []}
          loading={loading}
          onDrill={openDrill}
        />

        <DashboardModelHubSummary />

        <DashboardTrendCharts
          taskTrend={data?.taskTrend ?? []}
          revenueTrend={data?.revenueTrend ?? []}
          loading={loading}
          onTaskDrill={() => openDrill("taskTrend")}
          onRevenueDrill={() => openDrill("revenueTrend")}
        />

        <div className="dashboard-bottom-grid">
          <DashboardFailedWorkflowPanel
            items={data?.failedWorkflowTop ?? []}
            loading={loading}
            rangeDays={rangeDays}
            onRangeChange={handleRangeChange}
            onDrill={() => openDrill("failedWorkflows")}
          />
          <DashboardHealthPanel
            health={data?.health}
            loading={loading}
            onHealthDrill={() => openDrill("health")}
          />
          <DashboardStoreRankPanel
            items={data?.storeRank ?? []}
            loading={loading}
            rangeDays={rangeDays}
            onRangeChange={handleRangeChange}
            onDrill={() => openDrill("storeRank")}
          />
        </div>
      </div>

      <DashboardDrillSheet open={sheetOpen} onOpenChange={setSheetOpen} target={drill} data={data} />
    </PageShell>
  );
}
