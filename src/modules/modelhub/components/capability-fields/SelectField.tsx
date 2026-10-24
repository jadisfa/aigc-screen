import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { CapabilityFieldRendererProps } from "@/modules/modelhub/components/ModelCapabilityFieldRegistry";

export function SelectField(props: CapabilityFieldRendererProps) {
  const { field, value, onChange, uiSchema } = props;
  const rendererProps = (uiSchema.props || {}) as {
    placeholder?: string;
  };
  const resolvedOptions = uiSchema.options || field.options || [];
  const helperText = uiSchema.helperText;

  return (
    <div className="space-y-2">
      <Label className="workflow-form-label">{field.label}</Label>
      <Select value={String(value || "")} onValueChange={(val) => onChange(val)}>
        <SelectTrigger className="subpage-native-select w-full h-10">
          <SelectValue placeholder={rendererProps.placeholder || field.placeholder} />
        </SelectTrigger>
        <SelectContent className="subpage-select-content">
          {resolvedOptions.map((option) => (
            <SelectItem key={option.value} className="subpage-select-item" value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {helperText ? <p className="text-[11px] text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}

