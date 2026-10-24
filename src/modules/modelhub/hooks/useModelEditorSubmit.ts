import { useCallback } from "react";
import { notify } from "@/shared/lib/notify";
import type { ModelEditorInvalidSubmitState } from "@/modules/modelhub/hooks/useModelEditorForm";
import type { ModelCapabilityCode } from "@/modules/modelhub/types/modelCapabilityMetadata";

/**
 * 模型编辑页保存：先 toast 首条校验问题，再聚焦第一个非法能力区。
 */
export function useModelEditorSubmit(props: {
  submit: (onInvalid?: (state: ModelEditorInvalidSubmitState) => void) => boolean;
  onFocusFirstInvalidCapability: (
    validationIssues: Partial<Record<ModelCapabilityCode, string[]>>,
  ) => void;
}) {
  const { submit, onFocusFirstInvalidCapability } = props;

  return useCallback(() => {
    submit(({ capabilityValidationIssues, validationIssues }) => {
      if (validationIssues.length > 0) {
        notify.error(validationIssues[0]);
      }
      onFocusFirstInvalidCapability(capabilityValidationIssues);
    });
  }, [onFocusFirstInvalidCapability, submit]);
}
