import "server-only";

/*
 * apiRequest (lib/api.ts) with the signed-in user's access token, for server
 * components, server actions and the data modules that read the Django API.
 * The token comes from the HttpOnly cookie (lib/auth-cookies.ts), which only
 * the Next server can read; by the time anything here runs, the proxy has
 * already refreshed an expiring one.
 *
 * The data modules (lib/carriers.ts, …) call apiGet / apiGetAll and let a
 * failure throw: a list page that can't reach the API, or a user whose role
 * can't see the module, is an error the page shows rather than an empty
 * table that looks like "no records". Server actions call apiFetch and
 * branch on the result themselves, so a 400's field errors reach the form.
 */

import { cookies } from "next/headers";
import { apiRequest, type ApiFailure, type ApiResult } from "@/lib/api";
import { ACCESS_COOKIE } from "@/lib/auth-cookies";

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Query string values; undefined and "" are left out. */
  params?: Record<string, string | number | boolean | undefined>;
};

/** An API failure a data module could not handle. `code` is the API's (e.g. "permission_denied"). */
export class ApiError extends Error {
  status: number;
  code: string;
  errors: Record<string, string[]> | null;

  constructor(path: string, failure: ApiFailure) {
    super(`${failure.message} (${failure.code}, ${path})`);
    this.name = "ApiError";
    this.status = failure.status;
    this.code = failure.code;
    this.errors = failure.errors;
  }
}

/** The signed-in user's access token, or null when there is no cookie. */
export async function accessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE)?.value ?? null;
}

function withParams(path: string, params: ApiFetchOptions["params"]): string {
  if (!params) return path;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${path}${path.includes("?") ? "&" : "?"}${text}` : path;
}

/** apiRequest as the signed-in user. Never throws; the caller branches on `ok`. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> {
  const { method, body, params } = options;
  return apiRequest<T>(withParams(path, params), { method, body, token: await accessToken() });
}

/** GET one resource; throws ApiError on any failure. */
export async function apiGet<T>(path: string, params?: ApiFetchOptions["params"]): Promise<T> {
  const result = await apiFetch<T>(path, { params });
  if (!result.ok) throw new ApiError(path, result);
  return result.data;
}

/** The page numbers a paginated list answers with (StandardPagination's meta). */
type PageMeta = { page: number; total_pages: number };

/** Every page of a paginated list, in API order; throws ApiError on any failure. */
export async function apiGetAll<T>(path: string, params?: ApiFetchOptions["params"]): Promise<T[]> {
  const items: T[] = [];
  const pageSize = 100; // the API's maximum
  let page = 1;
  for (;;) {
    const result = await apiFetch<T[]>(path, { params: { ...params, page, page_size: pageSize } });
    if (!result.ok) throw new ApiError(path, result);
    items.push(...result.data);
    const meta = result.meta as PageMeta | undefined;
    if (!meta || meta.page >= meta.total_pages) return items;
    page = meta.page + 1;
  }
}

/**
 * The list, or null when the role can't see that module (a 403). For a
 * related list on another entity's page (certifications on an agent
 * profile), where the page should hide the section rather than fail. Any
 * other failure still throws.
 */
export async function allowForbidden<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  }
}
