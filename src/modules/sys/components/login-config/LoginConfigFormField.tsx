import { Input } from "@/shared/ui/input";

type LoginConfigFormFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
};

/**
 * 登录配置对话框字段，样式对齐 StorageConfigEditDialog。
 */
export function LoginConfigFormField({
  label,
  value,
  onChange,
  description,
  placeholder,
  secret,
  required,
}: LoginConfigFormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-normal text-foreground">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </label>
      <Input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={secret ? "new-password" : "off"}
      />
      {description ? <p className="text-xs text-muted-foreground leading-relaxed">{description}</p> : null}
    </div>
  );
}
