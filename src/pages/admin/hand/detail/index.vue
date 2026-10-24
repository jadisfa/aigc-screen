<template>
	<view>
	  <view v-if="item" class="dt">
		<view class="dt__bar">
		  <kiosk-chip :icon="ASSETS.back" label="手模详情" @click="onBack" />
		</view>

		<image class="dt__hero" :src="item.image" mode="aspectFill" />

		<view class="dt-field">
		  <text class="dt-field__label">手模名称</text>
		  <input
			v-if="editing"
			class="dt-field__box"
			v-model="draft"
			maxlength="20"
			:adjust-position="false"
		  />
		  <view v-else class="dt-field__box">
			<text>{{ item.name }}</text>
		  </view>
		</view>

		<view class="dt-foot">
		  <view class="dt-foot__ghost" hover-class="none" @click="onDelete">
			<text>删除</text>
		  </view>
		  <view class="dt-foot__solid" hover-class="none" @click="onEdit">
			<text>{{ editing ? "保存" : "编辑名称" }}</text>
		  </view>
		</view>
	  </view>
	  <kiosk-toast />
	  <KiostModal @delete="handleDelete" />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { cacheHands, findHand, toSortedHandItems, type HandItem } from "@/data/hand";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { deleteCustomHandModel, fetchHandModels, patchHandModel, unbindOfficialHandModel } from "@/lib/screen-api/hand-models";
import { showScreenError } from "@/lib/screen-http";
import KioskToast from "@/components/kiosk/kiosk-toast.vue";
import KiostModal from "@/components/kiosk/kiosk-modal.vue";

const ASSETS = {
  back: "/static/scan/back.svg",
};

const TOAST_MS = 1000;

const handId = ref("");
const item = ref<HandItem | null>(null);
const editing = ref(false);
const draft = ref("");
const acting = ref(false);

function showToast(ok: boolean, title: string) {
  if (ok) {
    (uni as any).$toast.success(title, undefined, TOAST_MS);
  } else {
    (uni as any).$toast.error(title, undefined, TOAST_MS);
  }
}

function backToHandLibrary() {
  setTimeout(() => goBackOr(ADMIN_PAGES.hand), TOAST_MS);
}

onLoad((query?: Record<string, string>) => {
  handId.value = query?.id || "";
});

onShow(() => {
  loadHand();
});

async function loadHand() {
  const cached = findHand(handId.value);
  if (cached) {
    item.value = cached;
    draft.value = cached.name;
    editing.value = false;
    return;
  }
  try {
    const list = await fetchHandModels();
    const mapped = toSortedHandItems(list);
    cacheHands(mapped);
    item.value = findHand(handId.value) ?? null;
    draft.value = item.value?.name || "";
    editing.value = false;
  } catch (error) {
    showScreenError(error, "手模详情加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.hand);
}

function onDelete() {
  const current = item.value;
  if (!current) {
    return;
  }
  (uni as any).$modal.load("确认删除", "确定删除该商品？操作不可逆。", "删除",  0, 200000);
}

const handleDelete = async () => {
  const current = item.value;
  (uni as any).$modal.hide();
  if (!current || acting.value) {
    return;
  }
  acting.value = true;
  try {
    if (current.official) {
      await unbindOfficialHandModel(current.id);
    } else {
      await deleteCustomHandModel(current.id);
    }
    showToast(true, "删除成功");
    backToHandLibrary();
  } catch {
    showToast(false, "删除失败");
  } finally {
    acting.value = false;
  }
};

async function onEdit() {
  const current = item.value;
  if (!current || acting.value) {
    return;
  }
  if (!editing.value) {
    draft.value = current.name;
    editing.value = true;
    return;
  }
  const name = draft.value.trim();
  if (!name) {
    showToast(false, "请输入手模名称");
    return;
  }
  acting.value = true;
  try {
    const updated = await patchHandModel(current.id, name);
    const next = {
      ...current,
      name: updated.displayName || name,
    };
    item.value = next;
    const cached = findHand(current.id);
    if (cached) {
      cached.name = next.name;
    }
    editing.value = false;
    showToast(true, "保存成功");
    backToHandLibrary();
  } catch {
    showToast(false, "保存失败");
  } finally {
    acting.value = false;
  }
}
</script>

<style>
page {
  background: #fff;
}

.dt {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(132 * var(--u)) calc(172 * var(--u));
  box-sizing: border-box;
}

.dt__bar {
  height: calc(80 * var(--u));
  margin-left: calc(-84 * var(--u));
}

.dt__hero {
  display: block;
  margin: calc(64 * var(--u)) auto 0;
  width: calc(816 * var(--u));
  height: calc(816 * var(--u));
  border-radius: calc(60 * var(--u));
}

.dt-field {
  margin-top: calc(60 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(32 * var(--u));
}

.dt-field__label {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  letter-spacing: calc(3.2 * var(--u));
  color: #333;
}

.dt-field__box {
  width: 100%;
  min-height: calc(112 * var(--u));
  padding: calc(32 * var(--u));
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(32 * var(--u));
  font-size: calc(32 * var(--u));
  letter-spacing: calc(3.2 * var(--u));
  color: #333;
  box-sizing: border-box;
}

.dt-foot {
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

.dt-foot__ghost,
.dt-foot__solid {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.dt-foot__ghost {
  border: calc(1 * var(--u)) solid #191919;
  color: #333;
  box-sizing: border-box;
}

.dt-foot__solid {
  background: #191919;
  color: #fff;
}
</style>
