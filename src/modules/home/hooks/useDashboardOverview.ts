import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDashboardOverview,
  refreshDashboardOverview,
  type DashboardOverview,
  type DashboardRangeDays,
} from "@/shared/api/ops/dashboard";

export const dashboardOverviewQueryKey = (rangeDays: DashboardRangeDays) =>
  ["ops", "dashboard", "overview", rangeDays] as const;

/** Align with backend Redis TTL to avoid stampede + redundant polls. */
export const DASHBOARD_STALE_MS = 45_000;

export function useDashboardOverview(rangeDays: DashboardRangeDays) {
  return useQuery({
    queryKey: dashboardOverviewQueryKey(rangeDays),
    queryFn: () => getDashboardOverview(rangeDays),
    staleTime: DASHBOARD_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useDashboardOverviewActions(rangeDays: DashboardRangeDays) {
  const queryClient = useQueryClient();

  return {
    async refresh(): Promise<DashboardOverview> {
      const data = await refreshDashboardOverview(rangeDays);
      queryClient.setQueryData(dashboardOverviewQueryKey(rangeDays), data);
      return data;
    },
  };
}
