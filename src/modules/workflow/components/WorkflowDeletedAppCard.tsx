import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
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
import { restoreWorkflow, type WorkflowCard } from "@/shared/api/workflow/workflow";
import { formatDateTime } from "@/shared/lib/datetime";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

function placeholderCover(): string {
  return "/placeholder.svg";
}

export default function WorkflowDeletedAppCard(props: {
  item: WorkflowCard;
  tagNameById: Map<string, string>;
  onRestored?: () => void;
}) {
  const queryClient = useQueryClient();
  const sessionScope = useSessionScope();
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const tagNames = useMemo(() => {
    const ids = props.item.tagIds ?? [];
    return ids.map((id) => props.tagNameById.get(id) || id);
  }, [props.item.tagIds, props.tagNameById]);

  const restoreMutation = useMutation({
    mutationFn: () => restoreWorkflow(props.item.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workflowList", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowKeywordSearch", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowDeletedList", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowDetail", sessionScope.scope.queryScopeKey, props.item.id] });
      await queryClient.invalidateQueries({ queryKey: ["workflowDetailForVersions", sessionScope.scope.queryScopeKey, props.item.id] });
      await queryClient.invalidateQueries({ queryKey: ["workflowVersions", sessionScope.scope.queryScopeKey, props.item.id] });
      props.onRestored?.();
      notify.success("恢复成功");
    },
    onError: (e) => {
      notify.error("恢复失败", { description: resolveUserErrorMessage(e, "请求失败") });
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
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                title="恢复应用"
                onClick={() => setRestoreConfirmOpen(true)}
                disabled={restoreMutation.isPending}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                恢复
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复确认</AlertDialogTitle>
            <AlertDialogDescription>
              确认恢复应用“{props.item.title || props.item.code}”？恢复后将重新出现在应用列表中，默认保持未上线。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoreMutation.isPending}
              onClick={async () => {
                await restoreMutation.mutateAsync();
                setRestoreConfirmOpen(false);
              }}
            >
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
