import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

const API_DOC_SOURCE = path.resolve(__dirname, "../contracts/openapi/AI应用接口文档.md");
const API_DOC_PUBLIC = path.resolve(__dirname, "./public/docs/ai-api.md");

/** 将契约目录中的 AI 应用接口文档同步到前端静态资源，供控制台 /docs/api 展示 */
function syncApiDocsPlugin(): Plugin {
  const sync = () => {
    fs.mkdirSync(path.dirname(API_DOC_PUBLIC), { recursive: true });
    if (!fs.existsSync(API_DOC_SOURCE)) {
      console.warn(`[sync-api-docs] source missing: ${API_DOC_SOURCE}`);
      return;
    }
    fs.copyFileSync(API_DOC_SOURCE, API_DOC_PUBLIC);
  };
  return {
    name: "sync-api-docs",
    buildStart: sync,
    configureServer(server) {
      sync();
      server.watcher.add(API_DOC_SOURCE);
      server.watcher.on("change", (file) => {
        if (path.resolve(file) === API_DOC_SOURCE) sync();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 9000,
    hmr: {
      overlay: false,
    },
    allowedHosts: ['11842ww9xe438.vicp.fun', 'ndmy.net', 'aimp.ndmy.net', 'test.ndmy.net'],
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
  plugins: [react(), syncApiDocsPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // fabric 7.3.1 的 package exports 指向了缺失的 .mjs 入口，显式别名到实际存在的构建产物
      fabric: path.resolve(__dirname, "./node_modules/fabric/dist/index.min.js"),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("fabric")) return "vendor-fabric";
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-tiptap";
          if (id.includes("recharts") || id.includes("/d3-")) return "vendor-recharts";
          if (id.includes("lottie")) return "vendor-lottie";
          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("micromark") ||
            id.includes("mdast") ||
            id.includes("unist-")
          ) {
            return "vendor-markdown";
          }
        },
      },
    },
  },
}));
