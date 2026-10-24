<template>
  <view class="hub">
    <view class="hub__bar">
      <kiosk-chip :icon="ASSETS.back" label="返回" @click="onBack" />
    </view>

    <view class="hub-points">
      <image class="hub-points__blob" :src="ASSETS.blob" mode="aspectFit" />
      <image class="hub-points__dot" :src="ASSETS.dot" mode="aspectFit" />
      <image class="hub-points__nail" :src="ASSETS.nail" mode="aspectFit" />
	  <text class="hub-points__storeName">{{ storeName }}</text>
      <view class="hub-points__copy">
        <text class="hub-points__label">当前余额</text>
        <text class="hub-points__num">{{ balanceText }}</text>
      </view>
    </view>

    <view class="hub-grid">
      <view v-for="tile in ADMIN_TILES" :key="tile.id" class="hub-tile" hover-class="none" @click="onTile(tile.action)">
        <view v-if="tile.action === 'version' && hasUpdate" class="hub-tile__badge">
          <text>{{ updateBadge }}</text>
        </view>
        <image class="hub-tile__icon" :src="tile.icon" mode="aspectFit" />
        <text>{{ tile.label }}</text>
      </view>
    </view>

    <text class="hub__more">更多功能，敬请期待…</text>
  </view>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { ADMIN_TILES, type AdminTileAction } from "@/data/admin";
import { ensureStore, resolveStoreName } from "@/data/store";
import { discardMismatchedDevice } from "@/lib/device-auth";
import { ADMIN_PAGES, KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { peekOtaSnapshot } from "@/lib/ota-upgrade";
import { fetchScreenAccount } from "@/lib/screen-api/me";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  blob: "/static/admin/points-blob.svg",
  dot: "/static/admin/points-dot.svg",
  nail: "/static/admin/points-nail.svg",
};

const balanceText = ref("--");
const hasUpdate = ref(false);
const updateBadge = ref("有新版本");
discardMismatchedDevice();
const storeName = ref(resolveStoreName());

onShow(() => {
  storeName.value = resolveStoreName();
  void loadStoreName();
  loadAccount();
  loadUpdateBadge();
});

async function loadStoreName() {
  const store = await ensureStore();
  storeName.value = resolveStoreName(store?.name);
}

async function loadAccount() {
  try {
    const account = await fetchScreenAccount();
    balanceText.value = formatStoreBalance(account.balanceAmount, account.currency);
  } catch (error) {
    showScreenError(error, "余额加载失败");
  }
}

function loadUpdateBadge() {
  const result = peekOtaSnapshot();
  hasUpdate.value = Boolean(result?.hasUpdate);
  updateBadge.value = result?.kind === "force" ? "需更新" : "有新版本";
}

function formatStoreBalance(amount: number | string | null | undefined, currency?: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return "--";
  }
  const code = (currency || "CNY").toUpperCase();
  const text = value.toFixed(2);
  return code === "CNY" ? `¥${text}` : `${text} ${code}`;
}

function onBack() {
  goBackOr(KIOSK_PAGES.home);
}

function onTile(action: AdminTileAction) {
  const urls: Partial<Record<AdminTileAction, string>> = {
    banner: ADMIN_PAGES.banner,
    store: ADMIN_PAGES.store,
    history: ADMIN_PAGES.history,
    product: ADMIN_PAGES.product,
    hand: ADMIN_PAGES.hand,
    version: ADMIN_PAGES.version,
  };
  const url = urls[action];
  if (url) {
    uni.navigateTo({ url });
    return;
  }
  uni.showToast({ title: "即将接入", icon: "none" });
}
</script>

<style>
page {
  height: 100%;
  background: #f2f3f5;
}

.hub {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #f2f3f5;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.hub__bar {
  height: calc(80 * var(--u));
}

.hub-points {
  position: relative;
  margin-top: calc(32 * var(--u));
  height: calc(428 * var(--u));
  background: #191919;
  border-radius: calc(60 * var(--u));
  overflow: hidden;
}

.hub-points__blob {
  position: absolute;
  left: calc(-176 * var(--u));
  top: calc(-139 * var(--u));
  width: calc(468 * var(--u));
  height: calc(468 * var(--u));
}

.hub-points__dot {
  position: absolute;
  right: calc(36 * var(--u));
  top: calc(52 * var(--u));
  width: calc(69 * var(--u));
  height: calc(69 * var(--u));
}

.hub-points__nail {
  position: absolute;
  right: calc(40 * var(--u));
  bottom: calc(-20 * var(--u));
  width: calc(370 * var(--u));
  height: calc(370 * var(--u));
}

.hub-points__storeName {
	color:#fff;
	position:absolute;
	left: calc(80 * var(--u));
	top: calc(60 * var(--u));
	font-size: calc(48 * var(--u));
	font-weight: bold;
}

.hub-points__copy {
  position: relative;
  z-index: 1;
  height: 100%;
  padding-left: calc(80 * var(--u));
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-top: calc(70 * var(--u));
  gap: calc(32 * var(--u));
}

.hub-points__label {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  letter-spacing: calc(3.2 * var(--u));
  color: rgba(255, 255, 255, 0.8);
}

.hub-points__num {
  font-size: calc(80 * var(--u));
  font-weight: 700;
  letter-spacing: calc(8 * var(--u));
  color: #fff;
}

.hub-grid {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.hub-tile {
  position: relative;
  width: calc(312 * var(--u));
  height: calc(312 * var(--u));
  background: #fff;
  border-radius: calc(32 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(18 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
}

.hub-tile__icon {
  width: calc(140 * var(--u));
  height: calc(140 * var(--u));
}

.hub-tile__badge {
  position: absolute;
  top: calc(16 * var(--u));
  right: calc(16 * var(--u));
  padding: calc(6 * var(--u)) calc(14 * var(--u));
  border-radius: calc(24 * var(--u));
  background: #e11d48;
  color: #fff;
  font-size: calc(20 * var(--u));
  font-weight: 600;
}

.hub__more {
  display: block;
  margin-top: calc(48 * var(--u));
  text-align: center;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #777;
}
</style>
