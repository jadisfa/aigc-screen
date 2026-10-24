import type { ParsedWorkflowNode } from "@/shared/api/workflow/workflow";
import WorkflowPageBuilder from "@/modules/workflow/components/pagebuilder/WorkflowPageBuilder";

export default function WorkflowWizardPageBuilderSection(props: {
  uiSchemaText: string;
  onUiSchemaTextChange: (next: string) => void;
  nodes: ParsedWorkflowNode[];
  rawJson: unknown;
}) {
  return <WorkflowPageBuilder uiSchemaText={props.uiSchemaText} onUiSchemaTextChange={props.onUiSchemaTextChange} nodes={props.nodes} rawJson={props.rawJson} />;
}
