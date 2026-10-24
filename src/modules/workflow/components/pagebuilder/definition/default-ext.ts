import type { UiComponent, UiComponentCommon, UiComponentType, UiParam } from "../ui-schema";
import { createId, DEFAULT_TITLE_BY_TYPE, defaultParamNameByType } from "./defaults";

function createDefaultParam(type: UiComponentType, index = 0): UiParam {
  return {
    name: defaultParamNameByType(type, index),
    inputKey: defaultParamNameByType(type, index),
    nodeId: "",
    required: false,
    defaultValue: type === "CameraMovement" && index === 1 ? "3" : "",
    marks: {},
  };
}

const DEFAULT_IMAGE_SELECT_PREVIEW_OPTIONS = [
  {
    title: "豆豆甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203181958849-1-sa8sqa.png",
    value: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203181958849-1-sa8sqa.png",
    valueExtra:
      "ndmy,close up of 5 short Round press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "短方甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182012165-3-mh8epo.png",
    value: "https://static.nailoffice.cn/2026-01-27/6811db59c58c28287e07e45c/upload/20260127175629838-3-51-g4vnhn.png",
    valueExtra:
      "ndmy,close up of 5 Short square press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "短椭圆甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182005571-2-2hugsh.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126111252172-2-51-5gbo1q.png",
    valueExtra:
      "ndmy,close up of 5 short Oval press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "中方圆甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182017740-4-nadav6.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126111319375-4-51-l9ae6n.png",
    valueExtra:
      "ndmy,close up of 5  Medium Square press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "细狗长尖甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182022702-5-nuzol2.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126111504221-6-51-vgdhc6.png",
    valueExtra:
      "ndmy,close up of 5 Long Stiletto press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "长水滴甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182032275-7-auihvy.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126111547026-7-51-tjt82c.png",
    valueExtra:
      "ndmy,close up of 5 Long Almond press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "长梯甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182037423-8-19bkqr.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126111610961-8-51-dqp9aw.png",
    valueExtra:
      "ndmy,close up of 5 Long Coffin press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "中梯甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182044043-9-ld8xos.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126111630243-9-51-2ov4kp.png",
    valueExtra:
      "ndmy,close up of 5 Medium Coffin press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "细狗长梯甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182051132-10-fr5j2a.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126111654087-10-51-wjpmrt.png",
    valueExtra:
      "ndmy,close up of 5 XL Coffin press-on nails without any Medium Oval fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "中椭圆甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182056838-11-0f6v8b.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126113154074-11-51-i8h50m.png",
    valueExtra:
      "ndmy,close up of 5 Medium Oval press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "中杏仁甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182101732-12-dai9ux.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126113217700-12-51-yxcx9y.png",
    valueExtra:
      "ndmy,close up of 5 Medium Almond press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "棺材甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182108209-13-k833kx.png",
    value: "https://static.nailoffice.cn/2026-01-27/6811db59c58c28287e07e45c/upload/20260127170615401-1351-utecry.png",
    valueExtra:
      "ndmy,close up of 5 COFFIN press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
  {
    title: "长尖甲",
    src: "https://static.nailoffice.cn/2026-02-03/6811db59c58c28287e07e45c/upload/20260203182027586-6-46ns1q.png",
    value: "https://static.nailoffice.cn/2026-01-26/6811db59c58c28287e07e45c/upload/20260126111504221-6-51-vgdhc6.png",
    valueExtra:
      "ndmy,close up of 5 Long Stiletto press-on nails without any fingers,no skins,No watermark. Macro photography, HD, high detail, professional studio lighting,background is clean white.",
    weight: 1,
  },
] as const;

export function defaultTitleByType(type: UiComponentType): string {
  if (type === "NumberSlider") return "数字滑块";
  return DEFAULT_TITLE_BY_TYPE[type] || "图片选择(本地/素材库/历史记录)";
}

export function createDefaultComponent(type: UiComponentType, position: number): UiComponent {
  const base: Omit<UiComponentCommon, "type"> = {
    id: createId(),
    title: defaultTitleByType(type),
    position,
    basic: { params: [createDefaultParam(type, 0)] },
    mcp: { description: "", ignore: false, dataType: "string", required: false, defaultValue: "" },
    schema: {},
  };

  if (type === "Seed") {
    return { ...base, type, ext: { seedLength: 9 } } as UiComponent;
  }
  if (type === "AIAspectRatioSelect") {
    return {
      ...base,
      type,
      ext: {
        options: [
          { label: "1:1", value: "1:1", icon: "", billingWeight: 1 },
          { label: "3:4", value: "3:4", icon: "", billingWeight: 1 },
          { label: "9:16", value: "9:16", icon: "", billingWeight: 1 },
        ],
      },
    } as UiComponent;
  }
  if (type === "PositivePrompt") {
    return {
      ...base,
      type,
      ext: {
        prependPrompt: "",
        enableLLM: true,
        enableTranslate: false,
        enableAutoTranslate: false,
        aiPresetPrompt: "你是一名知名的设计师，当用户给你一个场景，你不能简单翻译，而是需要根据用户的场景，设一个该场景的物品摆设，用英语直接输出，不需要任何其他修饰和说明。",
      },
    } as UiComponent;
  }
  if (type === "TemplatePrompt") {
    return {
      ...base,
      type,
      ext: {
        prependPrompt: "",
        enableLLM: false,
        enableTranslate: false,
        enableAutoTranslate: false,
        aiPresetPrompt: "你是一名知名的设计师，当用户给你一个场景，你不能简单翻译，而是需要根据用户的场景，设一个该场景的物品摆设，用英语直接输出，不需要任何其他修饰和说明。",
        template: "一个{{人物特征}}走在大街上，{{人物动作}}，景别{{运镜方式}}，{{画面细节}}",
        vars: [
          { name: "人物特征", options: ["帅气", "可爱"] },
          { name: "人物动作", options: ["奔跑", "回头"] },
          { name: "运镜方式", options: ["跟拍", "推拉"] },
          { name: "画面细节", options: ["电影质感", "光影丰富"] },
        ],
      },
    } as UiComponent;
  }
  if (type === "ImageUploadAuto") {
    return {
      ...base,
      type,
      ext: {
        fileTypes: ["image", "audio", "video"],
        imageRules: { maxSizeMB: 10, maxWidth: 2048, maxHeight: 2048, quality: 0.9 },
        enableUploadBeforeRun: true,
      },
    } as UiComponent;
  }
  if (type === "ImageSelectPreview") {
    const params = [createDefaultParam(type, 0), createDefaultParam(type, 1)];
    return {
      ...base,
      type,
      basic: { params },
      ext: {
        options: DEFAULT_IMAGE_SELECT_PREVIEW_OPTIONS.map((item) => ({ ...item })),
        enableUploadBeforeRun: false,
      },
    } as UiComponent;
  }
  if (type === "FirstLastFrame") {
    const params = [createDefaultParam(type, 0), createDefaultParam(type, 1)];
    return {
      ...base,
      type,
      title: "首尾帧",
      basic: { params },
      ext: {
        maxSizeMB: 5,
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 0.92,
        recommendations: [],
        enableUploadBeforeRun: true,
      },
    } as UiComponent;
  }
  if (type === "SingleSelectChip") {
    return {
      ...base,
      type,
      ext: { options: [{ title: "标签A", value: "A", billingWeight: 1 }, { title: "标签B", value: "B", billingWeight: 1 }, { title: "标签C", value: "C", billingWeight: 1 }] },
    } as UiComponent;
  }
  if (type === "MultiSelectChip") {
    return {
      ...base,
      type,
      ext: { options: [{ title: "标签A", value: "A", billingWeight: 1 }, { title: "标签B", value: "B", billingWeight: 1 }, { title: "标签C", value: "C", billingWeight: 1 }] },
    } as UiComponent;
  }
  if (type === "ColorPicker") {
    return {
      ...base,
      type,
      basic: { params: [{ ...createDefaultParam(type, 0), defaultValue: "#8B5CF6" }] },
      ext: { format: "hex" },
    } as UiComponent;
  }
  if (type === "ModelSelector") {
    return {
      ...base,
      type,
      ext: {
        sourceMode: "fixed",
        fixedOptions: [
          { label: "GPT-4o", modelId: "gpt-4o" },
          { label: "Qwen-Max", modelId: "qwen-max" },
        ],
      },
    } as UiComponent;
  }
  if (type === "CustomNumber") {
    return {
      ...base,
      type,
      mcp: { ...(base.mcp ?? {}), dataType: "number" },
      ext: {},
    } as UiComponent;
  }
  if (type === "NumberSlider") {
    return {
      ...base,
      type,
      mcp: { ...(base.mcp ?? {}), dataType: "number" },
      ext: { mode: "integer", min: 1, max: 10, step: 1 },
    } as UiComponent;
  }
  if (type === "ControlSwitch") {
    return {
      ...base,
      type,
      basic: { params: [{ ...createDefaultParam(type, 0), defaultValue: "false" }] },
      mcp: { ...(base.mcp ?? {}), dataType: "boolean" },
      ext: { onLabel: "开启", offLabel: "关闭", onValue: "true", offValue: "false" },
    } as UiComponent;
  }
  if (type === "CameraMovement") {
    return {
      ...base,
      type,
      title: "镜头运动",
      basic: { params: [createDefaultParam(type, 0), createDefaultParam(type, 1)] },
      mcp: { ...(base.mcp ?? {}), dataType: "object" },
      ext: {
        options: [
          { title: "左移", value: "pan_left" },
          { title: "右移", value: "pan_right" },
          { title: "上摇", value: "tilt_up" },
          { title: "下摇", value: "tilt_down" },
          { title: "推近", value: "zoom_in" },
          { title: "拉远", value: "zoom_out" },
          { title: "环绕", value: "orbit" },
          { title: "静止", value: "static", exclusive: true },
        ],
        intensityMin: 1,
        intensityMax: 5,
        intensityStep: 1,
        intensityLabels: [
          { value: 1, label: "微弱" },
          { value: 2, label: "较小" },
          { value: 3, label: "适中" },
          { value: 4, label: "较大" },
          { value: 5, label: "强烈" },
        ],
      },
    } as UiComponent;
  }
  if (type === "LlmModelSelector") {
    return {
      ...base,
      type,
      title: "选择模型",
      ext: { capability: "video_generation" },
    } as UiComponent;
  }
  return {
    ...base,
    type: "MultiSourceImageUpload",
    ext: {
      maxSizeMB: 10,
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 0.9,
      enableUploadBeforeRun: true,
    },
  } as UiComponent;
}
