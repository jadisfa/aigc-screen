import { apiFetch } from "@/shared/api/sys/http";

export type UserSession = {
  [key: string]: string;
};

// 获取当前用户会话信息
export async function getUserSession(): Promise<UserSession> {
  return apiFetch<UserSession>(`/api/store-ops/ums/me`, {
    method: "GET",
  });
}
