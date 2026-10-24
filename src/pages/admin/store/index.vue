<template>
  <view class="st">
    <view class="st__bar">
      <kiosk-chip :icon="ASSETS.back" label="门店信息设置" @click="onBack" />
    </view>

    <view class="st-hero">
      <image class="st-hero__blob" :src="ASSETS.blob" mode="aspectFit" />
      <image class="st-hero__icon" :src="ASSETS.icon" mode="aspectFit" />
    </view>

    <view class="st-field">
      <text class="st-field__label">门店信息</text>
      <view class="st-field__box">
        <input
          v-if="editing"
          class="st-field__value"
          v-model="draft.name"
          maxlength="32"
          :adjust-position="false"
        />
        <text v-else class="st-field__value">{{ info.name }}</text>
      </view>
    </view>

    <view class="st-field">
      <text class="st-field__label">门店地址</text>
      <view class="st-field__area">
        <textarea
          v-if="editing"
          class="st-field__value st-field__value--area"
          v-model="draft.address"
          maxlength="80"
          :adjust-position="false"
        />
        <text v-else class="st-field__value">{{ info.address }}</text>
      </view>
    </view>

    <view class="st__btn" hover-class="none" @click="onAction">
      <text>{{ editing ? "保存" : "编辑" }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { cacheStore, peekStore, type StoreInfo } from "@/data/store";
import { rememberDeviceStore } from "@/lib/device-session";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { fetchScreenStore, patchScreenStore } from "@/lib/screen-api/me";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  blob: "/static/admin/store-blob.svg",
  icon: "/static/admin/store-icon.svg",
};

const info = reactive<StoreInfo>({ name: "", address: "" });
const draft = reactive<StoreInfo>({ name: "", address: "" });
const editing = ref(false);
const saving = ref(false);

onShow(() => {
  loadStore();
});

async function loadStore() {
  applyStore(peekStore());
  try {
    const store = await fetchScreenStore();
    applyStore({ name: store.name || "", address: store.address || "" });
    cacheStore({ name: info.name, address: info.address });
    rememberDeviceStore({ name: info.name, address: info.address });
    editing.value = false;
  } catch (error) {
    showScreenError(error, "门店信息加载失败");
  }
}

function applyStore(store: StoreInfo | null) {
  if (!store) {
    return;
  }
  info.name = store.name;
  info.address = store.address;
  draft.name = info.name;
  draft.address = info.address;
}

function onBack() {
  goBackOr(ADMIN_PAGES.home);
}

async function onAction() {
  if (!editing.value) {
    draft.name = info.name;
    draft.address = info.address;
    editing.value = true;
    return;
  }
  if (!draft.name.trim() || !draft.address.trim()) {
    uni.showToast({ title: "请填写完整信息", icon: "none" });
    return;
  }
  if (saving.value) {
    return;
  }
  saving.value = true;
  try {
    const saved = await patchScreenStore({ name: draft.name.trim(), address: draft.address.trim() });
    info.name = saved.name || draft.name.trim();
    info.address = saved.address || draft.address.trim();
    cacheStore({ name: info.name, address: info.address });
    rememberDeviceStore({ name: info.name, address: info.address });
    editing.value = false;
    uni.showToast({ title: "已保存", icon: "none" });
  } catch (error) {
    showScreenError(error, "保存失败");
  } finally {
    saving.value = false;
  }
}
</script>

<style>
page {
  background: #fff;
}

.st {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.st__bar {
  height: calc(80 * var(--u));
}

.st-hero {
  position: relative;
  margin: calc(40 * var(--u)) auto 0;
  width: calc(480 * var(--u));
  height: calc(480 * var(--u));
}

.st-hero__blob {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.st-hero__icon {
  position: absolute;
  left: calc(95 * var(--u));
  top: calc(138 * var(--u));
  width: calc(292 * var(--u));
  height: calc(207 * var(--u));
}

.st-field {
  margin: calc(60 * var(--u)) auto 0;
  width: calc(816 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.st-field__label {
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
}

.st-field__box,
.st-field__area {
  width: 100%;
  padding: calc(32 * var(--u));
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(32 * var(--u));
  box-sizing: border-box;
}

.st-field__box {
  height: calc(112 * var(--u));
  display: flex;
  align-items: center;
}

.st-field__area {
  min-height: calc(199 * var(--u));
}

.st-field__value {
  width: 100%;
  font-size: calc(32 * var(--u));
  line-height: 1.4;
  letter-spacing: calc(3.2 * var(--u));
  color: #333;
  background: transparent;
}

.st-field__value--area {
  min-height: calc(135 * var(--u));
}

/* #ifdef H5 */
.st-field__box uni-input,
.st-field__box uni-input .uni-input-wrapper,
.st-field__box uni-input .uni-input-input,
.st-field__box uni-input input {
  display: block;
  width: 100%;
  height: calc(48 * var(--u));
  min-height: 0;
  font-size: calc(32 * var(--u));
  line-height: calc(48 * var(--u));
  letter-spacing: calc(3.2 * var(--u));
  color: #333;
  background: transparent;
}

.st-field__area uni-textarea,
.st-field__area uni-textarea .uni-textarea-wrapper,
.st-field__area uni-textarea .uni-textarea-textarea,
.st-field__area uni-textarea textarea {
  width: 100%;
  min-height: calc(135 * var(--u));
  font-size: calc(32 * var(--u));
  line-height: 1.4;
  letter-spacing: calc(3.2 * var(--u));
  color: #333;
  background: transparent;
}
/* #endif */

.st__btn {
  margin: calc(48 * var(--u)) auto 0;
  width: calc(480 * var(--u));
  height: calc(100 * var(--u));
  background: #191919;
  border-radius: calc(103 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #fff;
}
</style>
