<template>
  <view class="hd">
    <view class="hd__bar">
      <kiosk-chip :icon="ASSETS.back" label="手模库管理" @click="onBack" />
    </view>

    <view class="hd-cards">
      <view class="hd-card" hover-class="none" @click="goLibrary">
        <image class="hd-card__icon" :src="ASSETS.official" mode="aspectFit" />
        <view class="hd-card__copy">
          <text class="hd-card__title">官方手模图库</text>
          <text class="hd-card__lead">选择平台官方的手模图</text>
        </view>
      </view>
      <view class="hd-card" hover-class="none" @click="goUpload">
        <image class="hd-card__icon" :src="ASSETS.upload" mode="aspectFit" />
        <view class="hd-card__copy">
          <text class="hd-card__title">自定义上传手模图</text>
          <text class="hd-card__lead">上传自定义手模</text>
        </view>
      </view>
    </view>

    <view v-if="items.length" class="hd-hint">
      <text>长按图片拖动调整顺序，手模图上限{{ HAND_LIMIT }}张({{ items.length }}/{{ HAND_LIMIT }})</text>
      <view v-if="!editing" class="hd-edit" hover-class="none" @click="editing = true">
        <text>编辑</text>
      </view>
      <view v-else class="hd-edit" hover-class="none" @click="toggleAll">
        <text>全选</text>
        <image v-if="allPicked" class="hd-edit__check" :src="ASSETS.check" mode="aspectFit" />
        <view v-else class="hd-check" />
      </view>
    </view>

    <!-- 拖动网格 -->
    <view
      v-if="items.length"
      class="hd-grid"
      :class="{ 'is-edit': editing }"
      :style="{ height: gridHeight }"
    >
      <view
        v-for="(item, index) in items"
        :key="item.id"
        class="hd-item"
        :class="{ 'is-dragging': activeIndex === index }"
        :style="getItemStyle(index)"
        @touchstart="onTouchStart(index, $event)"
        @touchmove="onTouchMove($event)"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
        @click="onCell(item)"
      >
        <view class="hd-cell" hover-class="none">
          <view class="hd-cell__shot">
            <image class="hd-cell__img" :src="item.image" mode="aspectFill" />
            <text v-if="item.official" class="hd-cell__badge">官方</text>
            <view v-if="editing" class="hd-cell__pick">
              <image
                v-if="picked.has(item.id)"
                class="hd-cell__check"
                :src="ASSETS.check"
                mode="aspectFit"
              />
              <view v-else class="hd-check" />
            </view>
          </view>
          <text class="hd-cell__name">{{ item.name }}</text>
        </view>
      </view>
    </view>

    <view v-else class="hd-empty">
      <image class="hd-empty__art" :src="ASSETS.empty" mode="aspectFit" />
      <text>暂无手模图</text>
      <view class="hd-empty__btn" hover-class="none" @click="goUpload">
        <text>上传手模图</text>
      </view>
    </view>

    <view v-if="editing" class="hd-foot">
      <view class="hd-foot__ghost" hover-class="none" @click="cancelEdit">
        <text>取消</text>
      </view>
      <view class="hd-foot__solid" hover-class="none" @click="removePicked">
        <text>删除</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { cacheHands, HAND_LIMIT, toHandItem, type HandItem } from "@/data/hand";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { deleteCustomHandModel, fetchHandModels, unbindOfficialHandModel } from "@/lib/screen-api/hand-models";
import { showScreenError } from "@/lib/screen-http";
import { discardUploadDraft, scanUploadUrl } from "@/lib/upload-flow";

const ASSETS = {
  back: "/static/scan/back.svg",
  official: "/static/admin/card-hand-official.svg",
  upload: "/static/admin/card-hand-upload.svg",
  empty: "/static/admin/hand-empty.svg",
  check: "/static/admin/check-on.svg",
};

const items = ref<HandItem[]>([]);
const editing = ref(false);
const picked = ref(new Set<string>());

const allPicked = computed(
  () => items.value.length > 0 && items.value.every((row) => picked.value.has(row.id)),
);

// ====================== 网格参数 ======================
const COLS = 3;
const CELL_WIDTH_U = 312;
const GAP_U = 24;
const NAME_FONT_U = 24;

const grid = ref({
  cellWidth: 0,
  cellHeight: 0,
  gapX: 0,
  gapY: 0,
  columns: COLS,
});

// 每个 item 的目标坐标（非拖动元素都回这里）
const positions = ref<{ x: number; y: number }[]>([]);

// 拖动状态
const activeIndex = ref(-1);
const dragX = ref(0);
const dragY = ref(0);
let dragOffsetX = 0;
let dragOffsetY = 0;

// 长按
let longPressTimer: any = null;
const LONG_PRESS = 300;
let touchStartX = 0;
let touchStartY = 0;
let moved = false;

// 缓存 .hd-grid 的视口位置
let areaRect = { left: 0, top: 0 };

// 容器高度
const gridHeight = computed(() => {
  const rows = Math.ceil(items.value.length / COLS);
  const { cellHeight, gapY } = grid.value;
  if (!cellHeight) return "0px";
  return rows * cellHeight + Math.max(0, rows - 1) * gapY + "px";
});

// ====================== 1080 设计稿换算 ======================
function getUnit() {
  const sys = uni.getSystemInfoSync();
  const screenWidth = sys.windowWidth || sys.screenWidth || 375;
  const baseWidth = Math.min(screenWidth, 1080);
  return baseWidth / 1080;
}

function initGrid() {
  const u = getUnit();
  const cellWidth = CELL_WIDTH_U * u;
  const innerGap = GAP_U * u;
  const nameFont = NAME_FONT_U * u;
  const textHeight = Math.ceil(nameFont * 1.4);
  const cellHeight = cellWidth + innerGap + textHeight;
  const rowGap = GAP_U * u;

  grid.value = {
    cellWidth,
    cellHeight,
    gapX: GAP_U * u,
    gapY: rowGap,
    columns: COLS,
  };

  computePositions();
}

function computePositions() {
  const { cellWidth, cellHeight, gapX, gapY, columns } = grid.value;
  if (!cellWidth) return;

  const list: { x: number; y: number }[] = [];
  items.value.forEach((_, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    list.push({
      x: col * (cellWidth + gapX),
      y: row * (cellHeight + gapY),
    });
  });
  positions.value = list;
}

// 每个 item 的样式
function getItemStyle(index: number) {
  const { cellWidth, cellHeight } = grid.value;
  const isDragging = activeIndex.value === index;

  const x = isDragging ? dragX.value : positions.value[index]?.x ?? 0;
  const y = isDragging ? dragY.value : positions.value[index]?.y ?? 0;

  return {
    width: cellWidth + "px",
    height: cellHeight + "px",
    transform: `translate3d(${x}px, ${y}px, 0)`,
    transition: isDragging ? "none" : "transform 0.18s ease",
    zIndex: isDragging ? 10 : 1,
  };
}

// ====================== 拖动逻辑 ======================
function onTouchStart(index: number, e: any) {

  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) return;

  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  moved = false;

  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  // 缓存 .hd-grid 视口位置
  uni.createSelectorQuery()
    .select(".hd-grid")
    .boundingClientRect((rect: any) => {
      if (rect) {
        areaRect.left = rect.left;
        areaRect.top = rect.top;
      }
    })
    .exec();

  longPressTimer = setTimeout(() => {
    // 手指已经移动过，不算长按
    if (moved) return;

    const pos = positions.value[index];
    if (!pos) return;

    const itemLeft = areaRect.left + pos.x;
    const itemTop = areaRect.top + pos.y;
    dragOffsetX = touchStartX - itemLeft;
    dragOffsetY = touchStartY - itemTop;

    dragX.value = pos.x;
    dragY.value = pos.y;
    activeIndex.value = index;
    longPressTimer = null;

    // @ts-ignore
    uni.vibrateShort && uni.vibrateShort();
  }, LONG_PRESS);
}

function onTouchMove(e: any) {
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) return;

  const dx = Math.abs(touch.clientX - touchStartX);
  const dy = Math.abs(touch.clientY - touchStartY);

  // 长按前移动，取消长按（这里不 preventDefault，让页面正常滚动）
  if (activeIndex.value < 0) {
    if (dx > 8 || dy > 8) {
      moved = true;
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
    return;
  }

  // 拖动中：阻止页面滚动（在已激活拖动时 preventDefault 是安全的，
  // 因为此时该元素已设置 touch-action: none，事件不是 passive）
  // if (e.preventDefault) e.preventDefault();
  // if (e.stopPropagation) e.stopPropagation();

  dragX.value = touch.clientX - areaRect.left - dragOffsetX;
  dragY.value = touch.clientY - areaRect.top - dragOffsetY;

  const { cellWidth, cellHeight, gapX, gapY, columns } = grid.value;
  const colStep = cellWidth + gapX;
  const rowStep = cellHeight + gapY;
  const col = Math.round(dragX.value / colStep);
  const row = Math.round(dragY.value / rowStep);

  let targetIndex = row * columns + col;
  targetIndex = Math.max(0, Math.min(items.value.length - 1, targetIndex));

  if (targetIndex !== activeIndex.value) {
    swapItems(activeIndex.value, targetIndex);
    computePositions();
    activeIndex.value = targetIndex;
    // @ts-ignore
    uni.vibrateShort && uni.vibrateShort();
  }
}

function onTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  if (activeIndex.value > -1) {
    const idx = activeIndex.value;
    const pos = positions.value[idx];
    if (pos) {
      dragX.value = pos.x;
      dragY.value = pos.y;
    }
    // 等过渡动画跑完再清
    setTimeout(() => {
      if (activeIndex.value === idx) {
        activeIndex.value = -1;
		console.log(items, '拖拽后的items')
      }
    }, 180);
  }
}

function swapItems(from: number, to: number) {
  const list = [...items.value];
  const [movedItem] = list.splice(from, 1);
  list.splice(to, 0, movedItem);
  items.value = list;
}

// ====================== 生命周期 ======================
onShow(() => {
  loadHands();
});

async function loadHands() {
  try {
    const list = await fetchHandModels();
    const mapped = [
      ...(list.official || []).map((row) => toHandItem(row, true)),
      ...(list.custom || []).map((row) => toHandItem(row, false)),
    ];
    cacheHands(mapped);
    items.value = mapped;

    await nextTick();
    if (!grid.value.cellWidth) {
      initGrid();
    } else {
      computePositions();
    }
  } catch (error) {
    showScreenError(error, "手模库加载失败");
  }
}

// ====================== 路由 ======================
function onBack() {
  goBackOr(ADMIN_PAGES.home);
}

function goLibrary() {
  uni.navigateTo({ url: ADMIN_PAGES.handLibrary });
}

function goUpload() {
  if (items.value.length >= HAND_LIMIT) {
    uni.showToast({ title: `最多${HAND_LIMIT}张手模图`, icon: "none" });
    return;
  }
  discardUploadDraft("hand-admin");
  uni.navigateTo({ url: scanUploadUrl("hand-admin") });
}

// ====================== 编辑 / 选中 ======================
function onCell(item: HandItem) {
  // 拖动中不响应点击
  if (activeIndex.value > -1) return;

  if (editing.value) {
    const next = new Set(picked.value);
    if (next.has(item.id)) {
      next.delete(item.id);
    } else {
      next.add(item.id);
    }
    picked.value = next;
    return;
  }
  uni.navigateTo({ url: `${ADMIN_PAGES.handDetail}?id=${encodeURIComponent(item.id)}` });
}

function toggleAll() {
  picked.value = allPicked.value ? new Set() : new Set(items.value.map((row) => row.id));
}

function cancelEdit() {
  editing.value = false;
  picked.value = new Set();
}

async function removePicked() {
  const selected = items.value.filter((row) => picked.value.has(row.id));
  try {
    await Promise.all(
      selected.map((row) =>
        row.official ? unbindOfficialHandModel(row.id) : deleteCustomHandModel(row.id),
      ),
    );
    await loadHands();
  } catch (error) {
    showScreenError(error, "删除失败");
  }
  cancelEdit();
}
</script>

<style>
page {
  background: #fff;
}

.hd {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.hd__bar {
  height: calc(80 * var(--u));
}

.hd-cards {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.hd-card {
  width: calc(480 * var(--u));
  height: calc(200 * var(--u));
  padding: 0 calc(40 * var(--u));
  background: #fff;
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(16 * var(--u));
  box-sizing: border-box;
}

.hd-card__icon {
  width: calc(90 * var(--u));
  height: calc(90 * var(--u));
  flex-shrink: 0;
}

.hd-card__copy {
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.hd-card__title {
  font-size: calc(28 * var(--u));
  font-weight: 700;
  letter-spacing: calc(2.8 * var(--u));
  color: #333;
}

.hd-card__lead {
  font-size: calc(20 * var(--u));
  line-height: calc(24 * var(--u));
  color: #777;
}

.hd-hint {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  font-size: calc(32 * var(--u));
  color: #777;
}

.hd-edit {
  width: calc(228 * var(--u));
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

.hd-edit__check,
.hd-check,
.hd-cell__check {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
}

.hd-check {
  border: calc(2 * var(--u)) solid #d0d0d0;
  border-radius: calc(8 * var(--u));
  box-sizing: border-box;
}

/* ===== 拖动网格 ===== */
.hd-grid {
  position: relative;
  margin-top: calc(32 * var(--u));
  width: 100%;
}

.hd-grid.is-edit {
  padding-bottom: calc(148 * var(--u));
}

.hd-item {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  /* 关键：让该元素自己处理触摸，不参与页面滚动，不会触发 passive 报错 */
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

.hd-item.is-dragging {
  filter: drop-shadow(0 8rpx 24rpx rgba(0, 0, 0, 0.15));
}

.hd-item.is-dragging .hd-cell {
  transform: scale(1.05);
}

.hd-cell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
  box-sizing: border-box;
  transition: transform 0.18s ease;
}

.hd-cell__shot {
  position: relative;
  width: 100%;
  height: 0;
  padding-top: 100%;
  flex-shrink: 0;
}

.hd-cell__img {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  border-radius: calc(32 * var(--u));
}

.hd-cell__badge {
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

.hd-cell__pick {
  position: absolute;
  right: calc(20 * var(--u));
  top: calc(20 * var(--u));
}

.hd-cell__name {
  font-size: calc(24 * var(--u));
  line-height: 1.4;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ===== 空态 ===== */
.hd-empty {
  margin-top: calc(120 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(32 * var(--u));
  font-size: calc(24 * var(--u));
  color: #333;
}

.hd-empty__art {
  width: calc(299 * var(--u));
  height: calc(341 * var(--u));
}

.hd-empty__btn {
  margin-top: calc(28 * var(--u));
  width: calc(324 * var(--u));
  height: calc(80 * var(--u));
  background: #191919;
  border-radius: calc(77 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  color: #fff;
}

/* ===== 底部操作栏 ===== */
.hd-foot {
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

.hd-foot__ghost,
.hd-foot__solid {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.hd-foot__ghost {
  border: calc(1 * var(--u)) solid #191919;
  color: #333;
  box-sizing: border-box;
}

.hd-foot__solid {
  background: #191919;
  color: #fff;
}
</style>