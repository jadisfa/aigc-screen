import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell, TableSurface } from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { listPlans, type Plan } from "@/shared/api/billing/billing";
import { notify } from "@/shared/lib/notify";

export default function PlanManagementPage() {
  const [items, setItems] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPlans();
      setItems(res.items);
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell>
      <PageHeader
        title="套餐配置"
        actions={
          <Button variant="pageOutline" onClick={load} disabled={loading}>
            刷新
          </Button>
        }
      />

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">套餐ID</TableHead>
              <TableHead className="min-w-[200px]">名称</TableHead>
              <TableHead className="w-28 text-right">算力值</TableHead>
              <TableHead className="w-28 text-right">价格</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.planId}>
                  <TableCell className="font-mono text-xs">{p.planId}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right">{p.computeValue}</TableCell>
                  <TableCell className="text-right">{p.price}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableSurface>
    </PageShell>
  );
}
