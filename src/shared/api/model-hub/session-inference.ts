import { clearAuthSession, getAccessToken } from "@/shared/api/auth/auth";
import { tryRefreshToken } from "@/shared/api/auth/token-refresh";
import { HttpError, type TraceMetadata } from "@/shared/api/sys/http";
import { getApiBaseUrl } from "@/shared/api/sys/api-base";
import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";
import { BIZ_CAPABILITY_CODES, type BizCapabilityCode } from "@/shared/lib/biz-capability-codes";
import { notify } from "@/shared/lib/notify";

export type SessionChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type SessionChatCompletionRequest = {
  model?: string;
  messages: SessionChatMessage[];
  temperature?: number;
  stream?: boolean;
};

const SESSION_CHAT_PATH = "/api/v1/admin/model/chat/completions";

function getBaseUrl(): string {
  return getApiBaseUrl();
}

function createTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bearerAuthorization(token: string | null): string | null {
  if (!token) return null;
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
}

function parseErrorBody(body: unknown, status: number, statusText: string, headerTraceId?: string | null): HttpError {
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { code?: string; message?: string; data?: unknown; trace?: TraceMetadata })
      : null;
  const trace =
    payload?.trace && typeof payload.trace.traceId === "string"
      ? payload.trace
      : headerTraceId
        ? { traceId: headerTraceId, requestedAt: "" }
        : undefined;
  const message = resolveUserErrorMessage(
    {
      status,
      body,
      trace,
      traceId: trace?.traceId,
      message: typeof payload?.message === "string" ? payload.message : "",
    },
    statusText || "请求失败"
  );
  return new HttpError(status, message, body, trace);
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => undefined);
  }
  return response.text().catch(() => undefined);
}

function handleUnauthorized(): void {
  clearAuthSession();
  notify.error("登录已过期，请重新登录");
  if (typeof window !== "undefined") {
    window.dispatchEvent(
        new CustomEvent('openLogin', {
          detail: { value: true },
        })
      );
    // window.location.replace("/login");
  }
}

/**
 * 流式会话推理：鉴权 / 业务编码 / Trace / 401 刷新后重试；错误抛出 HttpError 供友好提示。
 */
export async function sessionChatCompletionsStream(
  cmd: SessionChatCompletionRequest,
  onToken: (token: string) => void,
  bizCode: BizCapabilityCode | string = BIZ_CAPABILITY_CODES.WORKFLOW_UI_LLM
): Promise<void> {
  const payload = JSON.stringify({ ...cmd, stream: true });

  const doRequest = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: "text/event-stream, application/json",
      "Content-Type": "application/json",
      "X-Trace-Id": createTraceId(),
      "X-Biz-Code": bizCode,
    };
    const authorization = bearerAuthorization(getAccessToken());
    if (authorization) {
      headers.Authorization = authorization;
    }
    return fetch(`${getBaseUrl()}${SESSION_CHAT_PATH}`, {
      method: "POST",
      headers,
      body: payload,
    });
  };

  let response = await doRequest();
  if (response.status === 401) {
    const refreshOutcome = await tryRefreshToken(true);
    if (refreshOutcome === "success") {
      response = await doRequest();
    } else if (refreshOutcome === "transient") {
      throw new HttpError(401, "网络异常，登录态暂未刷新，请稍后重试");
    } else {
      handleUnauthorized();
      throw parseErrorBody(await readErrorBody(response), 401, response.statusText, response.headers.get("X-Trace-Id"));
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized();
    }
    throw parseErrorBody(
      await readErrorBody(response),
      response.status,
      response.statusText,
      response.headers.get("X-Trace-Id")
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new HttpError(500, "无法读取模型流式响应，请稍后重试");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 2);
      if (!chunk.startsWith("data: ")) continue;

      const dataStr = chunk.slice(6);
      if (dataStr === "[DONE]") return;

      try {
        const data = JSON.parse(dataStr) as {
          choices?: Array<{ delta?: { content?: string } }>;
          error?: { message?: string; code?: string };
          code?: string;
          message?: string;
        };
        if (data.error || (data.code && data.message && !data.choices)) {
          throw parseErrorBody(data, 500, data.error?.message || data.message || "流式推理失败");
        }
        const content = data.choices?.[0]?.delta?.content;
        if (content) onToken(content);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        console.error("SSE JSON 解析失败", error, dataStr);
      }
    }
  }
}
