// custom-clearn-positive.tsx
import React, { useCallback } from "react";
import { Tooltip } from "antd";
import { XCircle } from "lucide-react";
import "@/assets/css/scss/workflow-common.scss";

interface CustomClearnPositiveProps {
  data?: string;
  onClearnPosition?: () => void;
  className?: string;
}

const ComponentCustomClearnPositive: React.FC<CustomClearnPositiveProps> = ({
  data,
  onClearnPosition,
  className,
}) => {
  const handleClick = useCallback(() => {
    onClearnPosition?.();
  }, [onClearnPosition]);

  // 只有当 data 存在且有内容时才显示
  const shouldShow = data && data.length > 0;

  if (!shouldShow) {
    return null;
  }

  return (
    <Tooltip title="清空提示词" placement="top">
      <XCircle
        className="custom-close-icon"
        onClick={handleClick}
        style={{
          cursor: "pointer",
          fontSize: "10px",
          color: "#999",
          transition: "color 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#7d33ff";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#999";
        }}
      />
    </Tooltip>
  );
};

export default ComponentCustomClearnPositive;
