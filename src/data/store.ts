export type StoreInfo = {
  name: string;
  address: string;
};

const STORE_KEY = "admin.store";

export const DEFAULT_STORE: StoreInfo = {
  name: "杭州下沙龙湖天街店",
  address: "中国浙江省杭州市上城区九堡街道九盛路9号东方电子商务园A04幢3楼",
};

export function readStore(): StoreInfo {
  try {
    const raw = uni.getStorageSync(STORE_KEY);
    if (raw) {
      return JSON.parse(raw) as StoreInfo;
    }
  } catch {
    /* seed */
  }
  writeStore(DEFAULT_STORE);
  return { ...DEFAULT_STORE };
}

export function writeStore(info: StoreInfo) {
  uni.setStorageSync(STORE_KEY, JSON.stringify(info));
}
