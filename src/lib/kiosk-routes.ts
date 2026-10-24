/** C 端电子屏（顾客使用） */
export const KIOSK_PAGES = {
  home: "/pages/kiosk/home/index",
  products: "/pages/kiosk/products/index",
  scanUpload: "/pages/kiosk/upload/scan-upload/index",
  camera: "/pages/kiosk/upload/camera-capture/index",
  keywords: "/pages/kiosk/generate/keywords/index",
  generating: "/pages/kiosk/generate/generating/index",
  results: "/pages/kiosk/generate/results/index",
  productDetail: "/pages/kiosk/generate/product-detail/index",
  tryOn: "/pages/kiosk/try-on/index",
  tryOnWait: "/pages/kiosk/try-on/wait/index",
  tryOnResult: "/pages/kiosk/try-on/result/index",
} as const;

/** 机上管理（店员配置） */
export const ADMIN_PAGES = {
  login: "/pages/admin/login/index",
  home: "/pages/admin/home/index",
  banner: "/pages/admin/banner/index",
  bannerDetail: "/pages/admin/banner/detail/index",
  bannerLibrary: "/pages/admin/banner/library/index",
  bannerLibraryDetail: "/pages/admin/banner/library/detail/index",
  bannerUpload: "/pages/admin/banner/upload/index",
  store: "/pages/admin/store/index",
  version: "/pages/admin/version/index",
  history: "/pages/admin/history/index",
  historyDetail: "/pages/admin/history/detail/index",
  product: "/pages/admin/product/index",
  productDetail: "/pages/admin/product/detail/index",
  hand: "/pages/admin/hand/index",
  handLibrary: "/pages/admin/hand/library/index",
  handDetail: "/pages/admin/hand/detail/index",
} as const;

let backNavLock = false;

function swallowUniNav(run: () => unknown) {
  try {
    const ret = run();
    if (ret && typeof (ret as Promise<unknown>).then === "function") {
      void (ret as Promise<unknown>).catch(() => undefined);
    }
  } catch {
    /* uni 同步抛 */
  }
}

/**
 * 有上一页则返回；否则落到 url。
 * H5 的 navigateBack 会再触发 onBackPress，fail 后立刻 reLaunch 会和下一跳互取消。
 */
export function goBackOr(url: string) {
  if (backNavLock) {
    return;
  }
  backNavLock = true;
  const fallback = url.startsWith("/") ? url : `/${url}`;
  const unlock = () => {
    backNavLock = false;
  };
  setTimeout(unlock, 800);
  // H5：navigateBack 会再进 onBackPress；return true 会取消当前返回，再 fail→reLaunch 就会互取消。
  // #ifdef H5
  swallowUniNav(() =>
    uni.reLaunch({
      url: fallback,
      complete: unlock,
    }),
  );
  return;
  // #endif
  const stack = getCurrentPages();
  if (stack.length > 1) {
    swallowUniNav(() =>
      uni.navigateBack({
        delta: 1,
        success: unlock,
        fail: () => {
          swallowUniNav(() =>
            uni.reLaunch({
              url: fallback,
              complete: unlock,
            }),
          );
        },
      }),
    );
    return;
  }
  swallowUniNav(() =>
    uni.reLaunch({
      url: fallback,
      complete: unlock,
    }),
  );
}
