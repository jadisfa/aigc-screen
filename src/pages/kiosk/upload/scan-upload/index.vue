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
		<span class="scan__nail_text">手模名称</span>
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
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onBackPress, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import PhotoExamples from "@/components/upload/photo-examples.vue";
import ScanStage from "@/components/upload/scan-stage.vue";
import { goBackOr } from "@/lib/kiosk-routes";
import {
  isPollAborted,
  mapScanStatus,
  pollUntilTerminal,
  qrImageUrl,
  scanTransport,
} from "@/lib/scan-session";
import { showScreenError } from "@/lib/screen-http";
import {
  cameraUrl,
  clearPreview,
  discardUploadDraft,
  parseUploadIntent,
  readOutfitUploadId,
  readPreview,
  scanBackUrl,
  UPLOAD_FLOWS,
  writeOutfitUploadId,
  writePreview,
  type ScanStatus,
  type UploadIntent,
} from "@/lib/upload-flow";
import KiostModal from "@/components/kiosk/kiosk-modal.vue";

const ICONS = {
  back: "/static/scan/back.svg",
  camera: "/static/scan/camera.svg",
};

const intent = ref<UploadIntent>("outfit");
const preview = ref("");
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

onLoad((query?: Record<string, string>) => {
  intent.value = parseUploadIntent(query);
  entryPreview = readPreview(intent.value);
  entryOutfitId =
    intent.value === "outfit" || intent.value === "inspire" ? readOutfitUploadId() : "";
});

onShow(() => {
  preview.value = readPreview(intent.value);
  if (preview.value) {
    status.value = "uploaded";
    haltScan(false);
    return;
  }
  if (scanSessionId || scanBusy) {
    return;
  }
  startScan();
});

onUnload(() => {
  if (committed) {
    haltScan(status.value !== "uploaded");
    return;
  }
  revertVisit();
});

let leaving = false;

onBackPress(() => {
  if (!leaving) {
    onBack();
  }
  return true;
});

function onBack() {
  if (leaving) {
    return;
  }
  leaving = true;
  revertVisit();
  console.log('上传返回', intent.value, scanBackUrl(intent.value))
  uni.navigateTo({
  	url: scanBackUrl(intent.value)
  })
  // goBackOr(scanBackUrl(intent.value));
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
}

function onCamera() {
  uni.navigateTo({ url: cameraUrl(intent.value) });
}

async function startScan() {
  const my = ++scanGen;
  haltScan(Boolean(scanSessionId), false);
  scanBusy = true;
  qrSrc.value = "";
  status.value = "waiting";
  const api = scanTransport(intent.value);
  try {
    const issued = await api.issue();
    if (my !== scanGen) {
      return;
    }
    if (!issued.h5Url) {
      throw new Error("出码失败：未返回上传地址");
    }
    scanSessionId = issued.sessionId;
    qrSrc.value = await qrImageUrl(issued.h5Url);
    const session = await pollUntilTerminal(() => api.poll(issued.sessionId), {
      expiresAt: issued.expiresAt,
      shouldContinue: () => my === scanGen,
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
  startScan();
}

function onConfirm() {
  if (!preview.value) {
    return;
  }
  committed = true;
  console.log(flow.value.nextAfterConfirm, flow.value)
  if (intent.value === "hand-admin") {
    clearPreview(intent.value);
	 goBackOr(flow.value.nextAfterConfirm);
  }
  if (flow.value.confirmKind === "generate") {
    uni.navigateTo({ url: flow.value.nextAfterConfirm });
    return;
  }
  goBackOr(flow.value.nextAfterConfirm);
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
  margin-top: calc(60 * var(--u));
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
	height: calc(80 * var(--u));
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	gap: calc(24 * var(--u));
	color: #333;
}
.scan__nail_text {
	font-size: calc(36 * var(--u));
	font-weight: 500;
	line-height: calc(80 * var(--u));
	letter-spacing: calc(2.4 * var(--u));
}
.scan-sheet__input {
	flex: 1;
	height: calc(80 * var(--u));
	font-size: calc(36 * var(--u));
	border: calc(1 * var(--u)) solid #ddd;
	border-radius: calc(20 * var(--u));
	padding: 0 calc(20 * var(--u));
}
</style>
