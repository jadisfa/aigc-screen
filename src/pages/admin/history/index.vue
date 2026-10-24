<template>
  <view class="his">
    <view class="his__bar">
      <kiosk-chip :icon="ASSETS.back" label="生成历史" @click="onBack" />
    </view>

    <view class="his-tabs">
      <view
        v-for="tab in TABS"
        :key="tab.id"
        class="his-tabs__item"
        :class="{ 'is-on': kindTab === tab.id }"
        hover-class="none"
        @click="kindTab = tab.id"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <view class="his-filter">
      <view class="his-drop" :class="{ 'is-on': showDate }" hover-class="none" @click="toggleDate">
        <text>{{ timeLabel }}</text>
        <image class="his-drop__chev" :src="ASSETS.chevron" mode="aspectFit" />
      </view>
      <view class="his-drop" :class="{ 'is-on': showStatus }" hover-class="none" @click="toggleStatus">
        <text>{{ statusLabel }}</text>
        <image class="his-drop__chev" :src="ASSETS.chevron" mode="aspectFit" />
      </view>
      <view v-if="!batching" class="his-batch" hover-class="none" @click="batching = true">
        <text>批量处理</text>
        <image class="his-batch__icon" :src="ASSETS.batch" mode="aspectFit" />
      </view>
      <view v-else class="his-batch" hover-class="none" @click="toggleAll">
        <text>全选</text>
        <image v-if="allPicked" class="his-batch__icon" :src="ASSETS.check" mode="aspectFit" />
        <view v-else class="his-check" />
      </view>
    </view>

    <view v-if="filtered.length" class="his-list">
      <view v-for="item in filtered" :key="item.id" class="his-row" :class="{ 'is-batch': batching }">
        <image class="his-row__thumb" :src="item.thumb" mode="aspectFill" />
        <view class="his-row__body">
          <view class="his-row__info">
            <text class="his-row__time">{{ item.createdAt }}</text>
            <text class="his-row__count">生成数量：{{ item.count }}张</text>
            <view class="his-row__tags">
              <text v-for="tag in item.tags" :key="tag" class="his-row__tag">{{ tag }}</text>
            </view>
          </view>
          <view v-if="!batching" class="his-row__acts">
            <view class="his-act" hover-class="none" @click="removeOne(item.id)">
              <text>删除</text>
            </view>
            <view class="his-act is-solid" hover-class="none" @click="goDetail(item.id)">
              <text>查看详情</text>
            </view>
          </view>
        </view>
        <view v-if="batching" class="his-row__pick" hover-class="none" @click="togglePick(item.id)">
          <image v-if="picked.has(item.id)" class="his-row__check" :src="ASSETS.check" mode="aspectFit" />
          <view v-else class="his-check his-check--lg" />
        </view>
      </view>
    </view>

    <view v-else class="his-empty">
      <image class="his-empty__art" :src="ASSETS.empty" mode="aspectFit" />
      <text>暂无生成记录</text>
    </view>

    <view v-if="batching" class="his-foot">
      <view class="his-foot__ghost" hover-class="none" @click="cancelBatch">
        <text>取消</text>
      </view>
      <view class="his-foot__solid" hover-class="none" @click="removePicked">
        <text>删除</text>
      </view>
    </view>

    <view v-if="showDate || showStatus" class="his-dim" hover-class="none" @click="closePanels" />
    <view v-if="showStatus" class="his-status">
      <view
        v-for="item in STATUS_SHEET"
        :key="item.id"
        class="his-status__opt"
        :class="{ 'is-on': statusFilter === item.id }"
        hover-class="none"
        @click="applyStatus(item.id)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>
    <view v-if="showDate" class="his-date">
      <view class="his-date__presets">
        <view
          v-for="p in PRESETS"
          :key="p.id"
          class="his-date__preset"
          :class="{ 'is-on': preset === p.id }"
          hover-class="none"
          @click="applyPreset(p.id)"
        >
          <text>{{ p.label }}</text>
        </view>
      </view>
      <view class="his-date__range">
        <view class="his-date__side" :class="{ 'is-on': rangeSide === 'start' }" hover-class="none" @click="selectSide('start')">
          <text>开始时间</text>
          <text>{{ formatDate(startDate) || "—年—月—日" }}</text>
          <view class="his-date__line" />
        </view>
        <view class="his-date__side" :class="{ 'is-on': rangeSide === 'end' }" hover-class="none" @click="selectSide('end')">
          <text>结束时间</text>
          <text>{{ formatDate(endDate) || "—年—月—日" }}</text>
          <view class="his-date__line" />
        </view>
      </view>
      <picker-view class="his-wheel" :value="wheel" indicator-class="his-wheel__ind" @change="onWheel">
        <picker-view-column>
          <view v-for="y in years" :key="y" class="his-wheel__cell">{{ y }}年</view>
        </picker-view-column>
        <picker-view-column>
          <view v-for="m in 12" :key="m" class="his-wheel__cell">{{ m }}月</view>
        </picker-view-column>
        <picker-view-column>
          <view v-for="d in 31" :key="d" class="his-wheel__cell">{{ d }}日</view>
        </picker-view-column>
      </picker-view>
      <view class="his-date__acts">
        <view class="his-date__reset" hover-class="none" @click="resetDate">
          <text>重置</text>
        </view>
        <view class="his-date__ok" hover-class="none" @click="confirmDate">
          <text>确定</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { cacheHistory, toHistoryItem, type HistoryItem, type HistoryKind } from "@/data/history";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { fetchGenerations } from "@/lib/screen-api/generations";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  chevron: "/static/admin/chevron.svg",
  batch: "/static/admin/batch.svg",
  check: "/static/admin/check-on.svg",
  empty: "/static/admin/history-empty.svg",
};

type KindTab = "all" | HistoryKind;
type TimePreset = "today" | "7d" | "1m" | "";
type StatusFilter = "all" | "定制款" | "推荐款" | "AI试戴";

const TABS: { id: KindTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "outfit", label: "美甲穿搭" },
  { id: "text", label: "商品匹配" },
];

const PRESETS: { id: TimePreset; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "7d", label: "近7日" },
  { id: "1m", label: "近1个月" },
];

const STATUS_SHEET: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "全部状态" },
  { id: "定制款", label: "定制款" },
  { id: "推荐款", label: "推荐款" },
  { id: "AI试戴", label: "AI试戴" },
];

const years = [2024, 2025, 2026, 2027, 2028];

const items = ref<HistoryItem[]>([]);
const kindTab = ref<KindTab>("all");
const statusFilter = ref<StatusFilter>("all");
const batching = ref(false);
const picked = ref(new Set<string>());
const showDate = ref(false);
const showStatus = ref(false);
const preset = ref<TimePreset>("");
const startDate = ref("");
const endDate = ref("");
const rangeSide = ref<"start" | "end">("start");
const wheel = ref([2, 4, 8]);

const statusLabel = computed(
  () => STATUS_SHEET.find((s) => s.id === statusFilter.value)?.label ?? "全部状态",
);

const timeLabel = computed(() => {
  if (preset.value === "today") {
    return "今日";
  }
  if (preset.value === "7d") {
    return "近7日";
  }
  if (preset.value === "1m") {
    return "近1个月";
  }
  if (startDate.value || endDate.value) {
    return "自定义";
  }
  return "时间";
});

const allPicked = computed(
  () => filtered.value.length > 0 && filtered.value.every((row) => picked.value.has(row.id)),
);

const filtered = computed(() =>
  items.value.filter((row) => {
    if (kindTab.value !== "all" && row.kind !== kindTab.value) {
      return false;
    }
    if (statusFilter.value !== "all" && !row.tags.includes(statusFilter.value)) {
      return false;
    }
    return inRange(row.createdAt);
  }),
);

onShow(() => {
  loadHistory();
});

async function loadHistory() {
  try {
    const rows = await fetchGenerations();
    const mapped = rows.map(toHistoryItem);
    cacheHistory(mapped);
    items.value = mapped;
  } catch (error) {
    showScreenError(error, "生成历史加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.home);
}

function goDetail(id: string) {
  uni.navigateTo({ url: `${ADMIN_PAGES.historyDetail}?id=${encodeURIComponent(id)}` });
}

function removeOne(_id: string) {
  uni.showToast({ title: "暂不支持删除生成记录", icon: "none" });
}

function togglePick(id: string) {
  const next = new Set(picked.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  picked.value = next;
}

function toggleAll() {
  if (allPicked.value) {
    picked.value = new Set();
    return;
  }
  picked.value = new Set(filtered.value.map((row) => row.id));
}

function cancelBatch() {
  batching.value = false;
  picked.value = new Set();
}

function removePicked() {
  uni.showToast({ title: "暂不支持删除生成记录", icon: "none" });
}

function closePanels() {
  showDate.value = false;
  showStatus.value = false;
}

function toggleStatus() {
  showStatus.value = !showStatus.value;
  if (showStatus.value) {
    showDate.value = false;
  }
}

function applyStatus(id: StatusFilter) {
  statusFilter.value = id;
  showStatus.value = false;
}

function toggleDate() {
  showDate.value = !showDate.value;
  if (showDate.value) {
    showStatus.value = false;
    syncWheel(rangeSide.value === "end" ? endDate.value : startDate.value);
  }
}

function selectSide(side: "start" | "end") {
  rangeSide.value = side;
  syncWheel(side === "end" ? endDate.value : startDate.value);
}

function applyPreset(id: TimePreset) {
  preset.value = id;
  const today = new Date();
  if (id === "today") {
    startDate.value = isoDay(today);
    endDate.value = isoDay(today);
  } else if (id === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    startDate.value = isoDay(from);
    endDate.value = isoDay(today);
  } else if (id === "1m") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    startDate.value = isoDay(from);
    endDate.value = isoDay(today);
  }
  syncWheel(rangeSide.value === "end" ? endDate.value : startDate.value);
}

function onWheel(e: { detail: { value: number[] } }) {
  wheel.value = e.detail.value;
  const next = `${years[e.detail.value[0]]}-${pad(e.detail.value[1] + 1)}-${pad(e.detail.value[2] + 1)}`;
  if (rangeSide.value === "start") {
    startDate.value = next;
  } else {
    endDate.value = next;
  }
  preset.value = "";
}

function resetDate() {
  preset.value = "";
  startDate.value = "";
  endDate.value = "";
}

function confirmDate() {
  showDate.value = false;
}

function formatDate(raw: string) {
  if (!raw) {
    return "";
  }
  const [y, m, d] = raw.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function syncWheel(raw: string) {
  const d = raw ? new Date(raw) : new Date();
  const yi = years.indexOf(d.getFullYear());
  wheel.value = [yi < 0 ? 2 : yi, d.getMonth(), d.getDate() - 1];
}

function inRange(stamp: string) {
  if (!startDate.value && !endDate.value && !preset.value) {
    return true;
  }
  const day = stamp.slice(0, 10);
  if (startDate.value && day < startDate.value) {
    return false;
  }
  if (endDate.value && day > endDate.value) {
    return false;
  }
  return true;
}
</script>

<style>
page {
  background: #fff;
}

.his {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(180 * var(--u));
  box-sizing: border-box;
}

.his__bar {
  height: calc(80 * var(--u));
}

.his-tabs {
  margin-top: calc(32 * var(--u));
  height: calc(80 * var(--u));
  padding: 0 calc(6 * var(--u));
  background: #f5f6f8;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  box-sizing: border-box;
}

.his-tabs__item {
  flex: 1;
  height: calc(68 * var(--u));
  border-radius: calc(77 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  color: #333;
}

.his-tabs__item.is-on {
  background: #191919;
  color: #fff;
}

.his-filter {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(24 * var(--u));
}

.his-drop {
  flex: 1;
  height: calc(80 * var(--u));
  padding: 0 calc(40 * var(--u));
  background: #fff;
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  box-sizing: border-box;
}

.his-drop.is-on {
  border-width: calc(2 * var(--u));
  border-color: #0f1010;
}

.his-drop.is-on .his-drop__chev {
  transform: rotate(-90deg);
}

.his-drop__chev {
  width: calc(10 * var(--u));
  height: calc(20 * var(--u));
  transform: rotate(90deg);
}

.his-batch {
  width: calc(228 * var(--u));
  height: calc(80 * var(--u));
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

.his-batch__icon {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
}

.his-check {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
  border: calc(2 * var(--u)) solid #d0d0d0;
  border-radius: calc(8 * var(--u));
  box-sizing: border-box;
}

.his-list {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.his-row {
  padding-bottom: calc(24 * var(--u));
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: calc(32 * var(--u));
}

.his-row.is-batch {
  align-items: center;
}

.his-row__thumb {
  width: calc(228 * var(--u));
  height: calc(228 * var(--u));
  border-radius: calc(22 * var(--u));
  flex-shrink: 0;
}

.his-row__body {
  flex: 1;
  min-width: 0;
  min-height: calc(228 * var(--u));
  padding: calc(16 * var(--u)) 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: calc(24 * var(--u));
}

.his-row.is-batch .his-row__body {
  min-height: 0;
  justify-content: flex-start;
}

.his-row__info {
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.his-row__time {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: calc(48 * var(--u));
  color: #333;
}

.his-row__count {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #777;
}

.his-row__tags {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(16 * var(--u));
}

.his-row__tag {
  padding: calc(12 * var(--u)) calc(16 * var(--u));
  background: #f2f3f7;
  border-radius: calc(12 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 500;
  color: #333;
}

.his-row__acts {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  gap: calc(16 * var(--u));
}

.his-act {
  width: calc(120 * var(--u));
  height: calc(48 * var(--u));
  border: calc(1 * var(--u)) solid #c7c7cc;
  border-radius: calc(77 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(20 * var(--u));
  font-weight: 500;
  color: #333;
  box-sizing: border-box;
}

.his-act.is-solid {
  background: #191919;
  color: #fff;
}

.his-row__pick {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
  flex-shrink: 0;
}

.his-row__check {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
}

.his-check--lg {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
}

.his-empty {
  margin-top: calc(228 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(32 * var(--u));
  font-size: calc(24 * var(--u));
  color: #333;
}

.his-empty__art {
  width: calc(318 * var(--u));
  height: calc(340 * var(--u));
}

.his-foot {
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

.his-foot__ghost,
.his-foot__solid {
  flex: 1;
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.his-foot__ghost {
  border: calc(1 * var(--u)) solid #191919;
  color: #333;
  box-sizing: border-box;
}

.his-foot__solid {
  background: #191919;
  color: #fff;
}

.his-dim {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(360 * var(--u));
  bottom: 0;
  z-index: 15;
  background: rgba(0, 0, 0, 0.5);
}

.his-date {
  position: fixed;
  left: 50%;
  top: calc(360 * var(--u));
  z-index: 16;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  background: #fff;
  border-radius: 0 0 calc(40 * var(--u)) calc(40 * var(--u));
  padding: calc(32 * var(--u)) calc(48 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(32 * var(--u));
  box-sizing: border-box;
}

.his-status {
  position: fixed;
  left: 50%;
  top: calc(360 * var(--u));
  z-index: 16;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  background: #fff;
  border-radius: 0 0 calc(40 * var(--u)) calc(40 * var(--u));
  padding: calc(32 * var(--u)) calc(48 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
  box-sizing: border-box;
}

.his-status__opt {
  width: calc(480 * var(--u));
  height: calc(80 * var(--u));
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(56 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  box-sizing: border-box;
}

.his-status__opt.is-on {
  background: #191919;
  border-color: #191919;
  color: #fff;
}

.his-date__presets {
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.his-date__preset {
  flex: 1;
  height: calc(80 * var(--u));
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(56 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  box-sizing: border-box;
}

.his-date__preset.is-on {
  background: #191919;
  border-color: #191919;
  color: #fff;
}

.his-date__range {
  display: flex;
  flex-direction: row;
}

.his-date__side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(16 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #777;
}

.his-date__side.is-on {
  color: #191919;
}

.his-date__line {
  width: calc(100 * var(--u));
  height: calc(4 * var(--u));
  border-radius: calc(5 * var(--u));
}

.his-date__side.is-on .his-date__line {
  background: #191919;
}

.his-wheel {
  width: 100%;
  height: calc(360 * var(--u));
}

.his-wheel__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  color: #333;
}

.his-date__acts {
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.his-date__reset {
  flex: 1;
  height: calc(100 * var(--u));
  border: calc(1 * var(--u)) solid #191919;
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  color: #333;
  box-sizing: border-box;
}

.his-date__ok {
  width: calc(719 * var(--u));
  height: calc(100 * var(--u));
  background: #191919;
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  color: #fff;
}
</style>
