# AI应用接口文档

## 1. 文档说明

本文档面向第三方对接开发人员，描述平台对外开放的 HTTP API。

| 项 | 说明 |
|----|------|
| 文档名称 | AI应用接口文档 |
| 适用读者 | 第三方业务系统 / 集成开发人员 |
| 覆盖范围 | 认证登录全流程（含验证码、微信扫码、SSO、手机号绑定）、应用、工作流派发与任务状态、用户、资金流水与余额、用户套餐、线上支付（微信/支付宝扫码充值）、素材、协议、ModelHub API Key、ModelHub 推理接口（OpenAI 兼容双入口） |

**使用说明**

1. 文中路径均为对外网关路径，请按此路径对接  
2. 除特别说明外，受保护接口需携带登录 Token 或 API Key  
3. 成功/失败响应格式见第 2 章；业务字段以各接口章节为准  
4. 模型推理见第 10 章

## 目录

- [1. 文档说明](#1-文档说明)
- [2. 通用约定](#2-通用约定)
  - [2.1 服务地址](#21-服务地址)
  - [2.2 鉴权方式](#22-鉴权方式)
  - [2.3 统一响应结构](#23-统一响应结构)
  - [2.4 路径说明](#24-路径说明)
- [3. 授权接口](#3-授权接口)
  - [3.1 登录流程总览](#31-登录流程总览)
  - [3.2 统一登录响应（AuthFlow）](#32-统一登录响应authflow)
  - [3.3 登录方式列表](#33-登录方式列表)
  - [3.4 验证码发送](#34-验证码发送)
    - [3.4.1 发送短信验证码](#341-发送短信验证码)
    - [3.4.2 发送邮箱验证码](#342-发送邮箱验证码)
  - [3.5 渠道登录](#35-渠道登录)
    - [3.5.1 用户名密码登录](#351-用户名密码登录)
    - [3.5.2 手机验证码登录](#352-手机验证码登录)
    - [3.5.3 邮箱验证码登录](#353-邮箱验证码登录)
    - [3.5.4 微信登录](#354-微信登录)
    - [3.5.5 第三方 SSO 登录](#355-第三方-sso-登录)
  - [3.6 绑定手机号并登录](#36-绑定手机号并登录)
  - [3.7 微信扫码辅助接口](#37-微信扫码辅助接口)
    - [3.7.1 扫码模式](#371-扫码模式)
    - [3.7.2 开放平台 OAuth 配置](#372-开放平台-oauth-配置)
    - [3.7.3 公众号 OAuth 配置](#373-公众号-oauth-配置)
    - [3.7.4 公众号扫码 Ticket](#374-公众号扫码-ticket)
  - [3.8 刷新 Token](#38-刷新-token)
  - [3.9 登出](#39-登出)
- [4. 应用接口](#4-应用接口)
  - [4.1 应用分类](#41-应用分类)
  - [4.2 应用列表查询](#42-应用列表查询)
  - [4.3 应用详情查询](#43-应用详情查询)
  - [4.4 通过应用 ID 获取线上版本](#44-通过应用-id-获取线上版本)
  - [4.5 应用详情配置信息查询](#45-应用详情配置信息查询)
  - [4.6 通过应用 ID 查询执行所需工作流详情](#46-通过应用-id-查询执行所需工作流详情)
  - [4.7 通过工作流版本 ID 查询执行所需工作流详情](#47-通过工作流版本-id-查询执行所需工作流详情)
- [5. 用户接口](#5-用户接口)
  - [5.1 基础信息查询](#51-基础信息查询)
    - [5.1.1 当前登录用户会话上下文](#511-当前登录用户会话上下文)
    - [5.1.2 用户详情查询](#512-用户详情查询)
  - [5.2 基础信息编辑](#52-基础信息编辑)
  - [5.3 密码修改](#53-密码修改)
  - [5.4 应用会话](#54-应用会话)
    - [5.4.1 会话列表](#541-会话列表)
    - [5.4.2 会话详情](#542-会话详情)
  - [5.5 绘图历史](#55-绘图历史)
  - [5.6 交易记录](#56-交易记录)
  - [5.7 统一资金流水](#57-统一资金流水)
    - [5.7.1 查询参数](#571-查询参数)
    - [5.7.2 返回结构](#572-返回结构)
    - [5.7.3 `bizContext` 总则](#573-bizcontext-总则)
    - [5.7.4 应用运行上下文](#574-应用运行上下文)
    - [5.7.5 模型调用上下文](#575-模型调用上下文)
    - [5.7.6 活动赠送上下文](#576-活动赠送上下文)
    - [5.7.7 线上充值上下文](#577-线上充值上下文)
    - [5.7.8 人工调账上下文](#578-人工调账上下文)
    - [5.7.9 空上下文](#579-空上下文)
    - [5.7.10 客户端解析建议](#5710-客户端解析建议)
  - [5.8 主体资金余额查询](#58-主体资金余额查询)
    - [5.8.1 路径参数](#581-路径参数)
    - [5.8.2 查询参数](#582-查询参数)
    - [5.8.3 请求示例（查用户自身余额）](#583-请求示例查用户自身余额)
    - [5.8.4 返回 `data` 字段](#584-返回-data-字段)
  - [5.9 用户套餐（算力套餐）](#59-用户套餐算力套餐)
    - [5.9.1 公共说明](#591-公共说明)
    - [5.9.2 套餐列表](#592-套餐列表)
    - [5.9.3 套餐详情](#593-套餐详情)
    - [5.9.4 创建套餐](#594-创建套餐)
    - [5.9.5 更新套餐](#595-更新套餐)
    - [5.9.6 删除套餐](#596-删除套餐)
  - [5.10 线上支付（扫码充值）](#510-线上支付扫码充值)
    - [5.10.1 流程总览](#5101-流程总览)
    - [5.10.2 购买上下文](#5102-购买上下文)
    - [5.10.3 创建待支付订单](#5103-创建待支付订单)
    - [5.10.4 订单列表](#5104-订单列表)
    - [5.10.5 订单详情](#5105-订单详情)
    - [5.10.6 同步支付状态](#5106-同步支付状态)
    - [5.10.7 关闭未支付订单](#5107-关闭未支付订单)
    - [5.10.8 支付渠道回调（公开）](#5108-支付渠道回调公开)
    - [5.10.9 订单字段与错误码](#5109-订单字段与错误码)
- [6. 工作流派发与任务状态](#6-工作流派发与任务状态)
  - [6.1 流程总览](#61-流程总览)
  - [6.2 派发任务](#62-派发任务)
  - [6.3 查询任务详情](#63-查询任务详情)
  - [6.4 查询任务事件](#64-查询任务事件)
  - [6.5 WebSocket 实时推送](#65-websocket-实时推送)
  - [6.6 下载任务产物打包](#66-下载任务产物打包)
  - [6.7 状态机与终态](#67-状态机与终态)
  - [6.8 废弃入口说明](#68-废弃入口说明)
  - [6.9 常见错误码](#69-常见错误码)
- [7. 素材接口](#7-素材接口)
  - [7.1 手模库（通过分类 ID 查询）](#71-手模库通过分类-id-查询)
  - [7.2 款式库（通过分类 ID 查询）](#72-款式库通过分类-id-查询)
  - [7.3 文件素材查询](#73-文件素材查询)
  - [7.4 文件素材上传](#74-文件素材上传)
  - [7.5 工作素材列表查询](#75-工作素材列表查询)
- [8. 协议接口](#8-协议接口)
  - [8.1 用户协议](#81-用户协议)
  - [8.2 隐私政策](#82-隐私政策)
- [9. ModelHub API Key 管理](#9-modelhub-api-key-管理)
  - [9.1 公共说明](#91-公共说明)
  - [9.2 列表查询](#92-列表查询)
  - [9.3 可选配置查询](#93-可选配置查询)
  - [9.4 详情查询](#94-详情查询)
  - [9.5 创建](#95-创建)
  - [9.6 更新](#96-更新)
  - [9.7 轮换密钥](#97-轮换密钥)
  - [9.8 撤销](#98-撤销)
  - [9.9 调用方鉴权提示（推理侧）](#99-调用方鉴权提示推理侧)
- [10. ModelHub 推理接口（双入口）](#10-modelhub-推理接口双入口)
  - [10.1 协议说明](#101-协议说明)
    - [10.1.1 接口范围](#1011-接口范围)
    - [10.1.2 调用形态](#1012-调用形态)
    - [10.1.3 请求字段](#1013-请求字段)
    - [10.1.4 异步任务状态](#1014-异步任务状态)
  - [10.2 两种调用方式对比](#102-两种调用方式对比)
  - [10.3 场景与路径对照](#103-场景与路径对照)
  - [10.4 API Key 调用入口（`/v1`）](#104-api-key-调用入口v1)
  - [10.5 Session 调用入口（`/api/v1/admin/model`）](#105-session-调用入口apiv1adminmodel)
  - [10.6 Chat Completions（详细）](#106-chat-completions详细)
  - [10.7 Embeddings](#107-embeddings)
  - [10.8 Images Generations](#108-images-generations)
  - [10.9 Audio](#109-audio)
    - [10.9.1 Speech（合成）](#1091-speech合成)
    - [10.9.2 Transcriptions（转写）](#1092-transcriptions转写)
  - [10.10 Videos（异步协议）](#1010-videos异步协议)
    - [10.10.1 创建任务](#10101-创建任务)
    - [10.10.2 查询状态](#10102-查询状态)
    - [10.10.3 下载成片](#10103-下载成片)
    - [10.10.4 删除任务](#10104-删除任务)
  - [10.11 3D Generations](#1011-3d-generations)
  - [10.12 错误、计费与对接注意](#1012-错误计费与对接注意)

## 2. 通用约定

### 2.1 服务地址

- 默认服务地址：`http://aigc.marvelvision.com.cn/`

### 2.2 鉴权方式

受保护接口默认使用 Bearer Token：

```http
Authorization: Bearer <accessToken>
```

`accessToken` 通过第 [3 章授权接口](#3-授权接口) 登录或刷新获得。
多数受保护接口还要求：

```http
X-Tenant-Id: <tenantId>
X-Trace-Id: <traceId>
```

| 请求头 | 业务含义 | 取值来源 |
|--------|----------|----------|
| `X-Tenant-Id` | **租户标识**：标明本次请求所属的组织数据范围（平台级 / 商户级）。平台按该值做数据隔离与权限边界判定，不可随意填写。 | 1）登录成功后调用 [5.1.1 当前登录用户会话上下文](#511-当前登录用户会话上下文)，取返回字段 `tenantId`；2）由平台开通对接时书面提供。常见取值：`GLOBAL`（平台级）；商户侧场景通常为商户 ID。同一登录会话内请保持与会话返回值一致。 |
| `X-Trace-Id` | **链路追踪 ID**：用于问题排查与日志关联，不参与业务鉴权。 | 对接方自行生成（建议 UUID）；未传时服务端可能自动生成，并在响应中回写。 |

公开协议接口（如用户协议）及 **API Key 推理入口（`/v1/**`）** 一般不强制要求 `X-Tenant-Id`；使用 Session Token 调用管理类 / 业务类接口时请按上表携带。

### 2.3 统一响应结构

统一响应结构示例：

```json
{
  "code": "200",
  "message": "success",
  "data": {},
  "timestamp": 1782202149328,
  "trace": {
    "traceId": "4122dd17-fa21-427a-a48f-ff496a90e764",
    "requestedAt": "2026-06-23T08:09:09.322114200Z",
    "tenantId": "GLOBAL"
  }
}
```

分页列表常见 `data` 形态：

```json
{
  "page": { "pageNo": 1, "pageSize": 20, "total": 100 },
  "items": []
}
```

### 2.4 路径说明

- 本文路径均为对外访问路径（如 `/api/admin/**`、`/api/v1/admin/model/**`、`/v1/**`）
- 正式环境 Host 以商务/实施提供的地址为准

## 3. 授权接口

本章描述认证中心对外登录与令牌接口。除特别说明外，本章接口**无需**事先携带 `Authorization`。

机器可读契约见同目录 [`iam-auth.openapi.yaml`](./iam-auth.openapi.yaml)（部分微信/SSO 辅助路径以本文为准）。

### 3.1 登录流程总览

平台以**手机号**作为账号归并主标识。规则：

| 登录渠道 | 是否可直接出 Token | 说明 |
|----------|-------------------|------|
| 手机验证码 | 是 | 手机号不存在时自动建主体并登录 |
| 邮箱 / 微信 / 用户名密码 / 钉钉 / 谷歌 / 飞书 | 仅当主体已绑定手机号 | 否则返回 **HTTP 428**，进入「绑定手机号」第二阶段 |

**推荐对接流程（非手机号渠道）**

```text
1. （可选）GET /api/auth/login/providers 拉取可用登录方式
2. 按渠道完成身份证明（验证码 / OAuth code / 密码）
3. 调用对应 POST /api/auth/login/**
4a. HTTP 200 且 data.status=authenticated → 保存 token，进入业务
4b. HTTP 428 且 code=AUTH-428-PHONE-BIND-REQUIRED
    → 取出 data.nextAction.bindToken（注意有效期 expiresAt）
    → POST /api/auth/sms/send（scene=bind_phone）
    → POST /api/auth/login/phone/bind（bindToken + phone + code）
    → HTTP 200 authenticated → 保存 token
5. 后续受保护接口：Authorization: Bearer <accessToken>
6. accessToken 过期：POST /api/auth/refresh
```

**微信开放平台网站应用（PC 扫码）典型时序**

```text
GET  /api/auth/login/wechat/scan-mode          → mode=open|mp|none
GET  /api/auth/login/wechat/scan-mode/integrate?redirectUri= → 第三方指定回调
GET  /api/auth/login/wechat/open/oauth-config  → appId + redirectUri
用户扫码授权，回调页拿到 code
POST /api/auth/login/wechat  { channel:"open", code, platformCode }
  → authenticated 或 428(phone_bind_required)
（若 428）→ 短信验证码 → POST /api/auth/login/phone/bind
```

**微信公众号扫码（PC 出码 + 手机授权）典型时序**

```text
POST /api/auth/login/wechat/mp/scan/ticket     → ticket + expiresAt
PC 展示含 ticket 的落地页二维码，并轮询：
GET  /api/auth/login/wechat/mp/scan/status?ticket=...
手机扫码后：
POST /api/auth/login/wechat/mp/scan/scanned
手机 OAuth 完成后：
POST /api/auth/login/wechat/mp/scan/complete  { ticket, code }
PC 轮询得到 status=authenticated | phone_bind_required（含 token 或 nextAction）
POST /api/auth/login/wechat/mp/scan/consume   （PC 取走结果后消费）
```

### 3.2 统一登录响应（AuthFlow）

多数登录类接口成功/428 的 `data` 均为同一结构：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `authenticated` / `phone_bind_required` / 各类失败态 |
| `token` | object \| null | 仅 `authenticated` 时有值 |
| `nextAction` | object \| null | 仅需补绑时有值 |
| `error` | object \| null | 失败时的结构化提示（可选） |

`token` 重点字段：

| 字段 | 说明 |
|------|------|
| `accessToken` / `refreshToken` | 访问令牌与刷新令牌 |
| `expiresAt` | **Unix 秒**（与 JWT `exp` 一致），表示 accessToken 过期时间 |
| `tokenType` | 固定 `Bearer` |
| `sessionId` / `source` / `contextVersion` | 会话与登录来源、上下文版本 |

各登录/绑定请求均可选传 `rememberMe`：`true` 或省略/`null` → 长 refresh（默认约 7 天，以服务端配置为准）；`false` → 短会话 refresh。

**认证成功（HTTP 200）**

```json
{
  "code": "200",
  "message": "success",
  "data": {
    "status": "authenticated",
    "token": {
      "accessToken": "xxx",
      "refreshToken": "xxx",
      "expiresAt": 1782202149,
      "tokenType": "Bearer",
      "sessionId": "session-001",
      "source": "ai_portal",
      "contextVersion": 1
    },
    "nextAction": null,
    "error": null
  }
}
```

**需要绑定手机号（HTTP 428）**

```json
{
  "code": "AUTH-428-PHONE-BIND-REQUIRED",
  "message": "请绑定手机号以完成登录",
  "data": {
    "status": "phone_bind_required",
    "token": null,
    "nextAction": {
      "action": "bind_phone",
      "bindToken": "bt_xxx",
      "expiresAt": 1782202200,
      "channel": "wechat"
    },
    "error": null
  }
}
```

| `nextAction` 字段 | 说明 |
|-------------------|------|
| `action` | 固定 `bind_phone` |
| `bindToken` | 第二阶段绑定凭证，一次性消费语义由服务端校验 |
| `expiresAt` | **Unix 秒**时间戳，过期后需重新走第一阶段登录 |
| `channel` | 触发渠道：`email` / `wechat` / `username` / `dingtalk` / `google` / `feishu` 等 |

**常见业务错误码（登录相关）**

| code | HTTP | 含义 |
|------|------|------|
| `AUTH-428-PHONE-BIND-REQUIRED` | 428 | 需绑定手机号（流程下一步，非永久失败） |
| `AUTH-400` | 400 | 参数非法 |
| `AUTH-401` | 401 | 凭证/验证码错误 |
| `AUTH-ACCOUNT-DISABLED` | 401 | 账号禁用 |
| `AUTH-400-BIND-TOKEN-INVALID` | 400 | bindToken 无效 |
| `AUTH-410-BIND-TOKEN-EXPIRED` | 410 | bindToken 过期 |
| `AUTH-409-IDENTIFIER-CONFLICT` | 409 | 标识归并冲突 |
| `AUTH-409-WECHAT-MERGE` | 409 | 微信标识已被其他账号占用 |
| `AUTH-WECHAT-CODE-INVALID` | 401/400 | 微信 code 无效或已使用 |
| `AUTH-WECHAT-NOT-CONFIGURED` | 503 | 微信通道未配置 |
| `AUTH-SSO-NOT-CONFIGURED` | 503 | SSO 通道未配置 |
| `AUTH-SSO-CODE-INVALID` | 401/400 | SSO code 无效 |
| `AUTH-500-SMS-NOT-CONFIGURED` | 503 | 短信未开通 |
| `AUTH-500-SMS-SEND-FAILED` | 502 | 短信发送失败 |

### 3.3 登录方式列表

- 方法：`GET`
- 路径：`/api/auth/login/providers`
- 说明：返回登录页可用渠道（与后台登录配置联动，不含密钥）
- 鉴权：无需登录

成功时 `data` 为数组：

```json
[
  {
    "providerCode": "phone",
    "name": "手机登录",
    "enabled": true,
    "isDefault": true,
    "sortOrder": 10
  },
  {
    "providerCode": "wechat",
    "name": "微信",
    "enabled": true,
    "isDefault": false,
    "sortOrder": 20
  }
]
```

常见 `providerCode`：`phone`、`email`、`account`（用户名密码）、`wechat`、`dingtalk`、`google`、`feishu`。

### 3.4 验证码发送

#### 3.4.1 发送短信验证码

- 方法：`POST`
- 路径：`/api/auth/sms/send`
- 说明：发送手机 OTP；登录与绑定场景均走此接口

请求体：

```json
{
  "phone": "13800000000",
  "platformCode": "ai_portal",
  "scene": "login"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `phone` | 是 | 手机号 |
| `platformCode` | 否 | 平台隔离，如 `ai_portal`、`store_ops`；与后续登录/绑定保持一致 |
| `scene` | 否 | `login` / `bind_phone` / `register` / `reset_password` 等 |

成功返回：

```json
{
  "data": {
    "status": "sent",
    "requestId": "otp-req-001"
  }
}
```

#### 3.4.2 发送邮箱验证码

- 方法：`POST`
- 路径：`/api/auth/email/send`
- 说明：发送邮箱登录 OTP

请求体：

```json
{
  "email": "demo@example.com"
}
```

成功返回同短信：`status` + `requestId`。

### 3.5 渠道登录

以下接口成功时 `data` 见 [3.2](#32-统一登录响应authflow)。除手机登录外，未绑定手机号时返回 **428**。

#### 3.5.1 用户名密码登录

- 方法：`POST`
- 路径：`/api/auth/login/password`
- 说明：用户名 + 密码。用户名尚未归并到主体时也会返回 428，引导绑定手机号完成归并。

请求体：

```json
{
  "username": "demo",
  "password": "123456",
  "platformCode": "ai_portal",
  "rememberMe": true
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `username` / `password` | 是 | 账号口令 |
| `platformCode` | 否 | 登录来源，影响 `token.source` |
| `rememberMe` | 否 | 见 [3.2](#32-统一登录响应authflow) |

#### 3.5.2 手机验证码登录

- 方法：`POST`
- 路径：`/api/auth/login/phone`
- 说明：手机号 + 验证码；手机号不存在时自动建主体并登录（**不会**返回 428）

请求体：

```json
{
  "phone": "13800000000",
  "code": "123456",
  "platformCode": "ai_portal",
  "rememberMe": true
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `phone` / `code` | 是 | 手机号与短信验证码 |
| `platformCode` | 否 | 与短信发送时一致 |
| `rememberMe` | 否 | 见 [3.2](#32-统一登录响应authflow) |

前置：先调用 [3.4.1](#341-发送短信验证码)，`scene` 建议 `login`。

#### 3.5.3 邮箱验证码登录

- 方法：`POST`
- 路径：`/api/auth/login/email`
- 说明：邮箱 + 验证码。邮箱未关联主体，或主体未绑手机号 → 428。

请求体：

```json
{
  "email": "demo@example.com",
  "code": "123456",
  "platformCode": "ai_portal",
  "rememberMe": true
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `email` / `code` | 是 | 邮箱与验证码 |
| `platformCode` | 否 | 登录来源，影响 `token.source` |
| `rememberMe` | 否 | 见 [3.2](#32-统一登录响应authflow) |

前置：先调用 [3.4.2](#342-发送邮箱验证码)。

#### 3.5.4 微信登录

- 方法：`POST`
- 路径：`/api/auth/login/wechat`
- 说明：服务端用 `code` 换 openId/unionId 后登录；未绑手机号 → 428。

**推荐请求体（生产）**

```json
{
  "channel": "open",
  "code": "081xxxxxx",
  "platformCode": "ai_portal",
  "rememberMe": true
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `channel` | 推荐 | `open`（开放平台网站应用）/ `mp`（公众号）/ `miniprogram`（小程序） |
| `code` | 推荐 | 微信授权码（一次性） |
| `appId` | 否 | 多应用场景可指定；默认取启用中的配置 |
| `platformCode` | 否 | 登录来源，影响 token.source |
| `rememberMe` | 否 | 见 [3.2](#32-统一登录响应authflow) |
| `openId` / `unionId` | 否 | 仅过渡/测试直传；生产请用 `channel`+`code` |

#### 3.5.5 第三方 SSO 登录

- 方法：`GET` 公开配置：`/api/auth/login/{providerCode}/oauth-config`
- 方法：`POST` 换票登录：`/api/auth/login/{providerCode}`
- `providerCode`：`dingtalk` / `google` / `feishu`
- 说明：未绑手机号 → 428

**OAuth 公开配置响应示例**

```json
{
  "data": {
    "providerCode": "dingtalk",
    "clientId": "dingxxxx",
    "redirectUri": "https://example.com/auth/sso/dingtalk/callback"
  }
}
```

**换票登录请求体**

```json
{
  "code": "oauth-authorization-code",
  "platformCode": "ai_portal",
  "rememberMe": true
}
```

客户端流程：拉取配置 → 跳转第三方授权 → 回调拿到 `code` → POST 换票 → 处理 authenticated / 428。

### 3.6 绑定手机号并登录

- 方法：`POST`
- 路径：`/api/auth/login/phone/bind`
- 说明：消费第一阶段 `bindToken`，校验短信验证码后绑定（或归并）手机号并签发 Token。若手机号已存在主体，将按服务端规则合并标识。

请求体：

```json
{
  "bindToken": "bt_xxx",
  "phone": "13800000000",
  "code": "123456",
  "password": null,
  "platformCode": "ai_portal",
  "rememberMe": true
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `bindToken` | 是 | 428 响应中的 `nextAction.bindToken` |
| `phone` | 是 | 待绑定手机号 |
| `code` | 是 | 短信验证码（先调用 sms/send，`scene=bind_phone`） |
| `password` | 否 | `channel=username` 等场景可顺带设置登录密码（至少 6 位） |
| `platformCode` | 否 | 与短信发送时一致 |
| `rememberMe` | 否 | 见 [3.2](#32-统一登录响应authflow) |

成功：HTTP 200，`data.status=authenticated`，结构同 [3.2](#32-统一登录响应authflow)。

### 3.7 微信扫码辅助接口

#### 3.7.1 扫码模式

- 方法：`GET`
- 路径：`/api/auth/login/wechat/scan-mode`
- 说明：登录页应使用的扫码实现；优先开放平台，否则公众号，否则 `none`

```json
{
  "data": {
    "mode": "open",
    "appId": "wx123",
    "redirectUri": "https://example.com/auth/wechat/open/callback"
  }
}
```

| `mode` | 含义 |
|--------|------|
| `open` | 使用开放平台 WxLogin / qrconnect |
| `mp` | 使用公众号扫码 ticket 流程 |
| `none` | 未配置可用微信登录 |

#### 3.7.1.1 第三方集成扫码模式（指定回调）

- 方法：`GET`
- 路径：`/api/auth/login/wechat/scan-mode/integrate`
- 说明：供其他业务系统嵌入开放平台二维码；可指定本系统回调页路径（主机须与开放平台「授权回调域」一致）

查询参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `redirectUri` | 是 | 完整回调 URL，如 `https://portal.example.com/partner/wechat/callback` |

```json
{
  "data": {
    "mode": "open",
    "appId": "wx123",
    "redirectUri": "https://portal.example.com/partner/wechat/callback"
  }
}
```

集成约定：

1. 调用本接口拿到 `appId` + 你传入并经校验回显的 `redirectUri`
2. 前端用开放平台 WxLogin / qrconnect（`scope=snsapi_login`）出码
3. 用户确认后跳转至你的 `redirectUri`，携带 `code`、`state`
4. 你的后端或前端再调用 [3.5.4](#354-微信登录) `POST /api/auth/login/wechat`（`channel=open`）换登录态
5. 若当前模式为 `mp` / `none`，响应与 [3.7.1](#371-扫码模式) 一致（不改写回调）

错误：`redirectUri` 缺失、非绝对 URL、或主机与配置回调域不一致 → HTTP 400（`COMMON-400`）。

#### 3.7.2 开放平台 OAuth 配置

- 方法：`GET`
- 路径：`/api/auth/login/wechat/open/oauth-config`

```json
{
  "data": {
    "appId": "wx123",
    "redirectUri": "https://example.com/auth/wechat/open/callback"
  }
}
```

前端用 `appId` + `redirectUri` 嵌入官方二维码；用户确认后回调携带 `code`、`state`，再调用 [3.5.4](#354-微信登录)。

#### 3.7.3 公众号 OAuth 配置

- 方法：`GET`
- 路径：`/api/auth/login/wechat/mp/oauth-config`

```json
{
  "data": {
    "appId": "wx456"
  }
}
```

#### 3.7.4 公众号扫码 Ticket

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 创建 ticket | `POST` | `/api/auth/login/wechat/mp/scan/ticket` | PC 出码；body 可选 `{ "platformCode": "ai_portal" }` |
| 标记已扫 | `POST` | `/api/auth/login/wechat/mp/scan/scanned` | body：`{ "ticket": "..." }` |
| 查询状态 | `GET` | `/api/auth/login/wechat/mp/scan/status?ticket=` | PC 轮询 |
| 提交 code | `POST` | `/api/auth/login/wechat/mp/scan/complete` | body：`{ "ticket", "code" }` |
| 消费结果 | `POST` | `/api/auth/login/wechat/mp/scan/consume` | PC 取走登录结果后调用 |

**创建 ticket 响应示例**

```json
{
  "data": {
    "ticket": "t_xxx",
    "appId": "wx456",
    "expiresAt": 1782202200
  }
}
```

**轮询状态 `data` 重点字段**

| 字段 | 说明 |
|------|------|
| `ticket` | ticket |
| `status` | 如 `pending` / `scanned` / `authenticated` / `phone_bind_required` / `expired` / `failed` |
| `token` | `authenticated` 时的 TokenPair |
| `nextAction` | `phone_bind_required` 时的绑定动作（同 3.2） |
| `expiresAt` | **Unix 秒**过期时间 |

当 `status=phone_bind_required` 时，客户端应进入 [3.6](#36-绑定手机号并登录)，无需再调 `/login/wechat`。

### 3.8 刷新 Token

- 方法：`POST`
- 路径：`/api/auth/refresh`
- 说明：使用 refreshToken 刷新 accessToken（及可能轮换的 refreshToken）

请求体：

```json
{
  "refreshToken": "refresh-token-value"
}
```

返回 `data` 为重点 Token 字段（非 AuthFlow 包装）：

```json
{
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token",
    "expiresAt": 1782202149,
    "tokenType": "Bearer",
    "sessionId": "session-001",
    "source": "ai_portal",
    "contextVersion": 2
  }
}
```

说明：`expiresAt` 为 accessToken 的 **Unix 秒**过期时间（同 [3.2](#32-统一登录响应authflow)）。

### 3.9 登出

- 方法：`POST`
- 路径：`/api/auth/logout`
- 说明：注销当前会话；可同时使 refreshToken 失效

请求头（可选）：`Authorization: Bearer <accessToken>`

请求体（可选）：

```json
{
  "refreshToken": "refresh-token-value"
}
```

成功：HTTP 200，`data` 可为 `null`。

## 4. 应用接口

### 4.1 应用分类

- 方法：`GET`
- 路径：`/api/admin/app/workflowCate`
- 说明：查询工作流应用分类树
- 鉴权：Bearer Token
- 主要参数：无
- 返回重点字段：
  - `id`
  - `name`
  - `parentId`
  - `level`
  - `iconUrl`
  - `sortNo`

### 4.2 应用列表查询

- 方法：`GET`
- 路径：`/api/admin/app/workflow`
- 说明：分页查询工作流应用
- 鉴权：Bearer Token
- 主要查询参数：
  - `pageNo`：页码，必填
  - `pageSize`：每页条数，必填
  - `total`：已知总数，可选
  - `keyword`：关键字，可选
  - `cateId`：分类 ID，可选
  - `subCateId`：子分类 ID，可选
  - `tagId`：标签 ID，可选
  - `status`：状态，可选
  - `type`：应用类型，可选
- 返回重点字段：
  - `page`
  - `items[].id`
  - `items[].code`
  - `items[].cateId`
  - `items[].cateName`
  - `items[].title`
  - `items[].coverUrl`
  - `items[].iconUrl`
  - `items[].description`
  - `items[].price`
  - `items[].status`
  - `items[].currentVersionNo`

### 4.3 应用详情查询

- 方法：`GET`
- 路径：`/api/admin/app/workflow/{id}`
- 说明：查询单个工作流应用详情
- 鉴权：Bearer Token
- 路径参数：
  - `id`：应用 ID
- 返回重点字段：
  - `id`
  - `code`
  - `type`
  - `cateId`
  - `cateName`
  - `title`
  - `detail`
  - `mcpDescription`
  - `outputNodesJson`
  - `appClientsJson`
  - `scopeBindings`
  - `comfyuiRels`
  - `tagIds`

### 4.4 通过应用 ID 获取线上版本

- 方法：`GET`
- 路径：`/api/admin/app/workflowVersion`
- 说明：根据应用 ID 查询该应用的线上版本列表
- 鉴权：Bearer Token
- 主要查询参数：
  - `pageNo`：页码，必填；示例值：`1`
  - `pageSize`：每页条数，必填；示例值：`200`
  - `workflowId`：应用 ID，必填；示例值：`019ecf63-3e9c-791c-8ce7-afc728286b61`
- 完整请求网址：`http://aigc.marvelvision.com.cn/api/admin/app/workflowVersion?pageNo=1&pageSize=200&workflowId=019ecf63-3e9c-791c-8ce7-afc728286b61`
- 返回重点字段：
  - `page`：分页信息
  - `items[].id`：应用版本 ID
  - `items[].workflowId`：所属应用 ID
  - `items[].versionNo`：版本号
  - `items[].changelog`：版本变更说明
  - `items[].createdAt`：创建时间
  - `items[].updatedAt`：更新时间
  - `items[].createdBy`：创建人
  - `items[].updatedBy`：最后更新人

### 4.5 应用详情配置信息查询

- 方法：`GET`
- 路径：`/api/admin/app/workflowVersion/{id}`
- 说明：查询单个工作流应用版本详情配置
- 鉴权：Bearer Token
- 路径参数：
  - `id`：应用版本 ID，例如：`019ecf63-3ea8-775f-a651-013f6a8e2575`
- 返回重点字段：
  - `id`：应用版本 ID
  - `workflowId`：所属应用 ID
  - `versionNo`：版本号
  - `changelog`：版本变更说明
  - `createdAt`：创建时间
  - `updatedAt`：更新时间
  - `createdBy`：创建人
  - `updatedBy`：最后更新人
  - `workflowJson`：工作流配置 JSON
  - `workflowJsonText`：工作流配置文本内容
  - `configJson`：版本附加配置 JSON
  - `inputSchema`：输入参数 Schema
  - `outputSchema`：输出结果 Schema
  - `uiSchema`：前端表单或界面渲染 Schema

### 4.6 通过应用 ID 查询执行所需工作流详情

- 方法：`GET`
- 路径：`/api/app/workflow/runtime-detail/by-app`
- 说明：根据应用 ID 返回完整工作流信息，以及与 `currentVersionNo` 对应的版本详情，供执行工作流前加载运行时配置使用。真正提交执行见 [第 6 章](#6-工作流派发与任务状态)。
- 鉴权：Bearer Token
- 查询参数：
  - `appId`：应用 ID，必填
- 返回重点字段：
  - `workflow.id`
  - `workflow.code`
  - `workflow.type`
  - `workflow.cateId`
  - `workflow.cateName`
  - `workflow.title`
  - `workflow.detail`
  - `workflow.mcpDescription`
  - `workflow.outputNodesJson`
  - `workflow.appClientsJson`
  - `workflow.scopeBindings`
  - `workflow.comfyuiRels`
  - `workflow.tagIds`
  - `version.workflowVersionId`
  - `version.versionNo`
  - `version.workflowJson`
  - `version.configJson`
  - `version.uiSchema`

### 4.7 通过工作流版本 ID 查询执行所需工作流详情

- 方法：`GET`
- 路径：`/api/app/workflow/runtime-detail/by-version`
- 说明：根据 `workflowVersionId` 返回该版本所属的完整工作流信息，以及该版本对应的完整版本详情。真正提交执行见 [第 6 章](#6-工作流派发与任务状态)。
- 鉴权：Bearer Token
- 查询参数：
  - `workflowVersionId`：工作流版本 ID，必填
- 返回重点字段：
  - `workflow.id`
  - `workflow.code`
  - `workflow.type`
  - `workflow.cateId`
  - `workflow.cateName`
  - `workflow.title`
  - `workflow.detail`
  - `workflow.mcpDescription`
  - `workflow.outputNodesJson`
  - `workflow.appClientsJson`
  - `workflow.scopeBindings`
  - `workflow.comfyuiRels`
  - `workflow.tagIds`
  - `version.workflowVersionId`
  - `version.versionNo`
  - `version.workflowJson`
  - `version.configJson`
  - `version.uiSchema`

## 5. 用户接口

## 5.1 基础信息查询

### 5.1.1 当前登录用户会话上下文

- 方法：`GET`
- 路径：`/api/store-ops/ums/me`
- 说明：获取当前登录用户基础会话信息；其中 `tenantId` 即后续请求头 `X-Tenant-Id` 应使用的值（见 2.2）
- 主要返回字段：
  - `tenantId`：租户标识（写入 `X-Tenant-Id`）
  - `principalId`
  - `merchantId`
  - `storeId`
  - `source`
  - `contextVersion`
  - `username`
  - `authorities`
  - `roles`
  - `permissions`

### 5.1.2 用户详情查询

- 方法：`GET`
- 路径：`/api/ums/users/{id}`
- 说明：查询指定用户基础信息；管理员或本人可访问
- 路径参数：
  - `id`：用户 ID
- 返回重点字段：
  - `id`
  - `principalId`
  - `merchantId`
  - `storeId`
  - `displayName`
  - `nickname`
  - `realName`
  - `avatarUrl`
  - `gender`
  - `birthday`
  - `phone`
  - `email`
  - `status`
  - `remark`
  - `groups`

## 5.2 基础信息编辑

- 方法：`PUT`
- 路径：`/api/ums/users/{id}`
- 说明：更新用户基础信息；管理员或本人可更新
- 路径参数：
  - `id`：用户 ID
- 请求体主要字段：
  - `merchantId`
  - `storeId`
  - `nickname`
  - `realName`
  - `gender`
  - `birthday`
  - `avatarUrl`
  - `phone`
  - `email`
  - `status`
  - `remark`
  - `groups`

示例：

```json
{
  "nickname": "张三",
  "realName": "张三",
  "gender": "male",
  "birthday": "1995-01-01",
  "phone": "13800000000",
  "email": "demo@example.com",
  "remark": "测试用户",
  "groups": ["vip", "store-owner"]
}
```

## 5.3 密码修改

- 方法：`POST`
- 路径：`/api/ums/users/{id}/reset-password`
- 说明：管理员或用户本人重置密码（非「旧密码校验后修改」流程）
- 路径参数：
  - `id`：用户 ID
- 请求体：无

## 5.4 应用会话

### 5.4.1 会话列表

- 方法：`GET`
- 路径：`/api/scheduler/sessions`
- 说明：分页查询应用会话列表
- 主要查询参数：
  - `pageNo`
  - `pageSize`
  - `total`
- 返回重点字段：
  - `items[].sessionId`
  - `items[].sessionName`
  - `items[].ownerPrincipalId`
  - `items[].merchantId`
  - `items[].storeId`
  - `items[].lastTaskAt`
  - `items[].createdAt`
  - `items[].updatedAt`

### 5.4.2 会话详情

- 方法：`GET`
- 路径：`/api/scheduler/sessions/{sessionId}`
- 说明：查询单个应用会话详情
- 路径参数：
  - `sessionId`

## 5.5 绘图历史

- 方法：`GET`
- 路径：`/api/scheduler/dispatch/sessions/{sessionId}/tasks`
- 说明：查询某个会话下的任务时间线（绘图/生成历史）
- 路径参数：
  - `sessionId`
- 查询参数：
  - `pageNo`
  - `pageSize`
  - `total`
- 返回重点字段：
  - `items[].taskId`
  - `items[].sessionId`
  - `items[].taskName`
  - `items[].status`
  - `items[].submittedAt`
  - `items[].finishedAt`
  - `items[].prompt`
  - `items[].appId`
  - `items[].workflowVersionId`
  - `items[].app`
  - `items[].assets`

## 5.6 交易记录

该能力暂未对外开放。如需对接，请联系平台方确认开放计划。

## 5.7 统一资金流水

分页查询资金流水，可按主体、方向、业务类型等条件过滤；`bizContext` 为业务上下文 JSON 字符串，结构见下文。

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/admin/fund/ledgers` |
| 权限 | 需具备账单管理权限 |

### 5.7.1 查询参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `pageNo` | 是 | 页码，≥1 |
| `pageSize` | 是 | 每页条数，1～200 |
| `total` | 否 | 已知总数（分页优化；字符串传入） |
| `principalId` | 否 | 按主体用户 ID 过滤（查「自己的流水」时传当前用户 `principalId`） |
| `billDirection` | 否 | `IN`（收入）/ `OUT`（支出） |
| `deductionSource` | 否 | 业务场景粗分类（见下表） |
| `keyword` | 否 | 关键字（昵称、应用名、模型名、UUID 等） |
| `startTime` | 否 | 开始时间 |
| `endTime` | 否 | 结束时间 |

**`deductionSource`（粗分类）↔ `bizType`（细类型）**

| deductionSource | 含义 | 对应 bizType（一个或多个） | bizContext 类型 |
|-----------------|------|----------------------------|-----------------|
| `APP_CALL` | 应用/工作流调用 | `APP_RUN` | 应用运行上下文 |
| `MODEL_CALL` | 模型调用 | `TEXT_GENERATION` / `EMBEDDING` / `IMAGE_GENERATION` / `AUDIO_SYNTHESIS` / `AUDIO_TRANSCRIPTION` / `VIDEO_GENERATION` | 模型调用上下文 |
| `REGISTRATION_REWARD` | 注册赠送 | `REGISTRATION_REWARD` | 活动赠送上下文 |
| `LOGIN_REWARD` | 登录赠送 | `LOGIN_REWARD` | 活动赠送上下文 |
| `ONLINE_RECHARGE` | 线上充值 | `ONLINE_RECHARGE` | 线上充值上下文 |
| `ADMIN_RECHARGE` | 后台人工充值 | `MANUAL_RECHARGE` | 人工调账上下文 |
| `ADMIN_DEDUCT` | 后台人工扣减 | `MANUAL_DEDUCT` | 人工调账上下文 |
| `WALLET_TRANSFER` | 钱包划拨 | `WALLET_TRANSFER` | 人工调账上下文 |
| `WALLET_FREEZE` | 钱包冻结 | `WALLET_FREEZE` | 人工调账上下文 |
| `WALLET_RECYCLE` | 钱包回收 | `WALLET_RECYCLE` | 人工调账上下文 |

> 过滤时可使用 `deductionSource`；明细里请以 `bizType` 区分细类业务。退款等动作看 `actionType`（如 `DEDUCT` / `REFUND` / `CREDIT`）。

**请求示例（查指定用户自己的模型调用支出）**

```http
GET /api/admin/fund/ledgers?pageNo=1&pageSize=20&principalId=<principalId>&billDirection=OUT&deductionSource=MODEL_CALL
Authorization: Bearer <accessToken>
X-Tenant-Id: <tenantId>
X-Trace-Id: <traceId>
```

### 5.7.2 返回结构

统一外层见 2.3，`data`：

```json
{
  "page": { "pageNo": 1, "pageSize": 20, "total": 2 },
  "items": [
    {
      "id": "ledger-001",
      "accountId": "acct-001",
      "principalId": "principal-001",
      "requestId": "task:xxxxxxxx",
      "orderId": null,
      "source": "store_ops",
      "ownerId": "principal-001",
      "ownerType": "user",
      "ownerName": "张三",
      "userNickname": "张三",
      "userAvatar": "https://example.com/a.png",
      "deductionSource": "MODEL_CALL",
      "billDirection": "OUT",
      "amount": 12.5,
      "currentBalance": 987.5,
      "currency": "CNY",
      "bizDomain": "model_hub",
      "bizType": "TEXT_GENERATION",
      "actionType": "DEDUCT",
      "resourceId": "req_abc123",
      "appName": "gpt-4o-mini",
      "platformName": null,
      "modelName": "gpt-4o-mini",
      "bizContext": "{\"bizId\":\"req_abc123\",\"bizName\":\"gpt-4o-mini\",\"traceId\":\"t1\",\"sceneCode\":\"chat\",\"channelCode\":\"openai-main\"}",
      "remark": null,
      "consumptionTime": "2026-08-01 10:00:00",
      "createdAt": "2026-08-01 10:00:01",
      "updatedAt": "2026-08-01 10:00:01",
      "updatedBy": null,
      "quotaId": null
    }
  ]
}
```

**`items[]` 字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 流水 ID |
| `accountId` | string | 资金账户 ID |
| `principalId` | string\|null | 主体用户 ID |
| `requestId` | string\|null | 关联请求 ID |
| `orderId` | string\|null | 关联订单 ID（充值等） |
| `source` | string\|null | 来源系统编码 |
| `ownerType` / `ownerId` | string | 账户归属：`user` / `store` / `merchant` + ID |
| `ownerName` / `userNickname` / `userAvatar` | string\|null | 归属展示信息 |
| `deductionSource` | string | 粗分类（上表） |
| `billDirection` | `IN`\|`OUT` | 收入 / 支出 |
| `amount` | number | 变动金额 |
| `currentBalance` | number | 变动后余额 |
| `currency` | string\|null | 币种 |
| `bizDomain` | string\|null | 业务域：`workflow` / `model_hub` / `activity` / `recharge` / `admin_adjust` |
| `bizType` | string\|null | 细业务类型（上表右列） |
| `actionType` | string\|null | 资金动作：`DEDUCT` / `CREDIT` / `REFUND` 等 |
| `resourceId` / `appName` / `platformName` / `modelName` | string\|null | 从 `bizContext` 提取的展示字段 |
| `bizContext` | string\|null | 业务上下文 **JSON 字符串**（解析规则见 5.7.3） |
| `remark` | string\|null | 备注 |
| `consumptionTime` / `createdAt` / `updatedAt` | string | 发生 / 创建 / 更新时间 |

### 5.7.3 `bizContext` 总则

1. `bizContext` 为 **JSON 字符串**（可能为 `null`）。请先反序列化再使用字段。  
2. **按 `bizType` 选择结构**（下表）；结构不能仅由 `deductionSource` 判定。  
3. 公共字段：  
   - `bizId`：主业务 ID（任务 ID / 调用 ID / 订单号等，视业务类型而定）  
   - `bizName`：主业务名称快照  
   - 列表字段约定：`resourceId` 通常等于 `bizId`；`appName` 通常等于 `bizName`  
4. 空/未知类型时，`bizContext` 可能为空对象或 `null`；请忽略无法识别的额外字段。  

**`bizType` → 上下文结构**

| bizType | 上下文 | 节 |
|---------|--------|----|
| `APP_RUN` | 应用运行上下文 | 5.7.4 |
| `TEXT_GENERATION` / `EMBEDDING` / `IMAGE_GENERATION` / `AUDIO_SYNTHESIS` / `AUDIO_TRANSCRIPTION` / `VIDEO_GENERATION` | 模型调用上下文 | 5.7.5 |
| `REGISTRATION_REWARD` / `LOGIN_REWARD` | 活动赠送上下文 | 5.7.6 |
| `ONLINE_RECHARGE` | 线上充值上下文 | 5.7.7 |
| `MANUAL_RECHARGE` / `MANUAL_DEDUCT` / `WALLET_TRANSFER` / `WALLET_FREEZE` / `WALLET_RECYCLE` | 人工调账上下文 | 5.7.8 |
| （空/未知） | 空上下文 | 5.7.9 |

### 5.7.4 应用运行上下文

适用：`bizType=APP_RUN`，`deductionSource=APP_CALL`。  
`bizId` 为本次任务运行 ID；`workflowId` 仅为工作流定义信息，不能代替 `bizId`。

| 字段 | 必填 | 说明 |
|------|------|------|
| `bizId` | 是 | 任务运行 ID |
| `bizName` | 是 | 工作流/应用标题快照 |
| `workflowId` | 否 | 工作流定义 ID（元数据） |
| `workflowVersionId` | 否 | 工作流版本 ID |

```json
{
  "bizId": "a1b2c3d4e5f64789a0b1c2d3e4f50617",
  "bizName": "电商主图生成",
  "workflowId": "wf-001",
  "workflowVersionId": "wfv-009"
}
```

列表字段：`resourceId`≈`bizId`，`appName`≈`bizName`。

### 5.7.5 模型调用上下文

适用：`TEXT_GENERATION` / `EMBEDDING` / `IMAGE_GENERATION` / `AUDIO_SYNTHESIS` / `AUDIO_TRANSCRIPTION` / `VIDEO_GENERATION`。  
`bizId` 为单次模型调用请求 ID。

| 字段 | 必填 | 说明 |
|------|------|------|
| `bizId` | 是 | 模型调用请求 ID |
| `bizName` | 是 | 模型展示名快照 |
| `traceId` | 否 | 链路追踪 ID（同链路多调用辅查） |
| `sceneCode` | 否 | 推理场景：`chat` / `embedding` / `image_generation` / `audio_synthesis` / `audio_transcription` / `video_generation` |
| `channelCode` | 否 | 渠道编码 |

```json
{
  "bizId": "req_01HXYZ...",
  "bizName": "gpt-4o-mini",
  "traceId": "4122dd17fa21427aa48fff496a90e764",
  "sceneCode": "chat",
  "channelCode": "openai-main"
}
```

列表字段：`resourceId`≈`bizId`，`appName`/`modelName`≈`bizName`。

### 5.7.6 活动赠送上下文

适用：`REGISTRATION_REWARD` / `LOGIN_REWARD`。

| 字段 | 必填 | 说明 |
|------|------|------|
| `bizId` | 是 | 活动/礼包 ID |
| `bizName` | 是 | 活动/礼包名称快照 |
| `periodKey` | 否 | 登录赠送周期键（如按日）；注册赠送可空 |

```json
{
  "bizId": "pkg-reg-001",
  "bizName": "新用户注册礼包",
  "periodKey": null
}
```

```json
{
  "bizId": "act-login-daily",
  "bizName": "每日登录赠送",
  "periodKey": "2026-08-01"
}
```

### 5.7.7 线上充值上下文

适用：`ONLINE_RECHARGE`。

| 字段 | 必填 | 说明 |
|------|------|------|
| `bizId` | 是 | 充值订单号 |
| `bizName` | 是 | 支付渠道展示名快照 |
| `payChannel` | 否 | 支付渠道编码 |

```json
{
  "bizId": "ORD202608010001",
  "bizName": "微信支付",
  "payChannel": "WECHAT_PAY"
}
```

### 5.7.8 人工调账上下文

适用：`MANUAL_RECHARGE` / `MANUAL_DEDUCT` / `WALLET_TRANSFER` / `WALLET_FREEZE` / `WALLET_RECYCLE`。  
账户归属以流水主字段为准。

| 字段 | 必填 | 说明 |
|------|------|------|
| `bizId` | 是 | 调账单/业务单 ID |
| `bizName` | 是 | 事由快照（建议 ≤64 字） |
| `peerOwnerType` | 否 | 划拨对端账户类别（仅 `WALLET_TRANSFER` 等） |
| `peerOwnerId` | 否 | 划拨对端所有者 ID |

**人工充值示例**

```json
{
  "bizId": "manual-recharge-001",
  "bizName": "运营补发算力"
}
```

**钱包划拨示例**

```json
{
  "bizId": "transfer-001",
  "bizName": "门店划拨至用户",
  "peerOwnerType": "user",
  "peerOwnerId": "principal-xyz"
}
```

### 5.7.9 空上下文

无业务实体时：`bizContext` 可能为 `null` 或 `{}`，列表展示字段为空。

### 5.7.10 客户端解析建议

```ts
function parseBizContext(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
// 再按流水的 bizType 读取对应字段（见 5.7.4～5.7.8）
```

## 5.8 主体资金余额查询

用于查询商户 / 门店 / 用户账户当前余额（查用户自身余额时：`ownerType=user`，`ownerId=<principalId>`）。

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/admin/fund/accounts/{ownerType}/{ownerId}/balance` |
| 权限 | 需具备账户管理权限 |

### 5.8.1 路径参数

| 参数 | 说明 |
|------|------|
| `ownerType` | `merchant` / `store` / `user` |
| `ownerId` | 对应主体 ID；用户场景传 `principalId` |

### 5.8.2 查询参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `merchantId` | 否 | 归属商户（门店/用户场景常用） |
| `storeId` | 否 | 归属门店 |
| `subjectScope` | 否 | 用户主体范围：`store_user` / `merchant_user` / `c_end_user` / `platform_user` |
| `currency` | 否 | 币种 |

### 5.8.3 请求示例（查用户自身余额）

```http
GET /api/admin/fund/accounts/user/{principalId}/balance?subjectScope=platform_user
Authorization: Bearer <accessToken>
X-Tenant-Id: <tenantId>
X-Trace-Id: <traceId>
```

### 5.8.4 返回 `data` 字段

| 字段 | 说明 |
|------|------|
| `accountId` | 账户 ID；无账户时可能为空 |
| `accountType` | 账户类别 |
| `ownerType` / `ownerId` | 归属类型 / ID |
| `principalId` | 主体用户 ID |
| `merchantId` / `storeId` | 归属商户 / 门店 |
| `subjectScope` | 主体范围 |
| `currency` | 币种 |
| `balance` | 余额；无账户时为 `0` |
| `status` | 账户状态；无账户时为 `not_found` |

```json
{
  "accountId": "acct-001",
  "accountType": "user_wallet",
  "ownerType": "user",
  "ownerId": "principal-001",
  "principalId": "principal-001",
  "merchantId": null,
  "storeId": null,
  "subjectScope": "platform_user",
  "currency": "CNY",
  "balance": 987.5,
  "status": "active"
}
```

> 若只需查询余额与流水，使用本章 5.7、5.8 即可。账户调账类接口另见平台管理约定（如未单独提供则不对第三方开放）。

## 5.9 用户套餐（算力套餐）

管理端维护「用户套餐」：定义充值售价、到账额度、入账目标账户等。线上扫码购买见 [5.10](#510-线上支付扫码充值)。

| 项 | 值 |
|----|----|
| 路径前缀 | `/api/admin/ops/computePackages` |
| 权限 | `ops.package.manage` |
| 鉴权 | Bearer Token + `X-Tenant-Id` / `X-Trace-Id`（见 2.2） |

机器可读契约见同目录 [`ops.yaml`](./ops.yaml)（`ComputePackage`）。

### 5.9.1 公共说明

**套餐类型 `packageType`**

| 值 | 含义 | 购买金额 `amount` | `onlineRecharge` | `creditTarget` |
|----|------|-------------------|------------------|----------------|
| `recharge` | 充值套餐（可线上购买） | 必填，单位：**分**，须 `> 0` | 允许 `true` | 必填：`user` / `store` / `merchant` |
| `registration` | 注册赠送 | 固定 `0` | 必须 `false` | 固定 `null` |
| `login_reward` | 登录活动赠送 | 固定 `0` | 必须 `false` | 固定 `null` |

**金额与额度口径**

| 字段 | 含义 |
|------|------|
| `amount` | 用户实付金额（**分**）；渠道下单金额取此值 |
| `computeQuota` | 基础到账额度 |
| `bonusCompute` | 赠送到账额度 |
| 实际入账 | `computeQuota + bonusCompute`（与实付金额分离） |
| `creditTarget` | 入账账户类型：`user`（个人）/ `store`（门店）/ `merchant`（商户）；与统一资金 `FundAccountType` 对齐。历史别名读路径兼容 `personal`→`user`、`enterprise`→`merchant`，写路径禁止再落旧码 |

**专属组织**

- `isExclusive=true` 时须填 `exclusiveMerchantId`
- 专属套餐仅允许所属商户匹配的用户购买

### 5.9.2 套餐列表

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/admin/ops/computePackages` |

**查询参数**

| 参数 | 必填 | 说明 |
|------|------|------|
| `pageNo` | 否 | 页码，默认 `1`，≥1 |
| `pageSize` | 否 | 每页条数，默认 `20`，1～200 |
| `total` | 否 | 已知总数（分页优化） |
| `packageType` | 否 | `recharge` / `registration` / `login_reward` |
| `keyword` | 否 | 名称关键字 |

**请求示例**

```http
GET /api/admin/ops/computePackages?pageNo=1&pageSize=20&packageType=recharge
Authorization: Bearer <accessToken>
X-Tenant-Id: <tenantId>
X-Trace-Id: <traceId>
```

**返回 `data`**

```json
{
  "page": { "pageNo": 1, "pageSize": 20, "total": 2 },
  "items": [
    {
      "id": "019fd144-a828-7462-bbdd-bec4c093061e",
      "name": "基础算力包",
      "coverUrl": null,
      "amount": 9900,
      "currency": "CNY",
      "computeQuota": 10000,
      "bonusCompute": 500,
      "exclusiveMerchantId": null,
      "isExclusive": false,
      "validityDays": 365,
      "onlineRecharge": true,
      "creditTarget": "user",
      "packageType": "recharge",
      "enabled": true,
      "sortNo": 10,
      "description": "适合个人体验",
      "detailContent": null,
      "createdAt": "2026-08-05T10:00:00Z",
      "updatedAt": "2026-08-05T10:00:00Z",
      "updatedBy": "019ecf63-3dd4-7214-9ac3-e8b5a961ebd8"
    }
  ]
}
```

### 5.9.3 套餐详情

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/admin/ops/computePackages/{id}` |

返回 `data` 为单条套餐对象（字段同列表 `items[]`）。

### 5.9.4 创建套餐

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 路径 | `/api/admin/ops/computePackages` |
| 成功状态 | HTTP `201`，`data` 为新建套餐 `id`（字符串） |

**请求体**

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 套餐名称 |
| `amount` | 是 | 购买金额（分）；奖励类传 `0` |
| `currency` | 是 | 币种，如 `CNY` |
| `computeQuota` | 是 | 基础到账额度 |
| `bonusCompute` | 是 | 赠送到账额度 |
| `isExclusive` | 是 | 是否专属组织 |
| `exclusiveMerchantId` | 条件 | `isExclusive=true` 时必填 |
| `onlineRecharge` | 是 | 是否允许线上购买；奖励类必须 `false` |
| `creditTarget` | 条件 | `packageType=recharge` 时必填：`user` / `store` / `merchant` |
| `packageType` | 是 | `recharge` / `registration` / `login_reward` |
| `enabled` | 是 | 是否启用 |
| `sortNo` | 是 | 排序号 |
| `coverUrl` | 否 | 封面 URL |
| `validityDays` | 否 | 有效天数 |
| `description` | 否 | 简介 |
| `detailContent` | 否 | 详情富文本 |

**请求示例**

```http
POST /api/admin/ops/computePackages
Authorization: Bearer <accessToken>
X-Tenant-Id: <tenantId>
X-Trace-Id: <traceId>
Content-Type: application/json

{
  "name": "基础算力包",
  "amount": 9900,
  "currency": "CNY",
  "computeQuota": 10000,
  "bonusCompute": 500,
  "isExclusive": false,
  "onlineRecharge": true,
  "creditTarget": "user",
  "packageType": "recharge",
  "enabled": true,
  "sortNo": 10,
  "description": "适合个人体验"
}
```

### 5.9.5 更新套餐

| 项 | 值 |
|----|----|
| 方法 | `PUT` |
| 路径 | `/api/admin/ops/computePackages/{id}` |
| 成功 | `data=true` |

请求体字段同创建，均为可选（按需部分更新）。可通过仅传 `{ "enabled": false }` 关闭套餐。

### 5.9.6 删除套餐

| 项 | 值 |
|----|----|
| 方法 | `DELETE` |
| 路径 | `/api/admin/ops/computePackages/{id}` |
| 成功 | `data=true` |

> 关闭的奖励类套餐不会参与注册/登录自动发放。线上购买仅认 `packageType=recharge` 且 `enabled=true`、`onlineRecharge=true` 的套餐。

## 5.10 线上支付（扫码充值）

管理端代客选用户 + 充值套餐，创建微信 / 支付宝 **PC Native 扫码** 订单；支付成功后按套餐 `creditTarget` 入账到对应资金账户。

| 项 | 值 |
|----|----|
| 路径前缀 | `/api/admin/fund/online-recharges` |
| 权限 | `ops.package.manage` |
| 鉴权 | Bearer Token + `X-Tenant-Id` / `X-Trace-Id` |
| 渠道 | `wechat` / `alipay`（须在系统「支付配置」中启用） |

### 5.10.1 流程总览

```text
1. GET  /api/admin/ops/computePackages?packageType=recharge   （选可购套餐）
2. GET  /api/admin/fund/online-recharges/purchase-context
       ?principalId=&packageId=                               （是否可买 / 是否需选门店）
3. POST /api/admin/fund/online-recharges                      （创建订单，拿到 codeUrl）
4. 前端展示二维码，用户扫码支付
5. 入账三入口（幂等，不重复加余额）：
   - 渠道回调 POST /api/public/pay/notify/{wechat|alipay}
   - POST .../{orderNo}/sync-status（人工查单）
   - 平台定时 poll-pending
6. （可选）切换支付方式：POST .../{orderNo}/close → 再 POST 创建新单
```

**购买主体规则（由套餐 `creditTarget` 决定，不可自由传 `ownerType`）**

| creditTarget | 校验 | 入账 |
|--------------|------|------|
| `user` | 用户存在 | 个人账户（`ownerId=principalId`） |
| `merchant` | 用户须有所属商户 | 商户账户 |
| `store` | 可解析可用门店；0 家拒绝；1 家自动选；>1 家须传 `storeId` | 门店账户 |

### 5.10.2 购买上下文

下单前调用，用于判断是否可买、是否需要选择门店。

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/admin/fund/online-recharges/purchase-context` |

**查询参数**

| 参数 | 必填 | 说明 |
|------|------|------|
| `principalId` | 是 | 购买用户主体 ID |
| `packageId` | 是 | 充值套餐 ID |

**请求示例**

```http
GET /api/admin/fund/online-recharges/purchase-context?principalId=<principalId>&packageId=<packageId>
Authorization: Bearer <accessToken>
X-Tenant-Id: <tenantId>
X-Trace-Id: <traceId>
```

**返回 `data`**

| 字段 | 说明 |
|------|------|
| `purchasable` | 当前是否可下单 |
| `storeSelectionRequired` | 是否必须再选门店 |
| `creditTarget` | 入账目标：`user` / `store` / `merchant` |
| `ownerType` / `ownerId` | 解析后的入账主体（可买且已确定时有值） |
| `merchantId` / `storeId` / `principalId` | 主体快照 |
| `availableStores` | 可选门店列表：`[{ storeId, storeName, merchantId }]` |
| `message` | 不可买或需补选时的提示文案 |

```json
{
  "purchasable": true,
  "storeSelectionRequired": false,
  "creditTarget": "user",
  "ownerType": "user",
  "ownerId": "019ecf63-3dd4-7214-9ac3-e8b5a961ebd8",
  "merchantId": null,
  "storeId": null,
  "principalId": "019ecf63-3dd4-7214-9ac3-e8b5a961ebd8",
  "availableStores": [],
  "message": null
}
```

### 5.10.3 创建待支付订单

创建本地订单并向微信 / 支付宝预下单，返回扫码 URL。

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 路径 | `/api/admin/fund/online-recharges` |

**请求体**

| 字段 | 必填 | 说明 |
|------|------|------|
| `principalId` | 是 | 购买用户主体 ID |
| `packageId` | 是 | 充值套餐 ID（须可线上购买） |
| `payChannel` | 是 | `wechat` / `alipay` |
| `storeId` | 条件 | `creditTarget=store` 且多门店时必填 |

**请求示例**

```http
POST /api/admin/fund/online-recharges
Authorization: Bearer <accessToken>
X-Tenant-Id: <tenantId>
X-Trace-Id: <traceId>
Content-Type: application/json

{
  "principalId": "019ecf63-3dd4-7214-9ac3-e8b5a961ebd8",
  "packageId": "019fd144-a828-7462-bbdd-bec4c093061e",
  "payChannel": "wechat",
  "storeId": null
}
```

成功时 `data` 为订单对象（见 [5.10.9](#5109-订单字段与错误码)），其中 `codeUrl` 用于生成二维码；`status` 通常为 `paying`。

### 5.10.4 订单列表

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/admin/fund/online-recharges` |

**查询参数**

| 参数 | 必填 | 说明 |
|------|------|------|
| `pageNo` | 否 | 默认 `1` |
| `pageSize` | 否 | 默认 `20`，最大 `200` |
| `total` | 否 | 已知总数 |
| `status` | 否 | `created` / `paying` / `paid` / `failed` / `closed` |
| `payChannel` | 否 | `wechat` / `alipay` |
| `orderNo` | 否 | 商户侧订单号 |
| `principalId` | 否 | 购买用户 |
| `merchantId` | 否 | 商户 |
| `storeId` | 否 | 门店 |

**请求示例**

```http
GET /api/admin/fund/online-recharges?pageNo=1&pageSize=20&status=paying&payChannel=wechat
Authorization: Bearer <accessToken>
X-Tenant-Id: <tenantId>
X-Trace-Id: <traceId>
```

返回 `data` 为 `{ page, items }`，`items[]` 字段同订单对象。

### 5.10.5 订单详情

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/admin/fund/online-recharges/{orderNo}` |

### 5.10.6 同步支付状态

向渠道查单；若已支付则入账并将订单置为 `paid`。

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 路径 | `/api/admin/fund/online-recharges/{orderNo}/sync-status` |
| 请求体 | 无 |

### 5.10.7 关闭未支付订单

关闭 `created` / `paying` 订单（例如支付页切换微信 ↔ 支付宝：先关旧单再创建新单）。已支付订单不可关闭。

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 路径 | `/api/admin/fund/online-recharges/{orderNo}/close` |
| 请求体 | 无 |

### 5.10.8 支付渠道回调（公开）

由微信 / 支付宝服务器调用，**无需**业务 Token；须在支付网关配置中登记公网可达的 `notifyUrl`。

| 方法 | 路径 | Content-Type | 说明 |
|------|------|--------------|------|
| `POST` | `/api/public/pay/notify/wechat` | JSON（APIv3）或 XML（APIv2） | 微信回调；按 body 形态应答 |
| `POST` | `/api/public/pay/notify/alipay` | `application/x-www-form-urlencoded` | 支付宝回调；成功应答纯文本 `success` |

建议配置：

```text
https://{公网域名}/api/public/pay/notify/wechat
https://{公网域名}/api/public/pay/notify/alipay
```

> 对接方一般不主动调用回调接口；管理端以 `sync-status` 或列表轮询确认支付结果。

### 5.10.9 订单字段与错误码

**订单对象（创建 / 详情 / 列表项 / 同步 / 关闭 共用）**

| 字段 | 说明 |
|------|------|
| `orderId` | 内部订单 ID |
| `orderNo` | 商户侧单号（渠道 `out_trade_no`） |
| `status` | `created` → `paying` → `paid` / `failed` / `closed` |
| `payChannel` | `wechat` / `alipay` |
| `amount` | 入账额度（`computeQuota + bonusCompute`） |
| `currency` | 币种 |
| `payAmountFen` | 渠道实付金额（分），来自套餐 `amount` |
| `codeUrl` | 扫码支付 URL；已支付/关闭后可能为空 |
| `packageId` / `packageName` | 套餐快照 |
| `creditTarget` | 入账目标 |
| `merchantId` / `storeId` / `principalId` | 主体快照 |
| `payOrderNo` | 渠道交易号（支付成功后有值） |
| `createdAt` / `paidAt` | 创建 / 支付完成时间 |
| `remark` | 备注 |

**示例**

```json
{
  "orderId": "019fe001-....",
  "orderNo": "OR202608051756001",
  "status": "paying",
  "payChannel": "wechat",
  "amount": 10500,
  "currency": "CNY",
  "payAmountFen": 9900,
  "codeUrl": "weixin://wxpay/bizpayurl?pr=xxxx",
  "packageId": "019fd144-a828-7462-bbdd-bec4c093061e",
  "packageName": "基础算力包",
  "creditTarget": "user",
  "merchantId": null,
  "storeId": null,
  "principalId": "019ecf63-3dd4-7214-9ac3-e8b5a961ebd8",
  "payOrderNo": null,
  "createdAt": "2026-08-05T09:55:59Z",
  "paidAt": null,
  "remark": "waiting pay"
}
```

**常见业务错误码**

| code | HTTP | 说明 |
|------|------|------|
| `PAY_GATEWAY_NOT_CONFIGURED` | 400 | 支付渠道未配置或未启用 |
| `PAY_CHANNEL_UNSUPPORTED` | 400 | `payChannel` 不受支持 |
| `PAY_PACKAGE_NOT_PURCHASABLE` | 400 | 套餐不可线上购买 / 金额或额度不合法 |
| `PAY_PURCHASE_SUBJECT_INVALID` | 400 | 购买主体不符合套餐要求（如无商户用户买商户套餐） |
| `PAY_STORE_SELECTION_REQUIRED` | 400 | 多门店场景须传 `storeId` |
| `PAY_CHANNEL_REQUEST_FAILED` | 502 | 支付渠道请求失败；`message` 可能为渠道原文（如商户收款受限） |
| `PAY_ORDER_STATUS_INVALID` | 409 | 当前订单状态不允许该操作（如关闭已支付单） |

> 支付成功后资金流水 `deductionSource` / `bizType` 为 `ONLINE_RECHARGE`，`bizContext` 结构见 [5.7.7](#577-线上充值上下文)。

## 6. 工作流派发与任务状态

本章描述 **AI 应用（ComfyUI / RunningHub 等工作流）** 的执行入口，与第 10 章 ModelHub Videos「创建任务」无关。

执行前请先通过 [4.6](#46-通过应用-id-查询执行所需工作流详情) / [4.7](#47-通过工作流版本-id-查询执行所需工作流详情) 取得 `appId`、`workflowVersionId` 与 `uiSchema`，再按 Schema 组装 `params` 调用派发。

> **说明**：实际执行后端（ComfyUI 节点或 RunningHub）由平台侧工作流版本配置决定，对接方**无需**在请求中指定 provider。

### 6.1 流程总览

```text
1. 登录取得 accessToken，并拿到 X-Tenant-Id（见 5.1.1）
2. GET runtime-detail 加载 uiSchema / 版本信息
3. POST /api/scheduler/dispatch 提交执行
4a. 轮询 GET /api/scheduler/dispatch/{taskId}
4b. 或连接 WS /api/scheduler/ws/dispatch?taskId=&token=
5. status 进入 succeeded / failed / canceled 后处理产物
6. （可选）GET .../assets/archive 打包下载
7. 会话时间线见 5.4 / 5.5
```

鉴权：本章接口均需 `Authorization: Bearer <accessToken>`，且请求头 **必须** 携带 `X-Tenant-Id`；建议同时传 `X-Trace-Id`。

### 6.2 派发任务

- 方法：`POST`
- 路径：`/api/scheduler/dispatch`
- 说明：应用执行核心入口；服务端选服、入队后返回 `taskId` 与排队信息

**请求头**

| 请求头 | 必填 | 说明 |
|--------|------|------|
| `Authorization` | 是 | `Bearer <accessToken>` |
| `X-Tenant-Id` | 是 | 租户标识 |
| `Idempotency-Key` | 否 | 幂等键；相同键重复提交可避免重复派发 |
| `X-Trace-Id` | 否 | 链路追踪 |

**请求体**

```json
{
  "appId": "019ecf63-3e9c-791c-8ce7-afc728286b61",
  "workflowVersionId": "019ecf63-3ea8-775f-a651-013f6a8e2575",
  "sessionId": "session-uuid-optional",
  "mode": "running",
  "taskName": "可选任务名",
  "params": {
    "prompt": "一只猫",
    "width": 1024
  },
  "prompt": null,
  "amount": 1.5,
  "expectedImageCount": 1,
  "preferredServerId": null,
  "tenantId": null
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `appId` | 是 | 应用 / 工作流 ID |
| `workflowVersionId` | 是 | 工作流版本 ID（须属于该应用） |
| `sessionId` | 否 | 应用会话 ID；不传时由服务端按策略处理/创建 |
| `mode` | 否 | 执行模式；门户常用 `"running"` |
| `taskName` | 否 | 任务显示名 |
| `params` | 否 | UI 表单参数 Map，键与 `uiSchema` 对齐 |
| `prompt` | 否 | 额外提示文本（部分场景） |
| `amount` | 否 | 计费金额（与门户计价一致时传入） |
| `expectedImageCount` | 否 | 期望产出图片数 |
| `preferredServerId` | 否 | 指定调度节点（一般不传） |
| `tenantId` | 否 | Body 内租户；以请求头 `X-Tenant-Id` 为准 |

**成功 `data`（DispatchAccepted）**

```json
{
  "taskId": "task-uuid",
  "status": "queued",
  "serverId": "server-uuid",
  "queuePosition": 2,
  "etaSeconds": 30,
  "computeUnits": 10
}
```

| 字段 | 说明 |
|------|------|
| `taskId` | 任务 ID，后续查询/WS 均用此值 |
| `status` | 初始多为 `queued` |
| `serverId` | 选中的调度节点 |
| `queuePosition` / `etaSeconds` | 排队位置与预估等待秒数 |
| `computeUnits` | 预扣/占用算力单位 |

### 6.3 查询任务详情

- 方法：`GET`
- 路径：`/api/scheduler/dispatch/{taskId}`
- 说明：查询任务快照（状态、进度、产物、错误信息）

**成功 `data` 重点字段**

| 字段 | 说明 |
|------|------|
| `taskId` / `sessionId` / `taskName` | 任务与会话 |
| `status` | 见 [6.7](#67-状态机与终态) |
| `progress` | 0–100 进度 |
| `queuePosition` / `etaSeconds` | 排队信息 |
| `submittedAt` / `startedAt` / `finishedAt` | 时间戳（字符串） |
| `computeUnits` | 算力 |
| `errorMessage` | 失败时错误摘要 |
| `appId` / `workflowVersionId` | 应用与版本 |
| `serverId` / `serverName` | 执行节点 |
| `inputJson` / `outputJson` | 输入/输出 JSON 文本 |
| `assets[]` | 产物列表 |

`assets[]` 元素：

| 字段 | 说明 |
|------|------|
| `assetId` | 产物 ID |
| `kind` | 类型（如图片/视频等） |
| `provider` | 如 `comfyui` / `runninghub`（服务端填写，对接方只读） |
| `textContent` | 文本类产物内容（若有） |
| `reviewStatus` | 内容审核状态 |

### 6.4 查询任务事件

- 方法：`GET`
- 路径：`/api/scheduler/dispatch/{taskId}/events`
- 说明：返回事件列表，用于补齐进度时间线

`data` 为数组，元素常见字段：`eventId`、`eventType`、`detailJson`、`createdAt`。

常见 `eventType`：`queued` / `claimed` / `running` / `progress` / `succeeded` / `failed` / `canceled` / `requeued` / `priority_updated`。

`detailJson` 为 JSON 字符串，含 `progress`、`message`、`errorCode`、`errorMessage` 等。

### 6.5 WebSocket 实时推送

- 协议：WebSocket
- 路径：`/api/scheduler/ws/dispatch`
- 说明：浏览器无法在 WS 握手中自定义 `Authorization` Header，因此通过 **Query** 传 token

查询参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `taskId` | 是 | 任务 ID |
| `token` | 是（浏览器） | accessToken |
| `lastEventId` | 否 | 断线续传：从该事件之后继续 |

示例：

```text
wss://aigc.marvelvision.com.cn/api/scheduler/ws/dispatch?taskId=<taskId>&token=<accessToken>
```

推荐：WS 推送为主，HTTP 轮询（6.3）为兜底；进入终态后关闭连接。

### 6.6 下载任务产物打包

- 方法：`GET`
- 路径：`/api/scheduler/dispatch/{taskId}/assets/archive`
- 说明：将可下载图片打包为归档文件（二进制流）
- 响应：`Content-Disposition` 含文件名；失败时可能返回统一 JSON 错误

相关会话时间线、会话 CRUD 见 [5.4](#54-应用会话) / [5.5](#55-绘图历史)（路径前缀 `/api/scheduler/sessions`、`/api/scheduler/dispatch/sessions/{sessionId}/tasks`）。

### 6.7 状态机与终态

| `status` | 含义 | 是否终态 |
|----------|------|----------|
| `queued` | 已入队等待 | 否 |
| `running` | 执行中 | 否 |
| `succeeded` | 成功 | 是 |
| `failed` | 失败 | 是 |
| `canceled` | 已取消 | 是 |

终态后可停止轮询/关闭 WS；成功时读取 `assets` 或调用打包下载。

### 6.8 废弃入口说明

| 路径 | 状态 | 说明 |
|------|------|------|
| `POST /api/scheduler/tasks` | **已停用** | 遗留 createTask；请统一使用 `POST /api/scheduler/dispatch` |
| `POST /api/scheduler/tasks/{taskId}/cancel` | 运营侧 | 需任务管理权限，非普通应用对接主路径 |

### 6.9 常见错误码

| code | HTTP | 含义 |
|------|------|------|
| `SCHEDULER-AUTH-401` | 401 | 未登录或登录失效 |
| `SCHEDULER-APP-400` | 400 | 应用请求不合法 |
| `SCHEDULER-APP-ID-INVALID` | 400 | 应用 ID 不合法 |
| `SCHEDULER-WORKFLOW-VERSION-ID-INVALID` | 400 | 版本 ID 不合法 |
| `SCHEDULER-APP-404` | 404 | 应用不存在或已下线 |
| `SCHEDULER-WORKFLOW-VERSION-404` | 404 | 版本不存在 |
| `SCHEDULER-APP-DISABLED` | 409 | 应用不可用 |
| `SCHEDULER-WORKFLOW-MISMATCH` | 400 | 应用与版本不匹配 |
| `SCHEDULER-NO-AVAILABLE-SERVER` | 404 | 暂无可用调度节点 |
| `SCHEDULER-QUOTA-429` | 429 | 余额不足 |
| `SCHEDULER-DUPLICATE-DISPATCH-IN-PROGRESS` | 409 | 重复派发（进行中） |
| `SCHEDULER-TASK-404` | 404 | 任务不存在或无权访问 |
| `SCHEDULER-TASK-NO-DOWNLOADABLE-IMAGES` | 400 | 无可下载图片 |
| `SCHEDULER-COMFYUI-SUBMIT-FAILED` | 502 | ComfyUI 提交失败 |
| `SCHEDULER-COMFYUI-POLL-TIMEOUT` | 504 | ComfyUI 执行超时 |
| `SCHEDULER-RH-SUBMIT-FAILED` | 502 | RunningHub 提交失败 |
| `SCHEDULER-RH-POLL-TIMEOUT` | 504 | RunningHub 执行超时 |
| `SCHEDULER-RH-TASK-FAILED` | 502 | RunningHub 任务失败 |
| `SCHEDULER-RH-WORKFLOW-ID-MISSING` | 500 | RunningHub 模板未配置 |

对接检查清单：

1. 使用 `/dispatch`；`POST /tasks` 已停用  
2. 头里带齐 `Authorization` + `X-Tenant-Id`  
3. `appId` / `workflowVersionId` 与 runtime-detail 一致  
4. 工作流派发与 ModelHub `/v1/videos` 为不同接口  
5. 以终态为准处理结果；`provider` 仅作只读展示


## 7. 素材接口

## 7.1 手模库（通过分类 ID 查询）

- 方法：`GET`
- 路径：`/api/admin/material/modelMaterail`
- 说明：手模库列表；可通过 `categoryId` 过滤
- 查询参数：
  - `categoryId`：分类 ID，可选
  - `categoryType`
  - `categoryTypes`
  - `auditStatus`
  - `publishStatus`
  - `keyword`
  - `tagId`
  - `tagName`
  - `pageNo`
  - `pageSize`
  - `total`
- 返回重点字段：
  - `id`
  - `fileHash`
  - `assetUrl`
  - `previewUrl`
  - `materialCategoryId`
  - `materialCategoryName`
  - `auditStatus`
  - `publishStatus`
  - `merchantId`
  - `storeId`

## 7.2 款式库（通过分类 ID 查询）

- 方法：`GET`
- 路径：`/api/admin/material/mediaMaterail`
- 说明：款式库列表；可通过 `categoryId` 过滤
- 查询参数：
  - `mediaType`
  - `categoryType`
  - `auditStatus`
  - `publishStatus`
  - `tagId`
  - `tagName`
  - `categoryId`
  - `pageNo`
  - `pageSize`
  - `total`
- 返回重点字段：
  - `id`
  - `mediaType`
  - `fileHash`
  - `assetUrl`
  - `previewUrl`
  - `materialCategoryId`
  - `auditStatus`
  - `publishStatus`

## 7.3 文件素材查询

- 方法：`GET`
- 路径：`/api/admin/material/fileMaterial`
- 说明：分页查询文件素材
- 查询参数：
  - `fileType`
  - `keyword`
  - `merchantId`
  - `storeId`
  - `ownerPrincipalId`
  - `categoryType`
  - `auditStatus`
  - `publishStatus`
  - `pageNo`
  - `pageSize`
  - `total`
- 返回重点字段：
  - `id`
  - `fileName`
  - `fileType`
  - `mimeType`
  - `fileSize`
  - `fileHash`
  - `storageProviderCode`
  - `storagePath`
  - `accessUrl`
  - `categoryType`
  - `auditStatus`
  - `publishStatus`
  - `ownerPrincipalId`

## 7.4 文件素材上传

- 方法：`POST`
- 路径：`/api/admin/material/fileMaterial/upload`
- 说明：上传文件素材，支持 `application/json` 与 `multipart/form-data`

`multipart/form-data` 主要字段：

- `file`
- `fileType`
- `fileHash`
- `tags[]`
- `merchantId`
- `storeId`
- `ownerPrincipalId`

返回重点字段：

- `file`
- `existed`

## 7.5 工作素材列表查询

- 方法：`GET`
- 路径：`/api/material/workMaterail`
- 说明：分页查询工作素材列表；支持按需返回任务信息与运行时详情。注意路径拼写为 `workMaterail`
- 鉴权：Bearer Token
- 查询参数：
  - `workType`：作品类型，可选
  - `keyword`：关键字，可选
  - `auditStatus`：审核状态，可选
  - `publishStatus`：发布状态，可选
  - `ownerPrincipalId`：归属用户 ID，可选
  - `merchantId`：商户 ID，可选
  - `storeId`：门店 ID，可选
  - `createdAtStart`：创建开始时间，可选
  - `createdAtEnd`：创建结束时间，可选
  - `includeTaskExecutionInfo`：是否返回工作流执行任务信息，可选，默认 `true`
  - `includeWorkflowInfo`：是否返回工作流信息及版本信息，可选，默认 `true`
  - `pageNo`：页码，必填
  - `pageSize`：每页条数，必填
  - `total`：已知总数，可选
- 返回重点字段：
  - `page`
  - `items[].id`
  - `items[].coverUrl`
  - `items[].workType`
  - `items[].sourceType`
  - `items[].clientType`
  - `items[].fileHash`
  - `items[].ownerPrincipalId`
  - `items[].ownerName`
  - `items[].merchantId`
  - `items[].storeId`
  - `items[].auditStatus`
  - `items[].publishStatus`
  - `items[].itemsJson`
  - `items[].createdAt`
  - `items[].updatedAt`
  - `items[].taskExecution.sessionId`
  - `items[].taskExecution.workflowId`
  - `items[].taskExecution.workflowVersionId`
  - `items[].taskExecution.taskName`
  - `items[].taskExecution.prompt`
  - `items[].taskExecution.inputParams`
  - `items[].workflowInfo.workflow.id`
  - `items[].workflowInfo.workflow.currentVersionNo`
  - `items[].workflowInfo.workflow.scopeBindings`
  - `items[].workflowInfo.workflow.comfyuiRels`
  - `items[].workflowInfo.version.workflowVersionId`
  - `items[].workflowInfo.version.versionNo`
  - `items[].workflowInfo.version.workflowJson`
  - `items[].workflowInfo.version.configJson`
  - `items[].workflowInfo.version.uiSchema`

## 8. 协议接口

### 8.1 用户协议

- 方法：`GET`
- 路径：`/api/admin/open/legal/user-agreement`
- 说明：公开获取当前在线版本用户协议
- 鉴权：无需登录
- 返回重点字段：
  - `id`
  - `docType`
  - `title`
  - `version`
  - `status`
  - `content`
  - `publishedAt`

### 8.2 隐私政策

- 方法：`GET`
- 路径：`/api/admin/open/legal/privacy-policy`
- 说明：公开获取当前在线版本隐私政策
- 鉴权：无需登录
- 返回重点字段：
  - `id`
  - `docType`
  - `title`
  - `version`
  - `status`
  - `content`
  - `publishedAt`

## 9. ModelHub API Key 管理

| 项 | 值 |
|----|----|
| 路径前缀 | `/api/v1/admin/model/api-keys` |
| 权限 | 需具备 API Key 管理权限 |

### 9.1 公共说明

**范围查询参数（多数写接口可带）**

| 参数 | 说明 |
|------|------|
| `merchantId` | 按商户范围过滤 / 创建归属 |
| `storeId` | 按门店范围过滤 / 创建归属 |
| `principalId` | 按主体用户范围过滤 / 创建归属 |

**`bindingType` 枚举**：`platform` / `merchant` / `store` / `user`  
**`status` 枚举**：`active` / `disabled` / `revoked` / `expired`

**列表/详情对象重点字段**

| 字段 | 说明 |
|------|------|
| `id` | API Key ID |
| `bindingType` | 绑定类型 |
| `editable` / `inherited` | 是否可编辑 / 是否继承 |
| `merchantId` / `storeId` / `principalId` | 归属 |
| `merchantName` / `storeName` / `principalName` | 归属名称（展示） |
| `keyName` / `keyPrefix` / `secretMasked` | 名称 / 前缀 / 脱敏密钥 |
| `assignedRoutingProfileId` | 指定路由策略 ID |
| `effectiveRoutingProfile` | 生效路由策略摘要 |
| `assignedGuardrailRuleIds` | 显式挂载的安全规则 ID |
| `explicitGuardrails` / `effectiveGuardrails` | 显式 / 生效安全规则 |
| `usesSystemDefaultRouting` | 是否使用系统默认路由 |
| `usesSystemBaselineGuardrail` | 是否使用系统基线安全策略 |
| `concurrencyLimit` | 并发上限 |
| `ipWhitelist` | IP 白名单 |
| `rateLimit` | 限流配置 JSON |
| `sourceCode` / `alertContact` | 来源编码 / 告警联系人 |
| `status` / `expiresAt` / `lastUsedAt` / `revokedAt` | 状态与时间 |
| `createdAt` / `updatedAt` | 审计时间 |

**创建/轮换成功时额外返回**：`plainSecret`（明文密钥，**仅此一次**，请立即保存）。

### 9.2 列表查询

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/v1/admin/model/api-keys` |

**查询参数**：`merchantId`、`storeId`、`principalId`（均可选）

**请求示例**

```http
GET /api/v1/admin/model/api-keys?merchantId=<merchantId>
Authorization: Bearer <accessToken>
```

**返回**：`data` 为 API Key 对象数组（非分页）。

### 9.3 可选配置查询

创建/更新 API Key 前拉取可选路由策略与安全规则。

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/v1/admin/model/api-keys/editor-options` |

**查询参数**：同 8.2 范围参数。

**返回重点字段**

| 字段 | 说明 |
|------|------|
| `bindingType` | 当前范围下默认绑定类型 |
| `routingProfiles[]` | 可选路由策略（`id`/`code`/`name`/`status` 等） |
| `guardrails[]` | 可选安全规则 |

### 9.4 详情查询

| 项 | 值 |
|----|----|
| 方法 | `GET` |
| 路径 | `/api/v1/admin/model/api-keys/{id}` |

**路径参数**：`id` — API Key ID  

**返回**：单个 API Key 对象（字段见 8.1）。

### 9.5 创建

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 路径 | `/api/v1/admin/model/api-keys` |
| HTTP 状态 | `201` |

**查询参数**：`merchantId` / `storeId` / `principalId`（决定 Key 归属范围）

**请求体**

```json
{
  "keyName": "生产环境调用密钥",
  "expiresAt": null,
  "ipWhitelist": [],
  "rateLimit": {},
  "concurrencyLimit": 10,
  "sourceCode": null,
  "alertContact": null,
  "assignedRoutingProfileId": null,
  "guardrailRuleIds": []
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `keyName` | 是 | 密钥名称 |
| `expiresAt` | 否 | 过期时间；空表示不过期 |
| `ipWhitelist` | 否 | IP 白名单 |
| `rateLimit` | 否 | 限流配置 |
| `concurrencyLimit` | 否 | 并发上限 |
| `sourceCode` | 否 | 来源编码 |
| `alertContact` | 否 | 告警联系人 |
| `assignedRoutingProfileId` | 否 | 指定路由策略；空则系统默认 |
| `guardrailRuleIds` | 否 | 挂载的安全规则 ID 列表 |

**返回重点字段**：`id`、`keyName`、`keyPrefix`、`secretMasked`、**`plainSecret`**、`status`、`expiresAt`

### 9.6 更新

| 项 | 值 |
|----|----|
| 方法 | `PUT` |
| 路径 | `/api/v1/admin/model/api-keys/{id}` |

**查询参数**：范围参数可选（与创建一致）  
**请求体**：同 8.5（不含明文密钥字段）  
**返回**：更新后的 API Key 对象（不含 `plainSecret`）

### 9.7 轮换密钥

生成新明文密钥，旧密钥立即失效。

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 路径 | `/api/v1/admin/model/api-keys/{id}/rotate` |

**请求体（可选）**

```json
{
  "expiresAt": null,
  "ipWhitelist": [],
  "rateLimit": {}
}
```

**返回**：同创建，含新的 **`plainSecret`**。

### 9.8 撤销

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 路径 | `/api/v1/admin/model/api-keys/{id}/revoke` |

**返回**：撤销后的 API Key 对象（`status` 一般为 `revoked`，含 `revokedAt`）。

### 9.9 调用方鉴权提示（推理侧）

  - [9.3 API Key 调用入口（`/v1`）](#103-api-key-调用入口v1)

---

## 10. ModelHub 推理接口（双入口）

| 入口 | 路径前缀 |
|------|----------|
| API Key（OpenAI 兼容公开协议） | `/v1` |
| Session（登录用户调用） | `/api/v1/admin/model` |

> 成功响应多为 **OpenAI 兼容 JSON/流式原文**；业务错误仍可能返回第 2 章统一响应结构。

### 10.1 协议说明

本章描述推理 HTTP 接口：路径、鉴权、请求/响应字段，以及视频异步任务生命周期。路径与字段对齐 OpenAI Compatible；`model` 使用平台基础模型编码。

#### 10.1.1 接口范围

```text
业务系统 / SDK
    │
    ▼
本章接口（OpenAI 兼容）
    Chat / Embeddings / Images / Audio / Videos / 3D
```

按本章路径与字段提交请求。同一 `model` 的路径与字段保持不变。

#### 10.1.2 调用形态

由路径与请求字段决定：

| 形态 | 典型路径 | 说明 |
|------|----------|------|
| 同步 JSON / 二进制 | Embeddings、Images、Audio Speech、3D | 一次 HTTP 返回结果或二进制 |
| SSE 流式 | Chat `stream=true` | `text/event-stream`，直到 `data: [DONE]` |
| 异步任务 | Videos | 创建返回 `id`，再 `GET` 状态 / `/content` |

Chat 在 `stream=false` 或不传 `stream` 时返回同步 JSON。图像创建返回图像 JSON（见 10.8）。

#### 10.1.3 请求字段

按场景提交下列字段。

| 场景 `sceneCode` | 主要请求字段 | 成功响应形态 |
|------------------|--------------|--------------|
| `chat` | `model`、`messages[]`、`temperature`、`stream`，以及其它 OpenAI chat 扩展 | `chat.completion` 或 SSE chunk |
| `embedding` | `model`、`input`（字符串或数组） | OpenAI embeddings JSON |
| `image_generation` | `model`、`prompt`、`n`、`size`；参考图按模型能力传 URL | `{ "created", "data": [ { "url" } ] }` |
| `audio_synthesis` | `model`、`input`、`voice` | 音频二进制，或错误 JSON |
| `audio_transcription` | multipart：`file`、`model`，可选 `language` | OpenAI transcription JSON |
| `video_generation` | `model`、`prompt`、`seconds`、`size`；图生视频可带参考图 | `{ "id", "object":"video", "status", "progress" }` |
| `three_d_generation` | `model`、`prompt` 及该模型能力允许的扩展字段 | 同步 JSON |

公共约定：

1. `model` 为控制台「基础模型」编码。  
2. 图像张数使用 `n`（整数 ≥ 1），上限以该模型能力为准。  
3. 参考图使用 URL 字段；视频 / 转写的本地文件使用 multipart。  
4. 时长、分辨率等可选能力使用本章字段（如 `seconds`、`size`），取值以该模型能力配置为准。

#### 10.1.4 异步任务状态

视频接口返回任务对象，`status` 取值如下：

| `status` | 含义 | 下一步 |
|----------|------|--------|
| `queued` | 已受理，排队或刚提交 | `GET /videos/{id}` |
| `in_progress` | 生成中 | 继续轮询；可读取 `progress`（0–100，可能为空） |
| `completed` | 成功 | `GET /videos/{id}/content` 下载 |
| `failed` | 失败 / 取消 / 过期 | 读取 `error.message` |

```json
{
  "id": "video_xxx",
  "object": "video",
  "status": "in_progress",
  "progress": 40
}
```

失败时可能带：

```json
{
  "id": "video_xxx",
  "object": "video",
  "status": "failed",
  "error": { "message": "任务失败原因" }
}
```

计费：创建（POST）计费；视频的 GET / DELETE 不计费。

### 10.2 两种调用方式对比

| 项 | API Key 入口 | Session 入口 |
|----|--------------|--------------|
| 适用场景 | 第三方 / 服务端集成、OpenAI SDK 兼容 | 已登录用户在业务场景内调用 |
| 路径前缀 | `/v1` | `/api/v1/admin/model` |
| 鉴权 | API Key 明文（见 9.3） | `Authorization: Bearer <accessToken>` |
| 业务能力 | 由 Key 配置决定；无需 `X-Biz-Code` | 须带 `X-Biz-Code`，且与路径场景一致 |
| 可选模型 | 由 Key 侧配置约束 | 由业务能力允许的模型列表约束 |
| 计费主体 | API Key 绑定的账户归属 | 当前登录用户所属账户 |
| 协议形态 | OpenAI Compatible | 与 API Key 同路径语义，仅前缀与鉴权不同 |

### 10.3 场景与路径对照

| 场景 `sceneCode` | API Key 路径 | Session 路径 | 请求体 |
|------------------|--------------|---------------|--------|
| `chat` | `POST /v1/chat/completions` | `POST /api/v1/admin/model/chat/completions` | JSON |
| `embedding` | `POST /v1/embeddings` | `POST /api/v1/admin/model/embeddings` | JSON |
| `image_generation` | `POST /v1/images/generations` | `POST /api/v1/admin/model/images/generations` | JSON |
| `audio_synthesis` | `POST /v1/audio/speech` | `POST /api/v1/admin/model/audio/speech` | JSON |
| `audio_transcription` | `POST /v1/audio/transcriptions` | `POST /api/v1/admin/model/audio/transcriptions` | multipart |
| `video_generation` | `POST /v1/videos` | `POST /api/v1/admin/model/videos` | JSON 或 multipart |
| （视频后续，不计费） | `GET/DELETE /v1/videos/{videoId}`… | `GET/DELETE /api/v1/admin/model/videos/{videoId}`… | — |
| `three_d_generation` | `POST /v1/3d/generations` | `POST /api/v1/admin/model/3d/generations` | JSON |

公共响应头：成功时可能回写 `X-Trace-Id`。

### 10.4 API Key 调用入口（`/v1`）

| 项 | 值 |
|----|----|
| 鉴权 | 使用第 9 章创建/轮换返回的 `plainSecret` |

**鉴权头（任选其一）**

```http
Authorization: Bearer <plainSecret>
Authorization: ApiKey <plainSecret>
X-Api-Key: <plainSecret>
X-ModelHub-Api-Key: <plainSecret>
```

建议同时携带：

```http
X-Trace-Id: <traceId>
```

**端点一览**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/v1/chat/completions` | 聊天补全，支持 `stream` |
| `POST` | `/v1/embeddings` | 向量嵌入 |
| `POST` | `/v1/images/generations` | 图像生成 |
| `POST` | `/v1/audio/speech` | 语音合成 |
| `POST` | `/v1/audio/transcriptions` | 语音转写（multipart） |
| `POST` | `/v1/videos` | 视频任务创建（JSON / multipart） |
| `GET` | `/v1/videos/{videoId}` | 视频任务状态（不计费） |
| `GET` | `/v1/videos/{videoId}/content` | 成片下载（不计费） |
| `DELETE` | `/v1/videos/{videoId}` | 删除视频任务（不计费） |
| `POST` | `/v1/3d/generations` | 3D 生成 |

### 10.5 Session 调用入口（`/api/v1/admin/model`）

| 项 | 值 |
|----|----|
| 鉴权 | `Authorization: Bearer <accessToken>` |
| 必填头 | `X-Biz-Code: <bizCode>` |

**调用约束**

1. 必须已登录（携带有效 accessToken）  
2. 必须携带已开通的 `X-Biz-Code`  
3. `X-Biz-Code` 对应的业务场景须与请求路径匹配，否则返回 `400`  
4. Chat：可使用业务能力配置的默认提示词与允许模型列表  
5. 其它多模态：同样受允许模型列表约束  

**请求头示例**

```http
Authorization: Bearer <accessToken>
X-Biz-Code: workflow_ui_llm
X-Trace-Id: <traceId>
Content-Type: application/json
```

示例业务编码：`workflow_ui_llm`。具体可用 `bizCode` 以平台开通配置为准。

**端点一览**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/admin/model/chat/completions` | 会话聊天补全，支持流式 |
| `POST` | `/api/v1/admin/model/embeddings` | 向量嵌入 |
| `POST` | `/api/v1/admin/model/images/generations` | 图像生成 |
| `POST` | `/api/v1/admin/model/audio/speech` | 语音合成 |
| `POST` | `/api/v1/admin/model/audio/transcriptions` | 语音转写（multipart） |
| `POST` | `/api/v1/admin/model/videos` | 视频任务创建 |
| `GET` | `/api/v1/admin/model/videos/{videoId}` | 状态查询（不计费，仍需 Session + biz） |
| `GET` | `/api/v1/admin/model/videos/{videoId}/content` | 成片下载（不计费） |
| `DELETE` | `/api/v1/admin/model/videos/{videoId}` | 删除任务（不计费） |
| `POST` | `/api/v1/admin/model/3d/generations` | 3D 生成 |

### 10.6 Chat Completions（详细）

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `POST` | `POST` |
| 路径 | `/v1/chat/completions` | `/api/v1/admin/model/chat/completions` |
| Content-Type | `application/json` | `application/json` |
| 流式 Content-Type（响应） | `text/event-stream` | `text/event-stream` |

**请求体**

```json
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "你是助手" },
    { "role": "user", "content": "你好" }
  ],
  "temperature": 0.7,
  "stream": false
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `messages` | 是 | 消息列表；`role` + `content`（`content` 可为字符串或结构化对象） |
| `model` | 视路由/白名单 | API Key：由路由策略决定可选模型；Session：须在业务能力允许列表内（若配置了白名单） |
| `temperature` | 否 | 采样温度 |
| `stream` | 否 | `true` 时走 SSE；默认非流式 |
| 其它字段 | 否 | 兼容 OpenAI 的扩展字段可一并提交 |

`stream=true` 时响应为 SSE，否则为同步 JSON。

**非流式成功响应（OpenAI 形态）**

```json
{
  "id": "chatcmpl_xxx",
  "object": "chat.completion",
  "created": 1782202149,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "你好，有什么可以帮你？" },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 16,
    "total_tokens": 28
  }
}
```

**流式（`stream=true`）**

```http
Accept: text/event-stream
```

SSE 片段示例：

```text
data: {"id":"chatcmpl_xxx","choices":[{"delta":{"content":"你"}}]}

data: {"id":"chatcmpl_xxx","choices":[{"delta":{"content":"好"}}]}

data: [DONE]
```

**curl 示例 — API Key**

```bash
curl -X POST 'https://<host>/v1/chat/completions' \
  -H 'Authorization: Bearer <plainSecret>' \
  -H 'Content-Type: application/json' \
  -H 'X-Trace-Id: <traceId>' \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"你好"}],"stream":false}'
```

**curl 示例 — Session**

```bash
curl -X POST 'https://<host>/api/v1/admin/model/chat/completions' \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'X-Biz-Code: workflow_ui_llm' \
  -H 'Content-Type: application/json' \
  -H 'X-Trace-Id: <traceId>' \
  -d '{"messages":[{"role":"user","content":"润色这段提示词"}],"stream":false}'
```

### 10.7 Embeddings

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `POST` | `POST` |
| 路径 | `/v1/embeddings` | `/api/v1/admin/model/embeddings` |
| Body | `application/json`（OpenAI embeddings 兼容） | 同左；需 `X-Biz-Code`，scene=`embedding` |
| 形态 | 同步 JSON | 同左 |

请求体示例（OpenAI 兼容）：

```json
{
  "model": "text-embedding-3-small",
  "input": "hello world"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `model` | 视路由/白名单 | 平台基础模型编码 |
| `input` | 是 | 字符串，或字符串数组 |

成功响应（OpenAI embeddings 形态）：

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.01, -0.02]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 2,
    "total_tokens": 2
  }
}
```

### 10.8 Images Generations

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `POST` | `POST` |
| 路径 | `/v1/images/generations` | `/api/v1/admin/model/images/generations` |
| Body | `application/json` | 同左；scene=`image_generation` |
| 形态 | 同步 JSON | 同左 |

请求体示例：

```json
{
  "model": "dall-e-3",
  "prompt": "a white siamese cat",
  "n": 1,
  "size": "1024x1024"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `model` | 视路由/白名单 | 平台基础模型编码 |
| `prompt` | 是 | 生成描述 |
| `n` | 否 | 张数，整数 ≥ 1，默认 1；上限以该模型能力为准 |
| `size` | 否 | 分辨率，如 `1024x1024`；枚举以该模型能力为准 |

成功响应（OpenAI 图像形态）：

```json
{
  "created": 1782202149,
  "data": [
    { "url": "https://<cdn>/xxx.png" }
  ]
}
```

创建接口在生成完成后返回上述结构；耗时可能较长。失败时返回业务错误。

### 10.9 Audio

#### 10.9.1 Speech（合成）

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `POST` | `POST` |
| 路径 | `/v1/audio/speech` | `/api/v1/admin/model/audio/speech` |
| Body | `application/json` | scene=`audio_synthesis` |

请求体示例：

```json
{
  "model": "tts-1",
  "input": "今天天气不错",
  "voice": "alloy"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `model` | 视路由/白名单 | 平台基础模型编码 |
| `input` | 是 | 待合成文本 |
| `voice` | 否 | 音色；取值以该模型能力为准 |

响应：多为音频二进制流（Content-Type 以响应头为准），或错误时的 JSON。

#### 10.9.2 Transcriptions（转写）

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `POST` | `POST` |
| 路径 | `/v1/audio/transcriptions` | `/api/v1/admin/model/audio/transcriptions` |
| Body | `multipart/form-data` | scene=`audio_transcription` |

| 字段 | 必填 | 说明 |
|------|------|------|
| `file` | 是 | 音频文件 |
| `model` | 视路由/白名单 | 平台基础模型编码 |
| `language` | 否 | 语言码等 OpenAI 兼容字段 |

成功响应为 OpenAI transcription JSON（常见为 `{ "text": "..." }`）。

### 10.10 Videos（异步协议）

对齐 OpenAI Videos：创建 → 轮询状态 → 下载成片 → 删除。  
**计费发生在创建（POST）**；`GET` / `DELETE` 后续操作不计费，但仍需对应入口鉴权（Session 仍要 `X-Biz-Code` 且 scene=`video_generation`）。

> 本节为 ModelHub 视频推理接口。工作流派发见 [第 6 章](#6-工作流派发与任务状态) `POST /api/scheduler/dispatch`。

#### 10.10.1 创建任务

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `POST` | `POST` |
| 路径 | `/v1/videos` | `/api/v1/admin/model/videos` |
| Body | `application/json` **或** `multipart/form-data`（按 Content-Type 自动识别） | 同左 |

JSON 示例（常见字段，具体以开通模型为准）：

```json
{
  "model": "sora-xxx",
  "prompt": "一只猫咪在草地上奔跑",
  "seconds": 4,
  "size": "1280x720"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `model` | 视路由/白名单 | 平台基础模型编码 |
| `prompt` | 文生视频时是 | 文本描述；也可用 `input` |
| `seconds` | 否 | 时长（秒）；也可用 `duration`。上下限以该模型能力为准 |
| `size` | 否 | 分辨率；枚举以该模型能力为准 |
| 参考图 | 图生视频时按能力 | JSON 可传 `image` / `image_url` / `first_frame` / `last_frame` 等 URL；本地文件用 multipart |

创建成功后返回任务对象（见 [10.1.4](#1014-异步任务状态)）。请保存 `id`。`status` 可能为 `queued`，也可能已是 `completed`；建议再 `GET` 一次后再下载。

```json
{
  "id": "video_xxx",
  "object": "video",
  "status": "queued",
  "progress": 0
}
```

#### 10.10.2 查询状态

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `GET` | `GET` |
| 路径 | `/v1/videos/{videoId}` | `/api/v1/admin/model/videos/{videoId}` |
| 计费 | 否 | 否 |

响应形态与创建成功相同：`id` / `object` / `status` / `progress`，失败时带 `error.message`。`status` 取值见 [10.1.4](#1014-异步任务状态)。

#### 10.10.3 下载成片

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `GET` | `GET` |
| 路径 | `/v1/videos/{videoId}/content` | `/api/v1/admin/model/videos/{videoId}/content` |
| 计费 | 否 | 否 |

响应：视频二进制流（`Content-Type: video/mp4`），或错误时的 JSON。请在 `status=completed` 后再调用。

#### 10.10.4 删除任务

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `DELETE` | `DELETE` |
| 路径 | `/v1/videos/{videoId}` | `/api/v1/admin/model/videos/{videoId}` |
| 计费 | 否 | 否 |

删除成功示例：

```json
{
  "id": "video_xxx",
  "object": "video",
  "deleted": true
}
```

### 10.11 3D Generations

| 项 | API Key | Session |
|----|---------|---------|
| 方法 | `POST` | `POST` |
| 路径 | `/v1/3d/generations` | `/api/v1/admin/model/3d/generations` |
| Body | `application/json` | 同左；scene=`three_d_generation` |
| 形态 | 同步 JSON | 同左 |

请求体示例：

```json
{
  "model": "tripo-xxx",
  "prompt": "一个陶瓷花瓶，写实风格"
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `model` | 视路由/白名单 | 平台基础模型编码 |
| `prompt` | 是 | 生成描述；也可用 `input` |
| 其它 | 否 | 该 3D 模型能力声明允许的键 |

成功响应为同步 JSON，结构以该模型实际返回为准。错误见 10.12。

### 10.12 错误、计费与对接注意

**错误响应**

- 参数/权限/业务校验失败：多为统一结构（`code` / `message` / `trace`，见 2.3）  
- 模型侧错误：可能返回 OpenAI 兼容错误 JSON  

**计费**

- Chat / Embedding：按 token 用量结算  
- 3D：按该模型定价结算（多为 token；以开通配置为准）  
- 图像 / 音频 / 视频创建：按对应计费规则结算  
- 视频状态查询、下载、删除：不计费  

**对接检查清单**

1. API Key：使用创建/轮换返回的 `plainSecret`，且状态为 `active`  
2. Session：Token 有效；`X-Biz-Code` 已开通且与路径场景一致  
3. Session 路径前缀为 `/api/v1/admin/model`  
4. 请求体使用本章列出的字段  
5. 流式：按 SSE `data:` 行解析，直到 `[DONE]`  
6. 图像：按 `{ created, data:[{ url }] }` 解析  
7. 视频：保存创建返回的 `id`，`status=completed` 后再下载 `/content`  
8. 3D：`POST /v1/3d/generations`（Session 为 `/api/v1/admin/model/3d/generations`）
