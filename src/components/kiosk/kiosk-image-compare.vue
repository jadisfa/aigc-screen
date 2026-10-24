<template>
  <view class="cmp" @touchmove.stop.prevent="onDrag" @click="emit('close')">
    <view class="cmp-stage" @click.stop @touchstart.stop="onDrag" @touchmove.stop.prevent="onDrag" @mousedown.stop="onMouseDown">
      <image class="cmp-shot" :src="after" mode="aspectFill" />
      <view class="cmp-clip" :style="{ width: ratio + '%' }">
        <image class="cmp-shot cmp-shot--before" :src="before" mode="aspectFill" :style="beforeStyle" />
      </view>
      <view class="cmp-line" :style="{ left: ratio + '%' }">
        <view class="cmp-knob">
          <text class="cmp-knob__arrow">‹</text>
          <text class="cmp-knob__arrow">›</text>
        </view>
      </view>
      <text class="cmp-tag cmp-tag--before">{{ beforeLabel }}</text>
      <text class="cmp-tag cmp-tag--after">{{ afterLabel }}</text>
    </view>
    <image class="cmp-close" src="/static/results/compare-close.svg" mode="aspectFit" @click.stop="emit('close')" />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    before: string;
    after: string;
    beforeLabel?: string;
    afterLabel?: string;
  }>(),
  { beforeLabel: "手模", afterLabel: "效果" },
);

const emit = defineEmits<{ close: [] }>();

const ratio = ref(50);
const stageWidth = ref(0);
const stageHeight = ref(0);
const instance = getCurrentInstance();
let stageLeft = 0;
let dragging = false;

const beforeStyle = computed(() => ({
  width: `${stageWidth.value || 1}px`,
  height: `${stageHeight.value || 1}px`,
}));

function measure(done?: () => void) {
  uni
    .createSelectorQuery()
    .in(instance?.proxy as never)
    .select(".cmp-stage")
    .boundingClientRect((rect) => {
      const box = (Array.isArray(rect) ? rect[0] : rect) as { left?: number; width?: number } | null;
      if (box?.width) {
        stageLeft = box.left || 0;
        stageWidth.value = box.width;
        stageHeight.value = (box as { height?: number }).height || stageHeight.value;
      }
      done?.();
    })
    .exec();
}

function clientX(event: TouchEvent | MouseEvent) {
  const touchEvent = event as TouchEvent;
  const touch = touchEvent.touches?.[0] || touchEvent.changedTouches?.[0];
  if (touch) {
    return touch.clientX;
  }
  return "clientX" in event ? event.clientX : null;
}

function applyX(x: number) {
  if (!stageWidth.value) {
    return;
  }
  const next = ((x - stageLeft) / stageWidth.value) * 100;
  ratio.value = Math.min(100, Math.max(0, next));
}

function onDrag(event: TouchEvent | MouseEvent) {
  const x = clientX(event);
  if (x == null) {
    return;
  }
  if (!stageWidth.value) {
    measure(() => applyX(x));
    return;
  }
  applyX(x);
}

function onMouseMove(event: MouseEvent) {
  if (!dragging) {
    return;
  }
  onDrag(event);
}

function onMouseUp() {
  dragging = false;
  window.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("mouseup", onMouseUp);
}

function onMouseDown(event: MouseEvent) {
  if (typeof window === "undefined") {
    return;
  }
  dragging = true;
  onDrag(event);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

onMounted(() => {
  setTimeout(() => measure(), 30);
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }
});
</script>

<style>
.cmp {
  --u: calc(min(100vw, 1080px) / 1080);
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(28 * var(--u));
}

.cmp-stage {
  position: relative;
  width: calc(960 * var(--u));
  height: calc(1280 * var(--u));
  max-height: 78vh;
  border-radius: calc(48 * var(--u));
  overflow: hidden;
  background: #111;
  touch-action: none;
}

.cmp-shot {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.cmp-clip {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  overflow: hidden;
  z-index: 1;
}

.cmp-shot--before {
  max-width: none;
}

.cmp-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: calc(4 * var(--u));
  margin-left: calc(-2 * var(--u));
  background: #fff;
  z-index: 2;
  pointer-events: none;
}

.cmp-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(72 * var(--u));
  height: calc(72 * var(--u));
  margin-left: calc(-36 * var(--u));
  margin-top: calc(-36 * var(--u));
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 calc(8 * var(--u)) calc(24 * var(--u)) rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(6 * var(--u));
}

.cmp-knob__arrow {
  font-size: calc(28 * var(--u));
  line-height: 1;
  color: #222;
  font-weight: 600;
}

.cmp-tag {
  position: absolute;
  top: calc(28 * var(--u));
  z-index: 3;
  padding: calc(8 * var(--u)) calc(18 * var(--u));
  border-radius: calc(999 * var(--u));
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: calc(22 * var(--u));
  font-weight: 500;
  pointer-events: none;
}

.cmp-tag--before {
  left: calc(28 * var(--u));
}

.cmp-tag--after {
  right: calc(28 * var(--u));
}

.cmp-close {
  margin-top: calc(28 * var(--u));
  width: calc(84 * var(--u));
  height: calc(84 * var(--u));
}
</style>
