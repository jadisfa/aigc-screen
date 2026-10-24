import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/shared/ui/badge";
import { HttpError } from "@/shared/api/sys/http";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { getWorkflow } from "@/shared/api/workflow/workflow";
import { activateWorkflowVersion, getWorkflowVersion, listWorkflowVersions } from "@/shared/api/workflow/workflow-version";
import WorkflowWizard, { type WorkflowWizardInitial, type WorkflowWizardResult } from "@/modules/workflow/components/WorkflowWizard";
import { createEmptyUiSchema } from "@/modules/workflow/components/pagebuilder/ui-schema";
import { resolveWorkflowEditorVersionContext } from "@/modules/workflow/lib/editor-versioning";
import {
  inferCreateKind,
  normalizeExecutionBackend,
  parseExecutionConfig,
} from "@/modules/workflow/lib/workflow-exec";
import { defaultTemplateGraphText, parseTemplateGraph } from "@/modules/workflow/lib/template-graph";
import { parseJsonText } from "@/modules/workflow/lib/wizard-json";
import { ErrorState } from "@/shared/components/ErrorState";
import { useSessionScope } from "@/shared/hooks/use-session-scope";
import { notify } from "@/shared/lib/notify";

export default function WorkflowAppEditorPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sessionScope = useSessionScope();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const workflowId = params.id;
  const versionIdParam = searchParams.get("versionId");
  const actionParam = searchParams.get("action");
  const createKind = inferCreateKind({
    createKind: searchParams.get("createKind"),
    executionBackend: searchParams.get("executionBackend"),
  });
  const createExecutionBackend = createKind === "template" ? "template" : normalizeExecutionBackend(searchParams.get("executionBackend"));
  const mode: "create" | "edit" = workflowId ? "edit" : "create";
  const [versionsLastTotal, setVersionsLastTotal] = useState<number | undefined>(undefined);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const isRefresh = e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r");
      if (!isRefresh) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const detailQuery = useQuery({
    queryKey: ["workflowDetail", sessionScope.scope.queryScopeKey, workflowId],
    queryFn: () => getWorkflow(workflowId!),
    enabled: mode === "edit" && !!workflowId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const versionsQuery = useQuery({
    queryKey: ["workflowVersionsForEdit", sessionScope.scope.queryScopeKey, workflowId],
    queryFn: () => listWorkflowVersions({ workflowId: workflowId!, pageNo: 1, pageSize: 200, total: versionsLastTotal }),
    enabled: mode === "edit" && !!workflowId && !!detailQuery.data?.workflow?.id,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (!workflowId) return;
    if (typeof versionsQuery.data?.page?.total !== "number") return;
    setVersionsLastTotal(versionsQuery.data.page.total);
  }, [versionsQuery.data?.page?.total, workflowId]);

  const editorVersionContext = useMemo(() => {
    return resolveWorkflowEditorVersionContext({
      actionParam,
      versionIdParam,
      workflowStatus: detailQuery.data?.workflow?.status,
      currentVersionNo: detailQuery.data?.workflow?.currentVersionNo,
      versions: versionsQuery.data?.items ?? [],
    });
  }, [actionParam, detailQuery.data?.workflow?.currentVersionNo, detailQuery.data?.workflow?.status, versionIdParam, versionsQuery.data?.items]);

  const currentVersionMeta = editorVersionContext.baseVersion;
  const shouldForceNewVersionOnFirstSave = editorVersionContext.shouldForceNewVersionOnFirstSave;

  const currentVersionDetailQuery = useQuery({
    queryKey: ["workflowVersionDetailForEdit", sessionScope.scope.queryScopeKey, currentVersionMeta?.id],
    queryFn: () => getWorkflowVersion(currentVersionMeta!.id),
    enabled: !!currentVersionMeta?.id,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (!detailQuery.isError) return;
    notify.fromError(detailQuery.error, "请求失败", "加载失败");
  }, [detailQuery.error, detailQuery.isError]);

  const initial: WorkflowWizardInitial | undefined = useMemo(() => {
    if (mode === "create") {
      return {
        versionNo: "系统自动生成",
        changelog: "",
        uiSchemaText: JSON.stringify(createEmptyUiSchema(), null, 2),
        createKind,
        executionBackend: createExecutionBackend,
        workflowJsonText: createKind === "template" ? defaultTemplateGraphText() : "",
        rhWorkflowId: "",
        accessPassword: "",
      };
    }

    const d = detailQuery.data;
    if (!d) return undefined;
    const w = d.workflow;
    if (!w) return undefined;
    const v = currentVersionDetailQuery.data;
    const workflowJsonText = v?.workflowJsonText?.trim()
      ? v.workflowJsonText
      : v?.workflowJson?.trim()
        ? v.workflowJson
        : "";
    const execCfg = parseExecutionConfig(v?.configJson ?? null);

    const outputNodes = (() => {
      const text = w.outputNodesJson?.trim();
      if (!text) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    })();

    const appClients = (() => {
      const text = w.appClientsJson?.trim();
      if (!text) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    })();

    return {
      workflowJsonText,
      uiSchemaText: v?.uiSchema?.trim() ? v.uiSchema : JSON.stringify(createEmptyUiSchema(), null, 2),
      versionNo: shouldForceNewVersionOnFirstSave ? "系统自动生成" : (v?.versionNo || "系统自动生成"),
      changelog: "",
      code: w.code || "",
      type: w.type || "comfyui",
      createKind: inferCreateKind({
        engineType: w.type,
        executionBackend: execCfg.executionBackend,
        createKind: (() => {
          if (w.type === "flow") return "template";
          const parsed = parseJsonText(workflowJsonText, "workflow JSON");
          return parsed.ok && parseTemplateGraph(parsed.value).ok ? "template" : null;
        })(),
      }),
      executionBackend: execCfg.executionBackend,
      rhWorkflowId: execCfg.rhWorkflowId,
      accessPassword: execCfg.accessPassword,
      cateId: w.cateId || "",
      title: w.title || "",
      coverUrl: w.coverUrl || "",
      iconUrl: w.iconUrl || "",
      description: w.description || "",
      detail: w.detail || "",
      mcpDescription: w.mcpDescription || "",
      timeoutSec: w.timeoutSec ?? 60,
      outputNodes,
      appClients,
      sortNo: w.sortNo ?? 100,
      price: w.price ?? null,
      status: w.status === "online" ? "online" : "offline",
      tagIds: d.tagIds ?? [],
      scopeBindings: (d.scopeBindings ?? []).flatMap((s) => {
        if (s.scopeLevel === "store" && s.storeId) {
          return [{ scopeLevel: "store" as const, merchantId: s.merchantId ?? null, storeId: s.storeId }];
        }
        if (s.scopeLevel === "merchant" && s.merchantId) {
          return [{ scopeLevel: "merchant" as const, merchantId: s.merchantId, storeId: null }];
        }
        return [];
      }),
      comfyuiRels: (d.comfyuiRels ?? []).map((r) => ({
        scopeType: r.scopeType === "exclude" ? "exclude" : "include",
        serverId: r.serverId,
      })),
    };
  }, [
    createExecutionBackend,
    createKind,
    currentVersionDetailQuery.data,
    detailQuery.data,
    mode,
    shouldForceNewVersionOnFirstSave,
  ]);

  const submitMutation = useMutation({
    mutationFn: async (result: WorkflowWizardResult) => {
      if (mode !== "edit") return { activated: false };
      const vid = result.draftVersionId;
      if (!vid) {
        throw new Error("draftVersionId is required");
      }
      await activateWorkflowVersion(vid);
      return { activated: true };
    },
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: ["workflowList", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowKeywordSearch", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowDetail", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowVersions", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowVersionsForEdit", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowVersionDetailForEdit", sessionScope.scope.queryScopeKey] });
      await queryClient.invalidateQueries({ queryKey: ["workflowVersionDetailForPreview", sessionScope.scope.queryScopeKey] });
      navigate("/app/workflows");
    },
    onError: (e) => {
      notify.error("保存失败", { description: resolveUserErrorMessage(e, "请求失败") });
    },
  });

  const needVersionDetail = !!currentVersionMeta?.id;
  const versionDetailReady = !needVersionDetail || !!currentVersionDetailQuery.data || currentVersionDetailQuery.isFetched;

  const loading =
    mode === "edit" &&
    (detailQuery.isLoading ||
      versionsQuery.isLoading ||
      (needVersionDetail && currentVersionDetailQuery.isLoading) ||
      !versionDetailReady);

  const loadError = detailQuery.error || versionsQuery.error || currentVersionDetailQuery.error;
  const isLoadFailed = mode === "edit" && !loading && (!!loadError || !detailQuery.data?.workflow);
  const loadErrorMessage = isLoadFailed ? resolveUserErrorMessage(loadError, "加载失败") : "";
  const httpErrorCode = useMemo(
    () => (loadError instanceof HttpError ? String(loadError.status) : "500"),
    [loadError],
  );

  useEffect(() => {
    if (!isLoadFailed) return;
    console.groupCollapsed("[WorkflowAppEditorPage] load failed");
    console.error("workflowId:", workflowId);
    console.error("versionId:", versionIdParam);
    console.error("action:", actionParam);
    console.error("detailQuery.error:", detailQuery.error);
    console.error("versionsQuery.error:", versionsQuery.error);
    console.error("currentVersionDetailQuery.error:", currentVersionDetailQuery.error);
    console.groupEnd();
  }, [
    actionParam,
    currentVersionDetailQuery.error,
    detailQuery.error,
    isLoadFailed,
    versionIdParam,
    versionsQuery.error,
    workflowId,
  ]);

  const extraHeaderActions = mode === "edit" ? (
    <div className="flex items-center gap-2">
      <Badge
        variant="outline"
        className={shouldForceNewVersionOnFirstSave ? "border-primary/40 bg-primary/5 text-primary" : "border-border bg-muted/30 text-foreground"}
      >
        {shouldForceNewVersionOnFirstSave ? "另存新版本" : "直接编辑"}
      </Badge>
      {currentVersionMeta?.versionNo ? (
        <Badge variant="secondary" className="text-xs">
          基于 {currentVersionMeta.versionNo}
        </Badge>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="page-content-shell">
      {loading && <div className="text-sm text-muted-foreground py-10">加载中...</div>}

      {isLoadFailed && (
        <div className="py-10 min-h-[60vh]">
          <ErrorState
            title="页面加载失败"
            description={loadErrorMessage}
            code={httpErrorCode}
            onRetry={async () => {
              const tasks = [detailQuery.refetch(), versionsQuery.refetch()];
              if (currentVersionMeta?.id) {
                tasks.push(currentVersionDetailQuery.refetch());
              }
              await Promise.all(tasks);
            }}
          />
        </div>
      )}

      {!loading && !isLoadFailed && (
        <WorkflowWizard
          key={
            mode === "create"
              ? "create"
              : `${workflowId}:${detailQuery.dataUpdatedAt}:${currentVersionMeta?.id}:${currentVersionDetailQuery.dataUpdatedAt}:${actionParam}`
          }
          mode="workflow"
          workflowId={workflowId}
          initialDraftVersionId={shouldForceNewVersionOnFirstSave ? null : (currentVersionMeta?.id ?? null)}
          title="工作流封装应用"
          initial={initial}
          submitLabel={submitMutation.isPending ? "保存中..." : mode === "create" ? "确认创建" : "发布此版本至线上"}
          onCancel={() => navigate("/app/workflows")}
          onSubmit={async (r) => {
            await submitMutation.mutateAsync(r);
          }}
          extraHeaderActions={extraHeaderActions}
          forceNewVersionOnFirstSave={shouldForceNewVersionOnFirstSave}
        />
      )}
    </div>
  );
}
