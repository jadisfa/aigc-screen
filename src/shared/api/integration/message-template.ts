import { apiFetch } from "@/shared/api/sys/http";
import { buildPageSearchParams } from "@/shared/api/sys/paging";

export type PageResult = {
  pageNo: number;
  pageSize: number;
  total: number;
};

export type MessageTemplate = {
  id: string;
  templateCode: string;
  templateName: string;
  templateType: string;
  region: string;
  externalTemplateId: string | null;
  content: string;
  /** 本模板启用的变量键序；接口字段也可能是 variablesJson 字符串 */
  variables?: string[];
  variablesJson?: string | string[] | null;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type VariableItem = {
  key: string;
  name: string;
  description: string;
};

export type VariableDict = Record<string, VariableItem>;

export type CreateMessageTemplateCommand = {
  templateCode: string;
  templateName: string;
  templateType: string;
  region: string;
  externalTemplateId?: string | null;
  content: string;
  variables?: string[];
};

export type UpdateMessageTemplateCommand = Partial<CreateMessageTemplateCommand>;

export function parseMessageTemplateVariables(source?: {
  variables?: string[] | null;
  variablesJson?: string | string[] | null;
}): string[] {
  if (Array.isArray(source?.variables)) {
    return source.variables.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  const raw = source?.variablesJson;
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? "").trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return [];
}

export async function listMessageTemplates(params: {
  pageNo: number;
  pageSize: number;
  total?: number;
  templateType?: string;
  templateCode?: string;
  region?: string;
  keyword?: string;
}): Promise<{ page: PageResult; items: MessageTemplate[] }> {
  const qs = buildPageSearchParams(params);
  if (params.templateType) qs.set("templateType", params.templateType);
  if (params.templateCode) qs.set("templateCode", params.templateCode);
  if (params.region) qs.set("region", params.region);
  if (params.keyword) qs.set("keyword", params.keyword);

  return apiFetch<{ page: PageResult; items: MessageTemplate[] }>(`/api/admin/int/messageTemplate?${qs.toString()}`, { method: "GET" });
}

export async function getMessageTemplate(id: string): Promise<MessageTemplate> {
  return apiFetch<MessageTemplate>(`/api/admin/int/messageTemplate/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createMessageTemplate(cmd: CreateMessageTemplateCommand): Promise<string> {
  return apiFetch<string>("/api/admin/int/messageTemplate", { method: "POST", body: JSON.stringify(cmd) });
}

export async function updateMessageTemplate(id: string, cmd: UpdateMessageTemplateCommand): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/messageTemplate/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(cmd) });
}

export async function deleteMessageTemplate(id: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/messageTemplate/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listMessageTemplateVariables(params: { templateType?: string; templateCode: string }): Promise<VariableDict>;
export function listMessageTemplateVariables(params?: {
  templateType?: string;
  templateCode?: undefined;
}): Promise<Record<string, VariableItem[]> | VariableItem[]>;
export async function listMessageTemplateVariables(params?: {
  templateType?: string;
  templateCode?: string;
}): Promise<Record<string, VariableItem[]> | VariableItem[] | VariableDict> {
  const qs = new URLSearchParams();
  if (params?.templateType) qs.set("templateType", params.templateType);
  if (params?.templateCode) qs.set("templateCode", params.templateCode);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch<Record<string, VariableItem[]> | VariableItem[] | VariableDict>(`/api/admin/int/messageTemplate/variables${suffix}`, {
    method: "GET",
  });
  if (!params?.templateCode) return res;

  if (Array.isArray(res)) {
    const entries = res.map((v) => [v.key, v] as const);
    return Object.fromEntries(entries);
  }

  if (!res || typeof res !== "object") return {};

  const entries = Object.entries(res).map(([key, v]) => {
    if (v && typeof v === "object" && "name" in v && "description" in v) {
      const item = v as Partial<VariableItem>;
      return [key, { key, name: item.name ?? "", description: item.description ?? "" }] as const;
    }
    return [key, { key, name: "", description: "" }] as const;
  });
  return Object.fromEntries(entries);
}
