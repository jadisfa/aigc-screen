import { resolveUserErrorMessage } from "@/shared/api/sys/error-message";

export function resolveModelHubErrorMessage(error: unknown, fallback: string): string {
  return resolveUserErrorMessage(error, fallback);
}

export function formatModelHubDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
