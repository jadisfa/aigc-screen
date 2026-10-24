import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { CapabilityFieldRendererProps } from "@/modules/modelhub/components/ModelCapabilityFieldRegistry";


export function BooleanField(props: CapabilityFieldRendererProps) {
  const { code, field, value, onChange, uiSchema } = props;

  return (
    <div className="rounded-lg bg-muted/30 px-4 py-3">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${code}-${field.key}`}
          className="mt-1"
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <div className="space-y-1">
          <Label htmlFor={`${code}-${field.key}`} className="workflow-form-label cursor-pointer leading-5">
            {field.label}
          </Label>
          {uiSchema.helperText ? <p className="text-[11px] text-muted-foreground">{uiSchema.helperText}</p> : null}
        </div>
      </div>
    </div>
  );
}


