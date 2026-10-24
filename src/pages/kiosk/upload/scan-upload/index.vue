<template>
  <view class="scan">
    <view class="scan__bar">
      <kiosk-chip :icon="ICONS.back" label="返回" @click="onBack" />
      <kiosk-chip :icon="ICONS.camera" variant="camera" label="相机拍摄" @click="onCamera" />
    </view>

    <text class="scan__title">{{ flow.title }}</text>
    <text class="scan__lead">{{ flow.lead }}</text>

    <scan-stage class="scan__stage" :preview="preview" :status="status" :qr-src="qrSrc" @retry="resetQr" />
	
	<view class="scan__nail_name" v-if="intent == 'hand-admin'">
		<input
		  type="text"
		  class="scan-sheet__input"
		  v-model="nailName"
		  placeholder="手模名称"
		  placeholder-style="color:#C7C7CC"
		/>
	</view>
	
    <view class="scan__actions">
      <view
        class="scan__btn"
        :class="{ 'scan__btn--disabled': !preview, 'scan__btn--solid': preview }"
        hover-class="none"
        @click="onConfirm"
      >
        <text>{{ flow.confirmText }}</text>
      </view>
      <view v-if="preview" class="scan__btn scan__btn--ghost" hover-class="none" @click="onReupload">
        <text>重新上传</text>
      </view>
    </view>
	
    <photo-examples class="scan__examples" :type="intent" />
    <text class="scan__privacy">您上传的图片仅用于 AI 识别，信息严格保密，请安心上传</text>
	
	<KiostModal @reUpload="handleReupload" />
	<KioskToast />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onBackPress, onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import PhotoExamples from "@/components/upload/photo-examples.vue";
import ScanStage from "@/components/upload/scan-stage.vue";
import { isRemoteAsset, publishLocalCapture } from "@/lib/local-capture";
import { KIOSK_PAGES ,goBackOr } from "@/lib/kiosk-routes";
import {
  isPollAborted,
  mapScanStatus,
  pollUntilTerminal,
  qrImageUrl,
  scanTransport,
} from "@/lib/scan-session";
import { fetchHandModels, patchHandModel } from "@/lib/screen-api/hand-models";
import { showScreenError } from "@/lib/screen-http";
import { trackOutfitSubmit } from "@/lib/track-events";
import {
  cameraUrl,
  clearPreview,
  discardUploadDraft,
  consumeCameraEntered,
  hasCameraHandoff,
  parseUploadIntent,
  readOutfitUploadId,
  readPreview,
  scanBackUrl,
  takeCameraHandoff,
  UPLOAD_FLOWS,
  writeOutfitUploadId,
  writePreview,
  type ScanStatus,
  type UploadIntent,
} from "@/lib/upload-flow";
import KiostModal from "@/components/kiosk/kiosk-modal.vue";
import KioskToast from "@/components/kiosk/kiosk-toast.vue";

const ICONS = {
  back: "/static/scan/back.svg",
  camera: "/static/scan/camera.svg",
};

const intent = ref<UploadIntent>("outfit");
const preview = ref("");
const fullPath = ref('');
const status = ref<ScanStatus>("waiting");
const qrSrc = ref("");
const nailName = ref("");
const flow = computed(() => UPLOAD_FLOWS[intent.value]);
let scanSessionId = "";
let scanGen = 0;
let scanBusy = false;
let committed = false;
let entryPreview = "";
let entryOutfitId = "";
let cameraOpen = false;
let confirming = false;
let leaving = false;
let waitTimer: ReturnType<typeof setTimeout> | null = null;
const WAIT_MS = 300_000;

onLoad((query?: Record<string, string>) => {
  intent.value = parseUploadIntent(query);
  fullPath.value = query?.fullPath || '';
  entryPreview = readPreview(intent.value);
  entryOutfitId =
    intent.value === "outfit" || intent.value === "inspire" ? readOutfitUploadId() : "";
});

onShow(() => {
  if (!scanIsTop()) {
    haltScan(true);
    return;
  }
  const entered = consumeCameraEntered();
  const shot = takeCameraHandoff(intent.value);
  if (cameraOpen && !entered) {
    haltScan(true);
    return;
  }
  const backFromCamera = cameraOpen || entered;
  cameraOpen = false;
  if (shot) {
    writePreview(intent.value, shot);
    preview.value = shot;
    status.value = "uploaded";
    qrSrc.value = "";
    haltScan(true);
    return;
  }
  preview.value = readPreview(intent.value);
  if (preview.value) {
    status.value = "uploaded";
    haltScan(false);
    void fillNailNameFromUpload(preview.value);
    return;
  }
  if (backFromCamera || !(scanSessionId || scanBusy)) {
    startScan();
  }
});

onHide(() => {
  if (cameraOpen) {
    haltScan(true);
  }
});
watch(status, (val) => {
  if (val === "waiting") {
    armWaitTimer();
    return;
  }
  clearWaitTimer();
});

onUnload(() => {
  clearWaitTimer();
  if (committed) {
    haltScan(status.value !== "uploaded");
    return;
  }
  if (cameraOpen || hasCameraHandoff(intent.value)) {
    haltScan(true);
    return;
  }
  revertVisit();
});

onBackPress(() => {
  if (cameraOpen || hasCameraHandoff(intent.value)) {
    return scanIsTop();
  }
  if (leaving) {
    return false;
  }
  onBack();
  return true;
});

function onBack() {
  if (leaving) {
    return;
  }
  leaving = true;
  clearWaitTimer();
  revertVisit();
  const url = scanBackUrl(intent.value);
  if (getCurrentPages().length > 1) {
    uni.navigateBack({
      delta: 1,
      fail: () => {
        uni.reLaunch({ url });
      },
    });
    return;
  }
  uni.reLaunch({ url });
}

function armWaitTimer() {
  clearWaitTimer();
  waitTimer = setTimeout(() => {
    waitTimer = null;
    if (status.value === "waiting") {
      status.value = "expired";
    }
  }, WAIT_MS);
}

function clearWaitTimer() {
  if (!waitTimer) {
    return;
  }
  clearTimeout(waitTimer);
  waitTimer = null;
}

/** 未点确认就离开：丢掉本次上传，试戴替换取消时恢复进入前的图。 */
function revertVisit() {
  haltScan(true);
  discardUploadDraft(intent.value);
  if (entryPreview) {
    writePreview(intent.value, entryPreview);
  }
  if (entryOutfitId) {
    writeOutfitUploadId(entryOutfitId);
  }
  preview.value = "";
  status.value = "waiting";
  qrSrc.value = "";
  nailName.value = "";
}

function onCamera() {
	// uni.chooseImage({
	//     count: 1,
	//     sourceType: ["camera"],
	//     sizeType: ["compressed"],
	//     camera: "front",
	//     success: (res) => {
	//       const tempFilePath = res.tempFilePaths?.[0];
	//       if (!tempFilePath) {
	//         uni.showToast({ title: "未获取到照片", icon: "none" });
	//         return;
	//       }
	//       haltScan(true);
	//       writePreview(intent.value, tempFilePath);
	//       preview.value = tempFilePath;
	//       status.value = "uploaded";
	//       qrSrc.value = "";
	//       void fillNailNameFromUpload(tempFilePath);
	//     },
	//     fail: (err) => {
	//       console.error("[camera] chooseImage fail", err);
	//       const msg = String((err as any)?.errMsg || "");
	//       if (msg.includes("cancel")) return;
	//       if (msg.includes("auth") || msg.includes("denied") || msg.includes("permission")) {
	//         uni.showModal({
	//           title: "需要相机权限",
	//           content: "请在设置中开启相机权限后重试",
	//           confirmText: "去设置",
	//           success: (r) => {
	//             if (r.confirm) uni.openAppAuthorizeSetting();
	//           },
	//         });
	//         return;
	//       }
	//       uni.showToast({ title: "打开相机失败", icon: "none" });
	//     },
	//   });
  // cameraOpen = true;
  // haltScan(true);
  // uni.navigateTo({
  //   url: cameraUrl(intent.value),
  //   fail: () => {
  //     cameraOpen = false;
  //     if (!preview.value) {
  //       startScan();
  //     }
  //   },
  // });
  uni.navigateTo({
    url: `/components/kiosk/kiosk-custom-camera?intent=${intent.value}&fullPath=${fullPath.value}`
  });
}

function scanIsTop() {
  const pages = getCurrentPages();
  const route = String((pages[pages.length - 1] as { route?: string } | undefined)?.route || "");
  return route.includes("scan-upload");
}

async function startScan() {
  if (cameraOpen) {
    return;
  }
  const my = ++scanGen;
  haltScan(Boolean(scanSessionId), false);
  scanBusy = true;
  qrSrc.value = "";
  status.value = "waiting";
  armWaitTimer();
  const api = scanTransport(intent.value);
  try {
    const issued = await api.issue();
    if (my !== scanGen) {
      if (issued?.sessionId) {
        api.cancel(issued.sessionId).catch(() => undefined);
      }
      return;
    }
    if (!issued.h5Url) {
      throw new Error("出码失败：未返回上传地址");
    }
    scanSessionId = issued.sessionId;
    qrSrc.value = await qrImageUrl(issued.h5Url);
    const session = await pollUntilTerminal(() => api.poll(issued.sessionId), {
      expiresAt: issued.expiresAt,
      shouldContinue: () => my === scanGen && !cameraOpen,
      onTick: (tick) => {
        if (my !== scanGen) {
          return;
        }
        if (mapScanStatus(tick.status) === "scanned") {
          status.value = "scanned";
        }
      },
    });
    if (my !== scanGen) {
      return;
    }
    scanBusy = false;
    if (session.status === "ready" && session.assetUrl) {
      writePreview(intent.value, session.assetUrl);
      if (intent.value === "outfit" || intent.value === "inspire") {
        writeOutfitUploadId(session.sessionId || issued.sessionId);
      }
      preview.value = session.assetUrl;
      status.value = "uploaded";
      scanSessionId = "";
      void fillNailNameFromUpload(session.assetUrl);
      return;
    }
    // cancelled / expired / rejected 等终态由后端决定，直接映射展示
    status.value = mapScanStatus(session.status);
    scanSessionId = "";
  } catch (error) {
    if (my !== scanGen || isPollAborted(error)) {
      return;
    }
    status.value = "failed";
    // 轮询失败不主动 cancel；取消/过期由后端或用户离页/换码触发
    showScreenError(error, "出码失败");
  } finally {
    if (my === scanGen) {
      scanBusy = false;
    }
  }
}

function haltScan(cancelSession: boolean, bump = true) {
  if (bump) {
    scanGen += 1;
  }
  scanBusy = false;
  if (scanSessionId && cancelSession) {
    scanTransport(intent.value).cancel(scanSessionId).catch(() => undefined);
    scanSessionId = "";
  }
}

function resetQr() {
  preview.value = "";
  status.value = "waiting";
  qrSrc.value = "";
  nailName.value = "";
  startScan();
}

async function onConfirm() {
  if (!preview.value || confirming) {
    return;
  }
  confirming = true;
  try {
    const ready = await ensureServerAsset();
    if (!ready) {
      return;
    }
    await finishConfirm();
  } finally {
    confirming = false;
    uni.hideLoading();
  }
}

/** 相机图先上传成和扫码一样的素材地址，再走原来的确认。 */
async function ensureServerAsset() {
  if (isRemoteAsset(preview.value)) {
    return true;
  }
  uni.showLoading({ title: "正在上传", mask: true });
  try {
    const published = await publishLocalCapture(intent.value, preview.value);
    writePreview(intent.value, published.assetUrl);
    if (intent.value === "outfit" || intent.value === "inspire") {
      writeOutfitUploadId(published.sessionId);
    }
    preview.value = published.assetUrl;
    await fillNailNameFromUpload(published.assetUrl);
    return true;
  } catch (error) {
    showScreenError(error, "照片上传失败");
    return false;
  }
}

async function finishConfirm() {
  if (!preview.value) {
    return;
  }
  if (intent.value === "hand-admin") {
    const name = nailName.value.trim();
    if (!name) {
      uni.showToast({ title: "请输入手模名称", icon: "none" });
      return;
    }
    try {
      await saveHandAdminName(name).then(res => {
		  (uni as any).$toast.success("上传成功", undefined, 1000);
	  });
    } catch (error) {
      showScreenError(error, "保存手模名称失败");
      return;
    }
    committed = true;
    clearPreview(intent.value);
    setTimeout(() => {
		goBackOr(flow.value.nextAfterConfirm)
	}, 1000)
    return;
  }
  committed = true;
  if (flow.value.confirmKind === "generate") {
    if (intent.value === "outfit" || intent.value === "inspire") {
      trackOutfitSubmit();
    }
    uni.navigateTo({ url: flow.value.nextAfterConfirm });
    return;
  }
  goBackOr(flow.value.nextAfterConfirm);
}

async function fillNailNameFromUpload(assetUrl: string) {
  if (intent.value !== "hand-admin" || nailName.value.trim() || !isRemoteAsset(assetUrl)) {
    return;
  }
  const match = await findUploadedHand(assetUrl);
  const label = materialLabel(match?.displayName);
  if (label) {
    nailName.value = label;
  }
}

async function saveHandAdminName(name: string) {
  const match = await findUploadedHand(preview.value);
  if (!match?.configId) {
    throw new Error("未找到刚上传的手模");
  }
  await patchHandModel(match.configId, name);
}

async function findUploadedHand(assetUrl: string) {
  const list = await fetchHandModels();
  return (list.custom || []).find((row) => sameAsset(row.previewUrl || row.assetUrl, assetUrl));
}

function materialLabel(name?: string | null) {
  const raw = (name || "").trim();
  if (!raw || raw === "自定义手模" || raw === "官方手模") {
    return "";
  }
  const base = raw.split(/[\\/]/).pop() || raw;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

function sameAsset(left?: string | null, right?: string | null) {
  const a = (left || "").trim();
  const b = (right || "").trim();
  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  return a.split("?")[0] === b.split("?")[0];
}

function onReupload() {
	(uni as any).$modal.load("重新上传", "重新上传将会清空现有照片，是否继续？", "重新上传",  1, 200000);
}

const handleReupload = () => {
	(uni as any).$modal.hide();
	haltScan(true);
	discardUploadDraft(intent.value);
	preview.value = "";
	status.value = "waiting";
	nailName.value = "";
	startScan();
}
</script>

<style>
page {
  height: 100%;
  background: #fff;
}

.scan {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(80 * var(--u)) 0 calc(48 * var(--u));
  box-sizing: border-box;
  overflow-y: auto;
}

.scan__bar {
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.scan__title {
  margin-top: calc(90 * var(--u));
  font-size: calc(56 * var(--u));
  font-weight: 900;
  line-height: calc(72 * var(--u));
  letter-spacing: calc(5.6 * var(--u));
  color: #333;
}

.scan__lead {
  margin-top: calc(32 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: calc(48 * var(--u));
  letter-spacing: calc(3.2 * var(--u));
  color: #333;
}

.scan__stage {
  margin-top: calc(60 * var(--u));
}

.scan__actions {
  margin-top: calc(37 * var(--u));
  width: calc(420 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(32 * var(--u));
}

.scan__btn {
  height: calc(88 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  box-sizing: border-box;
}

.scan__btn--disabled {
  background: rgba(25, 25, 25, 0.3);
  color: #fff;
}

.scan__btn--solid {
  background: #191919;
  color: #fff;
}

.scan__btn--ghost {
  background: #fff;
  color: #0f1010;
  border: calc(3 * var(--u)) solid #191919;
}

.scan__examples {
  margin-top: calc(60 * var(--u));
}

.scan__privacy {
  margin-top: calc(40 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  line-height: calc(36 * var(--u));
  letter-spacing: calc(2.4 * var(--u));
  color: #777;
}

.scan__nail_name {
	margin-top: calc(90 * var(--u));
	width: calc(820 * var(--u));
	height: calc(109 * var(--u));
	display: flex;
	flex-direction: row;
	justify-content: center;
	gap: calc(24 * var(--u));
	color: #333;
}
.scan-sheet__input {
	width: calc(528 * var(--u));
	height: calc(109 * var(--u));
	font-size: calc(36 * var(--u));
	border: calc(1 * var(--u)) solid #ddd;
	border-radius: calc(32 * var(--u));
	padding: 0 calc(32 * var(--u));
}
</style>
