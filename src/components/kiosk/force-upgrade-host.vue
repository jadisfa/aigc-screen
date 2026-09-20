<template>
  <view v-if="visible" class="fu-mask">
    <view class="fu-modal" @click.stop>
      <view class="fu-modal__hero">
        <image class="fu-modal__art" src="/static/admin/version-latest.svg" mode="aspectFit" />
      </view>
      <text class="fu-modal__title">必须升级当前版本</text>
      <text class="fu-modal__hint">检测到重大缺陷修复，请立即升级或指定安装时间。</text>
      <text class="fu-modal__head">待更新版本{{ latestName }}</text>
      <text class="fu-modal__line">安装包大小：{{ latestSize }}</text>
      <text class="fu-modal__line">更新内容：</text>
      <text v-for="line in notes" :key="line" class="fu-modal__line">{{ line }}</text>
      <view v-if="pickingTime" class="fu-times">
        <view class="fu-time" hover-class="none" @click="scheduleAt(hoursLater(1), '1小时后')">
          <text>1小时后</text>
        </view>
        <view class="fu-time" hover-class="none" @click="scheduleAt(tonightAt(2), '今晚 02:00')">
          <text>今晚 02:00</text>
        </view>
        <view class="fu-time" hover-class="none" @click="scheduleAt(tomorrowMorning(), '明天 08:00')">
          <text>明天 08:00</text>
        </view>
        <view class="fu-time fu-time--ghost" hover-class="none" @click="pickingTime = false">
          <text>返回</text>
        </view>
      </view>
      <view v-else class="fu-modal__acts">
        <view class="fu-modal__later" hover-class="none" @click="pickingTime = true">
          <text>指定时间升级</text>
        </view>
        <view class="fu-modal__now" hover-class="none" @click="upgradeNow">
          <text>立即升级</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import {
  OTA_FORCE_CHECK_MS,
  OTA_SCHEDULE_TICK_MS,
  checkOtaUpdate,
  formatOtaSize,
  formatScheduleTime,
  hoursLater,
  commitLocalScreenVersion,
  openOtaPackage,
  readForceSchedule,
  splitOtaNotes,
  subscribeOtaInspect,
  tonightAt,
  writeForceSchedule,
  type OtaCheckResult,
} from "@/lib/ota-upgrade";
import type { ScreenOtaVersion } from "@/lib/screen-api/ota";

const visible = ref(false);
const pickingTime = ref(false);
const latestName = ref("--");
const latestSize = ref("--");
const notes = ref<string[]>([]);
let latest: ScreenOtaVersion | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeInspect: (() => void) | null = null;

onMounted(() => {
  startTimers();
  unsubscribeInspect = subscribeOtaInspect(() => {
    void inspect();
  });
  void inspect();
});

onUnmounted(() => {
  unsubscribeInspect?.();
  unsubscribeInspect = null;
  stopTimers();
});

function startTimers() {
  stopTimers();
  pollTimer = setInterval(() => {
    void inspect();
  }, OTA_FORCE_CHECK_MS);
  tickTimer = setInterval(() => {
    void inspect();
  }, OTA_SCHEDULE_TICK_MS);
}

function stopTimers() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

async function inspect() {
  const result = await checkOtaUpdate(false);
  applyLatest(result);
  if (!result.hasUpdate || result.kind !== "force" || !result.latest) {
    visible.value = false;
    pickingTime.value = false;
    return;
  }
  const schedule = readForceSchedule();
  const versionNo = result.latest.versionNo ?? 0;
  if (schedule && schedule.versionNo === versionNo && Date.now() < schedule.at) {
    visible.value = false;
    pickingTime.value = false;
    return;
  }
  if (schedule && schedule.versionNo === versionNo && Date.now() >= schedule.at) {
    writeForceSchedule(null);
    startInstall(result.latest);
    return;
  }
  visible.value = true;
}

function applyLatest(result: OtaCheckResult) {
  latest = result.latest;
  latestName.value = result.latest?.versionName || "--";
  latestSize.value = formatOtaSize(result.latest?.fileSize);
  notes.value = splitOtaNotes(result.latest?.changelog);
}

function upgradeNow() {
  if (!latest) {
    return;
  }
  writeForceSchedule(null);
  startInstall(latest);
}

function startInstall(pkg: ScreenOtaVersion) {
  visible.value = false;
  pickingTime.value = false;
  openOtaPackage(pkg.accessUrl);
  commitLocalScreenVersion(pkg.versionNo, pkg.changelog);
}

function scheduleAt(at: number, label: string) {
  if (!latest?.versionNo) {
    uni.showToast({ title: "版本号不可用", icon: "none" });
    return;
  }
  writeForceSchedule({ versionNo: latest.versionNo, at });
  pickingTime.value = false;
  visible.value = false;
  uni.showToast({ title: `已预约 ${label}（${formatScheduleTime(at)}）安装`, icon: "none" });
}

function tomorrowMorning() {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(8, 0, 0, 0);
  return at.getTime();
}
</script>

<style>
.fu-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fu-modal {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(984 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u));
  padding: calc(48 * var(--u));
  box-sizing: border-box;
}

.fu-modal__hero {
  margin: 0 auto;
  width: calc(220 * var(--u));
  height: calc(220 * var(--u));
}

.fu-modal__art {
  width: 100%;
  height: 100%;
}

.fu-modal__title {
  display: block;
  margin-top: calc(24 * var(--u));
  text-align: center;
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
}

.fu-modal__hint {
  display: block;
  margin-top: calc(12 * var(--u));
  text-align: center;
  font-size: calc(28 * var(--u));
  color: #777;
}

.fu-modal__head {
  display: block;
  margin-top: calc(32 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 700;
  color: #333;
}

.fu-modal__line {
  display: block;
  margin-top: calc(8 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: 1.5;
  color: #777;
}

.fu-modal__acts,
.fu-times {
  margin-top: calc(40 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.fu-modal__later,
.fu-modal__now,
.fu-time {
  flex: 1;
  min-width: calc(280 * var(--u));
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.fu-modal__later,
.fu-time {
  border: calc(3 * var(--u)) solid #191919;
  color: #191919;
  box-sizing: border-box;
}

.fu-time--ghost {
  border-style: dashed;
  color: #777;
}

.fu-modal__now {
  background: #191919;
  color: #fff;
}
</style>
