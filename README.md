# frontend-store-screen-uniapp

NAILOOK 电子屏客户端，Vue 3 + uni-app。设计稿为 **1080 竖屏**，页面按视口宽度缩放。

页面按端分目录，端内再按领域收拢；路由集中在 `src/lib/kiosk-routes.ts`：

| 目录 | 领域 |
| --- | --- |
| `src/pages/kiosk/home/` | C 端首页 |
| `src/pages/kiosk/upload/` | 扫码 / 拍照（穿搭、Banner、手模共用） |
| `src/pages/kiosk/generate/` | 穿搭配货、商品匹配、款式详情 |
| `src/pages/kiosk/try-on/` | AI 试戴 |
| `src/pages/admin/login/` | 管理员登录 |
| `src/pages/admin/home/` | 机上管理首页（分包） |
| `src/pages/admin/banner/` | Banner 轮播、图库、上传 |
| `src/pages/admin/store/` | 门店信息 |
| `src/pages/admin/version/` | 版本升级 |
| `src/pages/admin/history/` | 生成历史与详情 |
| `src/pages/admin/product/` | 商品管理与详情 |
| `src/pages/admin/hand/` | 手模库、官方图库、详情 |

扫码 / 拍照上传是同一套页面，用 `intent` 区分入口（穿搭生成、寻找款式、Banner、C 端手模、管理端手模），配置在 `src/lib/upload-flow.ts`。共用 UI 在 `src/components/kiosk/` 与 `src/components/upload/`。

## 运行

```powershell
cd frontend-store-screen-uniapp
npm install
npm run dev:h5
```

浏览器打开提示的地址（默认 http://localhost:8004 ）。

机上管理登录走**设备登录**（隐藏账号=`deviceCode`，密码为设备凭据 `dev_device_credential`），不是店员/C 端用户账号。

设备编码是身份标识，不是密钥；密码和 refresh token 才需要保密。解析顺序：原生开通（`plus.storage`）→ 登录成功后的本机绑定 → 本次启动参数（不落盘）→ 运行时 `/static/device.json`。已绑定后 URL 不能改写。登出只清 token，不清设备编码。

- 网关：`VITE_API_BASE_URL`；未配置时用当前页面域名。本地 H5 同源 `/api` 由 Vite 代理到 `http://127.0.0.1:8080`
- 设备编码：复制 `src/static/device.json.example` 为 `src/static/device.json` 并填写（已 gitignore，不进仓库、不进 `import.meta.env`）。也可临时用 `?deviceCode=SCR-01`（仅本次进程）

**C 端**

- `/pages/kiosk/home/index` 首页
- `/pages/kiosk/upload/scan-upload/index?intent=outfit` 扫码上传
- `/pages/kiosk/upload/camera-capture/index?intent=outfit` 相机拍摄
- `/pages/kiosk/generate/keywords/index` 输入描述 / 选择关键词
- `/pages/kiosk/generate/generating/index` 匹配中（`?next=` 完成后跳转）
- `/pages/kiosk/generate/results/index` 生成美甲
- `/pages/kiosk/generate/product-detail/index` 美甲详情（购买同款）
- `/pages/kiosk/try-on/index` AI 试戴：选择/上传手模
- `/pages/kiosk/upload/scan-upload/index?intent=hand-model` 扫码上传手部照片
- `/pages/kiosk/try-on/wait/index` 试戴生成中
- `/pages/kiosk/try-on/result/index` 上手效果

**机上管理**

- `/pages/admin/login/index` 管理员登录
- `/pages/admin/home/index` 管理端首页
- `/pages/admin/banner/index` banner 轮播图管理
- `/pages/admin/banner/library/index` 官方 banner 图集
- `/pages/admin/banner/upload/index` 自定义上传 banner
- `/pages/admin/store/index` 门店信息设置
- `/pages/admin/version/index` 版本信息
- `/pages/admin/history/index` 生成历史
- `/pages/admin/history/detail/index` 生成历史详情
- `/pages/admin/product/index` 商品管理
- `/pages/admin/product/detail/index` 商品信息详情
- `/pages/admin/hand/index` 手模库管理
- `/pages/admin/hand/library/index` 官方手模图库
- `/pages/admin/hand/detail/index` 手模详情
- `/pages/kiosk/upload/scan-upload/index?intent=hand-admin` 管理端上传手模

打 Android 包时用 HBuilderX 打开本目录，或：

```powershell
npm run dev:app
```
