import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { notify } from "@/shared/lib/notify";
import { CapabilityEditorSection } from "@/modules/modelhub/components/model-editor/CapabilityEditorSection";
import { ModelEditorPageShell } from "@/modules/modelhub/components/model-editor/ModelEditorPageShell";
import {
  ModelBasicInfoSection,
  ModelCommonParamsSection,
} from "@/modules/modelhub/components/model-editor/ModelEditorSections";
import type { ModelEditorValue } from "@/modules/modelhub/components/model-editor/modelEditorTypes";
import { useCapabilityWorkbench } from "@/modules/modelhub/hooks/useCapabilityWorkbench";
import { useModelEditorForm } from "@/modules/modelhub/hooks/useModelEditorForm";
import { useModelEditorSubmit } from "@/modules/modelhub/hooks/useModelEditorSubmit";
import {
  loadBaseModelDetail,
  loadBaseModelProviderOptions,
  saveBaseModel,
} from "@/modules/modelhub/services/base-models";
import { resolveModelHubErrorMessage } from "@/modules/modelhub/services/modelhubAdminUi";

export type { ModelEditorValue } from "@/modules/modelhub/components/model-editor/modelEditorTypes";

export default function ModelHubModelEditorPage(props: {
  mode: "create" | "edit";
  editingId?: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const providersQuery = useQuery({
    queryKey: ["modelhub", "providers", "options"],
    queryFn: loadBaseModelProviderOptions,
  });

  const detailQuery = useQuery({
    queryKey: ["modelhub", "base-models", props.editingId ?? "create"],
    queryFn: () => loadBaseModelDetail(props.editingId as string),
    enabled: props.mode === "edit" && Boolean(props.editingId),
  });

  const saveMutation = useMutation({
    mutationFn: (value: ModelEditorValue) => saveBaseModel(props.mode, value),
    onSuccess: () => {
      notify.success(props.mode === "create" ? "创建成功" : "保存成功");
      props.onSuccess();
    },
    onError: (error) => {
      notify.error(resolveModelHubErrorMessage(error, "基础模型保存失败"));
    },
  });

  const providerOptions = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);

  const editorForm = useModelEditorForm({
    mode: props.mode,
    providers: providerOptions,
    initialModel: detailQuery.data,
    onSuccess: (value) => {
      saveMutation.mutate(value);
    },
  });
  const capabilityWorkbench = useCapabilityWorkbench({
    capabilityCodes: editorForm.capabilityCodes,
    capabilityConfigs: editorForm.form.capabilityConfigs,
    capabilitySnapshot: editorForm.capabilitySnapshot,
    onAddCapability: editorForm.addCapability,
    onRemoveCapability: editorForm.removeCapability,
    onReplaceCapabilityConfig: editorForm.replaceCapabilityConfig,
    onUpdateCapabilityConfig: editorForm.updateCapabilityConfig,
  });
  const handleSave = useModelEditorSubmit({
    submit: editorForm.submit,
    onFocusFirstInvalidCapability: capabilityWorkbench.focusFirstInvalidCapability,
  });
  const loading =
    providersQuery.isLoading ||
    (props.mode === "edit" && detailQuery.isLoading);

  if (loading) {
    return (
      <ModelEditorPageShell
        title={props.mode === "create" ? "新增基础模型" : "编辑基础模型"}
        onCancel={props.onCancel}
        onSave={() => undefined}
        saveDisabled
        cancelDisabled={saveMutation.isPending}
      >
        <div className="rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          {props.mode === "edit" ? "正在加载基础模型详情..." : "正在加载厂商选项..."}
        </div>
      </ModelEditorPageShell>
    );
  }

  const providersError = providersQuery.isError
    ? resolveModelHubErrorMessage(providersQuery.error, "模型厂商加载失败")
    : null;
  const detailError =
    props.mode === "edit" && detailQuery.isError
      ? resolveModelHubErrorMessage(detailQuery.error, "基础模型详情加载失败")
      : null;
  const saveDisabled = saveMutation.isPending || Boolean(providersError || detailError);

  return (
    <ModelEditorPageShell
      title={props.mode === "create" ? "新增基础模型" : "编辑基础模型"}
      onCancel={props.onCancel}
      onSave={handleSave}
      saveDisabled={saveDisabled}
      cancelDisabled={saveMutation.isPending}
      saveLabel={saveMutation.isPending ? "保存中..." : "保存"}
    >
      {providersError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {providersError}
        </div>
      ) : null}
      {detailError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {detailError}
        </div>
      ) : null}
      <ModelBasicInfoSection
        form={editorForm.form}
        capabilitySummary={editorForm.capabilitySnapshot.capabilitySummary}
        providers={providerOptions}
        onChange={editorForm.updateForm}
      />
      <ModelCommonParamsSection form={editorForm.form} onChange={editorForm.updateForm} />

      <CapabilityEditorSection capabilityWorkbench={capabilityWorkbench} />
    </ModelEditorPageShell>
  );
}
