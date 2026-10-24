import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardRevenueTrendPoint, DashboardTaskTrendPoint } from "@/shared/api/ops/dashboard";
import { formatCurrency, formatNumber } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";

type DashboardTrendChartsProps = {
  taskTrend: DashboardTaskTrendPoint[];
  revenueTrend: DashboardRevenueTrendPoint[];
  loading?: boolean;
  onTaskDrill: () => void;
  onRevenueDrill: () => void;
};

const axisTick = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const gridStroke = "hsl(var(--border))";
/** Keep chart SVG nodes bounded; aggregate (sum) buckets instead of dropping days. */
const MAX_CHART_POINTS = 45;

function aggregateTaskTrend(rows: DashboardTaskTrendPoint[]): DashboardTaskTrendPoint[] {
  if (rows.length <= MAX_CHART_POINTS) return rows;
  const bucketSize = Math.ceil(rows.length / MAX_CHART_POINTS);
  const result: DashboardTaskTrendPoint[] = [];
  for (let i = 0; i < rows.length; i += bucketSize) {
    const chunk = rows.slice(i, i + bucketSize);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    result.push({
      date: chunk.length === 1 ? first.date : `${first.date}~${last.date}`,
      dateKey: `${first.dateKey}_${last.dateKey}`,
      submitted: chunk.reduce((sum, row) => sum + row.submitted, 0),
      succeeded: chunk.reduce((sum, row) => sum + row.succeeded, 0),
      failed: chunk.reduce((sum, row) => sum + row.failed, 0),
    });
  }
  return result;
}

function aggregateRevenueTrend(rows: DashboardRevenueTrendPoint[]): DashboardRevenueTrendPoint[] {
  if (rows.length <= MAX_CHART_POINTS) return rows;
  const bucketSize = Math.ceil(rows.length / MAX_CHART_POINTS);
  const result: DashboardRevenueTrendPoint[] = [];
  for (let i = 0; i < rows.length; i += bucketSize) {
    const chunk = rows.slice(i, i + bucketSize);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    result.push({
      date: chunk.length === 1 ? first.date : `${first.date}~${last.date}`,
      dateKey: `${first.dateKey}_${last.dateKey}`,
      paidAmount: chunk.reduce((sum, row) => sum + row.paidAmount, 0),
      outflowAmount: chunk.reduce((sum, row) => sum + row.outflowAmount, 0),
    });
  }
  return result;
}

function ChartSkeleton() {
  return <div className="h-[220px] animate-pulse rounded-lg bg-muted/30" />;
}

function DashboardTrendChartsInner({
  taskTrend,
  revenueTrend,
  loading,
  onTaskDrill,
  onRevenueDrill,
}: DashboardTrendChartsProps) {
  const taskSeries = useMemo(() => aggregateTaskTrend(taskTrend), [taskTrend]);
  const revenueSeries = useMemo(() => aggregateRevenueTrend(revenueTrend), [revenueTrend]);

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <section className="dashboard-block">
        <div className="dashboard-section-bar">
          <h2 className="dashboard-section-title">任务趋势</h2>
          <Button type="button" variant="pageOutline" size="sm" onClick={onTaskDrill}>
            明细
          </Button>
        </div>
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  formatter={(value: number) => formatNumber(value)}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="succeeded" name="成功" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" name="失败" stackId="a" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="dashboard-block">
        <div className="dashboard-section-bar">
          <h2 className="dashboard-section-title">收入与消耗</h2>
          <Button type="button" variant="pageOutline" size="sm" onClick={onRevenueDrill}>
            明细
          </Button>
        </div>
        {loading ? (
          <ChartSkeleton />
        ) : (
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="dashOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, "CNY")}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="paidAmount"
                  name="订单实收"
                  stroke="hsl(var(--primary))"
                  fill="url(#dashPaid)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="outflowAmount"
                  name="资金消耗"
                  stroke="hsl(var(--warning))"
                  fill="url(#dashOut)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}

/** Memoized: charts are expensive; skip re-render when trend arrays are referentially stable. */
export const DashboardTrendCharts = memo(DashboardTrendChartsInner);
