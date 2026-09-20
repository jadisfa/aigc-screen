<template>
  <view class="lib">
    <view class="lib__bar">
      <kiosk-chip :icon="ASSETS.back" label="官方手模图库" @click="onBack" />
      <view v-if="!batching" class="lib-batch" hover-class="none" @click="startBatch">
        <text>批量选择</text>
        <image class="lib-batch__icon" :src="ASSETS.batch" mode="aspectFit" />
      </view>
      <view v-else class="lib-batch" hover-class="none" @click="toggleAll">
        <text>全选</text>
        <image v-if="allPicked" class="lib-batch__icon" :src="ASSETS.check" mode="aspectFit" />
        <view v-else class="lib-check" />
      </view>
    </view>

    <view class="lib-grid" :class="{ 'is-batch': batching }">
      <view
        v-for="item in catalog"
        :key="item.id"
        class="lib-cell"
        hover-class="none"
        @click="onCell(item)"
      >
        <view class="lib-cell__shot">
          <image class="lib-cell__img" :src="item.image" mode="aspectFill" />
          <text class="lib-cell__official">官方</text>
          <text v-if="!batching && selected.has(item.id)" class="lib-cell__picked">已选择</text>
          <view v-if="batching" class="lib-cell__checkwrap">
            <image v-if="picked.has(item.id)" class="lib-check-img" :src="ASSETS.check" mode="aspectFit" />
            <view v-else class="lib-check" />
          </view>
        </view>
        <text class="lib-cell__name">{{ item.name }}</text>
      </view>
    </view>

    <view v-if="batching" class="lib-foot">
      <view class="lib-foot__ghost" hover-class="none" @click="cancelBatch">
        <text>取消</text>
      </view>
      <view class="lib-foot__solid" hover-class="none" @click="confirmBatch">
        <text>确定({{ picked.size }}/{{ OFFICIAL_PICK_LIMIT }})</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { HAND_LIMIT, OFFICIAL_PICK_LIMIT, toOfficialHand, type OfficialHand } from "@/data/hand";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import {
  bindOfficialHandModel,
  fetchHandModels,
  fetchOfficialHandLibrary,
  unbindOfficialHandModel,
} from "@/lib/screen-api/hand-models";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  batch: "/static/admin/batch.svg",
  check: "/static/admin/check-on.svg",
};

const catalog = ref<OfficialHand[]>([]);
const selected = ref(new Set<string>());
const boundConfigByMaterial = ref(new Map<string, string>());
const storeTotal = ref(0);
const batching = ref(false);
const picked = ref(new Set<string>());

const allPicked = computed(
  () => catalog.value.length > 0 && catalog.value.every((row) => picked.value.has(row.id)),
);

onShow(() => {
  loadOfficial();
});

async function loadOfficial() {
  try {
    const [library, store] = await Promise.all([fetchOfficialHandLibrary(), fetchHandModels()]);
    catalog.value = library.map(toOfficialHand);
    const bound = new Map<string, string>();
    for (const row of store.official || []) {
      if (row.materialId && row.configId) {
        bound.set(row.materialId, row.configId);
      }
    }
    boundConfigByMaterial.value = bound;
    selected.value = new Set(bound.keys());
    storeTotal.value = (store.official?.length || 0) + (store.custom?.length || 0);
  } catch (error) {
    showScreenError(error, "官方手模加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.hand);
}

function startBatch() {
  picked.value = new Set(selected.value);
  batching.value = true;
}

function cancelBatch() {
  batching.value = false;
  picked.value = new Set();
}

function toggleAll() {
  if (allPicked.value) {
    picked.value = new Set();
    return;
  }
  picked.value = new Set(catalog.value.slice(0, OFFICIAL_PICK_LIMIT).map((row) => row.id));
}

async function onCell(item: OfficialHand) {
  if (batching.value) {
    const next = new Set(picked.value);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else if (next.size >= OFFICIAL_PICK_LIMIT) {
      uni.showToast({ title: `最多选择${OFFICIAL_PICK_LIMIT}张`, icon: "none" });
      return;
    } else {
      next.add(item.id);
    }
    picked.value = next;
    return;
  }
  if (selected.value.has(item.id)) {
    const configId = boundConfigByMaterial.value.get(item.id);
    if (!configId) {
      return;
    }
    try {
      await unbindOfficialHandModel(configId);
      await loadOfficial();
    } catch (error) {
      showScreenError(error, "解绑失败");
    }
    return;
  }
  if (storeTotal.value >= HAND_LIMIT) {
    uni.showToast({ title: `手模图上限${HAND_LIMIT}张`, icon: "none" });
    return;
  }
  if (selected.value.size >= OFFICIAL_PICK_LIMIT) {
    uni.showToast({ title: `最多选择${OFFICIAL_PICK_LIMIT}张`, icon: "none" });
    return;
  }
  try {
    await bindOfficialHandModel(item.id);
    await loadOfficial();
  } catch (error) {
    showScreenError(error, "绑定失败");
  }
}

async function confirmBatch() {
  if (picked.value.size > OFFICIAL_PICK_LIMIT) {
    uni.showToast({ title: `最多选择${OFFICIAL_PICK_LIMIT}张`, icon: "none" });
    return;
  }
  const customCount = storeTotal.value - selected.value.size;
  if (customCount + picked.value.size > HAND_LIMIT) {
    uni.showToast({ title: `手模图上限${HAND_LIMIT}张`, icon: "none" });
    return;
  }
  const toUnbind = [...selected.value].filter((id) => !picked.value.has(id));
  const toBind = [...picked.value].filter((id) => !selected.value.has(id));
  try {
    await Promise.all(
      toUnbind.map((id) => {
        const configId = boundConfigByMaterial.value.get(id);
        return configId ? unbindOfficialHandModel(configId) : Promise.resolve();
      }),
    );
    await Promise.all(toBind.map((id) => bindOfficialHandModel(id)));
    cancelBatch();
    await loadOfficial();
  } catch (error) {
    showScreenError(error, "保存失败");
  }
}
</script>

<style>
page {
  background: #fff;
}

.lib {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.lib__bar {
  height: calc(80 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.lib-batch {
  height: calc(80 * var(--u));
  padding: 0 calc(32 * var(--u));
  background: #fff;
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  box-sizing: border-box;
}

.lib-batch__icon,
.lib-check,
.lib-check-img {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
}

.lib-check {
  border: calc(2 * var(--u)) solid #d0d0d0;
  border-radius: calc(8 * var(--u));
  box-sizing: border-box;
}

.lib-grid {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.lib-grid.is-batch {
  padding-bottom: calc(148 * var(--u));
}

.lib-cell {
  width: calc(312 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.lib-cell__shot {
  position: relative;
  width: calc(312 * var(--u));
  height: calc(312 * var(--u));
}

.lib-cell__img {
  width: calc(312 * var(--u));
  height: calc(312 * var(--u));
  border-radius: calc(32 * var(--u));
}

.lib-cell__official {
  position: absolute;
  left: calc(20 * var(--u));
  bottom: calc(20 * var(--u));
  padding: calc(12 * var(--u)) calc(16 * var(--u));
  background: rgba(0, 0, 0, 0.3);
  border-radius: calc(12 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 500;
  color: #fff;
}

.lib-cell__picked {
  position: absolute;
  left: calc(20 * var(--u));
  top: calc(20 * var(--u));
  padding: calc(12 * var(--u)) calc(16 * var(--u));
  background: #000;
  border-radius: calc(12 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 500;
  color: #fff;
}

.lib-cell__checkwrap {
  position: absolute;
  right: calc(20 * var(--u));
  top: calc(20 * var(--u));
}

.lib-cell__name {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.lib-foot {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  padding: calc(24 * var(--u)) calc(48 * var(--u));
  background: #fff;
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
  box-sizing: border-box;
}

.lib-foot__ghost,
.lib-foot__solid {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.lib-foot__ghost {
  border: calc(1 * var(--u)) solid #191919;
  color: #333;
  box-sizing: border-box;
}

.lib-foot__solid {
  background: #191919;
  color: #fff;
}
</style>
