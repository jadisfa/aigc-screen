import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
  plugins: [uni()],
  server: {
    host: true,
    port: 8004,
    proxy: {
      "/api": {
        // target: "http://127.0.0.1:8080",
        target: "https://screen.marvelvision.com.cn",
        changeOrigin: true,
      },
    },
  },
});
