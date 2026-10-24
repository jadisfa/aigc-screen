import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Download, GitBranch, Pencil, Play, Plus, Trash2, Upload } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
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
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { deleteWorkflow, setWorkflowStatus, type WorkflowCard } from "@/shared/api/workflow/workflow";
import { formatDateTime } from "@/shared/lib/datetime";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { openAuthenticatedPath } from "@/shared/api/auth/auth";
import { notify } from "@/shared/lib/notify";

function placeholderCover(): string {
  return "/placeholder.svg";
}

export default function WorkflowAppCard(props: {
  item: WorkflowCard;
  tagNameById: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sessionScope = useSessionScope();

  const tagNames = useMemo(() => {
    const ids = props.item.tagIds ?? [];
    return ids.map((id) => props.tagNameById.get(id) || id);
  }, [props.item.tagIds, props.tagNameById]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflowList", sessionScope.scope.queryScopeKey] });
    await queryClient.invalidateQueries({ queryKey: ["workflowKeywordSearch", sessionScope.scope.queryScopeKey] });
    await queryClient.invalidateQueries({ queryKey: ["workflowDeletedList", sessionScope.scope.queryScopeKey] });
    await queryClient.invalidateQueries({ queryKey: ["workflowDetail", sessionScope.scope.queryScopeKey, props.item.id] });
    await queryClient.invalidateQueries({ queryKey: ["workflowDetailForVersions", sessionScope.scope.queryScopeKey, props.item.id] });
    await queryClient.invalidateQueries({ queryKey: ["workflowVersions", sessionScope.scope.queryScopeKey, props.item.id] });
  };

  const setStatusMutation = useMutation({
    mutationFn: (status: "online" | "offline") => setWorkflowStatus(props.item.id, status),
    onSuccess: async (_data, status) => {
      await refresh();
      notify.success(status === "online" ? "上线成功" : "下线成功");
    },
    onError: (e) => {
      notify.error("操作失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const nextStatus = props.item.status === "online" ? "offline" : "online";
  const statusLabel = nextStatus === "online" ? "上线" : "下线";
  const createsNewVersionOnEdit = props.item.status === "online";
  const editTitle = createsNewVersionOnEdit ? "基于线上版本创建新版本" : "编辑当前版本";
  const versionHint = props.item.currentVersionNo
    ? `当前版本 ${props.item.currentVersionNo} 将同步${statusLabel}。`
    : nextStatus === "online"
      ? "当前没有可上线的版本，请先在版本管理中上线一个版本。"
      : "";
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkflow(props.item.id),
    onSuccess: async () => {
      await refresh();
      notify.success("删除成功");
    },
    onError: (e) => {
      notify.error("删除失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-2 hover:shadow-md hover:border-primary/35 transition-all">
        <div className="flex gap-3">
          <div className="w-1/3 rounded-lg overflow-hidden shrink-0 bg-muted/30">
            <img
              src={props.item.coverUrl || placeholderCover()}
              alt={props.item.title || props.item.code}
              className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast]"
              loading="lazy"
            />
          </div>

          <div className="w-2/3 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[15px] leading-tight font-semibold text-foreground truncate">
                {props.item.title || props.item.code}
              </span>
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <Badge
                  variant={props.item.status === "online" ? "default" : "secondary"}
                  className="text-[11px] align-middle px-1.5 font-medium"
                >
                  {props.item.status === "online" ? "已上线" : "未上线"}
                </Badge>
              </div>
            </div>

            <p className="text-[12px] text-muted-foreground/90 leading-[1.45] line-clamp-2 min-h-[34px]">
              {props.item.description || "暂无描述"}
            </p>

            <div className="text-[12px] leading-[1.45] text-muted-foreground/85 space-y-1">
              <p>
                最近更新：{formatDateTime(props.item.updatedAt)}
              </p>
              <p>
                金额：{props.item.price ?? "-"} 分 · 排序：{props.item.sortNo ?? "-"} · 版本：{props.item.currentVersionNo || "-"}
              </p>
              <p className="truncate">
                <span className="mr-3">分类：{props.item.cateName || "-"}</span>
                <span className="mr-3">类型：{props.item.type || "-"}</span>
              </p>
              <p className="truncate">
                标签：{tagNames.length ? tagNames.join("、") : "-"}
              </p>
            </div>

            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <button
                className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="查看/预览"
                onClick={() => {
                  openAuthenticatedPath(`/app/workflows/${encodeURIComponent(props.item.id)}/preview`);
                }}
              >
                <Play className="w-4 h-4" />
              </button>

              {createsNewVersionOnEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-7 h-7 border-primary/40 bg-primary/5 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                  title={editTitle}
                  onClick={() => navigate(`/app/workflows/${encodeURIComponent(props.item.id)}/edit`)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              ) : (
                <button
                  className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                  title={editTitle}
                  onClick={() => navigate(`/app/workflows/${encodeURIComponent(props.item.id)}/edit`)}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}

              <Link
                to={`/app/versions?workflowId=${encodeURIComponent(props.item.id)}`}
                className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="版本管理"
              >
                <GitBranch className="w-4 h-4" />
              </Link>

              <button
                className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
                title={
                  nextStatus === "online" && !props.item.currentVersionNo
                    ? "请先在版本管理中上线一个版本"
                    : statusLabel
                }
                onClick={() => setStatusConfirmOpen(true)}
                disabled={setStatusMutation.isPending || (nextStatus === "online" && !props.item.currentVersionNo)}
              >
                {props.item.status === "online" ? (
                  <Download className="w-4 h-4 text-destructive" />
                ) : (
                  <Upload className="w-4 h-4 text-primary" />
                )}
              </button>

              <button
                className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:pointer-events-none"
                title="删除应用"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>

              <div className="flex-1"></div>

              <div className="inline-flex items-center gap-1 mr-2">
                <Switch
                  title={
                    props.item.status !== "online" && !props.item.currentVersionNo
                      ? "请先在版本管理中上线一个版本"
                      : "上线状态（联动当前版本）"
                  }
                  checked={props.item.status === "online"}
                  onCheckedChange={(checked) => setStatusMutation.mutate(checked ? "online" : "offline")}
                  disabled={setStatusMutation.isPending || (props.item.status !== "online" && !props.item.currentVersionNo)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认{statusLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              将{statusLabel}应用：{props.item.title || props.item.code}（{props.item.code}）。
              {versionHint ? ` ${versionHint}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await setStatusMutation.mutateAsync(nextStatus);
                setStatusConfirmOpen(false);
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除确认</AlertDialogTitle>
            <AlertDialogDescription>
              应用删除后，应用列表中将不再显示“{props.item.title || props.item.code}”，且该应用下的版本也将不可用。确认删除？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                await deleteMutation.mutateAsync();
                setDeleteConfirmOpen(false);
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
