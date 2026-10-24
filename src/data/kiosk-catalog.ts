import type { HomeProduct } from "@/data/home";
import {
  filterCatsFromAttrs,
  toProductItem,
  type ProductFilterCat,
  type ProductItem,
} from "@/data/product";
import {
  fetchCatalogAttrs,
  fetchCatalogProduct,
  fetchCatalogTags,
  fetchListedCatalogProducts,
  type ScreenCatalogAttr,
  type ScreenCatalogTag,
} from "@/lib/screen-api/catalog";
import { KIOSK_PAGES } from "@/lib/kiosk-routes";

const CACHE_KEY = "kiosk.listedCatalog";

type ListedCatalogCache = {
  products: ProductItem[];
  tags: ScreenCatalogTag[];
  attrs: ScreenCatalogAttr[];
};

let memory: ListedCatalogCache | null = null;
let inflight: Promise<ListedCatalogCache> | null = null;

function emptyCache(): ListedCatalogCache {
  return { products: [], tags: [], attrs: [] };
}

function readCache(): ListedCatalogCache {
  if (memory) {
    return memory;
  }
  try {
    const raw = uni.getStorageSync(CACHE_KEY);
    if (raw) {
      const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as ListedCatalogCache;
      if (Array.isArray(parsed?.products)) {
        memory = {
          products: parsed.products,
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          attrs: Array.isArray(parsed.attrs) ? parsed.attrs : [],
        };
        return memory;
      }
    }
  } catch {
    /* ignore broken cache */
  }
  return emptyCache();
}

function writeCache(cache: ListedCatalogCache) {
  memory = cache;
  uni.setStorageSync(CACHE_KEY, JSON.stringify(cache));
}

export function peekListedProducts(): ProductItem[] {
  return readCache().products;
}

export function peekListedFilterCats(): ProductFilterCat[] {
  return filterCatsFromAttrs(readCache().attrs);
}

export async function refreshListedCatalog(): Promise<ListedCatalogCache> {
  if (!inflight) {
    inflight = doRefresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function doRefresh(): Promise<ListedCatalogCache> {
  const cached = readCache();
  const [rows, tags, attrs] = await Promise.all([
    fetchListedCatalogProducts(),
    fetchCatalogTags().catch(() => cached.tags),
    fetchCatalogAttrs(false).catch(() => cached.attrs),
  ]);
  const cache: ListedCatalogCache = {
    products: (rows || []).map((row) => toProductItem(row, tags || [])),
    tags: tags || [],
    attrs: attrs || [],
  };
  writeCache(cache);
  return cache;
}

export function formatProductPrice(price: number) {
  return Number.isInteger(price) ? `￥${price}` : `￥${price.toFixed(2)}`;
}

export function toHomeProduct(item: ProductItem): HomeProduct {
  return {
    id: item.id,
    title: item.title,
    image: item.image,
    price: formatProductPrice(item.price),
    specs: [...item.styles, ...item.palettes, ...item.textures].filter(Boolean).slice(0, 3),
  };
}

export function recommendedHomeProducts(items: ProductItem[]): HomeProduct[] {
  return items.filter((item) => item.recommended).map(toHomeProduct);
}

const HOME_RAIL_CHUNK = 3;
const HOME_RAIL_FALLBACK_LIMIT = 9;

export function chunkItems<T>(items: T[], size: number): T[][] {
  if (!Array.isArray(items) || size <= 0) {
    return [];
  }
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/** 首页推荐轨：优先推荐款，没有推荐时用在售款，避免接口有数据但轨道空白。 */
export function homeRailProducts(items: ProductItem[]): HomeProduct[] {
  const recommended = recommendedHomeProducts(items);
  if (recommended.length) {
    return recommended;
  }
  return items.slice(0, HOME_RAIL_FALLBACK_LIMIT).map(toHomeProduct);
}

export function homeRailRows(items: ProductItem[]): HomeProduct[][] {
  return chunkItems(homeRailProducts(items), HOME_RAIL_CHUNK);
}

export function findListedProduct(id?: string) {
  if (!id) {
    return undefined;
  }
  return peekListedProducts().find((row) => row.id === id);
}

export function upsertListedProduct(item: ProductItem) {
  const cache = readCache();
  writeCache({
    products: [...cache.products.filter((row) => row.id !== item.id), item],
    tags: cache.tags,
    attrs: cache.attrs,
  });
}

export async function loadListedProduct(id: string): Promise<ProductItem> {
  const cached = findListedProduct(id);
  const tags = readCache().tags;
  try {
    const [row, nextTags] = await Promise.all([
      fetchCatalogProduct(id),
      tags.length ? Promise.resolve(tags) : fetchCatalogTags().catch(() => tags),
    ]);
    const mapped = toProductItem(row, nextTags || []);
    const current = readCache();
    writeCache({
      products: [...current.products.filter((item) => item.id !== mapped.id), mapped],
      tags: nextTags?.length ? nextTags : current.tags,
      attrs: current.attrs,
    });
    return mapped;
  } catch (error) {
    if (cached) {
      return cached;
    }
    throw error;
  }
}

export type KioskProductDetail = {
  id: string;
  title: string;
  price: string;
  exclusive: string;
  tags: string[];
  hero: string;
  thumbs: string[];
  promo: string;
  specs: { label: string; value: string }[];
};

export function toKioskProductDetail(item: ProductItem): KioskProductDetail {
  const thumbs = item.gallery.filter(Boolean);
  const hero = thumbs[0] || item.image;
  const tags = [...new Set([...item.styles, ...item.scenes, ...item.palettes, ...item.textures])].filter(Boolean);
  const specs = (item.attrs.length
    ? item.attrs.map((attr) => ({
        label: attr.attrName,
        value: attr.values.filter(Boolean).join(" / ") || "—",
      }))
    : [
        { label: "款式编号", value: item.sku || "—" },
        { label: "风格", value: item.styles.filter(Boolean).join(" / ") || "—" },
        { label: "色系", value: item.palettes.filter(Boolean).join(" / ") || "—" },
        { label: "工艺", value: item.textures.filter(Boolean).join(" / ") || "—" },
      ]
  ).slice(0, 5);
  return {
    id: item.id,
    title: item.title,
    price: formatProductPrice(item.price),
    exclusive: "门店专享价",
    tags,
    hero,
    thumbs,
    promo: thumbs[1] || "",
    specs,
  };
}

export function openKioskProduct(id: string) {
  uni.navigateTo({ url: `${KIOSK_PAGES.productDetail}?id=${encodeURIComponent(id)}` });
}
