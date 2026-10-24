/**
 * Resolve browser API origin without baking http/https into the production bundle.
 *
 * Priority:
 * 1. `VITE_API_BASE_URL` when set
 *    - absolute: `https://api.example.com`
 *    - protocol-relative: `//api.example.com` (follows current page protocol)
 * 2. Browser same-origin: `window.location.origin` (production default)
 * 3. Vite DEV fallback: `http://localhost:8080`
 * 4. Non-browser / empty fallback: `""` (relative paths)
 */
export function getApiBaseUrl(): string {
  const configured = normalizeConfiguredBase(import.meta.env.VITE_API_BASE_URL);
  if (configured !== null) {
    return configured;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    if (import.meta.env.DEV) {
      return "http://localhost:8080";
    }
    return stripTrailingSlash(window.location.origin);
  }

  if (import.meta.env.DEV) {
    return "http://localhost:8080";
  }
  return "";
}

/**
 * Convert an HTTP(S) API base into the matching WebSocket base (ws/wss).
 * Empty/relative bases follow the current page host + protocol.
 */
export function toWebSocketBaseUrl(httpBase: string = getApiBaseUrl()): string {
  const base = (httpBase ?? "").trim();
  if (base.startsWith("https://")) {
    return `wss://${base.slice("https://".length)}`;
  }
  if (base.startsWith("http://")) {
    return `ws://${base.slice("http://".length)}`;
  }
  if (base.startsWith("//")) {
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}${base}`;
  }
  if (typeof window !== "undefined" && window.location?.host) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }
  return base;
}

function normalizeConfiguredBase(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("//")) {
    if (typeof window !== "undefined" && window.location?.protocol) {
      return stripTrailingSlash(`${window.location.protocol}${value}`);
    }
    // Non-browser callers cannot resolve protocol-relative URLs.
    return null;
  }

  return stripTrailingSlash(value);
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
