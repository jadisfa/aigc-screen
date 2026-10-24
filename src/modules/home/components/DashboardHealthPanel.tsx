import { memo } from "react";
import type { DashboardHealth } from "@/shared/api/ops/dashboard";
import { formatNumber, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

type DashboardHealthPanelProps = {
  health: DashboardHealth | undefined;
  loading?: boolean;
  onHealthDrill: () => void;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] leading-none text-muted-foreground">{label}</div>
      <div className="mt-1.5 truncate text-[15px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}

function isOnline(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "online" || normalized === "ok" || normalized.includes("online");
}

function DashboardHealthPanelInner({ health, loading, onHealthDrill }: DashboardHealthPanelProps) {
  const servers = (health?.servers ?? []).slice(0, 6);

  return (
    <section className="dashboard-block flex h-full min-h-[320px] flex-col">
      <div className="dashboard-section-bar">
        <h2 className="dashboard-section-title">运行健康</h2>
      </div>

      <div className="min-h-0 flex-1">
        {loading || !health ? (
          <div className="h-full min-h-[220px] animate-pulse rounded-lg bg-muted/30" />
        ) : (
          <div className="flex h-full flex-col gap-4">
            <div className="grid grid-cols-3 gap-x-3 gap-y-4">
              <Metric label="排队积压" value={formatNumber(health.queueLength)} />
              <Metric label="执行中" value={formatNumber(health.runningCount ?? 0)} />
              <Metric
                label="平均耗时"
                value={`${formatNumber(health.avgTaskDurationSec, { maximumFractionDigits: 1 })}s`}
              />
              <Metric label="终态成功率" value={formatPercent(health.taskSuccessRate, 1)} />
              <Metric
                label="在线节点"
                value={`${formatNumber(health.comfyOnlineCount)}/${formatNumber(health.comfyEnabledCount)}`}
              />
              <Metric label="异常节点" value={formatNumber(health.comfyUnhealthyCount)} />
            </div>

            <div className="min-h-0 flex-1">
              <div className="mb-2 grid grid-cols-2 gap-x-6 text-[12px] text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>节点</span>
                  <span>状态</span>
                </div>
                <div className="hidden items-center justify-between gap-2 sm:flex">
                  <span>节点</span>
                  <span>状态</span>
                </div>
              </div>
              {servers.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-muted-foreground">暂无启用节点</div>
              ) : (
                <div className="grid grid-cols-1 gap-x-6 gap-y-4 py-2 sm:grid-cols-2">
                  {servers.map((server) => {
                    const online = isOnline(server.onlineStatus);
                    return (
                      <div
                        key={server.name}
                        className="flex items-center py-2 justify-between gap-2 border-b border-border/50 py-1.5 text-[13px] last:border-b-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-b-0"
                      >
                        <span className="min-w-0 truncate font-medium text-foreground">{server.name}</span>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1.5",
                            online ? "text-success-foreground" : "text-destructive",
                          )}
                        >
                          <span
                            className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-success" : "bg-destructive")}
                          />
                          {server.onlineStatus || "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-panel-footer">
        <button type="button" onClick={onHealthDrill} className="dashboard-panel-link">
          查看全部节点
        </button>
      </div>
    </section>
  );
}

export const DashboardHealthPanel = memo(DashboardHealthPanelInner);
