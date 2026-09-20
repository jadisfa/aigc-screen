export type PhotoExample = {
  id: string;
  label: string;
  ok: boolean;
  image: string;
};

export const PHOTO_EXAMPLES: PhotoExample[] = [
  { id: "ok", label: "正确示例", ok: true, image: "/static/scan/example-ok.png" },
  { id: "blocked", label: "主体遮挡", ok: false, image: "/static/scan/example-blocked.png" },
  { id: "blur", label: "图片模糊", ok: false, image: "/static/scan/example-blur.png" },
  { id: "landscape", label: "风景照", ok: false, image: "/static/scan/example-landscape.png" },
];

export const NAIL_EXAMPLES: PhotoExample[] = [
  { id: "ok", label: "正确示例", ok: true, image: "/static/scan/nail-ok.png" },
  { id: "blocked", label: "主体遮挡", ok: false, image: "/static/scan/nail-blocked.png" },
  { id: "blur", label: "图片模糊", ok: false, image: "/static/scan/nail-blur.png" },
  { id: "landscape", label: "风景照", ok: false, image: "/static/scan/nail-landscape.png" },
];
