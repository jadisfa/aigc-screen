import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/shared/api/auth/auth";
import { getMePermissions } from "@/shared/api/ums/iam";
import { CONSOLE_SOURCE_CODE } from "@/shared/lib/permissions";

export function getMePermissionsQueryKey(token: string | null | undefined, sourceCode: string = CONSOLE_SOURCE_CODE) {
  return ["mePermissions", sourceCode, token ?? null] as const;
}

export function useMePermissions(options?: { sourceCode?: string }) {
  const token = getAccessToken();
  const sourceCode = options?.sourceCode ?? CONSOLE_SOURCE_CODE;

  const query = useQuery({
    queryKey: getMePermissionsQueryKey(token, sourceCode),
    queryFn: () => getMePermissions(),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  return query;
}
