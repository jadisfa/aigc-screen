import React, { ReactNode } from "react";

interface MaskOverlayProps {
  overlayText?: string;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

const HoverMask: React.FC<MaskOverlayProps> = ({
  overlayText = "",
  onClick,
  children,
  className = "",
}) => {
  return (
    <div
      className={`
        relative overflow-hidden cursor-pointer group rounded-[inherit]
        hover-mask
        ${className}
      `}
      style={{ borderRadius: "8px" }}
      onClick={onClick}
    >
      {/* 遮罩层 */}
      <div
        className="
          absolute inset-0 bg-black/30 
          opacity-0 group-hover:opacity-100 
          transition-opacity duration-300 
          rounded-[inherit]
          z-10
        "
      >
        {/* 文字 */}
        {overlayText && (
          <div
            className="
            absolute inset-0 
            flex items-center justify-center 
            !text-white text-base 
            opacity-0 group-hover:opacity-100 
            transition-opacity duration-300 
            z-20
            pointer-events-none
          "
            style={{ color: "#fff" }}
          >
            {overlayText}
          </div>
        )}
      </div>

      {/* 子内容 */}
      {children}
    </div>
  );
};

export default HoverMask;
