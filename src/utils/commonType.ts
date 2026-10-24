export interface attrItem {
  src?: string;
  title?: string;
  value?: string;
  valueExtra?: string;
  weight?: number;
}
export interface workflows {
  [key: string]: string;
}
export interface workflowParams {
  active_num: number; // 甲片数量选中下标
  num_value: string | null | undefined; // 甲片数据
  active_modal: number; // 甲型数据选中下标
  modal_value: string | null; // 甲型数据
  modal_title: string | null; // 甲型标题
  modal_attr: string | null; // 甲型对应的text值valueExtra
  modal_src?: string | null; // 平台图标
  active_style?: number | null; // 风格选中下标
  style_value?: string | null; // 风格数据
  style_title?: string | null; // 风格名称
  positive?: string;
}
export interface proportion {
  index: number;
  title: string;
  value: string;
}
export interface quality {
  index: number;
  title: string;
  value: string;
}
export interface videoTime {
  index: number;
  title: string;
  value: number | string;
}
export interface proportQuantity {
  proport: proportion;
  quantity: string;
  quality?: quality;
  time?: videoTime;
  /**
   * 视频模型，
   * 通过应用params中:model_alias-attributes-modelList读取，
   * 应用中param无内容则取前述列表第一个
   * */
  videoModal?: string;
}

export const creatSeed = (n = 12) =>
  ((Math.random() * 9 + 1) | 0) +
  [...Array(n - 1)].map(() => (Math.random() * 10) | 0).join("");

export const findParentIndexByValue = (
  array: any[],
  targetValue: string,
): number => {
  for (let i = 0; i < array.length; i++) {
    if (array[i].attributes?.some((attr: any) => attr.value === targetValue)) {
      return i;
    }
  }
  return -1;
};
