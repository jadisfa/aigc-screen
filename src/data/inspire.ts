export const INSPIRE_MODE_KEY = "kiosk.inspireMode";
export const INSPIRE_QUERY_KEY = "kiosk.inspireQuery";
export const INSPIRE_TAGS_KEY = "kiosk.inspireTags";
export const MAX_KEYWORD_COUNT = 6;

export type KeywordCategory = {
  title: string;
  tags: string[];
};

export const KEYWORD_CATEGORIES: KeywordCategory[] = [
  {
    title: "风格氛围",
    tags: [
      "学生",
      "约会",
      "温柔奶油风",
      "居家休闲",
      "甜美",
      "夏日",
      "朋友聚会",
      "日常",
      "冬日",
      "氛围感",
      "韩系",
      "日系",
    ],
  },
  {
    title: "色系色调",
    tags: ["裸色", "红色", "黑色", "粉色", "嫩黄", "显白", "奶茶", "莫兰迪", "低饱和", "纯色"],
  },
  {
    title: "款式版型",
    tags: ["短甲", "中长", "长甲", "方圆", "杏仁", "梯形", "超短", "尖形"],
  },
  {
    title: "工艺质感",
    tags: ["猫眼", "渐变", "钻饰", "亮片", "拉线", "晕染", "镜面", "磨砂"],
  },
  {
    title: "场景主题",
    tags: ["通勤", "婚礼", "度假", "节日", "职场", "派对"],
  },
  {
    title: "装饰元素",
    tags: ["小花", "蝴蝶结", "爱心", "星星", "珍珠", "链条", "字母", "水滴"],
  },
];
