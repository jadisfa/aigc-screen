import { apiFetch } from "@/shared/api/sys/http";

export type DispatchStrategyConfigView = {
  scope: "global" | "server" | string;
  serverId: string | null;
  configJson: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type DispatchStrategyEffectiveConfigView = {
  serverId: string;
  globalConfigJson: string;
  overrideConfigJson: string | null;
  effectiveConfigJson: string;
};

export type DispatchStrategyOptionItem = {
  value: string;
  label: string;
};

export type DispatchStrategyOptionsResponse = {
  serverPickStrategies: DispatchStrategyOptionItem[];
  claimOrderStrategies: DispatchStrategyOptionItem[];
};

export async function getDispatchStrategyGlobalConfig(): Promise<DispatchStrategyConfigView> {
  return apiFetch<DispatchStrategyConfigView>("/api/admin/int/dispatchStrategyConfig/global", { method: "GET" });
}

export async function getDispatchStrategyConfigOptions(): Promise<DispatchStrategyOptionsResponse> {
  return apiFetch<DispatchStrategyOptionsResponse>("/api/admin/int/dispatchStrategyConfig/options", { method: "GET" });
}

export async function updateDispatchStrategyGlobalConfig(configJson: string): Promise<boolean> {
  return apiFetch<boolean>("/api/admin/int/dispatchStrategyConfig/global", {
    method: "PUT",
    body: JSON.stringify({ configJson }),
  });
}

export async function getDispatchStrategyEffectiveConfigForServer(serverId: string): Promise<DispatchStrategyEffectiveConfigView> {
  return apiFetch<DispatchStrategyEffectiveConfigView>(`/api/admin/int/dispatchStrategyConfig/servers/${encodeURIComponent(serverId)}`, { method: "GET" });
}

export async function updateDispatchStrategyServerOverride(serverId: string, configJson: string): Promise<boolean> {
  return apiFetch<boolean>(`/api/admin/int/dispatchStrategyConfig/servers/${encodeURIComponent(serverId)}`, {
    method: "PUT",
    body: JSON.stringify({ configJson }),
  });
}
