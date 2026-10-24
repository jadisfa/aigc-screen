<template>
  <view class="kw">
    <view class="kw__bar">
      <kiosk-chip :icon="ICONS.back" label="返回" @click="onBack" />
    </view>

    <text class="kw__title">{{ tab === "text" ? "描述你想要的美甲风格" : "点亮关键词" }}</text>
    <text class="kw__lead">{{
      tab === "text" ? "风格、颜色、场合、气质或你喜欢的细节，越具体越准哦~" : "每个维度选一个标签，让推荐的美甲更符合你的心意"
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
      <view v-if="loadingTags" class="kw-hint">
        <text>标签加载中...</text>
      </view>
      <view v-else-if="!categories.length" class="kw-hint">
        <text>暂无标签，请先在后台标签管理中配置</text>
      </view>
      <template v-else>
        <scroll-view class="kw-cats" scroll-x :show-scrollbar="false">
          <view class="kw-cats__row">
            <view
              v-for="(group, index) in categories"
              :key="group.title"
              class="kw-cat"
              :class="{ 'is-on': catIndex === index }"
              hover-class="none"
              @click="selectCat(index)"
            >
              <text>{{ group.title }}</text>
              <view class="kw-cat__bar" />
            </view>
          </view>
        </scroll-view>

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
            v-for="(group, index) in categories"
            :key="group.title"
            class="kw-grid"
            :id="`cat-${index}`"
            :style="{ width: getGridWidth(group) }"
          >
            <view
              v-for="(row, rowIndex) in getLayout(group).rows"
              :key="`${group.title}-${rowIndex}`"
              class="kw-grid__row"
              :class="{ 'is-offset': rowIndex % 2 === 1 }"
            >
              <view
                v-for="tag in row"
                :key="tag"
                class="kw-tag"
                :class="{ 'is-on': selected.includes(tag) }"
                hover-class="none"
                @click="toggle(tag)"
              >
                <text>{{ tag }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </template>

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
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import {
  INSPIRE_QUERY_KEY,
  INSPIRE_TAGS_KEY,
  MAX_KEYWORD_COUNT,
  keywordCategoriesFromTags,
  type KeywordCategory,
} from "@/data/inspire";
import { KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { fetchCatalogTags } from "@/lib/screen-api/catalog";
import { showScreenError } from "@/lib/screen-http";
import { trackMatchSubmit } from "@/lib/track-events";
import { generatingUrl } from "@/lib/upload-flow";

type Tab = "text" | "keywords";

const ICONS = { back: "/static/scan/back.svg" };

// ===== 尺寸常量 =====
const MIN_WIDTH_U = 1357;
const WIDTH_STEP_U = 40;
const MAX_ROWS = 4;
const ODD_ROW_OFFSET_U = 85;
const TAG_PADDING_X_U = 64;
const TAG_GAP_U = 24;
const TAG_FONT_U = 32;
const GRID_RIGHT_GAP_U = 24;   // .kw-grid 之间的右侧间距

// ===== 自动轮播配置 =====
const AUTO_INTERVAL = 30;
const AUTO_STEP = 1.5;
const USER_MOVE_THRESHOLD = 30;
const CLICK_GUARD_MS = 320;
const RESUME_DELAY = 5000;

// ===== 状态 =====
const tab = ref<Tab>("text");
const catIndex = ref(0);
const query = ref("");
const selected = ref<string[]>([]);
const scrollLeft = ref(0);
const categories = ref<KeywordCategory[]>([]);
const loadingTags = ref(false);

// ===== 内部状态 =====
let autoTimer: ReturnType<typeof setInterval> | null = null;
let autoPos = 0;
let autoRunning = false;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let isClickScrolling = false;

// ★ 每个分类的累计起点位置（px），用于滑动反推
const catStarts = ref<number[]>([]);
// ★ 每个分类的宽度（px）
const catWidths = ref<number[]>([]);

// ===== 单位换算 =====
function getUnit(): number {
  const sys = uni.getSystemInfoSync();
  const w = sys.windowWidth || sys.screenWidth || 375;
  return Math.min(w, 1080) / 1080;
}

function clampIndex(i: number): number {
  return Math.max(0, Math.min(categories.value.length - 1, i));
}

// ===== tag 宽度估算 =====
function charWidthRatio(ch: string): number {
  const code = ch.codePointAt(0)!;
  if (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef)
  ) return 1.0;
  if (code >= 0x30 && code <= 0x39) return 0.55;
  if (code >= 0x41 && code <= 0x5a) return 0.68;
  if (code >= 0x61 && code <= 0x7a) return 0.55;
  if (code === 0x20) return 0.28;
  return 0.4;
}

function estimateTagWidthU(tag: string): number {
  let textWidth = 0;
  for (const ch of tag) textWidth += charWidthRatio(ch) * TAG_FONT_U;
  return textWidth + TAG_PADDING_X_U * 2;
}

function rowWidthU(row: string[]): number {
  if (!row.length) return 0;
  return row.reduce((sum, tag) => sum + estimateTagWidthU(tag), 0)
    + TAG_GAP_U * (row.length - 1);
}

// ===== 贪心分行（塞满）=====
function computeRowsByGreedy(tags: string[], rowMaxU: number): string[][] {
  if (!tags.length) return [];
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentWidth = 0;

  for (const tag of tags) {
    const tagWidth = estimateTagWidthU(tag);
    const needed = currentRow.length === 0
      ? tagWidth
      : currentWidth + TAG_GAP_U + tagWidth;

    const rowIndex = rows.length;
    const rowOffset = rowIndex % 2 === 1 ? ODD_ROW_OFFSET_U : 0;
    const available = rowMaxU - rowOffset;

    if (currentRow.length > 0 && needed > available) {
      rows.push(currentRow);
      currentRow = [tag];
      currentWidth = tagWidth;
    } else {
      currentRow.push(tag);
      currentWidth = needed;
    }
  }
  if (currentRow.length) rows.push(currentRow);
  return rows;
}

// ===== 按数量均分 =====
function splitEvenly(tags: string[], n: number): string[][] {
  if (!tags.length) return Array.from({ length: n }, () => []);
  if (n <= 0) return [];
  const base = Math.floor(tags.length / n);
  const remainder = tags.length % n;
  const rows: string[][] = [];
  let index = 0;
  for (let i = 0; i < n; i++) {
    const size = base + (i < remainder ? 1 : 0);
    rows.push(tags.slice(index, index + size));
    index += size;
  }
  return rows;
}

// ===== 反算宽度 =====
function calcGridWidthU(rows: string[][]): number {
  let maxWidth = MIN_WIDTH_U;
  rows.forEach((row, i) => {
    const rowW = rowWidthU(row);
    const offset = i % 2 === 1 ? ODD_ROW_OFFSET_U : 0;
    const need = rowW + offset;
    if (need > maxWidth) maxWidth = need;
  });
  return maxWidth;
}

// ===== 核心：layoutTags =====
function layoutTags(tags: string[]): {
  rows: string[][];
  widthU: number;
} {
  if (!tags.length) return { rows: [], widthU: MIN_WIDTH_U };

  // 1. 最小宽度贪心分行
  let widthU = MIN_WIDTH_U;
  let rows = computeRowsByGreedy(tags, widthU);

  // 2. ≤ 4 行 → 直接用最小宽度
  if (rows.length <= MAX_ROWS) {
    return { rows, widthU: MIN_WIDTH_U };
  }

  // 3. > 4 行 → 加宽（无上限）
  while (rows.length > MAX_ROWS) {
    widthU += WIDTH_STEP_U;
    rows = computeRowsByGreedy(tags, widthU);
  }

  // 4. 加宽后按数量均分到 4 行
  const rowCount = Math.min(rows.length, MAX_ROWS);
  const evenRows = splitEvenly(tags, rowCount);

  // 5. 反算宽度
  const finalWidthU = Math.max(MIN_WIDTH_U, calcGridWidthU(evenRows));

  return { rows: evenRows, widthU: finalWidthU };
}

// ===== 缓存 =====
const layoutCache = new Map<string, ReturnType<typeof layoutTags>>();

function getLayout(group: KeywordCategory) {
  if (!layoutCache.has(group.title)) {
    layoutCache.set(group.title, layoutTags(group.tags));
  }
  return layoutCache.get(group.title)!;
}

function getGridWidth(group: KeywordCategory): string {
  const { widthU } = getLayout(group);
  return `calc(${widthU} * var(--u))`;
}

// ===== 重算 catStarts / catWidths =====
function recalcCatStarts() {
  const u = getUnit();
  const starts: number[] = [];
  const widths: number[] = [];
  let acc = 0;

  categories.value.forEach((group) => {
    const { widthU } = getLayout(group);
    const widthPx = widthU * u;
    starts.push(acc);
    widths.push(widthPx);
    // 累加：当前分类宽度 + 右侧间距
    acc += widthPx + GRID_RIGHT_GAP_U * u;
  });

  catStarts.value = starts;
  catWidths.value = widths;
}

// ===== 自动轮播 =====
function getMaxScroll(): number {
  if (!catStarts.value.length) return 0;
  const lastStart = catStarts.value[catStarts.value.length - 1];
  const lastWidth = catWidths.value[catWidths.value.length - 1];
  const total = lastStart + lastWidth;
  const viewport = uni.getSystemInfoSync().windowWidth || 375;
  return Math.max(0, total - viewport);
}

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
      // ★ 用 catStarts 反推当前分类
      const idx = findCatIndexByScroll(autoPos);
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

// ★ 根据 scrollLeft 找当前分类
function findCatIndexByScroll(scrollLeft: number): number {
  const starts = catStarts.value;
  if (!starts.length) return 0;
  let idx = 0;
  for (let i = 0; i < starts.length; i++) {
    if (scrollLeft >= starts[i]) idx = i;
    else break;
  }
  return clampIndex(idx);
}

// ===== 统一中断 =====
function interrupt() {
  autoRunning = false;
  stopAutoTimer();
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
  if (tab.value !== "keywords") return;
  resumeTimer = setTimeout(() => {
    resumeTimer = null;
    if (tab.value === "keywords") startAuto();
  }, RESUME_DELAY);
}

// ===== 切换 tab =====
function switchTab(next: Tab) {
  if (tab.value === next) return;
  autoRunning = false;
  stopAutoTimer();
  if (resumeTimer) {
    clearTimeout(resumeTimer);
    resumeTimer = null;
  }
  tab.value = next;
  if (next === "keywords") {
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
  const target = catStarts.value[index] ?? 0;
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

  if (autoRunning) {
    const diff = Math.abs(left - autoPos);
    if (diff <= USER_MOVE_THRESHOLD) {
      // 自动轮播自身：反推
      const idx = findCatIndexByScroll(left);
      if (idx !== catIndex.value) catIndex.value = idx;
      return;
    }
    scrollLeft.value = left;
    interrupt();
  } else {
    scrollLeft.value = left;
  }

  if (isClickScrolling) return;

  const idx = findCatIndexByScroll(left);
  if (idx !== catIndex.value) catIndex.value = idx;
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
  trackMatchSubmit();
  uni.navigateTo({ url: `${generatingUrl()}&from=keywords` });
}

// ===== 数据加载 =====
onShow(() => {
  void loadTags();
});

async function loadTags() {
  loadingTags.value = true;
  try {
    const tags = await fetchCatalogTags();
    categories.value = keywordCategoriesFromTags(tags);
    if (catIndex.value >= categories.value.length) catIndex.value = 0;

    // ★ 数据变了，清缓存 + 重算 catStarts
    layoutCache.clear();
    // 等 DOM 渲染后再算（宽度依赖 layout）
    setTimeout(() => {
      recalcCatStarts();
    }, 50);
  } catch (error) {
    categories.value = [];
    showScreenError(error, "标签加载失败");
  } finally {
    loadingTags.value = false;
  }
}

// ===== 生命周期 =====
watch(tab, (val) => {
  if (val !== "keywords") {
    interrupt();
  } else {
    setTimeout(() => startAuto(), 400);
  }
});

onMounted(() => {
  if (tab.value === "keywords") {
    setTimeout(() => startAuto(), 400);
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
  width: calc(1080 * var(--u));
  padding-left: calc(48 * var(--u));
  padding-bottom: calc(24 * var(--u));
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  height: 0;
  overflow: hidden;
}

/* #ifdef H5 */
.kw-pick > .uni-scroll-view {
  height: 100%;
  max-height: 100%;
}
/* #endif */

.kw-hint {
  margin-top: calc(48 * var(--u));
  font-size: calc(26 * var(--u));
  color: #bbb;
  text-align: center;
}

.kw-cats {
  width: calc(984 * var(--u));
  height: calc(64 * var(--u));
  white-space: nowrap;
}

.kw-cats__row {
  display: inline-flex;
  flex-direction: row;
  align-items: flex-start;
  gap: calc(60 * var(--u));
}

.kw-cat {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(16 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: calc(45 * var(--u));
  color: #777;
}

.kw-cat.is-on {
  font-weight: 700;
  color: #333;
}

.kw-cat__bar {
  width: calc(60 * var(--u));
  height: calc(3 * var(--u));
  border-radius: calc(22 * var(--u));
  background: transparent;
}

.kw-cat.is-on .kw-cat__bar {
  background: #191919;
}

.kw-grid {
  min-width: calc(1357 * var(--u));
  margin-top: calc(48 * var(--u));
  margin-right: calc(24 * var(--u));
  display: inline-flex;
  flex-direction: column;
  gap: calc(40 * var(--u));
  vertical-align: top;
  white-space: normal;
}

.kw-grid__row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(24 * var(--u));
}

.kw-grid__row.is-offset {
  padding-left: calc(85 * var(--u));
}

.kw-tag {
  height: calc(120 * var(--u));
  padding: 0 calc(64 * var(--u));
  border-radius: calc(32 * var(--u));
  background: #ebf1f4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 700;
  color: #333;
  box-sizing: border-box;
  flex-shrink: 0;
  overflow: hidden;
}

.kw-tag text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.kw-tag.is-on {
  background: #191919;
  color: #fff;
}

.kw-mine {
  width: calc(984 * var(--u));
  margin-top: calc(48 * var(--u));
  padding-bottom: calc(24 * var(--u));
}

.kw-mine__title {
  font-size: calc(32 * var(--u));
  font-weight: 700;
  color: #333;
}

.kw-mine__list {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(40 * var(--u));
}

.kw-mine__chip {
  height: calc(64 * var(--u));
  padding: 0 calc(40 * var(--u));
  border: calc(2 * var(--u)) solid #333;
  border-radius: calc(35 * var(--u));
  background: #fff;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 700;
  color: #333;
  box-sizing: border-box;
}

.kw-mine__x {
  font-size: calc(24 * var(--u));
  line-height: 1;
  color: #333;
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
  width: calc(1032 * var(--u));
  white-space: nowrap;
}
</style>
