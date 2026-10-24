import { memo } from "react";
import { Checkbox } from "@/shared/ui/checkbox";
import { REMEMBER_LABEL } from "./loginTheme";

type LoginRememberMeProps = {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean | "indeterminate") => void;
};

export const LoginRememberMe = memo(function LoginRememberMe({
  id,
  checked,
  onCheckedChange,
}: LoginRememberMeProps) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <label htmlFor={id} className={REMEMBER_LABEL}>
        7天免登录
      </label>
    </div>
  );
});
