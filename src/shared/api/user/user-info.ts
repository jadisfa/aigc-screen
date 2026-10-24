import { apiFetch } from "@/shared/api/sys/http";

export type AddBalanceCommand = {
  amount: number;
  reason?: string;
  validDays?: number | null;
};

export async function getAccountBalance(ownerType: string, ownerId: string): Promise<{ balance: number }> {
  return apiFetch<{ balance: number }>(`/api/admin/fund/accounts/${ownerType}/${ownerId}/balance`, {
    method: "GET",
  });
}

export async function addAccountBalance(ownerType: string, ownerId: string, cmd: AddBalanceCommand): Promise<void> {
  return apiFetch<void>(`/api/admin/fund/accounts/${ownerType}/${ownerId}/balance`, {
    method: "POST",
    body: JSON.stringify(cmd),
  });
}
