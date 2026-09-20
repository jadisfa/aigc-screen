<template>
  <view
    class="kiosk-chip"
    :class="{
      'kiosk-chip--camera': variant === 'camera',
      'kiosk-chip--glass': variant === 'glass',
      'kiosk-chip--shade': variant === 'shade',
    }"
    hover-class="none"
    @click="onClick"
  >
    <image class="kiosk-chip__icon" :class="{ 'is-cam': variant === 'camera' }" :src="icon" mode="aspectFit" />
    <text>{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    icon: string;
    variant?: "back" | "camera" | "glass" | "shade";
  }>(),
  { variant: "back" },
);

const emit = defineEmits<{ click: [] }>();

function onClick() {
  emit("click");
}
</script>

<style>
.kiosk-chip {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
  gap: calc(8 * var(--u));
  width: max-content;
  max-width: 100%;
  height: calc(80 * var(--u));
  padding: 0 calc(54 * var(--u)) 0 calc(32 * var(--u));
  border: calc(2 * var(--u)) solid #eee;
  border-radius: calc(77 * var(--u));
  background: #fff;
  font-size: calc(36 * var(--u));
  font-weight: 700;
  letter-spacing: calc(3.6 * var(--u));
  color: #333;
  box-sizing: border-box;
  white-space: nowrap;
}

.kiosk-chip--camera {
  gap: calc(16 * var(--u));
}

.kiosk-chip--glass,
.kiosk-chip--shade {
  width: calc(220 * var(--u));
  padding: 0 calc(32 * var(--u));
}

.kiosk-chip--glass {
  background: rgba(255, 255, 255, 0.2);
  border-color: transparent;
  color: #fff;
}

.kiosk-chip--shade {
  background: rgba(0, 0, 0, 0.2);
  border-color: transparent;
  color: #fff;
}

.kiosk-chip__icon {
  width: calc(48 * var(--u));
  height: calc(48 * var(--u));
}

.kiosk-chip__icon.is-cam {
  width: calc(40 * var(--u));
  height: calc(33 * var(--u));
}
</style>
