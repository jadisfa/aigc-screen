import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { CapabilityFieldRendererProps } from "@/modules/modelhub/components/ModelCapabilityFieldRegistry";

export function TextareaField(props: CapabilityFieldRendererProps) {
  const { field, value, onChange, uiSchema } = props;

  return (
    <div className="space-y-2">
      <Label className="workflow-form-label">{field.label}</Label>
      <Textarea
        value={String(value || "")}
        onChange={(event) => onChange(event.target.value)}
        className="workflow-form-textarea min-h-[96px]"
        placeholder={field.placeholder}
      />
      {uiSchema.helperText ? <p className="text-[11px] text-muted-foreground">{uiSchema.helperText}</p> : null}
    </div>
  );
}
