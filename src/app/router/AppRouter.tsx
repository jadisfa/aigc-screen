import { Component, type ReactNode } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { ErrorState } from "@/shared/components/ErrorState";
import { isStaleChunkError, reloadForStaleBundle } from "@/shared/lib/app-update";
import AppRoutes from "./routes";

type RouterLocationSnapshot = {
  pathname: string;
  search: string;
  hash: string;
};

type RouterErrorBoundaryProps = { children: ReactNode; location: RouterLocationSnapshot };
type RouterErrorBoundaryState = { hasError: boolean };

class RouterErrorBoundary extends Component<RouterErrorBoundaryProps, RouterErrorBoundaryState> {
  state: RouterErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    if (isStaleChunkError(error) && reloadForStaleBundle("error-boundary")) {
      return;
    }
    const location = this.props.location;
    console.groupCollapsed("[AppErrorBoundary] Uncaught error");
    console.error("location:", location);
    console.error("error:", error);
    console.error("errorInfo:", errorInfo);
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen">
          <ErrorState title="页面发生错误" description="页面运行时发生严重异常，请刷新页面后重试。" code="500" />
        </div>
      );
    }
    return this.props.children;
  }
}

function RouterErrorBoundaryWithReset(props: { children: ReactNode }) {
  const location = useLocation();
  return (
    <RouterErrorBoundary
      key={location.key}
      location={{ pathname: location.pathname, search: location.search, hash: location.hash }}
    >
      {props.children}
    </RouterErrorBoundary>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <RouterErrorBoundaryWithReset>
        <AppRoutes />
      </RouterErrorBoundaryWithReset>
    </BrowserRouter>
  );
}




