import { memo } from "react";
import type { DashboardFailedWorkflow, DashboardRangeDays } from "@/shared/api/ops/dashboard";
import { TableSurface } from "@/shared/components/page";
import { formatNumber } from "@/shared/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

type DashboardFailedWorkflowPanelProps = {
  items: DashboardFailedWorkflow[];
  loading?: boolean;
  rangeDays: DashboardRangeDays;
  onRangeChange: (value: string) => void;
  onDrill: () => void;
};

function DashboardFailedWorkflowPanelInner({
  items,
  loading,
  rangeDays,
  onRangeChange,
  onDrill,
}: DashboardFailedWorkflowPanelProps) {
  return (
    <section className="dashboard-block flex h-full min-h-[320px] flex-col">
      <div className="dashboard-section-bar">
        <h2 className="dashboard-section-title">失败工作流 TOP</h2>
        <Select value={String(rangeDays)} onValueChange={onRangeChange}>
          <SelectTrigger className="dashboard-range-select">
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
      </div>

      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="h-full min-h-[220px] animate-pulse rounded-lg bg-muted/30" />
        ) : items.length === 0 ? (
          <div className="dashboard-empty">
            <p className="text-[13px] text-muted-foreground">区间内暂无失败工作流</p>
          </div>
        ) : (
          <TableSurface>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-muted-foreground">#</TableHead>
                  <TableHead className="text-muted-foreground">工作流</TableHead>
                  <TableHead className="text-right text-muted-foreground">失败</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.slice(0, 5).map((item, index) => (
                  <TableRow key={`${item.workflowId}-${item.workflowName}`}>
                    <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="max-w-[180px] truncate font-medium" title={item.workflowName}>
                        {item.workflowName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-destructive">
                      {formatNumber(item.failedCount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableSurface>
        )}
      </div>

      <div className="dashboard-panel-footer">
        <button type="button" onClick={onDrill} className="dashboard-panel-link">
          查看全部
        </button>
      </div>
    </section>
  );
}

export const DashboardFailedWorkflowPanel = memo(DashboardFailedWorkflowPanelInner);
