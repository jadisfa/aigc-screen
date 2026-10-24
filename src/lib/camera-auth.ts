// lib/camera-auth.ts

/* ==================== 平台判断 ==================== */

function isApp(): boolean {
  // #ifdef APP-PLUS
  return true;
  // #endif
  // #ifndef APP-PLUS
  return false;
  // #endif
}

function isH5(): boolean {
  // #ifdef H5
  return true;
  // #endif
  // #ifndef H5
  return false;
  // #endif
}

/* ==================== App 端 ==================== */

type AppCameraState = "authorized" | "denied" | "not determined" | "restricted";

function getAppCameraState(): AppCameraState {
  try {
    const setting = uni.getAppAuthorizeSetting();
    return (setting.cameraAuthorized || "not determined") as AppCameraState;
  } catch (err) {
    console.error("[camera-auth] getAppAuthorizeSetting fail", err);
    return "not determined";
  }
}

function openAppAuthorizeSetting(): Promise<void> {
  return new Promise((resolve) => {
    uni.openAppAuthorizeSetting({
      success: () => resolve(),
      fail: () => resolve(),
    });
  });
}

function requestAppAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof uni.authorize !== "function") return resolve(false);
    uni.authorize({
      scope: "scope.camera",
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

async function ensureAppCameraAuth(): Promise<boolean> {
  const state = getAppCameraState();

  // 1. 已授权
  if (state === "authorized") return true;

  // 2. 从未申请过 → 弹系统弹窗
  if (state === "not determined") {
    const granted = await requestAppAuth();
    if (granted) return true;
  }

  // 3. 曾拒绝 → 打开系统设置，立即返回 false
  //    不轮询！让 onShow 从设置页返回后重新检查
  await openAppAuthorizeSetting();
  return false;
}

/* ==================== H5 端 ==================== */

type H5AuthState = "granted" | "denied" | "prompt" | "unsupported";

async function checkH5State(): Promise<H5AuthState> {
  if (typeof navigator === "undefined") return "unsupported";
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  if (!navigator.permissions?.query) return "prompt";
  try {
    const result = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    return result.state as H5AuthState;
  } catch {
    return "prompt";
  }
}

async function requestH5Auth(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err) {
    console.error("[camera-auth] getUserMedia fail", err);
    return false;
  }
}

async function ensureH5CameraAuth(): Promise<boolean> {
  const state = await checkH5State();

  if (state === "granted") return true;

  if (state === "unsupported") {
    uni.showModal({
      title: "无法使用相机",
      content: "当前浏览器不支持相机，或页面不是 HTTPS/localhost",
      showCancel: false,
    });
    return false;
  }

  if (state === "denied") {
    uni.showModal({
      title: "需要相机权限",
      content: "请在浏览器地址栏的权限设置中允许访问摄像头",
      showCancel: false,
    });
    return false;
  }

  return requestH5Auth();
}

/* ==================== 统一入口 ==================== */

export async function ensureCameraAuth(): Promise<boolean> {
  if (isApp()) return ensureAppCameraAuth();
  if (isH5()) return ensureH5CameraAuth();
  return false;
}

export function isAppCameraAuthorized(): boolean {
  if (!isApp()) return true;
  return getAppCameraState() === "authorized";
}