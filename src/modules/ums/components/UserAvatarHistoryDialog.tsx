import { useEffect, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { Loader2, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { listUserAvatarHistory, type UserAvatar } from "@/modules/ums/api/user-avatar";
import { getUserAvatarFallback, resolveUserAvatarUrl } from "@/shared/lib/user-avatar";

type UserAvatarHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (avatar: UserAvatar) => Promise<void> | void;
};

export default function UserAvatarHistoryDialog({
  open,
  onOpenChange,
  onPick,
}: UserAvatarHistoryDialogProps) {
  const [pageNo, setPageNo] = useState(1);
  const pageSize = 18;
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPageNo(1);
      setSubmittingId(null);
    }
  }, [open]);

  const historyQuery = useQuery({
    queryKey: ["ums-avatar-history", pageNo, pageSize],
    queryFn: () => listUserAvatarHistory({ pageNo, pageSize, total: requestTotal }),
    enabled: open,
  });

  const requestTotal = usePagedTotal(pageNo, historyQuery.data?.page?.total);

  const items = historyQuery.data?.items ?? [];
  const total = historyQuery.data?.page.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handlePick = async (avatar: UserAvatar) => {
    try {
      setSubmittingId(avatar.id);
      await onPick(avatar);
      onOpenChange(false);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px]">
        <DialogHeader>
          <DialogTitle>历史头像库</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <span>展示最近沉淀的系统头像，选择后直接回填头像地址，保存时绑定历史头像。</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => historyQuery.refetch()} disabled={historyQuery.isFetching}>
            {historyQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            刷新
          </Button>
        </div>

        <ScrollArea className="h-[420px] rounded-xl border border-border/60 p-4">
          {historyQuery.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              历史头像加载中...
            </div>
          ) : null}

          {!historyQuery.isLoading && items.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              暂无历史头像
            </div>
          ) : null}

          {!historyQuery.isLoading && items.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => handlePick(avatar)}
                  disabled={submittingId === avatar.id}
                  className="group flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-background p-4 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Avatar className="h-24 w-24 shadow-sm">
                    <AvatarImage
                      src={resolveUserAvatarUrl(avatar.avatarUrl, avatar.id, 160)}
                      alt="历史头像"
                      className="object-cover"
                    />
                    <AvatarFallback>{getUserAvatarFallback(avatar.id)}</AvatarFallback>
                  </Avatar>
                  {/* <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      {submittingId === avatar.id ? "处理中..." : "选择头像"}
                    </div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{avatar.updatedAt || avatar.createdAt}</div>
                  </div> */}
                </button>
              ))}
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <div className="text-sm text-muted-foreground">
            第 {pageNo} / {totalPages} 页，共 {total} 条
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setPageNo((prev) => Math.max(1, prev - 1))} disabled={pageNo <= 1 || historyQuery.isFetching}>
              上一页
            </Button>
            <Button type="button" variant="outline" onClick={() => setPageNo((prev) => Math.min(totalPages, prev + 1))} disabled={pageNo >= totalPages || historyQuery.isFetching}>
              下一页
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
