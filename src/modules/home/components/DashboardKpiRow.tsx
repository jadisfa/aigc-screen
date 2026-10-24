import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  ClipboardList,
  Cpu,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DashboardAlertItem, DashboardKpiCard } from "@/shared/api/ops/dashboard";
import { formatCurrency, formatNumber, formatPercent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

type DomainMetric = {
  key: string;
  label: string;
  valueText: string;
  drillKey: string;
  delta: number | null;
  hot: boolean;
};

type DomainGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  accentClass: string;
  metrics: DomainMetric[];
};

type DashboardKpiRowProps = {
  items: DashboardKpiCard[];
  alerts?: DashboardAlertItem[];
  loading?: boolean;
  onDrill: (drillKey: string) => void;
};

const DOMAIN_DEFS: Array<{
  id: string;
  title: string;
  icon: LucideIcon;
  accentClass: string;
  kpiIds: string[];
  alertIds: string[];
}> = [
  {
    id: "scale",
    title: "平台规模",
    icon: Building2,
    accentClass: "text-primary bg-primary/10",
    kpiIds: ["merchants", "stores", "users"],
    alertIds: [],
  },
  {
    id: "tasks",
    title: "任务运行",
    icon: ClipboardList,
    accentClass: "text-info bg-info/10",
    kpiIds: ["tasks", "successRate"],
    alertIds: ["failed-tasks", "queue-backlog"],
  },
  {
    id: "fund",
    title: "资金往来",
    icon: Wallet,
    accentClass: "text-warning-foreground bg-warning/10",
    kpiIds: ["revenue", "consumption"],
    alertIds: [],
  },
  {
    id: "ops",
    title: "服务运维",
    icon: Cpu,
    accentClass: "text-success-foreground bg-success/10",
    kpiIds: ["tickets"],
    alertIds: ["overdue-tickets", "comfy-unhealthy"],
  },
];

function formatKpiValue(item: DashboardKpiCard): string {
  if (item.unit === "currency") return formatCurrency(Number(item.value), "CNY");
  if (item.unit === "percent") return formatPercent(Number(item.value), 1);
  return formatNumber(Number(item.value));
}

function buildDomains(items: DashboardKpiCard[], alerts: DashboardAlertItem[]): DomainGroup[] {
  const kpiMap = new Map(items.map((item) => [item.id, item]));
  const alertMap = new Map(alerts.map((item) => [item.id, item]));

  return DOMAIN_DEFS.map((domain) => {
    const metrics: DomainMetric[] = [];
    for (const kpiId of domain.kpiIds) {
      const kpi = kpiMap.get(kpiId);
      if (!kpi) continue;
      metrics.push({
        key: `kpi:${kpi.id}`,
        label: kpi.label,
        valueText: formatKpiValue(kpi),
        drillKey: kpi.drillKey,
        delta: kpi.delta,
        hot: false,
      });
    }
    for (const alertId of domain.alertIds) {
      const alert = alertMap.get(alertId);
      if (!alert) continue;
      metrics.push({
        key: `alert:${alert.id}`,
        label: alert.label,
        valueText: formatNumber(alert.count),
        drillKey: alert.drillKey,
        delta: null,
        hot: alert.severity === "warning" || alert.severity === "critical",
      });
    }
    return {
      id: domain.id,
      title: domain.title,
      icon: domain.icon,
      accentClass: domain.accentClass,
      metrics,
    };
  }).filter((domain) => domain.metrics.length > 0);
}

export function DashboardKpiRow({ items, alerts = [], loading, onDrill }: DashboardKpiRowProps) {
  const domains = useMemo(() => buildDomains(items, alerts), [items, alerts]);

  if (loading) {
    return (
      <div className="dashboard-domain-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[200px] animate-pulse rounded-xl border border-border/80 bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="dashboard-domain-grid">
      {domains.map((domain) => {
        const Icon = domain.icon;
        return (
          <section key={domain.id} className="dashboard-block flex flex-col">
            <div className="mb-3 flex items-center gap-2.5">
              <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", domain.accentClass)}>
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="text-[14px] font-semibold text-foreground">{domain.title}</h3>
            </div>
            <div className="flex flex-1 flex-col">
              {domain.metrics.map((metric) => {
                const up = metric.delta != null && metric.delta >= 0;
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => onDrill(metric.drillKey)}
                    className="group dashboard-domain-metric"
                    aria-label={`${metric.label}：${metric.valueText}`}
                  >
                    <span className="min-w-0 truncate text-[13px] text-muted-foreground">{metric.label}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                      {metric.delta != null ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
                            up ? "text-success-foreground" : "text-destructive",
                          )}
                        >
                          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(metric.delta).toFixed(1)}%
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "text-[15px] font-semibold tabular-nums",
                          metric.hot ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {metric.valueText}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
