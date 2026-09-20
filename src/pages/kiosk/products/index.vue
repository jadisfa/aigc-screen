<template>
  <view class="pl">
    <view class="pl__bar">
      <kiosk-chip :icon="ASSETS.back" label="商品列表" @click="onBack" />
    </view>

    <view class="pl-tools">
      <view class="pl-search">
        <image class="pl-search__icon" :src="ASSETS.search" mode="aspectFit" />
        <input
          class="pl-search__input"
          v-model="keyword"
          maxlength="32"
          placeholder="搜索美甲"
          placeholder-style="color:#989898"
          :adjust-position="false"
        />
      </view>
      <view class="pl-filter" :class="{ 'is-on': filterOn }" hover-class="none" @click="openFilter">
        <text>筛选</text>
        <image class="pl-filter__chev" :src="ASSETS.chevron" mode="aspectFit" />
      </view>
    </view>

    <view class="pl-grid">
      <kiosk-product-card
        v-for="product in visible"
        :key="product.id"
        :product="product"
        size="list"
        show-price
        @click="openKioskProduct(product.id)"
      />
      <text v-if="!visible.length" class="pl-empty">暂无商品</text>
    </view>

    <view v-if="showFilter" class="pl-dim" hover-class="none" @click="showFilter = false" />
    <view v-if="showFilter" class="pl-sheet">
      <view class="pl-sheet__body">
        <view class="pl-side">
          <view
            v-for="cat in filterCats"
            :key="cat.id"
            class="pl-side__item"
            :class="{ 'is-on': filterCat === cat.id }"
            hover-class="none"
            @click="filterCat = cat.id"
          >
            <text>{{ cat.label }}</text>
          </view>
        </view>
        <scroll-view class="pl-opts" scroll-y>
          <view v-for="cat in filterCats" :key="cat.id" class="pl-group">
            <text class="pl-group__title">{{ cat.label }}{{ cat.multi ? "(多选)" : "" }}</text>
            <view class="pl-chips">
              <view
                v-for="opt in cat.options"
                :key="opt"
                class="pl-chip"
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
      <view class="pl-sheet__foot">
        <view class="pl-sheet__ghost" hover-class="none" @click="resetFilter">
          <text>重置</text>
        </view>
        <view class="pl-sheet__ok" hover-class="none" @click="applyFilter">
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
import KioskProductCard from "@/components/kiosk/kiosk-product-card.vue";
import {
  openKioskProduct,
  peekListedFilterCats,
  peekListedProducts,
  refreshListedCatalog,
  toHomeProduct,
} from "@/data/kiosk-catalog";
import {
  cloneProductFilter,
  emptyProductFilter,
  matchProductFilter,
  pruneProductFilter,
  productFilterActive,
  type ProductFilterCat,
} from "@/data/product";
import { KIOSK_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  search: "/static/admin/search.svg",
  chevron: "/static/admin/chevron.svg",
};

const items = ref(peekListedProducts());
const keyword = ref("");
const showFilter = ref(false);
const filterCats = ref<ProductFilterCat[]>(peekListedFilterCats());
const filterCat = ref(filterCats.value[0]?.id || "");
const applied = ref(emptyProductFilter());
const draft = ref(emptyProductFilter());

const filterOn = computed(() => productFilterActive(applied.value));

const visible = computed(() => {
  const q = keyword.value.trim();
  return items.value
    .filter((item) => {
      if (q && !item.title.includes(q)) {
        return false;
      }
      return matchProductFilter(item, applied.value);
    })
    .map(toHomeProduct);
});

onShow(() => {
  hydrate();
  loadProducts();
});

function hydrate() {
  items.value = peekListedProducts();
  filterCats.value = peekListedFilterCats();
  applied.value = pruneProductFilter(applied.value, filterCats.value);
  if (!filterCats.value.some((cat) => cat.id === filterCat.value)) {
    filterCat.value = filterCats.value[0]?.id || "";
  }
}

async function loadProducts() {
  try {
    const cache = await refreshListedCatalog();
    items.value = cache.products;
    filterCats.value = peekListedFilterCats();
    applied.value = pruneProductFilter(applied.value, filterCats.value);
    if (!filterCats.value.some((cat) => cat.id === filterCat.value)) {
      filterCat.value = filterCats.value[0]?.id || "";
    }
  } catch (error) {
    if (!items.value.length) {
      showScreenError(error, "商品加载失败");
    }
  }
}

function onBack() {
  goBackOr(KIOSK_PAGES.home);
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
  background: #f2f3f5;
}

.pl {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  min-height: 100%;
  margin: 0 auto;
  background: #f2f3f5;
  padding: calc(32 * var(--u)) calc(48 * var(--u)) calc(48 * var(--u));
  box-sizing: border-box;
}

.pl__bar {
  height: calc(80 * var(--u));
}

.pl-tools {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(24 * var(--u));
}

.pl-search {
  flex: 1;
  height: calc(80 * var(--u));
  padding: 0 calc(6 * var(--u)) 0 calc(32 * var(--u));
  background: #fff;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(10 * var(--u));
  box-sizing: border-box;
}

.pl-search__icon {
  width: calc(20 * var(--u));
  height: calc(20 * var(--u));
  flex-shrink: 0;
}

.pl-search__input {
  flex: 1;
  height: 100%;
  font-size: calc(24 * var(--u));
  color: #333;
}

.pl-filter {
  width: calc(228 * var(--u));
  height: calc(80 * var(--u));
  background: #fff;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
  flex-shrink: 0;
  box-sizing: border-box;
}

.pl-filter.is-on {
  box-shadow: inset 0 0 0 calc(2 * var(--u)) #0f1010;
}

.pl-filter__chev {
  width: calc(10 * var(--u));
  height: calc(20 * var(--u));
  transform: rotate(90deg);
}

.pl-grid {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.pl-empty {
  width: 100%;
  padding: calc(120 * var(--u)) 0;
  text-align: center;
  font-size: calc(28 * var(--u));
  color: #989898;
}

.pl-dim {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(256 * var(--u));
  bottom: 0;
  z-index: 15;
  background: rgba(0, 0, 0, 0.35);
}

.pl-sheet {
  position: fixed;
  left: 50%;
  top: calc(256 * var(--u));
  z-index: 16;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  bottom: 0;
  background: #fff;
  border-radius: 0 0 calc(40 * var(--u)) calc(40 * var(--u));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pl-sheet__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
}

.pl-side {
  width: calc(276 * var(--u));
  background: #f7f7f7;
  flex-shrink: 0;
}

.pl-side__item {
  height: calc(96 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  color: #777;
  box-sizing: border-box;
}

.pl-side__item.is-on {
  background: #fff;
  border-left: calc(4 * var(--u)) solid #191919;
  font-weight: 500;
  color: #333;
}

.pl-opts {
  flex: 1;
  height: 100%;
  padding: calc(32 * var(--u)) 0 calc(24 * var(--u));
  box-sizing: border-box;
}

.pl-group {
  padding: 0 calc(48 * var(--u));
  margin-bottom: calc(40 * var(--u));
}

.pl-group__title {
  display: block;
  margin-bottom: calc(24 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.pl-chips {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: calc(24 * var(--u));
}

.pl-chip {
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

.pl-chip.is-on {
  background: #191919;
  border-color: #191919;
  color: #fff;
}

.pl-sheet__foot {
  padding: calc(32 * var(--u)) calc(48 * var(--u));
  background: #fff;
  display: flex;
  flex-direction: row;
  gap: calc(24 * var(--u));
}

.pl-sheet__ghost,
.pl-sheet__ok {
  height: calc(100 * var(--u));
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
}

.pl-sheet__ghost {
  flex: 1;
  border: calc(1 * var(--u)) solid #191919;
  color: #333;
  box-sizing: border-box;
}

.pl-sheet__ok {
  width: calc(719 * var(--u));
  background: #191919;
  color: #fff;
  flex-shrink: 0;
}
</style>
