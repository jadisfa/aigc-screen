import { useCallback, useEffect, useMemo, useState } from "react";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { createTag, deleteTag, listTags, type Tag } from "@/shared/api/sys/tags";
import { formatDateTime } from "@/shared/lib/datetime";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  TableSurface,
} from "@/shared/components/page";
import { notify } from "@/shared/lib/notify";

export default function TagManagementPage() {
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, rememberTotal } =
    usePagedListQuery(10);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [items, setItems] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTags({
        q: appliedQ,
        pageNo,
        pageSize,
        total: getTotalParam(),
      });
      setItems(res.items);
      setTotal(res.page.total);
      rememberTotal(res.page.total);
    } catch (e) {
      notify.error("加载失败", { description: resolveUserErrorMessage(e, "请求失败") });
    } finally {
      setLoading(false);
    }
  }, [appliedQ, getTotalParam, pageNo, pageSize, rememberTotal]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearch = () => {
    const normalized = q.trim();
    setQ(normalized);
    setAppliedQ(normalized);
    resetPage();
  };

  const onCreate = async () => {
    if (!newName.trim()) {
      setFormError("请输入标签名称");
      return;
    }
    setFormError(null);
    try {
      await createTag(newName.trim());
      setCreateOpen(false);
      setNewName("");
      invalidateTotal();
      if (pageNo === 1) {
        await load();
      } else {
        resetPage();
      }
      notify.success("创建成功");
    } catch (e) {
      notify.error("创建失败", { description: resolveUserErrorMessage(e, "创建失败") });
    }
  };

  const onDelete = async (tagId: string) => {
    try {
      await deleteTag(tagId);
      invalidateTotal();
      await load();
      notify.success("删除成功");
    } catch (e) {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "删除失败") });
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="标签字典"
        actions={
          <Button
            variant="page"
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
            disabled={loading}
          >
            新增
          </Button>
        }
      />

      <PageFilterBar>
        <SearchField
          wrapClassName="!max-w-[280px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch();
            }
          }}
          placeholder="搜索标签，回车搜索"
        />
        <Button variant="pageOutline" onClick={onSearch} disabled={loading}>
          搜索
        </Button>
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">标签ID</TableHead>
              <TableHead className="min-w-[200px]">名称</TableHead>
              <TableHead className="min-w-[200px]">创建时间</TableHead>
              <TableHead className="w-24">操作</TableHead>
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
              items.map((t) => (
                <TableRow key={t.tagId}>
                  <TableCell className="font-mono text-xs">{t.tagId}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="pageOutline" size="sm" onClick={() => onDelete(t.tagId)} disabled={loading}>
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={total}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={pageNo < totalPages}
        onPageNoChange={setPageNo}
        onPageSizeChange={() => {}}
        showPageSizeSelect={false}
        disabled={loading}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewName("");
            setFormError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增标签</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="标签名称"
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setNewName("");
                setFormError(null);
              }}
            >
              取消
            </Button>
            <Button onClick={onCreate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
