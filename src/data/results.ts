import { formatProductPrice } from "@/data/kiosk-catalog";

export type GenerateLook = {
  id: string;
  image: string;
  price: string;
  buyThumb: string;
};

export function toGenerateLooks(
  products: Array<{
    productId?: string;
    coverImageUrl?: string;
    retailPrice?: number | string | null;
  }> | null | undefined,
): GenerateLook[] {
  return (products || [])
    .filter((row): row is { productId: string; coverImageUrl?: string; retailPrice?: number | string | null } =>
      Boolean(row.productId),
    )
    .map((row) => {
      const image = row.coverImageUrl || "";
      const amount = Number(row.retailPrice ?? 0);
      return {
        id: row.productId,
        image,
        price: Number.isFinite(amount) ? formatProductPrice(amount) : "",
        buyThumb: image,
      };
    });
}

export const GENERATE_LOOKS: GenerateLook[] = [
  {
    id: "1",
    image: "/static/results/look-1.png",
    price: "￥35",
    buyThumb: "/static/results/buy-thumb.png",
  },
  {
    id: "2",
    image: "/static/results/look-2.png",
    price: "￥35",
    buyThumb: "/static/results/buy-thumb.png",
  },
  {
    id: "3",
    image: "/static/results/look-3.png",
    price: "￥35",
    buyThumb: "/static/results/buy-thumb.png",
  },
  {
    id: "4",
    image: "/static/results/look-4.png",
    price: "￥35",
    buyThumb: "/static/results/buy-thumb.png",
  },
  {
    id: "5",
    image: "/static/results/look-5.png",
    price: "￥35",
    buyThumb: "/static/results/buy-thumb.png",
  },
];

export const DEFAULT_STYLE_TAGS = ["约会", "居家休闲", "朋友聚会", "上班通勤", "婚礼"];

export type NailSpec = {
  label: string;
  value: string;
};

export type NailProduct = {
  id: string;
  title: string;
  price: string;
  exclusive: string;
  tags: string[];
  hero: string;
  thumbs: string[];
  promo: string;
  specs: NailSpec[];
};

export const NAIL_PRODUCT: NailProduct = {
  id: "1",
  title: "嫩黄法式彩钻小花美甲",
  price: "￥26",
  exclusive: "门店专享价",
  tags: ["甜美约会", "甜美约会", "甜美约会"],
  hero: "/static/results/detail-hero.png",
  thumbs: [
    "/static/results/detail-hero.png",
    "/static/results/look-2.png",
    "/static/results/look-3.png",
    "/static/results/look-4.png",
  ],
  promo: "/static/results/detail-promo.png",
  specs: [
    { label: "款式编号", value: "N-0523" },
    { label: "甲型", value: "中长椭圆" },
    { label: "尺寸", value: "XS/S/M/L" },
    { label: "工艺", value: "猫眼工艺" },
    { label: "规格", value: "24片装" },
  ],
};

