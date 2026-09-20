<template>
  <view class="kiosk-sheet-mask" @click="onClose">
    <view class="kiosk-sheet" @click.stop>
      <view class="kiosk-sheet__close" hover-class="none" @click="onClose">
        <image :src="ICONS.close" mode="aspectFit" />
      </view>
      <view class="kiosk-sheet__photo">
        <image :src="product.image" mode="aspectFit" />
      </view>
      <text class="kiosk-sheet__name">{{ product.title }}</text>
      <text class="kiosk-sheet__price">{{ product.price }}</text>
      <view class="kiosk-sheet__specs">
        <view v-for="spec in product.specs" :key="spec" class="kiosk-sheet__spec">
          <text>{{ spec }}</text>
        </view>
      </view>
      <view class="kiosk-sheet__btn" hover-class="none" @click="onTryOn">
        <text>开始试甲</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { HomeProduct } from "../../data/home";

defineProps<{
  product: HomeProduct;
}>();

const emit = defineEmits<{
  close: [];
  tryon: [];
}>();

const ICONS = {
  close: "/static/sheet/close.svg",
};

function onClose() {
  emit("close");
}

function onTryOn() {
  emit("tryon");
}
</script>

<style>
.kiosk-sheet-mask {
  position: fixed;
  left: 50%;
  top: 0;
  bottom: 0;
  width: calc(1080 * var(--u));
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.45);
  z-index: 20;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.kiosk-sheet {
  position: relative;
  width: 100%;
  background: #fff;
  border-radius: calc(60 * var(--u)) calc(60 * var(--u)) 0 0;
  padding: calc(48 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.kiosk-sheet__close {
  position: absolute;
  top: calc(32 * var(--u));
  right: calc(32 * var(--u));
  width: calc(60 * var(--u));
  height: calc(60 * var(--u));
  z-index: 1;
}

.kiosk-sheet__close image {
  width: 100%;
  height: 100%;
}

.kiosk-sheet__photo {
  width: calc(720 * var(--u));
  height: calc(720 * var(--u));
  border-radius: calc(32 * var(--u));
  overflow: hidden;
  background: #f7f7f7;
}

.kiosk-sheet__photo image {
  width: 100%;
  height: 100%;
}

.kiosk-sheet__name {
  margin-top: calc(32 * var(--u));
  font-size: calc(40 * var(--u));
  font-weight: 700;
  color: #333;
  text-align: center;
}

.kiosk-sheet__price {
  margin-top: calc(12 * var(--u));
  font-size: calc(36 * var(--u));
  font-weight: 700;
  color: #333;
}

.kiosk-sheet__specs {
  margin-top: calc(24 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: calc(16 * var(--u));
}

.kiosk-sheet__spec {
  height: calc(56 * var(--u));
  padding: 0 calc(24 * var(--u));
  border-radius: calc(56 * var(--u));
  background: #f2f3f5;
  display: flex;
  align-items: center;
  font-size: calc(24 * var(--u));
  color: #333;
}

.kiosk-sheet__btn {
  margin-top: calc(40 * var(--u));
  width: calc(696 * var(--u));
  height: calc(120 * var(--u));
  border-radius: calc(120 * var(--u));
  background: #191919;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: calc(36 * var(--u));
  font-weight: 700;
}
</style>
