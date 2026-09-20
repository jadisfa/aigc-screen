<template>
  <view v-if="item" class="dt">
    <view class="dt__bar">
      <kiosk-chip :icon="ASSETS.back" label="商品信息详情" @click="onBack" />
    </view>

    <scroll-view class="dt-gallery" scroll-x>
      <image v-for="(src, i) in item.gallery" :key="`${src}-${i}`" class="dt-gallery__shot" :src="src" mode="aspectFill" />
    </scroll-view>

    <view class="dt-rows">
      <view class="dt-row">
        <text>上架状态</text>
        <text>{{ item.status === "on" ? "上架" : "下架" }}</text>
      </view>
      <view class="dt-row">
        <text>商品名称</text>
        <text>{{ item.title }}</text>
      </view>
      <view class="dt-row">
        <text>零售价</text>
        <text class="dt-row__price">￥{{ item.price }}</text>
      </view>
      <view class="dt-row">
        <text>商品编号</text>
        <text>{{ item.sku }}</text>
      </view>
      <view v-if="item.category" class="dt-row">
        <text>商品分类</text>
        <text>{{ item.category }}</text>
      </view>
      <view v-for="attr in item.attrs" :key="attr.attrCode" class="dt-row">
        <text>{{ attr.attrName }}</text>
        <view class="dt-tags">
          <text v-for="value in attr.values" :key="value" class="dt-tag">{{ value }}</text>
        </view>
      </view>
    </view>

    <view class="dt-foot">
      <view
        class="dt-foot__btn"
        :class="{ 'is-ghost': item.status === 'on' }"
        hover-class="none"
        @click="toggleShelf"
      >
        <text>{{ item.status === "on" ? "下架商品" : "立即上架" }}</text>
      </view>
    </view>
	<KioskModal @RemoveSale="handleFetch" />
	<KioskToast />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import { findProduct, toProductItem, upsertCachedProduct, type ProductItem } from "@/data/product";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import { fetchCatalogProduct, patchStoreCatalogProduct } from "@/lib/screen-api/catalog";
import { showScreenError } from "@/lib/screen-http";
import KioskModal from "@/components/kiosk/kiosk-modal.vue";
import KioskToast from "@/components/kiosk/kiosk-toast.vue";

const ASSETS = {
  back: "/static/scan/back.svg",
};

const productId = ref("");
const item = ref<ProductItem | null>(null);
const acting = ref(false);

onLoad((query?: Record<string, string>) => {
  productId.value = query?.id || "";
});

onShow(() => {
  loadProduct();
});

async function loadProduct() {
  const cached = findProduct(productId.value);
  if (cached) {
    item.value = cached;
  }
  try {
    const row = await fetchCatalogProduct(productId.value);
    const mapped = toProductItem(row, []);
    item.value = {
      ...mapped,
      image: cached?.image || mapped.image,
      gallery: cached?.gallery?.length ? cached.gallery : mapped.gallery,
    };
    upsertCachedProduct(item.value);
  } catch (error) {
    if (!item.value) {
      showScreenError(error, "商品详情加载失败");
    }
  }
}

function onBack() {
  goBackOr(ADMIN_PAGES.product);
}

function toggleShelf() {
  if (!item.value || acting.value) {
    return;
  }
  acting.value = true;
  if (item.value.status == 'on') {
	  (uni as any).$modal.load("确认下架", "是否下架该商品?", "确认",  2, 200000);
  } else {
	  handleFetch()
  }
}

async function handleFetch() {
	const prevStatus = item?.value?.status;
	try {
	  const next = item?.value?.status === "on" ? "down" : "up";
	  const row = await patchStoreCatalogProduct(item.value.id, { status: next });
	  const mapped: ProductItem = {
	    ...item.value,
	    status: row.status === "down" || row.status === "off" ? "off" : "on",
	  };
	  item.value = mapped;
	  upsertCachedProduct(mapped);
	  // uni.showToast({ title: mapped.status === "on" ? "已上架" : "已下架", icon: "none" });
	  (uni as any).$modal.hide();
	  (uni as any).$toast.success(prevStatus == 'off' ? "上架成功" : "下架成功", undefined, 1000);
	} catch (error) {
	  // showScreenError(error, "操作失败");
	  (uni as any).$toast.error("操作失败", undefined, 1000);
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
  padding: calc(32 * var(--u)) 0 calc(172 * var(--u));
  box-sizing: border-box;
}

.dt__bar {
  height: calc(80 * var(--u));
  padding: 0 calc(48 * var(--u));
}

.dt-gallery {
  margin-top: calc(32 * var(--u));
  width: 100%;
  white-space: nowrap;
  padding: 0 calc(48 * var(--u));
  box-sizing: border-box;
}

.dt-gallery__shot {
  display: inline-block;
  width: calc(312 * var(--u));
  height: calc(312 * var(--u));
  margin-right: calc(24 * var(--u));
  border-radius: calc(32 * var(--u));
  vertical-align: top;
}

.dt-rows {
  margin-top: calc(40 * var(--u));
  padding: 0 calc(48 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(40 * var(--u));
}

.dt-row {
  padding-bottom: calc(40 * var(--u));
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: calc(24 * var(--u));
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
}

.dt-row:last-child {
  border-bottom: none;
}

.dt-row__price {
  font-size: calc(40 * var(--u));
  font-weight: 700;
  line-height: calc(56 * var(--u));
}

.dt-tags {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: calc(16 * var(--u));
}

.dt-tag {
  padding: calc(12 * var(--u)) calc(16 * var(--u));
  background: #f2f3f7;
  border-radius: calc(12 * var(--u));
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #333;
}

.dt-foot {
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  padding: calc(24 * var(--u)) calc(48 * var(--u));
  background: #fff;
  box-sizing: border-box;
}

.dt-foot__btn {
  height: calc(100 * var(--u));
  background: #191919;
  border-radius: calc(60 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #fff;
}

.dt-foot__btn.is-ghost {
  background: #fff;
  border: calc(1 * var(--u)) solid #191919;
  color: #333;
  box-sizing: border-box;
}
</style>
