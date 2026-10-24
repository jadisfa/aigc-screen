import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { CapabilityFieldRendererProps } from "@/modules/modelhub/components/ModelCapabilityFieldRegistry";

export function TextField(props: CapabilityFieldRendererProps) {
  const { field, value, onChange, uiSchema } = props;
  const rendererProps = (uiSchema.props || {}) as {
    placeholder?: string;
  };

  return (
    <div className="space-y-2">
      <Label className="workflow-form-label">{field.label}</Label>
      <Input
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        className="workflow-form-input"
        placeholder={rendererProps.placeholder || field.placeholder}
      />
      {uiSchema.helperText ? <p className="text-[11px] text-muted-foreground">{uiSchema.helperText}</p> : null}
    </div>
  );
}

