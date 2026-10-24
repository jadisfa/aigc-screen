import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

export default function ConsoleLayout() {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AppSidebar />
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex">
          <Outlet />
        </div>
      </div>
    </div>
  );
}





