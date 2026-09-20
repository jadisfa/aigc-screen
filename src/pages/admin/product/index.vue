<template>
  <view class="pd">
    <view class="pd__bar">
      <kiosk-chip :icon="ASSETS.back" label="商品管理" @click="onBack" />
    </view>

    <view class="pd-search">
      <image class="pd-search__icon" :src="ASSETS.search" mode="aspectFit" />
      <input
        class="pd-search__input"
        v-model="keyword"
        maxlength="32"
        placeholder="搜索商品名称"
        placeholder-style="color:#989898"
        :adjust-position="false"
      />
    </view>

    <view class="pd-toolbar">
      <view class="pd-tabs">
        <view
          v-for="tab in TABS"
          :key="tab.id"
          class="pd-tabs__item"
          :class="{ 'is-on': statusTab === tab.id }"
          hover-class="none"
          @click="statusTab = tab.id"
        >
          <text>{{ tab.label }}</text>
          <view class="pd-tabs__bar" />
        </view>
      </view>
      <view class="pd-tools">
        <view class="pd-pill" :class="{ 'is-on': showFilter }" hover-class="none" @click="openFilter">
          <text>筛选</text>
          <image class="pd-pill__chev" :src="ASSETS.chevron" mode="aspectFit" />
        </view>
        <view v-if="!batching" class="pd-pill" hover-class="none" @click="batching = true">
          <text>批量处理</text>
          <image class="pd-pill__batch" :src="ASSETS.batch" mode="aspectFit" />
        </view>
        <view v-else class="pd-pill" hover-class="none" @click="toggleAll">
          <text>全选</text>
          <image v-if="allPicked" class="pd-pill__batch" :src="ASSETS.check" mode="aspectFit" />
          <view v-else class="pd-check" />
        </view>
      </view>
    </view>

    <view class="pd-list" :class="{ 'is-batch': batching }">
      <view v-for="item in filtered" :key="item.id" class="pd-row">
        <image class="pd-row__thumb" :src="item.image" mode="aspectFill" />
        <view class="pd-row__body">
          <view class="pd-row__info">
            <view class="pd-row__name">
              <text class="pd-row__title">{{ item.title }}</text>
              <text class="pd-row__status" :class="{ 'is-on': item.status === 'on' }">
                {{ item.status === "on" ? "已上架" : "已下架" }}
              </text>
            </view>
            <text class="pd-row__price">￥{{ item.price }}</text>
            <text class="pd-row__cat">{{ item.category }}</text>
          </view>
          <view v-if="!batching" class="pd-row__acts">
            <view
              v-for="act in rowActions(item)"
              :key="act.id"
              class="pd-act"
              :class="{ 'is-solid': act.solid, 'is-wide': act.wide }"
              hover-class="none"
              @click="onAction(item, act.id)"
            >
              <text>{{ act.label }}</text>
            </view>
          </view>
        </view>
        <view v-if="batching" class="pd-row__pick" hover-class="none" @click="togglePick(item.id)">
          <image v-if="picked.has(item.id)" class="pd-row__check" :src="ASSETS.check" mode="aspectFit" />
          <view v-else class="pd-check pd-check--lg" />
        </view>
      </view>
    </view>

    <view v-if="batching" class="pd-foot">
      <view class="pd-foot__ghost" hover-class="none" @click="cancelBatch">
        <text>取消</text>
      </view>
      <view class="pd-foot__solid" hover-class="none" @click="removePicked">
        <text>下架</text>
      </view>
    </view>

    <view v-if="showFilter" class="pd-dim" hover-class="none" @click="showFilter = false" />
    <view v-if="showFilter" class="pd-sheet">
      <view class="pd-sheet__body">
        <view class="pd-side">
          <view
            v-for="cat in filterCats"
            :key="cat.id"
            class="pd-side__item"
            :class="{ 'is-on': filterCat === cat.id }"
            hover-class="none"
            @click="filterCat = cat.id"
          >
            <text>{{ cat.label }}</text>
          </view>
        </view>
        <scroll-view class="pd-opts" scroll-y>
          <view v-for="cat in filterCats" :key="cat.id" class="pd-group">
            <text class="pd-group__title">{{ cat.label }}{{ cat.multi ? "(多选)" : "" }}</text>
            <view class="pd-chips">
              <view
                v-for="opt in cat.options"
                :key="opt"
                class="pd-chip"
                :class="{ 'is-on': chipOn(cat.id, opt) }"
                hover-class="none"
                @click="toggleChip(cat, opt)"
              >
                <text>{{ opt }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
      <view class="pd-sheet__foot">
        <view class="pd-foot__ghost" hover-class="none" @click="resetFilter">
          <text>重置</text>
        </view>
        <view class="pd-sheet__ok" hover-class="none" @click="applyFilter">
          <text>确定</text>
        </view>
      </view>
    </view>
	<KioskModal @RemoveSale="handleFetch" @delete="handleDelete" />
	<KioskToast />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import {
  cacheProducts,
  cloneProductFilter,
  emptyProductFilter,
  filterCatsFromAttrs,
  matchProductFilter,
  pruneProductFilter,
  toProductItem,
  type ProductFilterCat,
  type ProductItem,
  type ProductTab,
} from "@/data/product";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import {
  fetchCatalogAttrs,
  fetchCatalogProducts,
  patchStoreCatalogProduct,
  unhangStoreCatalogProduct,
} from "@/lib/screen-api/catalog";
import { showScreenError } from "@/lib/screen-http";
import KioskModal from "@/components/kiosk/kiosk-modal.vue";
import KioskToast from "@/components/kiosk/kiosk-toast.vue";

const ASSETS = {
  back: "/static/scan/back.svg",
  search: "/static/admin/search.svg",
  chevron: "/static/admin/chevron.svg",
  batch: "/static/admin/batch.svg",
  check: "/static/admin/check-on.svg",
};

const TABS: { id: ProductTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "on", label: "已上架" },
  { id: "off", label: "已下架" },
];

type RowAct = { id: "rec" | "shelf" | "detail" | "del"; label: string; solid: boolean; wide: boolean };

const items = ref<ProductItem[]>([]);
const acting = ref(false);
const statusTab = ref<ProductTab>("all");
const keyword = ref("");
const batching = ref(false);
const picked = ref(new Set<string>());
const showFilter = ref(false);
const filterCats = ref<ProductFilterCat[]>([]);
const filterCat = ref("");
const applied = ref(emptyProductFilter());
const draft = ref(emptyProductFilter());
const selectProduct = ref<ProductItem>({} as ProductItem);

const filtered = computed(() => {
  const q = keyword.value.trim();
  return items.value.filter((item) => {
    if (statusTab.value !== "all" && item.status !== statusTab.value) {
      return false;
    }
    if (q && !item.title.includes(q)) {
      return false;
    }
    return matchProductFilter(item, applied.value);
  });
});

const allPicked = computed(
  () => filtered.value.length > 0 && filtered.value.every((row) => picked.value.has(row.id)),
);

onShow(() => {
  loadProducts();
});

async function loadProducts() {
  try {
    const [rows, attrs] = await Promise.all([fetchCatalogProducts(), fetchCatalogAttrs()]);
    filterCats.value = filterCatsFromAttrs(attrs);
    applied.value = pruneProductFilter(applied.value, filterCats.value);
    const mapped = rows.map((row) => toProductItem(row, []));
    cacheProducts(mapped);
    items.value = mapped;
  } catch (error) {
    showScreenError(error, "商品加载失败");
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.home);
}

function rowActions(item: ProductItem): RowAct[] {
  return [
    {
      id: "rec",
      label: item.recommended ? "取消推荐" : "推荐至首页",
      solid: false,
      wide: true,
    },
    {
      id: "shelf",
      label: item.status === "on" ? "下架" : "上架",
      solid: item.status === "off",
      wide: false,
    },
    { id: "detail", label: "详情", solid: false, wide: false },
    { id: "del", label: "删除", solid: false, wide: false },
  ];
}

function confirmDelete(content: string): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: "删除商品",
      content,
      confirmText: "删除",
      cancelText: "取消",
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    });
  });
}

async function onAction(item: ProductItem, act: RowAct["id"]) {
  selectProduct.value = item;
  if (act === "detail") {
    uni.navigateTo({ url: `${ADMIN_PAGES.productDetail}?id=${encodeURIComponent(item.id)}` });
    return;
  }
  if (acting.value) {
    return;
  }
  if (act === "del") {
    // const ok = await confirmDelete("确定删除该商品？");
    // if (!ok) {
    //   return;
    // }
	(uni as any).$modal.load("确认删除", "确认删除该内容？操作不可逆。", "删除",  0, 200000);
  }
  acting.value = true;
  try {
    if (act === "rec") {
      await patchStoreCatalogProduct(item.id, { recommended: !item.recommended });
      // uni.showToast({ title: item.recommended ? "已取消推荐" : "已推荐至首页", icon: "none" });
	  (uni as any).$toast.success(item.recommended ? "已取消推荐" : "已推荐至首页", undefined, 1000);
    } else if (act === "shelf") {
	  if (item.status == 'on') {
		  (uni as any).$modal.load("确认下架", "是否下架该商品?", "确认",  2, 200000);
	  } else {
		  handleFetch()
	  }
    } 
	// else if (act === "del") {
 //      await unhangStoreCatalogProduct(item.id);
 //      uni.showToast({ title: "已删除", icon: "none" });
 //    }
    await loadProducts();
  } catch (error) {
    (uni as any).$toast.error("操作失败", undefined, 1000);
  } finally {
    acting.value = false;
  }
}

async function handleFetch() {
	const prevStatus = selectProduct?.value?.status;
	console.log(prevStatus);
	const next = prevStatus === "on" ? "down" : "up";
	try {
		await patchStoreCatalogProduct(selectProduct?.value.id, { status: next });
		(uni as any).$modal.hide();
		(uni as any).$toast.success(prevStatus == 'off' ? "上架成功" : "下架成功", undefined, 1000);
	} catch (err) {
		(uni as any).$toast.error("操作失败", undefined, 1000);
	} finally {
		acting.value = false;
		await loadProducts();
	}
	// uni.showToast({ title: next === "up" ? "已上架" : "已下架", icon: "none" });
}

// 删除
const handleDelete = async() => {
	try {
		await unhangStoreCatalogProduct(selectProduct.value.id);
		(uni as any).$modal.hide();
		(uni as any).$toast.success("删除成功", undefined, 1000);
	} catch (err) {
		(uni as any).$toast.error("操作失败", undefined, 1000);
	} finally {
		acting.value = false;
	}
	await loadProducts();
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
  picked.value = allPicked.value ? new Set() : new Set(filtered.value.map((row) => row.id));
}

function cancelBatch() {
  batching.value = false;
  picked.value = new Set();
}

async function removePicked() {
  const ids = [...picked.value];
  if (ids.length === 0) {
    uni.showToast({ title: "请先选择商品", icon: "none" });
    return;
  }
  if (acting.value) {
    return;
  }
  const ok = await confirmDelete("确定删除已选商品？");
  if (!ok) {
    return;
  }
  acting.value = true;
  try {
    await Promise.all(ids.map((id) => unhangStoreCatalogProduct(id)));
    uni.showToast({ title: "已删除", icon: "none" });
    cancelBatch();
    await loadProducts();
  } catch (error) {
    showScreenError(error, "删除失败");
  } finally {
    acting.value = false;
  }
}

function openFilter() {
  draft.value = cloneProductFilter(applied.value);
  filterCat.value = filterCats.value.some((cat) => cat.id === filterCat.value)
    ? filterCat.value
    : filterCats.value[0]?.id || "";
  showFilter.value = true;
}

function chipOn(key: string, opt: string) {
  return (draft.value[key] || []).includes(opt);
}

function toggleChip(cat: ProductFilterCat, opt: string) {
  const current = draft.value[cat.id] || [];
  const nextValues = cat.multi
    ? current.includes(opt)
      ? current.filter((tag) => tag !== opt)
      : [...current, opt]
    : current.includes(opt)
      ? []
      : [opt];
  draft.value = { ...draft.value, [cat.id]: nextValues };
}

function resetFilter() {
  draft.value = emptyProductFilter();
}

function applyFilter() {
  applied.value = cloneProductFilter(draft.value);
  showFilter.value = false;
}
</script>

<style>
page {
  background: #fff;
}

.pd {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #fff;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(56 * var(--u));
  box-sizing: border-box;
}

.pd__bar {
  height: calc(80 * var(--u));
}

.pd-search {
  margin-top: calc(32 * var(--u));
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  padding: 0 calc(6 * var(--u)) 0 calc(32 * var(--u));
  background: #fff;
  border: calc(1 * var(--u)) solid #d0d0d0;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(10 * var(--u));
  box-sizing: border-box;
}

.pd-search__icon {
  width: calc(20 * var(--u));
  height: calc(20 * var(--u));
  flex-shrink: 0;
}

.pd-search__input {
  flex: 1;
  height: 100%;
  font-size: calc(24 * var(--u));
  color: #333;
}

.pd-toolbar {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.pd-tabs {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(60 * var(--u));
}

.pd-tabs__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(16 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #777;
}

.pd-tabs__item.is-on {
  color: #333;
}

.pd-tabs__bar {
  width: 100%;
  height: calc(4 * var(--u));
  border-radius: calc(20 * var(--u));
}

.pd-tabs__item.is-on .pd-tabs__bar {
  background: #0f1010;
}

.pd-tools {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(32 * var(--u));
}

.pd-pill {
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

.pd-pill.is-on {
  border-width: calc(2 * var(--u));
  border-color: #0f1010;
}

.pd-pill__chev {
  width: calc(10 * var(--u));
  height: calc(20 * var(--u));
  transform: rotate(90deg);
}

.pd-pill__batch {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
}

.pd-check {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
  border: calc(2 * var(--u)) solid #d0d0d0;
  border-radius: calc(8 * var(--u));
  box-sizing: border-box;
}

.pd-list {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.pd-list.is-batch {
  padding-bottom: calc(148 * var(--u));
}

.pd-row {
  padding-bottom: calc(24 * var(--u));
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: calc(32 * var(--u));
}

.pd-row__thumb {
  width: calc(228 * var(--u));
  height: calc(228 * var(--u));
  border-radius: calc(22 * var(--u));
  flex-shrink: 0;
}

.pd-row__body {
  flex: 1;
  min-width: 0;
  min-height: calc(228 * var(--u));
  padding: calc(8 * var(--u)) 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: calc(24 * var(--u));
}

.pd-row__info {
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.pd-row__name {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(16 * var(--u));
  min-width: 0;
}

.pd-row__title {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  line-height: calc(48 * var(--u));
  color: #333;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.pd-row__status {
  flex-shrink: 0;
  padding: calc(12 * var(--u)) calc(16 * var(--u));
  background: #f2f3f5;
  border-radius: calc(12 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 700;
  color: #191919;
}

.pd-row__status.is-on {
  background: #191919;
  color: #fff;
}

.pd-row__price {
  font-size: calc(32 * var(--u));
  font-weight: 700;
  color: #333;
}

.pd-row__cat {
  align-self: flex-start;
  padding: calc(12 * var(--u)) calc(16 * var(--u));
  background: #f2f3f7;
  border-radius: calc(12 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 500;
  color: #333;
}

.pd-row__acts {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  gap: calc(16 * var(--u));
}

.pd-act {
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

.pd-act.is-wide {
  width: calc(132 * var(--u));
}

.pd-act.is-solid {
  background: #191919;
  color: #fff;
}

.pd-row__pick {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
  flex-shrink: 0;
  align-self: center;
}

.pd-row__check,
.pd-check--lg {
  width: calc(32 * var(--u));
  height: calc(32 * var(--u));
}

.pd-foot,
.pd-sheet__foot {
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.pd-foot {
  position: fixed;
  left: 50%;
  bottom: 0;
  z-index: 8;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  padding: calc(24 * var(--u)) calc(48 * var(--u));
  background: #fff;
  box-sizing: border-box;
}

.pd-foot__ghost,
.pd-foot__solid,
.pd-sheet__ok {
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.pd-foot__ghost {
  flex: 1;
  border: calc(1 * var(--u)) solid #191919;
  color: #333;
  box-sizing: border-box;
}

.pd-foot__solid {
  flex: 1;
  background: #191919;
  color: #fff;
}

.pd-sheet__ok {
  width: calc(719 * var(--u));
  background: #191919;
  color: #fff;
  flex-shrink: 0;
}

.pd-dim {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(360 * var(--u));
  bottom: 0;
  z-index: 15;
  background: rgba(0, 0, 0, 0.35);
}

.pd-sheet {
  position: fixed;
  left: 50%;
  top: calc(360 * var(--u));
  z-index: 16;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  height: calc(1173 * var(--u));
  background: #fff;
  border-radius: 0 0 calc(40 * var(--u)) calc(40 * var(--u));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pd-sheet__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
}

.pd-side {
  width: calc(276 * var(--u));
  background: #f7f7f7;
  flex-shrink: 0;
}

.pd-side__item {
  height: calc(96 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  color: #777;
  box-sizing: border-box;
}

.pd-side__item.is-on {
  background: #fff;
  border-left: calc(4 * var(--u)) solid #191919;
  font-weight: 500;
  color: #333;
}

.pd-opts {
  flex: 1;
  height: 100%;
  padding: calc(32 * var(--u)) 0 calc(24 * var(--u));
  box-sizing: border-box;
}

.pd-group {
  padding: 0 calc(48 * var(--u));
  margin-bottom: calc(40 * var(--u));
}

.pd-group__title {
  display: block;
  margin-bottom: calc(24 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.pd-chips {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.pd-chip {
  width: calc(220 * var(--u));
  height: calc(80 * var(--u));
  padding: 0 calc(16 * var(--u));
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

.pd-chip.is-on {
  background: #191919;
  border-color: #191919;
  color: #fff;
}

.pd-sheet__foot {
  padding: calc(32 * var(--u)) calc(48 * var(--u));
  background: #fff;
}
</style>
