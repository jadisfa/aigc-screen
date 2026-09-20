<template>
  <view class="kw">
    <view class="kw__bar">
      <kiosk-chip :icon="ICONS.back" label="返回" @click="onBack" />
    </view>

    <text class="kw__title">{{ tab === "text" ? "描述你想要的美甲风格" : "点亮关键词" }}</text>
    <text class="kw__lead">{{
      tab === "text" ? "风格、颜色、场合、气质或你喜欢的细节，越具体越准哦~" : "为您推荐心仪美甲"
    }}</text>

    <view class="kw-seg">
      <view
        class="kw-seg__item"
        :class="{ 'is-on': tab === 'text' }"
        hover-class="none"
        @click="switchTab('text')"
      >
        <text>文字输入</text>
      </view>
      <view
        class="kw-seg__item"
        :class="{ 'is-on': tab === 'keywords' }"
        hover-class="none"
        @click="switchTab('keywords')"
      >
        <text>选择关键词</text>
      </view>
    </view>

    <view v-if="tab === 'text'" class="kw-box">
      <textarea
        class="kw-box__field"
        v-model="query"
        maxlength="200"
        placeholder="例如:我想要一款适合夏天通勤、温柔显白、有一点法式感的美甲"
        placeholder-style="color:#BBBBBB"
        :adjust-position="false"
        confirm-type="done"
      />
      <text class="kw-box__count">{{ query.length }}/200</text>
    </view>

    <scroll-view v-else class="kw-pick" scroll-y :show-scrollbar="false">
      <!-- 顶部分类 tab -->
      <scroll-view
        class="kw-cats"
        scroll-x
        :show-scrollbar="false"
        @touchstart="interrupt"
      >
        <view class="kw-cats__row">
          <view
            v-for="(group, index) in KEYWORD_CATEGORIES"
            :key="group.title"
            class="kw-cat"
            :class="{ 'is-on': catIndex === index }"
            hover-class="none"
            @click="selectCat(index)"
          >
            <text>{{ group.title }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- 横向可滑动的分类内容 -->
      <scroll-view
        class="tags-list"
        scroll-x
        :show-scrollbar="false"
        :scroll-left="scrollLeft"
        :scroll-with-animation="false"
        @scroll="onTagsScroll"
        @touchstart="interrupt"
      >
        <view
          v-for="(group, index) in KEYWORD_CATEGORIES"
          :key="group.title"
          class="kw-grid"
          :id="`cat-${index}`"
        >
          <view
            v-for="tag in group.tags"
            :key="tag"
            class="kw-tag"
            :class="{ 'is-on': selected.includes(tag) }"
            hover-class="none"
            @click="toggle(tag)"
          >
            <text>{{ tag }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="kw-mine">
        <text class="kw-mine__title">我的关键词({{ selected.length }}/{{ MAX_KEYWORD_COUNT }})</text>
        <view class="kw-mine__list">
          <view
            v-for="tag in selected"
            :key="tag"
            class="kw-mine__chip"
            hover-class="none"
            @click="remove(tag)"
          >
            <text>{{ tag }}</text>
            <text class="kw-mine__x">×</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-if="tab === 'text'" class="kw__spacer" />

    <view class="kw__btn" hover-class="none" @click="onStart">
      <text>开始生成</text>
    </view>
  </view>
</template>


<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import {
  INSPIRE_QUERY_KEY,
  INSPIRE_TAGS_KEY,
  KEYWORD_CATEGORIES,
  MAX_KEYWORD_COUNT,
} from "@/data/inspire";
import { KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { generatingUrl } from "@/lib/upload-flow";

type Tab = "text" | "keywords";

const ICONS = { back: "/static/scan/back.svg" };

// ===== 固定尺寸（与 CSS 一一对应）=====
const GRID_WIDTH_U = 1272; // .kw-grid 宽度（u）
const GRID_GAP_U = 24;     // .kw-grid 右侧间距（u）

// ===== 自动轮播配置 =====
const AUTO_INTERVAL = 30;  // 每 30ms 走一步
const AUTO_STEP = 1.5;     // 每步 1.5px ≈ 50px/s
const USER_MOVE_THRESHOLD = 30; // 判定"用户手动滑动"的阈值
const CLICK_GUARD_MS = 320;     // 点击 tab 后屏蔽反推的时长
const RESUME_DELAY = 5000; // 用户操作后多久恢复自动轮播
const CAT_SWITCH_HYSTERESIS = 0.15;

// ===== 状态 =====
const tab = ref<Tab>("text");
const catIndex = ref(0);
const query = ref("");
const selected = ref<string[]>([]);
const scrollLeft = ref(0);

// ===== 内部状态 =====
let autoTimer: ReturnType<typeof setInterval> | null = null;
let autoPos = 0;              // 自动轮播当前坐标（px）
let autoRunning = false;      // 是否正在自动轮播
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let isClickScrolling = false; // 点击 tab 期间屏蔽反推

// ===== 单位换算 =====
function getUnit(): number {
  const sys = uni.getSystemInfoSync();
  const w = sys.windowWidth || sys.screenWidth || 375;
  return Math.min(w, 1080) / 1080;
}

function getStep(): number {
  return (GRID_WIDTH_U + GRID_GAP_U) * getUnit();
}

function getMaxScroll(): number {
  // 最后一个分类起点 + 分类宽度 - 视口宽度 = 最大可滚距离
  // 简化：直接用"分类数量 * 步长 - 视口宽度"，略大于实际
  const total = getStep() * KEYWORD_CATEGORIES.length;
  const viewport = uni.getSystemInfoSync().windowWidth || 375;
  return Math.max(0, total - viewport);
}

function clampIndex(i: number): number {
  return Math.max(0, Math.min(KEYWORD_CATEGORIES.length - 1, i));
}

// ===== 自动轮播 =====
function startAuto() {
  stopAutoTimer();
  autoRunning = true;
  autoPos = scrollLeft.value;

  autoTimer = setInterval(() => {
    if (!autoRunning) return;

    autoPos += AUTO_STEP;

    if (autoPos >= getMaxScroll()) {
      autoPos = 0;
      if (catIndex.value !== 0) catIndex.value = 0;
    } else {
      const step = getStep();
      const idx = clampIndex(Math.round(autoPos / step));
      if (idx !== catIndex.value) catIndex.value = idx;
    }

    scrollLeft.value = autoPos;
  }, AUTO_INTERVAL);
}

function stopAutoTimer() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

// ===== 统一中断入口 =====
function interrupt() {
  // 任何用户交互都调这个
  // if (!autoRunning) return;
  // autoRunning = false;
  // stopAutoTimer();
  autoRunning = false;
    stopAutoTimer();
  
    // 清掉旧的恢复计时器
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  
    // 不在 keywords 页就不恢复
    if (tab.value !== "keywords") return;
  
    // 延迟恢复
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      if (tab.value === "keywords") {
        startAuto();
      }
    }, RESUME_DELAY);
}

// ===== 切换 tab =====
function switchTab(next: Tab) {
  if (tab.value === next) return;

  // 清理所有计时器
  autoRunning = false;
  stopAutoTimer();
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }

  tab.value = next;

  if (next === "keywords") {
	  console.log(KEYWORD_CATEGORIES)
    catIndex.value = 0;
    scrollLeft.value = 0;
    autoPos = 0;
    setTimeout(() => {
      if (tab.value === "keywords") startAuto();
    }, 400);
  }
}

// ===== 点击 tab =====
function selectCat(index: number) {
  interrupt();
  catIndex.value = index;

  const target = getStep() * index;

  isClickScrolling = true;
  scrollLeft.value = target;
  autoPos = target;

  setTimeout(() => {
    isClickScrolling = false;
  }, CLICK_GUARD_MS);
}

// ===== 滑动反推 =====
function onTagsScroll(e: any) {
  const left = e.detail?.scrollLeft ?? 0;

  // 自动轮播中：判断是自动还是用户
  if (autoRunning) {
    const diff = Math.abs(left - autoPos);
    if (diff <= USER_MOVE_THRESHOLD) {
      // 自动轮播自身：直接反推
      const step = getStep();
      if (step > 0) {
        const idx = clampIndex(Math.round(left / step));
        if (idx !== catIndex.value) catIndex.value = idx;
      }
      return;
    }
    // 用户手动滑动：同步 + 中断
    scrollLeft.value = left;
    interrupt();
  } else {
    // 已停自动轮播，同步位置
    scrollLeft.value = left;
  }

  // 点击 tab 期间不反推
  if (isClickScrolling) return;

  const step = getStep();
  if (step <= 0) return;

  // 直接 round，不做 hysteresis
  const idx = clampIndex(Math.round(left / step));
  if (idx !== catIndex.value) {
    catIndex.value = idx;
  }
}

// ===== 业务逻辑 =====
function onBack() {
  interrupt();
  goBackOr(KIOSK_PAGES.home);
}

function toggle(tag: string) {
  interrupt();
  const next = selected.value.slice();
  const i = next.indexOf(tag);
  if (i >= 0) {
    next.splice(i, 1);
    selected.value = next;
    return;
  }
  if (next.length >= MAX_KEYWORD_COUNT) {
    uni.showToast({ title: `最多选择${MAX_KEYWORD_COUNT}个关键词`, icon: "none" });
    return;
  }
  next.push(tag);
  selected.value = next;
}

function remove(tag: string) {
  interrupt();
  selected.value = selected.value.filter((item) => item !== tag);
}

function onStart() {
  interrupt();
  if (tab.value === "text") {
    const text = query.value.trim();
    if (!text) return;
    uni.setStorageSync(INSPIRE_QUERY_KEY, text);
    uni.setStorageSync(INSPIRE_TAGS_KEY, "[]");
  } else {
    if (!selected.value.length) return;
    uni.setStorageSync(INSPIRE_QUERY_KEY, "");
    uni.setStorageSync(INSPIRE_TAGS_KEY, JSON.stringify(selected.value));
  }
  uni.navigateTo({ url: generatingUrl() });
}

// ===== 生命周期 =====
watch(tab, (val) => {
  if (val !== "keywords") {
    interrupt();
  }
});

onMounted(() => {
  if (tab.value === "keywords") {
    setTimeout(() => startAuto(), 400);
	console.log(KEYWORD_CATEGORIES)
  }
});

onUnmounted(() => {
  stopAutoTimer();
    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
});

</script>

<style>
page {
  height: 100%;
  background: #fff;
}

.kw {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  height: 100%;
  margin: 0 auto;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: calc(80 * var(--u)) 0 calc(56 * var(--u));
  box-sizing: border-box;
}

.kw__bar {
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
}

.kw__title {
  margin-top: calc(16 * var(--u));
  width: calc(984 * var(--u));
  font-size: calc(56 * var(--u));
  font-weight: 900;
  line-height: calc(76 * var(--u));
  letter-spacing: calc(2 * var(--u));
  color: #333;
  text-align: center;
}

.kw__lead {
  margin-top: calc(12 * var(--u));
  width: calc(984 * var(--u));
  font-size: calc(26 * var(--u));
  font-weight: 500;
  line-height: calc(38 * var(--u));
  color: #bbb;
  text-align: center;
}

.kw-seg {
  margin-top: calc(40 * var(--u));
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  padding: calc(6 * var(--u));
  background: #f5f6f8;
  border-radius: calc(80 * var(--u));
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
}

.kw-seg__item {
  flex: 1;
  height: 100%;
  border-radius: calc(68 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(30 * var(--u));
  font-weight: 700;
  color: #999;
}

.kw-seg__item.is-on {
  background: #191919;
  color: #fff;
}

.kw-box {
  position: relative;
  margin-top: calc(56 * var(--u));
  width: calc(984 * var(--u));
  height: calc(432 * var(--u));
  border: calc(2 * var(--u)) solid #e6e6e6;
  border-radius: calc(32 * var(--u));
  box-sizing: border-box;
  background: #fff;
  flex-shrink: 0;
}

.kw-box__field {
  width: 100%;
  height: 100%;
  padding: calc(36 * var(--u)) calc(36 * var(--u)) calc(64 * var(--u));
  box-sizing: border-box;
  font-size: calc(30 * var(--u));
  font-weight: 500;
  line-height: calc(46 * var(--u));
  color: #333;
  background: transparent;
}

.kw-box__count {
  position: absolute;
  right: calc(36 * var(--u));
  bottom: calc(24 * var(--u));
  font-size: calc(24 * var(--u));
  color: #bbb;
}

/* #ifdef H5 */
.kw uni-textarea,
.kw uni-textarea .uni-textarea-wrapper,
.kw uni-textarea .uni-textarea-textarea,
.kw uni-textarea textarea {
  width: 100%;
  height: 100%;
  font-size: calc(30 * var(--u));
  line-height: calc(46 * var(--u));
  color: #333;
}
/* #endif */

.kw-pick {
  margin-top: calc(40 * var(--u));
  width: calc(984 * var(--u));
  flex: 1;
  min-height: 0;
  height: 0;
}

.kw-cats {
  width: 100%;
  height: calc(64 * var(--u));
  white-space: nowrap;
}

.kw-cats__row {
  display: inline-flex;
  flex-direction: row;
  align-items: flex-start;
  gap: calc(40 * var(--u));
}

.kw-cat {
  flex-shrink: 0;
  padding-bottom: calc(10 * var(--u));
  border-bottom: calc(6 * var(--u)) solid transparent;
  font-size: calc(28 * var(--u));
  font-weight: 500;
  color: #bbb;
}

.kw-cat.is-on {
  font-weight: 700;
  color: #333;
  border-bottom-color: #191919;
}

.kw-grid {
  width: calc(1272 * var(--u));
  margin-top: calc(32 * var(--u));
  margin-right: calc(24 * var(--u));
  display: inline-flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u)) 0;
}

.kw-tag {
  /* width: calc((984 * var(--u) - 48 * var(--u)) / 3); */
  width: auto;
  padding: 0 calc(64 * var(--u));
  height: calc(112 * var(--u));
  border-radius: calc(24 * var(--u));
  background: #ebf1f4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(28 * var(--u));
  font-weight: 500;
  color: #333;
  box-sizing: border-box;
  margin-left: calc(24 * var(--u));
}
.kw-tag:first-child {
	margin-left: 0;
}

.kw-tag.is-on {
  background: #191919;
  color: #fff;
}

.kw-mine {
  margin-top: calc(48 * var(--u));
  padding-bottom: calc(24 * var(--u));
}

.kw-mine__title {
  font-size: calc(28 * var(--u));
  font-weight: 700;
  color: #333;
}

.kw-mine__list {
  margin-top: calc(20 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(16 * var(--u));
}

.kw-mine__chip {
  height: calc(52 * var(--u));
  padding: 0 calc(20 * var(--u));
  border: calc(2 * var(--u)) solid #ccc;
  border-radius: calc(52 * var(--u));
  background: #fff;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(8 * var(--u));
  font-size: calc(24 * var(--u));
  color: #333;
  box-sizing: border-box;
}

.kw-mine__x {
  font-size: calc(28 * var(--u));
  line-height: 1;
  color: #777;
}

.kw__spacer {
  flex: 1;
  min-height: calc(24 * var(--u));
}

.kw__btn {
  width: calc(696 * var(--u)) !important;
  height: calc(120 * var(--u));
  border-radius: calc(120 * var(--u));
  background: #191919;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: calc(36 * var(--u));
  font-weight: 700;
  flex-shrink: 0;
}
.kw-grid:last-child {
  margin-right: 0;
}
.tags-list {
	white-space: nowrap;
}
</style>
