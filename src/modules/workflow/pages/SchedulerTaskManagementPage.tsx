import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LayoutGrid, List, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
} from "@/shared/components/page";
import { DatePicker } from "@/shared/components/DatePicker";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import { usePagedListQuery } from "@/shared/hooks/use-paged-total";
import { usePersistedViewMode } from "@/shared/hooks/use-persisted-view-mode";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { deleteTask, exportTasksCsv, listTasks, type Task } from "@/shared/api/sys/scheduler";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { notify } from "@/shared/lib/notify";
import { ImageViewerDialog } from "@/modules/workflow/components/preview/ImageViewerDialog";
import { MaterialMediaPreviewDialog } from "@/modules/materials/components/MaterialMediaPreviewDialog";
import TaskDetailPage from "../components/TaskDetailPage";
import { SchedulerTaskCard } from "../components/SchedulerTaskCard";
import {
  SchedulerTaskListTable,
  SchedulerTaskParamsDialog,
} from "../components/SchedulerTaskListTable";
import { taskOutputItems } from "../lib/scheduler-task-display";

type TaskStatusFilter = "all" | "queued" | "running" | "succeeded" | "failed" | "canceled";

export default function SchedulerTaskManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const queueServerId = searchParams.get("queueServerId");
  const { pageNo, setPageNo, pageSize, getTotalParam, resetPage, invalidateTotal, changePageSize, rememberTotal } = usePagedListQuery(15);

  const [status, setStatus] = useState<TaskStatusFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [createdAtStart, setCreatedAtStart] = useState("");
  const [createdAtEnd, setCreatedAtEnd] = useState("");
  const [viewMode, setViewMode] = usePersistedViewMode("scheduler_tasks", "list");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [paramsTarget, setParamsTarget] = useState<Task | null>(null);
  const [galleryTarget, setGalleryTarget] = useState<Task | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewGallery, setPreviewGallery] = useState<{ src: string }[]>([]);
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string } | null>(null);

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    resetPage();
  };

  const listQueryKey = [
    "schedulerTasks",
    pageNo,
    pageSize,
    status,
    appliedKeyword,
    createdAtStart,
    createdAtEnd,
    queueServerId,
  ] as const;

  const listQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      listTasks({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
        status: status === "all" ? undefined : status,
        createdAtStart: createdAtStart ? `${createdAtStart} 00:00:00` : undefined,
        createdAtEnd: createdAtEnd ? `${createdAtEnd} 23:59:59` : undefined,
        assignedServerId: queueServerId || undefined,
      }),
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    rememberTotal(listQuery.data?.page?.total);
  }, [listQuery.data?.page?.total, rememberTotal]);

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const total = listQuery.data?.page?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || items.length) / pageSize)), [items.length, pageSize, total]);
  const canNextPage = useMemo(() => {
    if (total <= 0) return false;
    return pageNo * pageSize < total;
  }, [pageNo, pageSize, total]);

  const galleryItems = useMemo(
    () => (galleryTarget ? taskOutputItems(galleryTarget) : []),
    [galleryTarget],
  );

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      notify.success("删除成功");
      setDeleteTarget(null);
      invalidateTotal();
      void queryClient.invalidateQueries({ queryKey: ["schedulerTasks"] });
    },
    onError: (error) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(error, "删除失败") });
    },
  });

  const exportCurrentPage = async () => {
    try {
      const csv = await exportTasksCsv({
        pageNo,
        pageSize,
        total: getTotalParam(),
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
        status: status === "all" ? undefined : status,
        createdAtStart: createdAtStart ? `${createdAtStart} 00:00:00` : undefined,
        createdAtEnd: createdAtEnd ? `${createdAtEnd} 23:59:59` : undefined,
        assignedServerId: queueServerId || undefined,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tasks-page-${pageNo}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      notify.success("导出成功", { description: "已下载当前页 CSV" });
    } catch (e) {
      notify.error("导出失败", { description: e instanceof Error ? e.message : "导出失败" });
    }
  };

  const openImage = useCallback((row: Task, url: string) => {
    const images = taskOutputItems(row)
      .filter((item) => (item.kind === "image" || row.workType === "image") && !!item.url)
      .map((item) => ({ src: item.url as string }));
    setPreviewGallery(images.length > 0 ? images : [{ src: url }]);
    setPreviewImageUrl(url);
  }, []);

  if (selectedTaskId) {
    return (
      <TaskDetailPage
        taskId={selectedTaskId}
        onBack={() => {
          setSelectedTaskId(null);
          void queryClient.invalidateQueries({ queryKey: ["schedulerTasks"] });
        }}
      />
    );
  }

  return (
    <PageShell className={viewMode === "list" ? "flex flex-col overflow-hidden" : undefined}>
      <PageHeader
        className={viewMode === "list" ? "shrink-0" : undefined}
        title={
          <div className="page-header-start">
            {queueServerId ? (
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            ) : null}
            <h1 className="page-title">任务调度</h1>
          </div>
        }
        actions={
          <>
            <Button variant="pageOutline" onClick={() => void listQuery.refetch()} disabled={listQuery.isFetching}>
              <RefreshCw className="w-4 h-4" />
              刷新
            </Button>
            <Button variant="pageOutline" onClick={() => void exportCurrentPage()} disabled={listQuery.isFetching}>
              导出当前页
            </Button>
          </>
        }
      />

      <PageFilterBar
        className={`flex-wrap${viewMode === "list" ? " shrink-0" : ""}`}
        end={
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => {
              if (v === "card" || v === "list") setViewMode(v);
            }}
            variant="outline"
            size="sm"
            className="bg-background"
          >
            <ToggleGroupItem value="card" aria-label="卡片" title="卡片" className="h-8 w-8 px-0">
              <LayoutGrid className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="列表" title="列表" className="h-8 w-8 px-0">
              <List className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      >
        <div className="flex items-center gap-2">
          <DatePicker
            value={createdAtStart}
            onChange={(val) => {
              setCreatedAtStart(val);
              resetPage();
            }}
            placeholder="开始时间"
            className="w-[150px] h-9 bg-background"
          />
          <span className="text-muted-foreground">-</span>
          <DatePicker
            value={createdAtEnd}
            onChange={(val) => {
              setCreatedAtEnd(val);
              resetPage();
            }}
            placeholder="结束时间"
            className="w-[150px] h-9 bg-background"
          />
        </div>

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as TaskStatusFilter);
            resetPage();
          }}
        >
          <SelectTrigger className="subpage-native-select w-[160px]">
            <SelectValue placeholder="任务状态" />
          </SelectTrigger>
          <SelectContent className="subpage-select-content">
            <SelectItem className="subpage-select-item" value="all">任务状态: 全部</SelectItem>
            <SelectItem className="subpage-select-item" value="succeeded">成功</SelectItem>
            <SelectItem className="subpage-select-item" value="failed">失败</SelectItem>
            <SelectItem className="subpage-select-item" value="running">执行中</SelectItem>
            <SelectItem className="subpage-select-item" value="queued">等待中</SelectItem>
            <SelectItem className="subpage-select-item" value="canceled">已取消</SelectItem>
          </SelectContent>
        </Select>

        <SearchField
          wrapClassName="!max-w-[280px]"
          placeholder="任务名称/任务ID，回车搜索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyKeywordSearch();
            }
          }}
        />
      </PageFilterBar>

      {viewMode === "card" ? (
        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-5 max-[768px]:grid-cols-1">
          {items.map((row) => (
            <SchedulerTaskCard
              key={row.taskId}
              item={row}
              onDelete={() => setDeleteTarget(row)}
              onViewGallery={() => setGalleryTarget(row)}
              onViewImage={(url) => openImage(row, url)}
              onViewVideo={(url) => setPreviewVideo({ url, title: row.taskName || row.taskId })}
              onViewParams={() => setParamsTarget(row)}
              onViewDetail={() => setSelectedTaskId(row.taskId)}
              disabledDelete={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <SchedulerTaskListTable
            items={items}
            loading={listQuery.isLoading}
            onViewGallery={(row) => setGalleryTarget(row)}
            onViewImage={openImage}
            onViewVideo={(row, url) => setPreviewVideo({ url, title: row.taskName || row.taskId })}
            onViewDetail={(row) => setSelectedTaskId(row.taskId)}
            onDelete={(row) => setDeleteTarget(row)}
            disabledDelete={deleteMutation.isPending}
          />
        </div>
      )}

      {!listQuery.isLoading && items.length === 0 && viewMode === "card" && (
        <div className="text-center py-20 text-muted-foreground">暂无数据</div>
      )}

      <CommonPaginationBar
        className={viewMode === "list" ? "shrink-0" : undefined}
        total={total || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage || pageNo < totalPages}
        onPageNoChange={setPageNo}
        pageSizeOptions={[15, 30, 45]}
        showPageSizeSelect={true}
        onPageSizeChange={changePageSize}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除任务「<span className="font-mono">{deleteTarget?.taskName || deleteTarget?.taskId || "-"}</span>」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.taskId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!galleryTarget}
        onOpenChange={(open) => {
          if (!open) setGalleryTarget(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>生成内容详情</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {galleryItems.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">暂无生成内容</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryItems.map((item, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden border bg-muted aspect-[4/3] flex items-center justify-center relative group">
                    {item.kind === "image" || galleryTarget?.workType === "image" ? (
                      <img
                        src={item.url || ""}
                        alt="生成图片"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        loading="lazy"
                        onClick={() => {
                          if (galleryTarget && item.url) openImage(galleryTarget, item.url);
                        }}
                      />
                    ) : item.kind === "video" || galleryTarget?.workType === "video" ? (
                      <video src={item.url || ""} className="w-full h-full object-cover" controls preload="metadata" />
                    ) : (
                      <div className="p-4 text-sm whitespace-pre-wrap overflow-y-auto w-full h-full break-all bg-card">
                        {item.text || item.url || JSON.stringify(item)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SchedulerTaskParamsDialog target={paramsTarget} onClose={() => setParamsTarget(null)} />

      <ImageViewerDialog
        previewImageUrl={previewImageUrl}
        gallery={previewGallery}
        onClose={() => {
          setPreviewImageUrl(null);
          setPreviewGallery([]);
        }}
      />
      <MaterialMediaPreviewDialog
        preview={previewVideo ? { type: "video", url: previewVideo.url, title: previewVideo.title } : null}
        onClose={() => setPreviewVideo(null)}
      />
    </PageShell>
  );
}
