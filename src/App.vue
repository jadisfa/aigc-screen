<script setup lang="ts">
import { onMounted } from "vue";
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { discardMismatchedDevice } from "@/lib/device-auth";
import { captureDeviceCodeFromLaunch, hasAdminSession, loadDeviceCodeFromFile } from "@/lib/device-session";
import { resolveKioskAuth } from "@/lib/kiosk-auth";
import { ADMIN_PAGES, KIOSK_PAGES } from "@/lib/kiosk-routes";
import { trackSdk } from "@/lib/track-sdk";
import { ensureLocalScreenVersion } from "@/lib/screen-version";
import KioskToast from "@/components/kiosk/kiosk-toast.vue";
import successIcon from "@/static/admin/success.svg";
import errIcon from "@/static/admin/error.svg";


onLaunch((options) => {
  discardMismatchedDevice();
  captureDeviceCodeFromLaunch(options?.query as Record<string, string | undefined> | undefined);
  ensureLocalScreenVersion();
  // 区分开发/生产环境
  if (process.env.NODE_ENV !== 'development') void loadDeviceCodeFromFile();
});

onMounted(() => {
  // 挂到全局
  (uni as any).$toast = {
      show: (opts: any) => uni.$emit("kiosk:toast:show", opts),
      hide: () => uni.$emit("kiosk:toast:hide"),
      success: (title: string, icon?: string, duration: number = 2000) =>
        uni.$emit("kiosk:toast:show", {
          icon: icon || successIcon,
          title,
          duration,
        }),
      error: (title: string, icon?: string, duration: number = 2000) =>
        uni.$emit("kiosk:toast:show", {
          icon: icon || errIcon,
          title,
          duration,
        }),
      text: (title: string) =>
        uni.$emit("kiosk:toast:show", { title, duration: 2000 }),
    };
	// 自定义modal挂载
	(uni as any).$modal = {
	    show: (opts: any) => uni.$emit("kiosk:modal:show", opts),
	    hide: () => uni.$emit("kiosk:modal:hide"),
	    load: (title: string, dec: string, btnText: string, type: number, duration: number = 2000) =>
	      uni.$emit("kiosk:modal:show", {
	        title,
			dec,
			btnText,
			type,
	        duration,
	      }),
	  };
	  // 自定义modal挂载
	  (uni as any).$ResultModal = {
	      show: (opts: any) => uni.$emit("kiosk:ResultModal:show", opts),
	      hide: () => uni.$emit("kiosk:ResultModal:hide"),
	      load: (title: string, dec: string, btnText: string, type: number, duration: number = 2000, url: string) =>
	        uni.$emit("kiosk:ResultModal:show", {
	          title,
	  		dec,
	  		btnText,
	  		type,
	          duration,
			  url,
	        }),
	    };
});

onShow(() => {
  void onAppShow();
});

async function onAppShow() {
  await loadDeviceCodeFromFile();
  const pages = getCurrentPages();
  const last = pages[pages.length - 1] as { route?: string } | undefined;
  const route = last?.route || "";
  if (route.startsWith("pages/admin/") && route !== "pages/admin/login/index") {
    if (!hasAdminSession()) {
      uni.reLaunch({ url: ADMIN_PAGES.login });
      return;
    }
  } else if (route.startsWith("pages/kiosk/")) {
    await gateKiosk(route);
  }
}

async function gateKiosk(route: string) {
  const state = await resolveKioskAuth();
  if (state === "unauthorized" && route !== "pages/kiosk/home/index") {
    uni.reLaunch({ url: KIOSK_PAGES.home });
  }
}

onHide(() => {
  void trackSdk.flush();
});
</script>

<style>
@font-face {
  font-family: "Noto Sans SC";
  src: url("/static/fonts/noto-sans-sc-500.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Noto Sans SC";
  src: url("/static/fonts/noto-sans-sc-700.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

page {
  height: 100%;
  background-color: #f0f0f0;
  font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif;
  color: #333;
  --u: calc(min(100vw, 1080px) / 1080);
}

/* #ifdef H5 */
html,
body,
uni-app,
uni-page,
uni-page-wrapper,
uni-page-body {
  height: 100%;
}
body {
  margin: 0;
  background: #d8d8d8;
}
.uni-simple-toast__text,
.uni-toast__content,
.uni-sample-toast,
uni-toast .uni-toast {
  font-size: 16px !important;
  line-height: 1.4;
}
/* #endif */
</style>
