import React, { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "@/assets/css/commonLogo.css";

interface MaskOverlayProps {
  creation?: boolean;
  custom?: boolean;
  home?: boolean;
}

const CommonLogo: React.FC<MaskOverlayProps> = ({
  creation = false,
  custom = false,
  home = false,
}) => {
  const navigate = useNavigate();
  const logoUrl =
    "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203110237325-logo1-ndmy-wyasny.png";

  const handleReturnHome = () => {
    navigate("/");
  };
  return (
    <div
      className={`logo-image ${creation ? "creation-img" : ""} ${custom ? "custom-img" : ""} ${home ? "custom-home-img" : ""}`}
      style={{ background: `url(${logoUrl}) no-repeat center / contain` }}
      onClick={handleReturnHome}
    ></div>
  );
};

export default CommonLogo;
