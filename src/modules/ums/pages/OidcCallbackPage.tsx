import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAccessToken } from "@/shared/api/auth/auth";
import { getApiBaseUrl } from "@/shared/api/sys/api-base";
import { notify } from "@/shared/lib/notify";

function getBaseUrl(): string {
  return getApiBaseUrl();
}

function getSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeSession(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    return;
  }
}

export default function OidcCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    const expectedState = getSession("oidc_state");
    const verifier = getSession("pkce_verifier");

    removeSession("oidc_state");
    removeSession("pkce_verifier");

    if (!code || !state || !expectedState || state !== expectedState || !verifier) {
      notify.error("登录回调校验失败");
      navigate("/login", { replace: true });
      return;
    }

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", "aigc-admin-web");
    body.set("code", code);
    body.set("redirect_uri", "http://localhost:5173/auth/callback");
    body.set("code_verifier", verifier);

    fetch(`${getBaseUrl()}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => undefined);
        if (!res.ok) {
          const payload = (json && typeof json === "object") ? (json as Record<string, unknown>) : {};
          const msg =
            typeof payload.error_description === "string"
              ? payload.error_description
              : typeof payload.error === "string"
                ? payload.error
                : "token exchange failed";
          throw new Error(msg);
        }
        return json as { access_token: string };
      })
      .then((token) => {
        setAccessToken(token.access_token);
        // 离开当前页：成功不弹 Toast
        navigate("/", { replace: true });
      })
      .catch((e) => {
        notify.error(e instanceof Error ? e.message : "登录失败");
        navigate("/login", { replace: true });
      });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground text-sm">正在完成登录...</div>
    </div>
  );
}
