// components/GenerateButton.tsx
import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "antd";
import { useDebounceFn } from "@/shared/hooks/use-debounce";
import creatIcon from "@/assets/svg/creat.svg";
import creatEnableIcon from "@/assets/svg/creat-enable.svg";
import "@/assets/css/scss/GenerateButton.scss";

interface GenerateButtonProps {
  disabled?: boolean;
  power: number;
  onClick: () => void;
  className?: string;
}

const ComponentResusableButton: React.FC<GenerateButtonProps> = ({
  disabled = false,
  power,
  onClick,
  className = "",
}) => {
  const onClickRef = useRef(onClick);
  // 使用 useMemo 缓存图标
  const iconSrc = useMemo(() => {
    return disabled ? creatIcon : creatEnableIcon;
  }, [disabled]);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);
  // 使用函数防抖
  const { run: debouncedClick } = useDebounceFn(() => {
    onClickRef.current();
  }, 500);

  const handleClick = useCallback(() => {
    debouncedClick();
  }, [debouncedClick]);

  return (
    <Button
      type="primary"
      disabled={disabled}
      className={`generate-btn ${disabled ? "disabled" : "enable"} ${className}`}
      onClick={handleClick}
      icon={
        <img
          src={iconSrc}
          alt={disabled ? "生成不可用" : "生成"}
          className="generate-icon"
        />
      }
    >
      {`${power}  生成`}
    </Button>
  );
};

export default ComponentResusableButton;
