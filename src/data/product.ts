export type ProductStatus = "on" | "off";
export type ProductTab = "all" | "on" | "off";

export type ProductItem = {
  id: string;
  title: string;
  image: string;
  gallery: string[];
  price: number;
  sku: string;
  category: string;
  status: ProductStatus;
  recommended: boolean;
  attrs: ProductAttrItem[];
  shapes: string[];
  styles: string[];
  tones: string[];
  palettes: string[];
  textures: string[];
  scenes: string[];
};

export type ProductAttrItem = {
  attrCode: string;
  attrName: string;
  values: string[];
};

/** 按 attrCode 选中的候选值；空数组表示该属性未筛选。 */
export type ProductFilter = Record<string, string[]>;

export type ProductFilterCat = {
  id: string;
  label: string;
  multi: boolean;
  options: string[];
};

const PRODUCT_KEY = "admin.products";

const GALLERY = [
  "/static/admin/product-gallery.png",
  "/static/admin/product-2.png",
  "/static/admin/product-3.png",
  "/static/results/look-2.png",
];

export const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: "n1",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/admin/product-2.png",
    gallery: GALLERY,
    price: 26,
    sku: "20250701001",
    category: "小方盒",
    status: "off",
    recommended: false,
    attrs: [],
    shapes: ["豆豆", "短方"],
    styles: ["甜蜜", "简约"],
    tones: ["暖色"],
    palettes: ["多巴胺色系"],
    textures: ["格纹", "碎花"],
    scenes: ["日常"],
  },
  {
    id: "n2",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/admin/product-3.png",
    gallery: GALLERY,
    price: 26,
    sku: "20250701002",
    category: "小方盒",
    status: "on",
    recommended: true,
    attrs: [],
    shapes: ["中方圆"],
    styles: ["简约", "温柔"],
    tones: ["中性色"],
    palettes: ["莫兰迪色系"],
    textures: ["条纹"],
    scenes: ["通勤", "日常"],
  },
  {
    id: "n3",
    title: "粉萌心语",
    image: "/static/admin/product-gallery.png",
    gallery: GALLERY,
    price: 128,
    sku: "20250701003",
    category: "小方盒",
    status: "off",
    recommended: false,
    attrs: [],
    shapes: ["豆豆", "短方", "中方圆"],
    styles: ["甜蜜", "温柔", "简约"],
    tones: ["冷色"],
    palettes: ["多巴胺色系"],
    textures: ["格纹", "碎花"],
    scenes: ["约会", "通勤", "日常"],
  },
  {
    id: "n4",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/admin/product-4.png",
    gallery: GALLERY,
    price: 26,
    sku: "20250701004",
    category: "小方盒",
    status: "on",
    recommended: true,
    attrs: [],
    shapes: ["短方"],
    styles: ["复古"],
    tones: ["暖色"],
    palettes: ["爆闪亮片色系"],
    textures: ["碎花"],
    scenes: ["约会"],
  },
  {
    id: "n5",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/results/look-1.png",
    gallery: ["/static/results/look-1.png", ...GALLERY],
    price: 26,
    sku: "20250701005",
    category: "小方盒",
    status: "on",
    recommended: true,
    attrs: [],
    shapes: ["豆豆"],
    styles: ["温柔"],
    tones: ["冷色"],
    palettes: ["莫兰迪色系"],
    textures: ["格纹"],
    scenes: ["日常"],
  },
];

export function emptyProductFilter(): ProductFilter {
  return {};
}

const UUID_GROUP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function visualTagDimension(tag: { code: string; group?: string }): string {
  const group = (tag.group || "").trim();
  if (group && !UUID_GROUP.test(group)) {
    return group;
  }
  const prefix = (tag.code || "").split(".")[0]?.trim();
  return prefix || group;
}

export function filterCatsFromAttrs(
  attrs: {
    attrCode?: string;
    attrName?: string;
    values?: string[];
    searchable?: boolean;
    allowsMultiple?: boolean;
  }[],
): ProductFilterCat[] {
  return attrs
    .filter((attr) => attr.searchable === true && Boolean(attr.attrCode) && (attr.values || []).length > 0)
    .map((attr) => ({
      id: attr.attrCode!,
      label: attr.attrName || attr.attrCode!,
      multi: attr.allowsMultiple === true,
      options: [...new Set((attr.values || []).filter(Boolean))],
    }));
}

export function cloneProductFilter(src: ProductFilter): ProductFilter {
  const next: ProductFilter = {};
  for (const [code, values] of Object.entries(src)) {
    if (values.length) {
      next[code] = values.slice();
    }
  }
  return next;
}

export function pruneProductFilter(filter: ProductFilter, cats: ProductFilterCat[]): ProductFilter {
  const allowed = new Set(cats.map((cat) => cat.id));
  const next: ProductFilter = {};
  for (const [code, values] of Object.entries(filter)) {
    if (!allowed.has(code) || !values.length) {
      continue;
    }
    next[code] = values.slice();
  }
  return next;
}

export function productFilterActive(filter: ProductFilter) {
  return Object.values(filter).some((values) => values.length > 0);
}

export function matchProductFilter(item: ProductItem, filter: ProductFilter) {
  for (const [code, selected] of Object.entries(filter)) {
    if (!selected.length) {
      continue;
    }
    const values = item.attrs.find((attr) => attr.attrCode === code)?.values || [];
    if (!selected.some((value) => values.includes(value))) {
      return false;
    }
  }
  return true;
}

export function readProducts(): ProductItem[] {
  try {
    const raw = uni.getStorageSync(PRODUCT_KEY);
    if (raw) {
      return JSON.parse(raw) as ProductItem[];
    }
  } catch {
    /* seed */
  }
  writeProducts(DEFAULT_PRODUCTS);
  return DEFAULT_PRODUCTS.slice();
}

export function writeProducts(items: ProductItem[]) {
  uni.setStorageSync(PRODUCT_KEY, JSON.stringify(items));
}

export function findProduct(id?: string) {
  return productCache.find((row) => row.id === id);
}

let productCache: ProductItem[] = [];

export function cacheProducts(items: ProductItem[]) {
  productCache = items;
}

export function upsertCachedProduct(item: ProductItem) {
  const next = productCache.filter((row) => row.id !== item.id);
  next.push(item);
  productCache = next;
}

export function removeCachedProduct(id: string) {
  productCache = productCache.filter((row) => row.id !== id);
}

export function toProductItem(
  row: {
    productId: string;
    productCode?: string;
    productName?: string;
    coverImageUrl?: string;
    galleryImageUrls?: string[];
    retailPrice?: number | string | null;
    tagCodes?: string[];
    status?: string | null;
    recommended?: boolean;
    attrs?: {
      attrCode: string;
      attrName: string;
      values?: string[];
    }[];
  },
  tags: { code: string; name: string; group?: string }[],
): ProductItem {
  const byCode = new Map(tags.map((tag) => [tag.code, tag]));
  const names = (group: string) =>
    [...new Set(
      (row.tagCodes || [])
        .map((code) => byCode.get(code))
        .filter((tag): tag is { code: string; name: string; group?: string } =>
          Boolean(tag) && visualTagDimension(tag) === group)
        .map((tag) => tag.name)
        .filter(Boolean),
    )];
  const cover = (row.coverImageUrl || "").trim();
  const gallery = uniqueUrls([cover, ...(row.galleryImageUrls || [])]);
  const image = gallery[0] || "/static/admin/product-2.png";
  return {
    id: row.productId,
    title: row.productName || "未命名商品",
    image,
    gallery: gallery.length ? gallery : [image],
    price: Number(row.retailPrice ?? 0),
    sku: row.productCode || "",
    category: "",
    status: row.status === "down" || row.status === "off" ? "off" : "on",
    recommended: row.recommended === true,
    attrs: (row.attrs || []).map((attr) => ({
      attrCode: attr.attrCode,
      attrName: attr.attrName,
      values: attr.values || [],
    })),
    shapes: [],
    styles: names("style"),
    tones: names("tone"),
    palettes: names("color_family"),
    textures: names("craft"),
    scenes: names("scene"),
  };
}

function uniqueUrls(urls: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const url of urls) {
    const trimmed = (url || "").trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}
