import { Link } from "react-router-dom";
import type { DashboardOverview } from "@/shared/api/ops/dashboard";
import type { DashboardDrillTarget } from "@/modules/home/lib/dashboard-drill";
import { StatusBadge, statusToneFromCode, TableSurface } from "@/shared/components/page";
import { formatCurrency, formatLatencyMs, formatNumber } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

type DashboardDrillSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DashboardDrillTarget | null;
  data: DashboardOverview | undefined;
};

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-[12px] text-muted-foreground">
      {text}
    </div>
  );
}

export function DashboardDrillSheet({ open, onOpenChange, target, data }: DashboardDrillSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{target?.title ?? "明细"}</SheetTitle>
          <SheetDescription>{target?.description ?? "从总览下钻查看明细"}</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {target ? (
            <Button asChild variant="page" className="w-full">
              <Link to={target.href}>{target.hrefLabel}</Link>
            </Button>
          ) : null}

          {target?.panel === "tasks" ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">异常任务 TOP</h3>
              {(data?.abnormalTasks ?? []).length === 0 ? (
                <EmptyHint text="暂无异常任务" />
              ) : (
                <TableSurface>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">耗时</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.abnormalTasks ?? []).map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div className="max-w-[180px] truncate font-medium">{task.name}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{task.id}</div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone={statusToneFromCode(task.status)}>{task.status}</StatusBadge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatLatencyMs(task.durationSec * 1000)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableSurface>
              )}
            </section>
          ) : null}

          {target?.panel === "tickets" ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">超时工单 TOP</h3>
              {(data?.overdueTickets ?? []).length === 0 ? (
                <EmptyHint text="暂无超时工单" />
              ) : (
                <TableSurface>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>工单</TableHead>
                        <TableHead>优先级</TableHead>
                        <TableHead className="text-right">已开时长</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.overdueTickets ?? []).map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell>
                            <div className="max-w-[180px] truncate font-medium">{ticket.title}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{ticket.id}</div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone={statusToneFromCode(ticket.priority)}>{ticket.priority}</StatusBadge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {formatNumber(ticket.openHours)}h
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableSurface>
              )}
            </section>
          ) : null}

          {target?.panel === "health" ? (
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">节点快照</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/70 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">排队积压</div>
                  <div className="mt-1 text-lg font-semibold">{formatNumber(data?.health.queueLength)}</div>
                </div>
                <div className="rounded-lg border border-border/70 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">执行中</div>
                  <div className="mt-1 text-lg font-semibold">{formatNumber(data?.health.runningCount)}</div>
                </div>
                <div className="rounded-lg border border-border/70 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">异常节点</div>
                  <div className="mt-1 text-lg font-semibold">{formatNumber(data?.health.comfyUnhealthyCount)}</div>
                </div>
                <div className="rounded-lg border border-border/70 px-3 py-2">
                  <div className="text-[11px] text-muted-foreground">终态成功率</div>
                  <div className="mt-1 text-lg font-semibold">
                    {formatNumber(data?.health.taskSuccessRate, { maximumFractionDigits: 1 })}%
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {(data?.health.servers ?? []).map((server) => (
                  <div
                    key={server.name}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-[12px]"
                  >
                    <span className="truncate">{server.name}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={statusToneFromCode(server.onlineStatus)}>{server.onlineStatus}</StatusBadge>
                      <span className="text-muted-foreground">{server.loadStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {target?.panel === "revenue" ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">近几日摘要</h3>
              {(data?.revenueTrend ?? []).length === 0 ? (
                <EmptyHint text="暂无收入数据" />
              ) : (
                <TableSurface>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日期</TableHead>
                        <TableHead className="text-right">实收</TableHead>
                        <TableHead className="text-right">消耗</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.revenueTrend ?? []).slice(-7).map((row) => (
                        <TableRow key={row.dateKey}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.paidAmount, "CNY")}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(row.outflowAmount, "CNY")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableSurface>
              )}
            </section>
          ) : null}

          {target?.panel === "stores" ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">门店排行</h3>
              {(data?.storeRank ?? []).length === 0 ? (
                <EmptyHint text="暂无门店排行" />
              ) : (
                <div className="space-y-2">
                  {(data?.storeRank ?? []).map((store, index) => (
                    <div
                      key={store.name}
                      className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-[13px]"
                    >
                      <span className="w-5 text-muted-foreground">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{store.name}</span>
                      <span className="font-medium">{formatNumber(store.memberCount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {target?.panel === "workflows" ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">失败工作流 TOP</h3>
              {(data?.failedWorkflowTop ?? []).length === 0 ? (
                <EmptyHint text="区间内暂无失败工作流" />
              ) : (
                <div className="space-y-2">
                  {(data?.failedWorkflowTop ?? []).map((item, index) => (
                    <div
                      key={`${item.workflowId}-${item.workflowName}`}
                      className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-[13px]"
                    >
                      <span className="w-5 text-muted-foreground">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{item.workflowName}</span>
                      <span className="font-medium text-destructive">{formatNumber(item.failedCount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {target?.panel === "none" ? (
            <EmptyHint text="该指标直接跳转业务页查看完整列表" />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
