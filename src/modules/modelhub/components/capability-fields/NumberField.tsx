import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { CapabilityFieldRendererProps } from "@/modules/modelhub/components/ModelCapabilityFieldRegistry";

export function NumberField(props: CapabilityFieldRendererProps) {
  const { field, value, onChange, uiSchema } = props;
  const rendererProps = (uiSchema.props || {}) as {
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
  };
  const handleChange = (rawValue: string) => {
    if (rawValue.trim() === "") {
      onChange("");
      return;
    }

    const nextValue = Number(rawValue);
    onChange(Number.isFinite(nextValue) ? nextValue : rawValue);
  };

  return (
    <div className="space-y-2">
      <Label className="workflow-form-label">{field.label}</Label>
      <Input
        value={String(value ?? "")}
        onChange={(event) => handleChange(event.target.value)}
        className="workflow-form-input"
        type="number"
        placeholder={rendererProps.placeholder || field.placeholder}
        min={rendererProps.min}
        max={rendererProps.max}
        step={rendererProps.step}
      />
      {uiSchema.helperText ? <p className="text-[11px] text-muted-foreground">{uiSchema.helperText}</p> : null}
    </div>
  );
}
