<template>
  <view class="login">
    <view class="login-hero">
      <image class="login-hero__art" :src="ASSETS.hero" mode="widthFix" />
      <view class="login-hero__bar">
        <kiosk-chip :icon="ASSETS.back" label="返回" @click="onBack" />
      </view>
    </view>

    <view class="login-sheet">
      <text class="login-sheet__title">奈杜美甲-三孝口店</text>
      <text class="login-sheet__lead">输入管理员密码进入设备后台管理</text>
      <view class="login-sheet__field">
        <input
          :key="showPlain ? 'plain' : 'masked'"
          class="login-sheet__input"
          v-model="password"
          :password="!showPlain"
          maxlength="32"
          placeholder="请输入管理员密码"
          placeholder-style="color:#C7C7CC"
          :adjust-position="false"
        />
        <view class="login-sheet__eye" hover-class="none" @click.stop="showPlain = !showPlain">
          <image
            class="login-sheet__eye-icon"
            :src="showPlain ? ASSETS.eyeOff : ASSETS.eye"
            mode="aspectFit"
          />
        </view>
      </view>
    </view>

    <view class="login__btn" :class="{ 'is-off': !canSubmit }" hover-class="none" @click="onLogin">
      <text>{{ submitting ? "登录中…" : "登录" }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { loginDevice, showLoginError } from "@/lib/device-auth";
import { captureDeviceCodeFromLaunch } from "@/lib/device-session";
import { ADMIN_PAGES, KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";

const ASSETS = {
  back: "/static/scan/back.svg",
  hero: "/static/admin/login-top.svg",
  eye: "/static/admin/eye.svg",
  eyeOff: "/static/admin/eye-off.svg",
};

const password = ref("");
const showPlain = ref(false);
const submitting = ref(false);
const canSubmit = computed(() => Boolean(password.value) && !submitting.value);

onLoad((query?: Record<string, string>) => {
  captureDeviceCodeFromLaunch(query);
});

function onBack() {
  goBackOr(KIOSK_PAGES.home);
}

async function onLogin() {
  if (!canSubmit.value) {
    return;
  }
  submitting.value = true;
  try {
    await loginDevice(password.value);
    uni.redirectTo({ url: ADMIN_PAGES.home });
  } catch (error) {
    showLoginError(error);
  } finally {
    submitting.value = false;
  }
}
</script>

<style>
page {
  height: 100%;
  background: #fff;
}

.login {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  position: relative;
  padding-bottom: calc(48 * var(--u));
  box-sizing: border-box;
}

.login-hero {
  position: relative;
  height: calc(640 * var(--u));
  background: #f5f5f5;
  overflow: hidden;
}

.login-hero__art {
  position: absolute;
  left: calc(80 * var(--u));
  top: calc(144 * var(--u));
  width: calc(964 * var(--u));
}

.login-hero__bar {
  position: absolute;
  left: calc(48 * var(--u));
  top: calc(32 * var(--u));
  z-index: 2;
}

.login-sheet {
  position: relative;
  z-index: 1;
  margin-top: calc(-60 * var(--u));
  background: #fff;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  padding: calc(80 * var(--u)) calc(132 * var(--u)) 0;
}

.login-sheet__title {
  display: block;
  font-size: calc(56 * var(--u));
  font-weight: 700;
  color: #333;
}

.login-sheet__lead {
  display: block;
  margin-top: calc(24 * var(--u));
  font-size: calc(36 * var(--u));
  font-weight: 500;
  color: #777;
}

.login-sheet__field {
  position: relative;
  margin-top: calc(72 * var(--u));
}

.login-sheet__input {
  width: 100%;
  height: calc(120 * var(--u));
  padding: 0 calc(120 * var(--u)) 0 calc(40 * var(--u));
  background: #f5f6f8;
  border-radius: calc(92 * var(--u));
  font-size: calc(32 * var(--u));
  color: #333;
  box-sizing: border-box;
}

.login-sheet__eye {
  position: absolute;
  right: 0;
  top: 0;
  width: calc(120 * var(--u));
  height: calc(120 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-sheet__eye-icon {
  width: calc(48 * var(--u));
  height: calc(48 * var(--u));
}

.login__btn {
  margin: calc(48 * var(--u)) auto 0;
  width: calc(816 * var(--u));
  height: calc(120 * var(--u));
  border-radius: calc(103 * var(--u));
  background: #191919;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.login__btn.is-off {
  background: rgba(25, 25, 25, 0.3);
}
</style>
