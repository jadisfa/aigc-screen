import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, RefreshCw, Play, Edit, Trash2, Upload, Download } from "lucide-react";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  StatusBadge,
  TableSurface,
} from "@/shared/components/page";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { notify } from "@/shared/lib/notify";
import { getWorkflow } from "@/shared/api/workflow/workflow";
import { activateWorkflowVersion, deactivateWorkflowVersion, deleteWorkflowVersion, getWorkflowVersion, listWorkflowVersions, type WorkflowVersion } from "@/shared/api/workflow/workflow-version";
import { formatDateTime } from "@/shared/lib/datetime";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { WorkflowAppSelect } from "@/modules/workflow/components/WorkflowAppSelect";
import { openAuthenticatedPath } from "@/shared/api/auth/auth";

export default function WorkflowVersionsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sessionScope = useSessionScope();
  const [sp, setSp] = useSearchParams();
  const workflowIdFromUrl = sp.get("workflowId") || "";

  const [workflowId, setWorkflowId] = useState<string>(workflowIdFromUrl);
  const [versionsLastTotal, setVersionsLastTotal] = useState<number | undefined>(undefined);

  useEffect(() => {
    setWorkflowId(workflowIdFromUrl);
  }, [workflowIdFromUrl]);

  const workflowDetailQuery = useQuery({
    queryKey: ["workflowDetailForVersions", sessionScope.scope.queryScopeKey, workflowId],
    queryFn: () => getWorkflow(workflowId),
    enabled: !!workflowId,
  });

  const versionsQuery = useQuery({
    queryKey: ["workflowVersions", sessionScope.scope.queryScopeKey, workflowId],
    queryFn: () => listWorkflowVersions({ workflowId, pageNo: 1, pageSize: 200, total: versionsLastTotal }),
    enabled: !!workflowId,
  });
  useEffect(() => {
    if (!workflowId) return;
    if (typeof versionsQuery.data?.page?.total !== "number") return;
    setVersionsLastTotal(versionsQuery.data.page.total);
  }, [versionsQuery.data?.page?.total, workflowId]);

  useEffect(() => {
    if (!versionsQuery.isError) return;
    notify.fromError(versionsQuery.error, "请求失败", "加载失败");
  }, [versionsQuery.error, versionsQuery.isError]);

  const currentVersionNo = workflowDetailQuery.data?.workflow?.currentVersionNo || null;
  const workflowOnline = workflowDetailQuery.data?.workflow?.status === "online";
  const versions = useMemo<WorkflowVersion[]>(() => versionsQuery.data?.items ?? [], [versionsQuery.data?.items]);
  const currentVersion = useMemo(() => {
    if (!currentVersionNo) return null;
    return versions.find((v) => v.versionNo === currentVersionNo) || null;
  }, [currentVersionNo, versions]);

  const currentVersionDetailQuery = useQuery({
    queryKey: ["workflowVersionDetailForCopy", sessionScope.scope.queryScopeKey, currentVersion?.id],
    queryFn: () => getWorkflowVersion(currentVersion!.id),
    enabled: !!currentVersion?.id,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workflowVersions", sessionScope.scope.queryScopeKey, workflowId] });
    await queryClient.invalidateQueries({ queryKey: ["workflowDetailForVersions", sessionScope.scope.queryScopeKey, workflowId] });
    await queryClient.invalidateQueries({ queryKey: ["workflowList", sessionScope.scope.queryScopeKey] });
    await queryClient.invalidateQueries({ queryKey: ["workflowAppSelect", sessionScope.scope.queryScopeKey] });
  };

  const activateMutation = useMutation({
    mutationFn: (id: string) => activateWorkflowVersion(id),
    onSuccess: async () => {
      await refresh();
      notify.success("上线成功");
    },
    onError: (e) => {
      notify.fromError(e, "请求失败");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateWorkflowVersion(id),
    onSuccess: async () => {
      await refresh();
      notify.success("下线成功");
    },
    onError: (e) => {
      notify.fromError(e, "请求失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWorkflowVersion(id),
    onSuccess: async () => {
      await refresh();
      notify.success("删除成功");
    },
    onError: (e) => {
      notify.fromError(e, "请求失败");
    },
  });

  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [activating, setActivating] = useState<WorkflowVersion | null>(null);
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<WorkflowVersion | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState<WorkflowVersion | null>(null);

  const onWorkflowIdChange = (next: string) => {
    setWorkflowId(next);
    setVersionsLastTotal(undefined);
    if (next) setSp({ workflowId: next });
    else setSp({});
  };

  return (
    <PageShell>
      <PageHeader
        title={
          <div className="page-header-start">
            <Button variant="ghost" size="icon" onClick={() => navigate("/app/workflows")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="page-title">版本管理</h1>
          </div>
        }
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={versionsQuery.isFetching}>
              <RefreshCw className="w-4 h-4 mr-1" />
              刷新
            </Button>
            <Button variant="page" onClick={() => navigate(`/app/workflows/${workflowId}/edit?action=newVersion`)} disabled={!workflowId}>
              <Plus className="w-4 h-4 mr-1" />
              新增版本
            </Button>
          </>
        }
      />

      <PageFilterBar>
        <WorkflowAppSelect
          value={workflowId}
          onChange={onWorkflowIdChange}
          placeholder="选择工作流应用"
        />

        {workflowId && (
          <div className="text-sm text-muted-foreground">
            当前版本：{currentVersionNo || "-"}
            <span className="mx-2">·</span>
            应用状态：{workflowOnline ? "已上线" : "未上线"}
          </div>
        )}
      </PageFilterBar>

      {!!workflowId && (
        <div className="mb-3 text-xs text-muted-foreground">
          编辑线上版本时，将基于该版本内容创建一个新版本；编辑非线上版本时，将直接编辑该版本。
        </div>
      )}

      {!workflowId && <div className="text-sm text-muted-foreground py-10">请选择一个工作流应用</div>}

      {!!workflowId && (
        <TableSurface>
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">版本号</TableHead>
                <TableHead className="min-w-[280px]">变更日志</TableHead>
                <TableHead className="min-w-[100px]">创建时间</TableHead>
                <TableHead className="w-40 text-center">状态</TableHead>
                <TableHead className="w-120">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versionsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    加载中...
                  </TableCell>
                </TableRow>
              )}
              {!versionsQuery.isLoading &&
                versions.map((v) => {
                  const isCurrent = !!currentVersionNo && v.versionNo === currentVersionNo;
                  const isOnline = workflowOnline && isCurrent;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.versionNo}</TableCell>
                      <TableCell className="text-muted-foreground">{v.changelog || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(v.createdAt)}</TableCell>
                      <TableCell className="text-center">
                        {isOnline ? <StatusBadge tone="success">线上</StatusBadge> : <StatusBadge tone="neutral">未上线</StatusBadge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isOnline ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={deactivateMutation.isPending}
                              onClick={() => {
                                setDeactivating(v);
                                setDeactivateConfirmOpen(true);
                              }}
                              title="下线"
                            >
                              <Download className="w-4 h-4 text-destructive" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={activateMutation.isPending}
                              onClick={() => {
                                setActivating(v);
                                setActivateConfirmOpen(true);
                              }}
                              title="上线"
                            >
                              <Upload className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              openAuthenticatedPath(
                                `/app/workflows/${encodeURIComponent(workflowId)}/preview?versionId=${encodeURIComponent(v.id)}`
                              )
                            }
                            title="运行"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={isOnline ? "outline" : "ghost"}
                            size={isOnline ? "sm" : "icon"}
                            className={isOnline ? "h-8 border-primary/40 bg-primary/5 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary" : undefined}
                            onClick={() => navigate(`/app/workflows/${workflowId}/edit?versionId=${v.id}`)}
                            title={isOnline ? "基于线上版本创建新版本" : "编辑该版本"}
                          >
                            {isOnline ? (
                              <>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                另存新版本
                              </>
                            ) : (
                              <Edit className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isCurrent || deleteMutation.isPending}
                            onClick={() => {
                              setDeleting(v);
                              setDeleteConfirmOpen(true);
                            }}
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!versionsQuery.isLoading && versions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    暂无版本
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableSurface>
      )}

      <AlertDialog open={activateConfirmOpen} onOpenChange={setActivateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认上线版本</AlertDialogTitle>
            <AlertDialogDescription>
              将上线版本：{activating?.versionNo || "-"}，工作流应用将同步上线。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!activating) return;
                await activateMutation.mutateAsync(activating.id);
                setActivateConfirmOpen(false);
                setActivating(null);
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deactivateConfirmOpen} onOpenChange={setDeactivateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认下线版本</AlertDialogTitle>
            <AlertDialogDescription>
              将下线版本：{deactivating?.versionNo || "-"}，工作流应用将同步下线。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deactivating) return;
                await deactivateMutation.mutateAsync(deactivating.id);
                setDeactivateConfirmOpen(false);
                setDeactivating(null);
              }}
            >
              确认下线
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除版本</AlertDialogTitle>
            <AlertDialogDescription>
              将删除版本：{deleting?.versionNo || "-"}，此操作不可恢复
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                await deleteMutation.mutateAsync(deleting.id);
                setDeleteConfirmOpen(false);
                setDeleting(null);
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
