import { apiFetch } from "@/shared/api/sys/http";

function isAsciiText(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 0x7f) {
      return false;
    }
  }
  return true;
}

export async function translateText(text: string): Promise<string> {
  // 如果文本为空，直接返回
  if (!text || !text.trim()) {
    return text;
  }

  // 检测是否为纯英文（包含基础 ASCII 字符）
  // 如果全为 ASCII 字符，则认为不需要翻译，直接返回原文本
  if (isAsciiText(text)) {
    return text;
  }

  return apiFetch<string>("/api/admin/translation/translate", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
