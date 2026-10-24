<template>
  <view class="bn">
    <!-- 固定头部：bar + tabs + cards + filter -->
    <view class="bn-header">
      <view class="bn__bar">
        <kiosk-chip :icon="ASSETS.back" label="banner轮播图管理" @click="onBack" />
      </view>

      <view class="bn-tabs">
        <view
          v-for="tab in TABS"
          :key="tab.id"
          class="bn-tabs__item"
          :class="{ 'is-on': kindTab === tab.id }"
          hover-class="none"
          @click="kindTab = tab.id"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>

      <view class="bn-cards">
        <view class="bn-card" hover-class="none" @click="goLibrary">
          <image class="bn-card__icon" :src="ASSETS.official" mode="aspectFit" />
          <view class="bn-card__copy">
            <text class="bn-card__title">官方顶部广告图库</text>
            <text class="bn-card__lead">选择平台官方宣传banner</text>
          </view>
        </view>
        <view class="bn-card" hover-class="none" @click="goUpload()">
          <image class="bn-card__icon" :src="ASSETS.upload" mode="aspectFit" />
          <view class="bn-card__copy">
            <text class="bn-card__title">自定义上传顶部广告</text>
            <text class="bn-card__lead">上传专属海报，自定义展示内容</text>
          </view>
        </view>
      </view>

      <view class="bn-filter">
        <view class="bn-search">
          <image class="bn-search__icon" :src="ASSETS.search" mode="aspectFit" />
          <input
            class="bn-search__input"
            v-model="keyword"
            maxlength="32"
            :placeholder="searchPlaceholder"
            placeholder-style="color:#989898"
            :adjust-position="false"
          />
        </view>
        <view class="bn-status" hover-class="none" @click="pickStatus">
          <text>筛选</text>
          <image class="bn-status__chev" :src="ASSETS.chevron" mode="aspectFit" />
        </view>
      </view>
	  <view class="bn-looger-text">长按拖动，自由调整排序</view>
    </view>

    <!-- 占位：撑出头部高度 -->
    <view class="bn-spacer" :style="{ height: headerHeight }" />

    <!-- 滚动区 -->
    <scroll-view
      v-if="filtered.length"
      class="bn-list"
      :scroll-y="!isShow && activeIndex < 0"
    >
      <view class="bn-list__inner">
        <view
          v-for="(item, index) in filtered"
          :key="item.id"
          class="bn-row"
          :class="{ 'is-dragging': activeIndex === index }"
          :style="getRowStyle(index)"
          hover-class="none"
          @touchstart="onTouchStart(index, $event)"
          @touchmove="onTouchMove($event)"
          @touchend="onTouchEnd"
          @touchcancel="onTouchCancel"  
          @click="onRowClick(item, index)"
        >
          <image :src="ASSETS.loonger" mode="aspectFit" class="bn-looger-icon" />
          <banner-shot
            class="bn-row__thumb"
            :kind="item.kind"
            :src="shotOf(item).src"
            :cover="shotOf(item).cover"
			:poster="item.poster"
          />
          <view class="bn-row__body">
            <text class="bn-row__title">{{ item.title }}</text>
            <view class="bn-row__tags">
              <text class="bn-row__tag">{{ item.kind === "video" ? "视频" : "图片" }}</text>
              <text v-if="item.official" class="bn-row__tag">官方</text>
              <text v-if="item.inUse" class="bn-row__tag is-use">本机使用中</text>
            </view>
            <text class="bn-row__time">创建时间：{{ item.createdAt }}</text>
            <view class="bn-row__actions">
              <view
                v-for="act in rowActions(item)"
                :key="act.id"
                class="bn-act"
                :class="{ 'is-solid': act.solid }"
                hover-class="none"
                @click.stop="onAction(item, act.id)"
              >
                <text>{{ act.label }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view v-else class="bn-empty">
      <image class="bn-empty__art" :src="ASSETS.empty" mode="aspectFit" />
      <text class="bn-empty__text">{{ emptyText }}</text>
      <view class="bn-empty__btn" hover-class="none" @click="goUpload()">
        <image class="bn-empty__plus" :src="ASSETS.uploadPlus" mode="aspectFit" />
        <text>{{ emptyAction }}</text>
      </view>
    </view>

    <!-- 遮罩：固定显示在头部下方 -->
    <view class="bn-proup" :class="{ isShow: isShow }">
		<view class="bn-proup-content">
			<view class="content-item">
				<view class="content-label">类型</view>
				<view class="proup-btns">
					<view 
						class="proup-btn" 
						:class="{'active': bannerType == typeItem.val}"
						v-for="(typeItem, index) in pruopBtns.type" 
						:key="typeItem.val" 
						@click="handleSelect('type', typeItem.val)"
					>{{ typeItem.label }}</view>
				</view>
			</view>
			<view class="content-item sts">
				<view class="content-label">状态</view>
				<view class="proup-btns">
					<view 
						class="proup-btn"
						:class="{'active': bannerSts == stsItem.val}"
						v-for="(stsItem, index) in pruopBtns.status" 
						:key="stsItem.val"
						@click="handleSelect('sts', stsItem.val)"
					>{{ stsItem.label }}</view>
				</view>
			</view>
			
			<view class="content-bottom">
				<view class="btn-reset custom-round" @click="handleReset">重置</view>
				<view class="btn-submit custom-round active" @click="handleConfirm">确定</view>
			</view>
		</view>
	</view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import KioskChip from "@/components/kiosk/kiosk-chip.vue";
import BannerShot from "@/components/admin/banner-shot.vue";
// #ifdef APP-PLUS || APP-ANDROID || APP-IOS
import { extractVideoFrame } from '@/uni_modules/m-video-frame';
// #endif
import {
  mediaShot,
  toBannerItem,
  type BannerItem,
  type BannerTab,
  type StatusFilter,
} from "@/data/admin";
import { ADMIN_PAGES, goBackOr } from "@/lib/kiosk-routes";
import {
  deleteBannerCatalog,
  fetchBannerCatalog,
  applyBannerCatalog,
  patchDeviceBanner,
  // sortBannerCatalog,
  fetchDeviceBanners
} from "@/lib/screen-api/banners";
import { showScreenError } from "@/lib/screen-http";

const ASSETS = {
  back: "/static/scan/back.svg",
  official: "/static/admin/card-official.svg",
  upload: "/static/admin/card-upload.svg",
  search: "/static/admin/search.svg",
  chevron: "/static/admin/chevron.svg",
  empty: "/static/admin/empty.svg",
  uploadPlus: "/static/admin/upload-plus.svg",
  loonger: "/static/admin/loonger.svg",
};

const pruopBtns = {
	type: [
		{
			val: 'image',
			label: '图片'
		},
		{
			val: 'video',
			label: '视频'
		}
	],
	status: [
		{
			val: 'on',
			label: '已上架'
		},
		{
			val: 'off',
			label: '已下架'
		}
	]
}

const momckData = [
  {
    configId: "01a0c6e1-8098-7a05-8828-2b689134f9ad",
    libraryId: "01a0d2ba-7744-786a-a81e-fc07a48f6fe2",
    adCode: "AD-KH8MIGGC",
    adName: "首页顶部默认banner",
    adCategory: "banner",
    displayForm: "image_scroll",
    isCustom: "no",
    contentJson:
      '{"items": [{"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/72f66e37dbed51cc80c20e29206c639b-file.png"}, {"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/e020ba9034bfbbfce7c847d87a1ab8dd-file.png"}]}',
    openDeviceConfig: "yes",
    createdAt: "2026-09-24T09:24:19.365173Z",
    sortNo: 1,
    previewUrl:
      "https://static.nailoffice.cn/file/20260924/72f66e37dbed51cc80c20e29206c639b-file.png",
    storeAdId: "01a0d2ba-e735-72e7-8dd1-738ab65f8c55",
    id: "01a0d2ba-e735-72e7-8dd1-738ab65f8c55",
    kind: "image",
  },
  {
    configId: "01a0c6e1-8098-7a05-8828-2b689134f9dd",
    libraryId: "01a0d2ba-7744-786a-a81e-fc07a48f6fc2",
    adCode: "AD-KH8MIGGC",
    adName: "首页顶部默认banner1",
    adCategory: "banner",
    displayForm: "image_scroll",
    isCustom: "no",
    contentJson:
      '{"items": [{"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260921/dd2a7032551c3b23917e41dd0f51e6aa-file.png"}, {"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260921/dd2a7032551c3b23917e41dd0f51e6aa-file.png"}]}',
    openDeviceConfig: "no",
    createdAt: "2026-09-24T09:24:19.365173Z",
    sortNo: 1,
    previewUrl:
      "https://static.nailoffice.cn/file/20260921/dd2a7032551c3b23917e41dd0f51e6aa-file.png",
    storeAdId: "01a0d2ba-e735-72e7-8dd1-738ab65g8c55",
    id: "01a0d2ba-e735-72e7-8dd1-738ab65g8c55",
    kind: "image",
  },
  {
	configId: "01a0e6eb-8a74-7cae-bb64-bd199c55ddb6",
	libraryId: "01a0d2d8-f8af-794a-a21c-299cc9f94569",
	adCode: "AD-4MHMSV-A",
	adName: "电子屏默认全屏广告",
	adCategory: "fullscreen",
	displayForm: "video_dynamic",
	isCustom: "no",
	contentJson: "{\"items\": [{\"linkUrl\": \"\", \"videoUrl\": \"https://static.nailoffice.cn/file/20260924/667d853ff72fa8b29f1290691fc55544-file.mp4\"}, {\"linkUrl\": \"\", \"videoUrl\": \"https://static.nailoffice.cn/file/20260924/3529d3767ad8add7067274a1dff84113-file.mp4\"}, {\"linkUrl\": \"\", \"videoUrl\": \"https://static.nailoffice.cn/file/20260924/46615a6656c5edab9fb44cf684069878-file.mp4\"}]}",
	openDeviceConfig: "yes",
	createdAt: "2026-09-28T07:29:51.148976Z",
	sortNo: 1,
	previewUrl: "https://static.nailoffice.cn/file/20260924/3529d3767ad8add7067274a1dff84113-file.mp4",
	kind: 'video'
  },
  {
    configId: "01a0c6e1-8098-7a05-8828-2b689134df9dd",
    libraryId: "01a0d2ba-7744-786a-a81e-fc07a48fgfc2",
    adCode: "AD-KH8MIGGC",
    adName: "首页顶部默认banner3",
    adCategory: "banner",
    displayForm: "image_scroll",
    isCustom: "no",
    contentJson:
      '{"items": [{"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg"}, {"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg"}]}',
    openDeviceConfig: "yes",
    createdAt: "2026-09-24T09:24:19.365173Z",
    sortNo: 1,
    previewUrl:
      "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg",
    storeAdId: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    id: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    kind: "image",
  },
  {
    configId: "01a0c6e1-8098-7a05-8828-2b689134df9dd",
    libraryId: "01a0d2ba-7744-786a-a81e-fc07a48fgfc2",
    adCode: "AD-KH8MIGGC",
    adName: "首页顶部默认banner4",
    adCategory: "banner",
    displayForm: "video_dynamic",
    isCustom: "no",
    contentJson:
      '{"items": [{"linkUrl": "", "videoUrl": "https://static.nailoffice.cn/file/20260924/667d853ff72fa8b29f1290691fc55544-file.mp4"}, {"linkUrl": "", "videoUrl": "https://static.nailoffice.cn/file/20260924/3529d3767ad8add7067274a1dff84113-file.mp4"}, {"linkUrl": "", "videoUrl": "https://static.nailoffice.cn/file/20260924/46615a6656c5edab9fb44cf684069878-file.mp4"}]}',
    openDeviceConfig: "no",
    createdAt: "2026-09-24T09:24:19.365173Z",
    sortNo: 1,
    previewUrl:
      "https://static.nailoffice.cn/file/20260924/46615a6656c5edab9fb44cf684069878-file.mp4",
    storeAdId: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    id: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    kind: "video",
	
  },
  {
    configId: "01a0c6e1-8098-7a05-8828-2b689134df9dd",
    libraryId: "01a0d2ba-7744-786a-a81e-fc07a48fgfc2",
    adCode: "AD-KH8MIGGC",
    adName: "首页顶部默认banner5",
    adCategory: "banner",
    displayForm: "image_scroll",
    isCustom: "no",
    contentJson:
      '{"items": [{"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg"}, {"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg"}]}',
    openDeviceConfig: "no",
    createdAt: "2026-09-24T09:24:19.365173Z",
    sortNo: 1,
    previewUrl:
      "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg",
    storeAdId: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    id: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    kind: "image",
  },
  {
  	configId: "01a0e6eb-8a74-76ae-bb64-bd199c55ddb6",
  	libraryId: "01a0d2d8-f8af-774a-b21c-299cc9f94569",
  	adCode: "AD-4MHMSV-A",
  	adName: "电子屏默认全屏广告",
  	adCategory: "fullscreen",
  	displayForm: "video_dynamic",
  	isCustom: "no",
  	contentJson: "{\"items\": [{\"linkUrl\": \"\", \"videoUrl\": \"https://static.nailoffice.cn/file/20260924/667d853ff72fa8b29f1290691fc55544-file.mp4\"}, {\"linkUrl\": \"\", \"videoUrl\": \"https://static.nailoffice.cn/file/20260924/3529d3767ad8add7067274a1dff84113-file.mp4\"}, {\"linkUrl\": \"\", \"videoUrl\": \"https://static.nailoffice.cn/file/20260924/46615a6656c5edab9fb44cf684069878-file.mp4\"}]}",
  	openDeviceConfig: "yes",
  	createdAt: "2026-09-28T07:29:51.148976Z",
  	sortNo: 1,
  	previewUrl: "https://static.nailoffice.cn/file/20260924/3529d3767ad8add7067274a1dff84113-file.mp4",
  	kind: 'video'
  },
  {
    configId: "01a0c6e1-8098-7a05-8828-2b689134df9dd",
    libraryId: "01a0d2ba-7744-786a-a81e-fc07a48fgfc2",
    adCode: "AD-KH8MIGGC",
    adName: "首页顶部默认banner5",
    adCategory: "banner",
    displayForm: "image_scroll",
    isCustom: "no",
    contentJson:
      '{"items": [{"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260914/cc8d6689d30547ea61070cf03e773eca4625c44593b6d9e16c3b0bad90e84d14-file.png"}, {"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg"}]}',
    openDeviceConfig: "no",
    createdAt: "2026-09-24T09:24:19.365173Z",
    sortNo: 1,
    previewUrl:
      "https://static.nailoffice.cn/file/20260914/cc8d6689d30547ea61070cf03e773eca4625c44593b6d9e16c3b0bad90e84d14-file.png",
    storeAdId: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    id: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    kind: "image",
  },
  {
    configId: "01a0c6e1-8098-7a05-8828-2b689134df9dd",
    libraryId: "01a0d2ba-7744-786a-a81e-fc07a48fgfc2",
    adCode: "AD-KH8MIGGC",
    adName: "首页顶部默认banner5",
    adCategory: "banner",
    displayForm: "image_scroll",
    isCustom: "no",
    contentJson:
      '{"items": [{"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260921/84c2e95a18ef31a4ba77aa33a670013a-file.png"}, {"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg"}]}',
    openDeviceConfig: "no",
    createdAt: "2026-09-24T09:24:19.365173Z",
    sortNo: 1,
    previewUrl:
      "https://static.nailoffice.cn/file/20260921/84c2e95a18ef31a4ba77aa33a670013a-file.png",
    storeAdId: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    id: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    kind: "image",
  },
  {
    configId: "01a0c6e1-8098-7a05-8828-2b689134df9dd",
    libraryId: "01a0d2ba-7744-786a-a81e-fc07a48fgfc2",
    adCode: "AD-KH8MIGGC",
    adName: "首页顶部默认banner5",
    adCategory: "banner",
    displayForm: "image_scroll",
    isCustom: "no",
    contentJson:
      '{"items": [{"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260928/aae6e70ce2ca0e4f632e7789c5c7335ecfabde012fcf688f69b2e24cfc3c69d9-file.jpg"}, {"linkUrl": "", "imageUrl": "https://static.nailoffice.cn/file/20260924/44951bc3a766e0482775b4608ff18ceadbf0f1613977861577e9185f8e8042ac-file.jpg"}]}',
    openDeviceConfig: "no",
    createdAt: "2026-09-24T09:24:19.365173Z",
    sortNo: 1,
    previewUrl:
      "https://static.nailoffice.cn/file/20260928/aae6e70ce2ca0e4f632e7789c5c7335ecfabde012fcf688f69b2e24cfc3c69d9-file.jpg",
    storeAdId: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    id: "01a0d2ba-e735-72e7-8dd1-738db65g8c55",
    kind: "image",
  },
];


const TABS: { id: BannerTab; label: string }[] = [
  { id: "home", label: "首页顶部广告位" },
  { id: "screen", label: "无操作全屏广告位" },
];

const isShow = ref(false);

const STATUS_SHEET: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "全部状态" },
  { id: "on", label: "已上架" },
  { id: "off", label: "已下架" },
];

type RowAct = { id: "on" | "off" | "edit" | "del"; label: string; solid: boolean };

const items = ref<BannerItem[]>([]);
const kindTab = ref<BannerTab>("home");
const kindType = ref('all');
const statusFilter = ref<StatusFilter>("all");
const bannerType = ref('all');
const bannerSts = ref<StatusFilter>('all');
const keyword = ref("");

const statusLabel = computed(
  () => STATUS_SHEET.find((s) => s.id === statusFilter.value)?.label ?? "全部状态",
);

const kindNoun = computed(() => {
  if (bannerType.value === "video") {
    return "视频";
  }
  if (bannerType.value === "image") {
    return "图片";
  }
  return "轮播图";
});
const searchPlaceholder = computed(() => `搜索${kindNoun.value}名称`);
const emptyText = computed(() => `暂无${kindNoun.value}`);
const emptyAction = computed(() => `上传${kindNoun.value}`);

const filtered = computed(() => {
  const q = keyword.value.trim();
  console.log(items.value, 374)
  return items.value.filter((item) => {
      if (kindType.value !== "all" && item.kind !== kindType.value) {
        return false;
      }
      if (statusFilter.value !== "all" && item.status !== statusFilter.value) {
        return false;
      }
      return !q || item.title.includes(q);
    });
});


// ====================== 头部高度（用于占位和遮罩定位） ======================
const headerHeight = ref("0px");

function calcHeaderHeight() {
  const u = getUnit();
  // bar 80 + tabs margin 32 + tabs 80 + cards margin 32 + cards 200
  // + filter margin 32 + filter 80
  // = 80 + 32 + 80 + 32 + 200 + 32 + 80 = 536
  const h = 618 * u; // 加 padding-top
  headerHeight.value = `${h}px`;
}

// ====================== 纵向拖动排序 ======================
const ROW_HEIGHT_U = 282;
const ROW_GAP_U = 32;
const LONG_PRESS = 500;
const MOVE_THRESHOLD = 15; // 新增：移动容错阈值，大屏上手指抖动 5-10px 很正常

const rowMetrics = ref({
  rowHeight: 0,
  rowGap: 0,
});

const activeIndex = ref(-1);
const dragY = ref(0);

let dragOffsetY = 0;
let touchStartX = 0;
let touchStartY = 0;
let moved = false;
let longPressTimer: any = null;
let orderDirty = false;

let listRectTop = 0;

function getUnit() {
  const sys = uni.getSystemInfoSync();
  const screenWidth = sys.windowWidth || sys.screenWidth || 375;
  return Math.min(screenWidth, 1080) / 1080;
}

function initRowMetrics() {
  const u = getUnit();
  rowMetrics.value = {
    rowHeight: ROW_HEIGHT_U * u,
    rowGap: ROW_GAP_U * u,
  };
}

function getRowStyle(index: number) {
  const isDragging = activeIndex.value === index;
  const y = isDragging ? dragY.value : 0;

  return {
    transform: `translate3d(0, ${y}px, 0)`,
    transition: isDragging ? "none" : "transform 0.18s ease",
    zIndex: isDragging ? 10 : 1,
  };
}

function onTouchStart(index: number, e: any) {
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) return;
console.log(`[TouchStart] index:${index}, x:${touch.clientX}, y:${touch.clientY}`, e?.touches?.length);
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  moved = false;

  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  uni.createSelectorQuery()
    .select(".bn-list")
    .boundingClientRect((rect: any) => {
      if (rect) listRectTop = rect.top;
    })
    .exec();

  longPressTimer = setTimeout(() => {
    if (moved) return;

    const { rowHeight, rowGap } = rowMetrics.value;
    const step = rowHeight + rowGap;
    const rowTop = listRectTop + index * step;

    dragOffsetY = touchStartY - rowTop;

    dragY.value = 0;
    activeIndex.value = index; // 选中！
    longPressTimer = null;

    // @ts-ignore
    uni.vibrateShort && uni.vibrateShort();
  }, LONG_PRESS);
  console.log('touchstart')
}

function onTouchMove(e: any) {
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  if (!touch) return;

  const dx = Math.abs(touch.clientX - touchStartX);
  const dy = Math.abs(touch.clientY - touchStartY);
if (dx > 15 || dy > 15) {
    console.log(`[TouchMove] x:${touch.clientX}, y:${touch.clientY}, 当前是否拖动中:${activeIndex.value > -1}`);
	}
  // 如果还没进入拖拽状态（activeIndex < 0）
  if (activeIndex.value < 0) {
    // 用容错阈值 15 替代原来的 8，防止大屏手指轻微抖动取消长按
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      moved = true;
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
    return;
  }

  // 已经进入拖拽状态，直接处理移动逻辑
  const { rowHeight, rowGap } = rowMetrics.value;
  const step = rowHeight + rowGap;

  const rowTop = listRectTop + activeIndex.value * step;
  dragY.value = touch.clientY - rowTop - dragOffsetY;

  const visualTop = activeIndex.value * step + dragY.value;
  let targetIndex = Math.round(visualTop / step);
  targetIndex = Math.max(0, Math.min(filtered.value.length - 1, targetIndex));

  if (targetIndex !== activeIndex.value) {
    swapRows(activeIndex.value, targetIndex);
    activeIndex.value = targetIndex;
    dragY.value = 0;
    // @ts-ignore
    uni.vibrateShort && uni.vibrateShort();
  }
  console.log('touchmove')
}

function onTouchEnd(e: any) {
	console.log(`[TouchEnd] 当前是否拖动中:${activeIndex.value > -1}`, e);
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  if (activeIndex.value > -1) {
    activeIndex.value = -1;
    dragY.value = 0;

    if (orderDirty) {
      orderDirty = false;
      void persistOrder();
    }
  }
}

// 新增：在组件模板中绑定 touchcancel
// @touchcancel="onTouchCancel"

function onTouchCancel(e: any) {
  // 安卓系统有时会在长按时强行接管，触发 touchcancel。
  // 如果已经进入了拖拽状态（activeIndex > -1），我们不要立刻取消，而是当作 end 处理，或者恢复状态
  if (activeIndex.value > -1) {
	  console.log('长按取消', e)
    onTouchEnd(e);
  } else {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
   console.log(`[TouchCancel] ⚠️系统强行打断！当前是否拖动中:${activeIndex.value > -1}`);
}

function swapRows(from: number, to: number) {
  const visible = [...filtered.value];
  const [movedItem] = visible.splice(from, 1);
  visible.splice(to, 0, movedItem);

  const visibleIds = new Set(visible.map((r) => r.id));
  const next: BannerItem[] = [];
  let vi = 0;
  for (const row of items.value) {
    if (visibleIds.has(row.id)) {
      next.push(visible[vi++]);
    } else {
      next.push(row);
    }
  }
  items.value = next;
  orderDirty = true;
}

async function persistOrder() {
  const ids = filtered.value.map((row) => row.storeAdId || row.id).filter(Boolean);
  if (!ids.length) return;
  try {
    // await sortBannerCatalog(ids);
  } catch (error) {
    showScreenError(error, "排序保存失败");
    await loadBanners();
  }
}

function onRowClick(item: BannerItem, index: number) {
  if (activeIndex.value > -1) return;
  openDetail(item);
}

// ====================== 生命周期 ======================
onShow(() => {
  loadBanners();
});

watch(
  () => [kindTab.value, statusFilter.value, keyword.value],
  () => {
    nextTick(() => {
      if (!rowMetrics.value.rowHeight) {
        initRowMetrics();
      }
    });
  },
);

async function loadBanners() {
  try {
    const catalog = await fetchBannerCatalog();
	const fullScreen = await fetchDeviceBanners();
	console.log(fullScreen, 623)
    const stashValue = (momckData || [])
	// .map(toBannerItem).filter((row) => row.id);
	 // 并发取所有视频项的首帧
	// #ifdef APP-PLUS || APP-ANDROID || APP-IOS
	const allBanners = await Promise.all(
	  stashValue.map(async (bannerItem) => {
		let poster: string | undefined;

		if (bannerItem.kind === 'video') {
		  try {
			if (bannerItem.previewUrl) {
			  const res = await videoFirstFrame(bannerItem.previewUrl);
			  console.log(res, bannerItem.id)
			  poster = res?.path;
			}
		  } catch {
			poster = undefined;
		  }
		}

		return {
		  ...bannerItem,
		  poster,
		};
	  })
	);
	items.value = (allBanners)
	  .map(toBannerItem)
	  .filter((row) => row.id);
	// #endif
	// #ifdef H5
	items.value = (stashValue)
	  .map(toBannerItem)
	  .filter((row) => row.id);
	// #endif

    await nextTick();
	console.log(items.value, 603)
    if (!rowMetrics.value.rowHeight) {
      initRowMetrics();
    }
    calcHeaderHeight();
  } catch (error) {
    showScreenError(error, "轮播图加载失败");
  }
}

const videoFirstFrame = async (src: string) => {
	return await extractVideoFrame({ url: src }) || undefined
}

function shotOf(item: BannerItem) {
  return mediaShot(item.contentJson, item.image, item.kind);
}

function onBack() {
  goBackOr(ADMIN_PAGES.home);
}

function goLibrary() {
  uni.navigateTo({ url: ADMIN_PAGES.bannerLibrary });
}

function openDetail(item: BannerItem) {
  const id = item.storeAdId || item.id;
  if (!id) {
    return;
  }
  uni.navigateTo({
    url: `${ADMIN_PAGES.bannerDetail}?id=${encodeURIComponent(id)}`,
  });
}

function goUpload(id?: string) {
  const qs = id ? `?id=${encodeURIComponent(id)}` : "";
  uni.navigateTo({ url: `${ADMIN_PAGES.bannerUpload}${qs}` });
}

function pickStatus() {
  isShow.value = !isShow.value;
}

function rowActions(item: BannerItem): RowAct[] {
  const actions: RowAct[] = [];
  if (item.inUse && item.status === "on") {
    actions.push({ id: "off", label: "下架", solid: false });
  } else {
    actions.push({ id: "on", label: "上架", solid: true });
  }
  if (!item.official) {
    actions.push({ id: "edit", label: "编辑", solid: false });
  }
  actions.push({ id: "del", label: "删除", solid: false });
  return actions;
}

async function onAction(item: BannerItem, act: RowAct["id"]) {
  if (act === "edit") {
    const id = item.storeAdId || item.id;
    if (id) {
      goUpload(id);
    }
    return;
  }
  try {
    if (act === "del") {
      await deleteBannerCatalog(item.storeAdId || item.id);
      (uni as any).$toast?.success("删除成功", undefined, 1000);
    } else if (act === "on") {
      if (item.inUse && item.configId) {
        await patchDeviceBanner(item.configId, { openDeviceConfig: "yes" });
      } else {
        await applyBannerCatalog(item.storeAdId || item.id, "yes");
      }
      (uni as any).$toast?.success("上架成功", undefined, 1000);
    } else if (item.configId) {
      await patchDeviceBanner(item.configId, { openDeviceConfig: "no" });
      (uni as any).$toast?.success("下架成功", undefined, 1000);
    }
    await loadBanners();
  } catch (error) {
    showScreenError(error, "操作失败");
  }
}

const handleSelect = (type: 'type' | 'sts', val: string) => {
	if (type == 'type') {
		bannerType.value = val
	} else {
		bannerSts.value = val as StatusFilter;
	}
}

const handleReset = () => {
	bannerType.value = 'all';
	bannerSts.value = 'all';
	statusFilter.value = 'all';
	kindType.value = 'all';
	isShow.value = false;
	loadBanners();
}

const handleConfirm = () => {
	isShow.value = false;
	kindType.value = bannerType.value;
	statusFilter.value = bannerSts.value;
}
</script>

<style>
page {
  background: #fff;
}

.bn {
  --u: calc(min(100vw, 1080px) / 1080);
  width: calc(1080 * var(--u));
  height: 100vh;
  margin: 0 auto;
  background: #fff;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  position: relative;
}

/* ===== 固定头部 ===== */
.bn-header {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: calc(1080 * var(--u));
  padding: calc(32 * var(--u)) calc(48 * var(--u)) 0;
  background: #fff;
  box-sizing: border-box;
  z-index: 20;
}

/* ===== 占位：撑出头部高度 ===== */
.bn-spacer {
  width: 100%;
  flex-shrink: 0;
}

.bn__bar {
  height: calc(80 * var(--u));
}

.bn-cards {
  margin-top: calc(32 * var(--u));
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.bn-card {
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

.bn-card__icon {
  width: calc(84 * var(--u));
  height: calc(82 * var(--u));
  flex-shrink: 0;
}

.bn-card__copy {
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.bn-card__title {
  font-size: calc(28 * var(--u));
  font-weight: 700;
  letter-spacing: calc(2.8 * var(--u));
  color: #333;
}

.bn-card__lead {
  font-size: calc(20 * var(--u));
  line-height: calc(24 * var(--u));
  color: #777;
}

.bn-tabs {
  margin-top: calc(32 * var(--u));
  width: calc(984 * var(--u));
  height: calc(80 * var(--u));
  padding: 0 calc(6 * var(--u));
  background: #f5f6f8;
  border-radius: calc(53 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  box-sizing: border-box;
}

.bn-tabs__item {
  flex: 1;
  height: calc(68 * var(--u));
  border-radius: calc(77 * var(--u));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(24 * var(--u));
  color: #333;
}

.bn-tabs__item.is-on {
  background: #191919;
  color: #fff;
}

.bn-filter {
  margin-top: calc(32 * var(--u));
  padding-bottom: calc(20 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.bn-search {
  width: calc(732 * var(--u));
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

.bn-search__icon {
  width: calc(20 * var(--u));
  height: calc(20 * var(--u));
  flex-shrink: 0;
}

.bn-search__input {
  flex: 1;
  height: 100%;
  font-size: calc(24 * var(--u));
  color: #333;
}

.bn-status {
  width: calc(228 * var(--u));
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

.bn-status__chev {
  width: calc(10 * var(--u));
  height: calc(20 * var(--u));
  transform: rotate(90deg);
}

.bn-looger-text {
  margin: 0 0 calc(16 * var(--u));
  font-size: calc(24 * var(--u));
  color: #777;
}

/* ===== 滚动列表：占满剩余高度 ===== */
.bn-list {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 0 calc(48 * var(--u));
  box-sizing: border-box;
}

.bn-list__inner {
  width: 100%;
  padding-top: calc(12 * var(--u));
  padding-bottom: calc(56 * var(--u));
}

.bn-row {
  position: relative;
  width: 100%;
  height: calc(282 * var(--u));
  margin-bottom: calc(32 * var(--u));
  padding-bottom: calc(24 * var(--u));
  border-bottom: calc(1 * var(--u)) solid #eee;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: calc(32 * var(--u));
  box-sizing: border-box;
  will-change: transform;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  /* 核心新增：禁用系统长按菜单和拖拽 */
  -webkit-touch-callout: none;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y; /* 允许纵向滚动，但阻止系统接管横向/长按手势 */
}

.bn-row.is-dragging {
  touch-action: none;
  filter: drop-shadow(0 8rpx 24rpx rgba(0, 0, 0, 0.15));
}

.bn-row.is-dragging .bn-row__thumb {
  transform: scale(1.03);
}

.bn-looger-icon {
  width: calc(32 * var(--u));
  height: calc(24 * var(--u));
}

.bn-row__thumb {
  width: calc(193 * var(--u));
  height: calc(257 * var(--u));
  border-radius: calc(22 * var(--u));
  flex-shrink: 0;
}

.bn-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: calc(24 * var(--u));
}

.bn-row__title {
  font-size: calc(32 * var(--u));
  font-weight: 500;
  color: #333;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.bn-row__tags {
  display: flex;
  flex-direction: row;
  gap: calc(16 * var(--u));
}

.bn-row__tag {
  padding: calc(8 * var(--u)) calc(16 * var(--u));
  background: #f2f3f7;
  border-radius: calc(6 * var(--u));
  font-size: calc(16 * var(--u));
  font-weight: 500;
  color: #333;
}

.bn-row__tag.is-use {
  background: #191919;
  color: #fff;
}

.bn-row__time {
  font-size: calc(24 * var(--u));
  font-weight: 500;
  color: #c7c7cc;
}

.bn-row__actions {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: calc(16 * var(--u));
}

.bn-act {
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

.bn-act.is-solid {
  background: #191919;
  color: #fff;
}

.bn-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.bn-empty__art {
  width: calc(292 * var(--u));
  height: calc(331 * var(--u));
}

.bn-empty__text {
  margin-top: calc(40 * var(--u));
  font-size: calc(24 * var(--u));
  color: #333;
}

.bn-empty__btn {
  margin-top: calc(60 * var(--u));
  width: calc(324 * var(--u));
  height: calc(80 * var(--u));
  background: #191919;
  border-radius: calc(77 * var(--u));
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: calc(16 * var(--u));
  color: #fff;
  font-size: calc(24 * var(--u));
}

.bn-empty__plus {
  width: calc(20 * var(--u));
  height: calc(22 * var(--u));
}

/* ===== 遮罩：固定在头部下方 ===== */
.bn-proup {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  top: calc(570 * var(--u));
  background: rgba(0, 0, 0, 0.5);
  z-index: 30;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s linear;
}

.bn-proup.isShow {
  opacity: 1;
  pointer-events: auto;
}
.bn-proup-content {
	width: 100%;
	height: calc(720 * var(--u));
	background: #fff;
	box-sizing: border-box;
	border-bottom-left-radius: calc(40 * var(--u));
	border-bottom-right-radius: calc(40 * var(--u));
	padding: calc(48 * var(--u)) calc(32 * var(--u));
}
.content-item {
	display: flex;
	flex-direction: column;
	gap: calc(32 * var(--u));
}
.content-item.sts {
	margin-top: calc(32 * var(--u));
}
.content-label {
	font-size: calc(32 * var(--u));
	color: #777;
	height: calc(48 * var(--u));
}
.proup-btns {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	height: calc(80 * var(--u));
	gap: calc(20 * var(--u));
}
.proup-btn {
	padding: 0 calc(64 * var(--u));
	flex: 1;
	height: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	border: calc(1 * var(--u)) solid #d0d0d0;
	border-radius: calc(80 * var(--u));
	font-size: calc(24 * var(--u));
	color: #333;
}
.content-bottom {
	height: calc(100 * var(--u));
	display: flex;
	flex-direction: row;
	gap: calc(16 * var(--u));
	margin-top: calc(160 * var(--u));
}
.btn-reset {
	height: calc(100 * var(--u));
	border: calc(1 * var(--u)) solid #191919;
	width: calc(241 * var(--u));
	color: #191919;
}
.btn-submit {
	flex: 1;
}
.active {
	background: #191919;
	color: #fff;
}
.custom-round {
	border-radius: calc(100 * var(--u));
	font-size: calc(32 * var(--u));
	display: flex;
	justify-content: center;
	align-items: center;
}
</style>