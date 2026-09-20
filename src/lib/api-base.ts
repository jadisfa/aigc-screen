/**
 * Resolve API origin for the kiosk.
 *
 * 1. `VITE_API_BASE_URL` when set (absolute or protocol-relative)
 * 2. Current page origin (`window.location.origin`)
 * 3. Vite DEV without a browser: `http://localhost:8080`
 * 4. Otherwise relative `""`
 */
export function getApiBaseUrl(): string {
  const configured = normalizeConfiguredBase(import.meta.env.VITE_API_BASE_URL);
  if (configured !== null) {
    return configured;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }

  if (import.meta.env.DEV) {
    return "http://localhost:8080";
  }
  return "";
}

function normalizeConfiguredBase(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const value = raw.trim();
  if (!value) {
    return null;
  }
  if (value.startsWith("//")) {
    if (typeof window !== "undefined" && window.location?.protocol) {
      return stripTrailingSlash(`${window.location.protocol}${value}`);
    }
    return null;
  }
  return stripTrailingSlash(value);
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
