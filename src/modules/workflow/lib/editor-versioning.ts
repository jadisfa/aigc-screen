import type { WorkflowVersion } from "@/shared/api/workflow/workflow-version";
import type { WorkflowLifecycleStatus } from "@/shared/api/workflow/workflow";

export type WorkflowEditorVersionContext = {
  baseVersion: WorkflowVersion | null;
  shouldForceNewVersionOnFirstSave: boolean;
};

export function resolveWorkflowEditorVersionContext(params: {
  actionParam: string | null;
  versionIdParam: string | null;
  workflowStatus?: WorkflowLifecycleStatus | null;
  currentVersionNo?: string | null;
  versions: WorkflowVersion[];
}): WorkflowEditorVersionContext {
  const { actionParam, versionIdParam, workflowStatus, currentVersionNo, versions } = params;

  const baseVersion = (() => {
    if (versions.length === 0) return null;
    if (versionIdParam) {
      return versions.find((v) => v.id === versionIdParam) || null;
    }
    if (workflowStatus === "online" && currentVersionNo) {
      return versions.find((v) => v.versionNo === currentVersionNo) || null;
    }
    return versions[0] ?? null;
  })();

  const shouldForceNewVersionOnFirstSave = (() => {
    if (actionParam === "newVersion") return true;
    if (workflowStatus !== "online" || !currentVersionNo || !baseVersion) {
      return false;
    }
    if (!versionIdParam) {
      return true;
    }
    return baseVersion.versionNo === currentVersionNo;
  })();

  return {
    baseVersion,
    shouldForceNewVersionOnFirstSave,
  };
}
