<template>
  <view class="kiosk-product" :class="['is-' + size, { 'is-framed': framed }]" hover-class="none" @click="onClick">
    <view class="kiosk-product__image">
      <image class="kiosk-product__shot" :src="product.image" mode="aspectFill" />
    </view>
    <view class="kiosk-product__body">
      <text class="kiosk-product__name">{{ product.title }}</text>
      <text v-if="showPrice" class="kiosk-product__price">{{ product.price }}</text>
      <view v-if="actionVisible" class="kiosk-product__btn">
        <text class="kiosk-product__btn-text">查看详情</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { HomeProduct } from "../../data/home";

const props = withDefaults(
  defineProps<{
    product: HomeProduct;
    size?: "rail" | "grid" | "list";
    showPrice?: boolean;
    showAction?: boolean;
    framed?: boolean;
  }>(),
  { size: "grid", showPrice: false, framed: false },
);

const actionVisible = computed(() => props.showAction ?? props.size !== "list");

const emit = defineEmits<{ click: [] }>();

function onClick() {
  emit("click");
}
</script>

<style>
.kiosk-product {
  --u: calc(min(100vw, 1080px) / 1080);
  background: #fff;
  border-radius: calc(32 * var(--u));
  overflow: hidden;
  padding-bottom: calc(24 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  white-space: normal;
}

.kiosk-product.is-rail,
.kiosk-product.is-list {
  flex-shrink: 0;
  width: calc(312 * var(--u));
}

.kiosk-product.is-grid {
  width: calc(480 * var(--u));
}

.kiosk-product.is-framed {
  border: calc(2 * var(--u)) solid #eee;
}

.kiosk-product__image {
  width: 100%;
  flex-shrink: 0;
  background: #fff;
  overflow: hidden;
}

.kiosk-product.is-rail .kiosk-product__image,
.kiosk-product.is-list .kiosk-product__image {
  height: calc(312 * var(--u));
}

.kiosk-product.is-grid .kiosk-product__image {
  height: calc(480 * var(--u));
}

.kiosk-product__shot {
  display: block;
  width: 100%;
  height: 100%;
}

.kiosk-product__body {
  width: 100%;
  flex-shrink: 0;
  margin-top: calc(16 * var(--u));
  padding: 0 calc(24 * var(--u));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.kiosk-product.is-list .kiosk-product__body {
  align-items: flex-start;
}

.kiosk-product__name {
  display: block;
  width: 100%;
  font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  font-weight: 500;
  line-height: normal;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.kiosk-product.is-rail .kiosk-product__name,
.kiosk-product.is-list .kiosk-product__name {
  font-size: calc(24 * var(--u));
}

.kiosk-product.is-list .kiosk-product__name {
  height: calc(68 * var(--u));
  line-height: calc(34 * var(--u));
  white-space: normal;
  text-align: left;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.kiosk-product.is-grid .kiosk-product__name {
  font-size: calc(28 * var(--u));
}

.kiosk-product__price {
  display: block;
  margin-top: calc(8 * var(--u));
  font-size: calc(28 * var(--u));
  font-weight: 700;
  color: #333;
  text-align: center;
}

.kiosk-product.is-list .kiosk-product__price {
  margin-top: calc(16 * var(--u));
  font-size: calc(32 * var(--u));
  text-align: left;
}

.kiosk-product__btn {
  width: calc(160 * var(--u));
  height: calc(44 * var(--u));
  margin-top: calc(16 * var(--u));
  border-radius: calc(75 * var(--u));
  background: #191919;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kiosk-product__btn-text {
  font-family: "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  color: #fff;
  font-size: calc(18 * var(--u));
  font-weight: 700;
  line-height: normal;
}
</style>
