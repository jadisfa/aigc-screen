import { createSSRApp } from "vue";
import App from "./App.vue";

// #ifdef APP-PLUS
import vConsole from '@/uni_modules/s-vconsole/js_sdk/s-vconsole'
// #endif

export function createApp() {
  const app = createSSRApp(App);
  
  // #ifdef APP-PLUS
    app.use(vConsole, {
      // enabled: process.env.NODE_ENV !== 'production',
    })
    // #endif
  return {
    app,
  };
}
