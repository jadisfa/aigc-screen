
const SUCCESS_CODES = new Set(["0", "00000", "200", "OK", "SUCCESS"]);

function createTraceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `screen-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isSuccessCode(code) {
  return SUCCESS_CODES.has(String(code).toUpperCase());
}

function uniRequest(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: (res) => resolve(res),
      fail: (err) => reject(err),
    });
  });
}

export async function screenRequest(path, options = {}) {
  const method = options.method || "GET";
  const withAuth = options.withAuth !== false;
  const headers = {
    Accept: "application/json",
    "X-Trace-Id": createTraceId(),
  };
  if (options.data !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (withAuth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }
  }

  let response;
  try {
    response = await uniRequest({
      url: `${getApiBaseUrl()}${path}`,
      method,
      header: headers,
      data: options.data,
      timeout: 15000,
    });
  } catch (e) {
    const err = new Error("网络异常，请稍后重试");
    err.status = 0;
    throw err;
  }

  const status = response.statusCode || 0;
  if (status === 204) return undefined;

  const body = response.data && typeof response.data === "object" ? response.data : {};
  const code = body.code;
  if (status < 200 || status >= 300 || (code && !isSuccessCode(code))) {
    const err = new Error(body.message || "请求失败");
    err.status = status;
    err.code = code;
    throw err;
  }
  return body.data;
}


export function getApiBaseUrl() {
  // 用你项目里真实的 base url 逻辑
  // 例如：
  return "https://screen.marvelvision.com.cn";
  // 或者按环境区分：
  // const env = process.env.NODE_ENV;
  // return env === "development" ? "http://127.0.0.1:8080" : "https://screen.marvelvision.com.cn";
}

const SESSION_KEY = "screen.device.session";

function getAccessToken() {
  try {
    const raw = uni.getStorageSync(SESSION_KEY);
    if (!raw) return "";
    const session = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (session && session.accessToken) || "";
  } catch (e) {
    return "";
  }
}