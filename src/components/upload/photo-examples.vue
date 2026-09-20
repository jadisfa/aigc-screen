<template>
  <view class="photo-examples">
    <view v-for="item in (type != 'outfit' ? NAIL_EXAMPLES : PHOTO_EXAMPLES )" :key="item.id" class="photo-ex">
      <image class="photo-ex__img" :src="item.image" mode="aspectFill" />
      <image class="photo-ex__badge" :src="item.ok ? ICONS.ok : ICONS.bad" mode="aspectFit" />
      <view class="photo-ex__cap">
        <text>{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { PHOTO_EXAMPLES, NAIL_EXAMPLES } from "../../data/upload";

const ICONS = {
  ok: "/static/scan/badge-ok.svg",
  bad: "/static/scan/badge-bad.svg",
};

const props = defineProps<{
  type?: string 
}>();
</script>

<style>
.photo-examples {
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.photo-ex {
  position: relative;
  width: calc(186 * var(--u));
  height: calc(279 * var(--u));
  border-radius: calc(32 * var(--u));
  overflow: hidden;
}

.photo-ex__img {
  width: 100%;
  height: 100%;
}

.photo-ex__badge {
  position: absolute;
  top: calc(16 * var(--u));
  right: calc(16 * var(--u));
  width: calc(40 * var(--u));
  height: calc(40 * var(--u));
}

.photo-ex__cap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(54 * var(--u));
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0 0 calc(30 * var(--u)) calc(30 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: calc(24 * var(--u));
  font-weight: 700;
  letter-spacing: calc(2.4 * var(--u));
}
</style>
