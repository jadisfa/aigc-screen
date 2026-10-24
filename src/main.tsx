import { createRoot } from "react-dom/client";
import { consumeAuthTabHandoff } from "@/shared/api/auth/auth";
import { installSessionKeepAlive } from "@/shared/api/auth/token-refresh";
import { installAppUpdateGuard } from "@/shared/lib/app-update";
import "@/assets/fonts/noto-sans-sc/wght.css";
import "@/assets/fonts/noto-serif-sc/wght.css";
import App from "./App.tsx";
import "./index.css";
import "@/assets/css/scss/global.scss";

consumeAuthTabHandoff();
installSessionKeepAlive();
installAppUpdateGuard();

createRoot(document.getElementById("root")!).render(<App />);
