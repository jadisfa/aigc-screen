import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken } from "@/shared/api/auth/auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/custom/home" replace state={{ from: location.pathname }} />;
    // return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

