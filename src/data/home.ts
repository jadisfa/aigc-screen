export type HomeProduct = {
  id: string;
  title: string;
  image: string;
  price: string;
  specs: string[];
};

export type HomeSlideKind = "outfit" | "inspire";

export const DEFAULT_PRODUCTS: HomeProduct[] = [
  {
    id: "1",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/images/product-1.png",
    price: "¥128",
    specs: ["法式", "嫩黄", "小花"],
  },
  {
    id: "2",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/images/product-2.png",
    price: "¥138",
    specs: ["法式", "彩钻", "短甲"],
  },
  {
    id: "3",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/images/product-3.png",
    price: "¥128",
    specs: ["日式", "嫩黄", "亮片"],
  },
  {
    id: "4",
    title: "嫩黄法式彩钻小花美甲",
    image: "/static/images/product-3.png",
    price: "¥158",
    specs: ["韩系", "钻饰", "渐变"],
  },
];

export const OUTFIT_STEPS = [
  { label: "上传穿搭", icon: "/static/icons/step-upload.svg" },
  { label: "生成美甲", icon: "/static/icons/step-generate.svg" },
  { label: "AI试甲", icon: "/static/icons/step-tryon.svg" },
];

export const INSPIRE_STEPS = [
  { label: "选关键词", icon: "/static/icons/step-upload.svg" },
  { label: "推荐款式", icon: "/static/icons/step-generate.svg" },
  { label: "AI试甲", icon: "/static/icons/step-tryon.svg" },
];

/** 后台未配置 Banner 时的系统默认首页轮播。 */
export const HOME_SLIDES: { kind: HomeSlideKind }[] = [
  { kind: "outfit" },
  { kind: "inspire" },
  { kind: "outfit" },
];
