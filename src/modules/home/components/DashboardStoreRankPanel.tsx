import { memo } from "react";
import type { DashboardRangeDays, DashboardStoreRank } from "@/shared/api/ops/dashboard";
import { TableSurface } from "@/shared/components/page";
import { formatNumber } from "@/shared/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import emptyStoreImg from "@/modules/home/assets/dashboard-empty-store-v3.png";

type DashboardStoreRankPanelProps = {
  items: DashboardStoreRank[];
  loading?: boolean;
  rangeDays: DashboardRangeDays;
  onRangeChange: (value: string) => void;
  onDrill: () => void;
};

function DashboardStoreRankPanelInner({
  items,
  loading,
  rangeDays,
  onRangeChange,
  onDrill,
}: DashboardStoreRankPanelProps) {
  return (
    <section className="dashboard-block flex h-full min-h-[320px] flex-col">
      <div className="dashboard-section-bar">
        <h2 className="dashboard-section-title">门店会员 TOP</h2>
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
            <img src={emptyStoreImg} alt="" className="dashboard-empty-image" />
            <p className="text-[13px] text-muted-foreground">暂无门店数据</p>
          </div>
        ) : (
          <TableSurface>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-muted-foreground">#</TableHead>
                  <TableHead className="text-muted-foreground">门店</TableHead>
                  <TableHead className="text-right text-muted-foreground">会员</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.slice(0, 5).map((store, index) => (
                  <TableRow key={store.name}>
                    <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="max-w-[160px] truncate font-medium">{store.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(store.memberCount)}
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

export const DashboardStoreRankPanel = memo(DashboardStoreRankPanelInner);
