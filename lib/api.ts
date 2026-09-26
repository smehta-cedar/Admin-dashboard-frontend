/*
 * The one way the frontend talks to the Django API. Only the Next server
 * calls this: server components, server actions and the proxy. The browser
 * never holds a token and never talks to Django directly, so there is no
 * CORS to configure and nothing for a script on the page to steal.
 *
 * Every response from the API is an envelope:
 *
 *   success  { "success": true,  "message": "...", "data": ..., "meta"?: ... }
 *   failure  { "success": false, "message": "...", "code": "...", "errors": {...} | null }
 *
 * apiRequest never throws for an HTTP error; it returns the failure so the
 * caller can branch on `code` (e.g. "invalid_credentials", "account_blocked",
 * "token_not_valid", "throttled"). A network failure comes back as status 0
 * with code "network_error".
 */

/** Base URL of the API, including the version prefix. Set API_URL in .env.local. */
export const API_URL = (process.env.API_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/+$/, "");

export type ApiOk<T> = {
  ok: true;
  status: number;
  message: string;
  data: T;
  meta?: unknown;
};

export type ApiFailure = {
  ok: false;
  status: number;
  message: string;
  code: string;
  /** Field errors from a 400, e.g. { email: ["Enter a valid email address."] }. */
  errors: Record<string, string[]> | null;
};

export type ApiResult<T> = ApiOk<T> | ApiFailure;

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON-encoded into the request. */
  body?: unknown;
  /** Bearer access token for endpoints that need a signed-in user. */
  token?: string | null;
};

/** The pair the API issues on login, refresh and password change. */
export type TokenPair = { access: string; refresh: string };

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<ApiResult<T>> {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Auth-bound responses are per user and per moment; never reuse one.
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      code: "network_error",
      message: "Can't reach the server. Please try again.",
      errors: null,
    };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A non-JSON body (a proxy error page, an empty 204) falls through to the status-only branches.
  }
  const envelope = (payload ?? {}) as {
    success?: boolean;
    message?: string;
    data?: T;
    meta?: unknown;
    code?: string;
    errors?: Record<string, string[]> | null;
  };

  if (response.ok && envelope.success !== false) {
    return {
      ok: true,
      status: response.status,
      message: envelope.message ?? "",
      data: envelope.data as T,
      meta: envelope.meta,
    };
  }

  return {
    ok: false,
    status: response.status,
    code: envelope.code ?? (response.status === 429 ? "throttled" : `http_${response.status}`),
    message: envelope.message ?? "Something went wrong. Please try again.",
    errors: envelope.errors ?? null,
  };
}
