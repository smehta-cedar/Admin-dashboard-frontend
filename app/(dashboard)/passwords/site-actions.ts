"use server";

/*
 * Add and edit sites, and add, edit and delete site passwords, run on the Next server so
 * the access token stays in its HttpOnly cookie. Same shape as ./actions.ts
 * (carrier passwords): a 400's field errors go under their fields, a 401
 * goes back to sign in, anything else goes under the form. On success the
 * dashboard is revalidated, so the Passwords page and the navbar search
 * show the change.
 *
 *   POST /sites/create/            PATCH /sites/{id}/
 *   POST /site-passwords/create/   PATCH / DELETE /site-passwords/{id}/
 *
 * The API keeps site names unique whatever their case, one site password
 * per agent (and one for the agency) at each site, and lets a username and
 * password be blank only while the status is pending.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ApiFailure } from "@/lib/api";
import { apiFetch } from "@/lib/api-server";
import {
  toSitePasswordRecord,
  toSiteRecord,
  type ApiSite,
  type ApiSitePassword,
  type SiteError,
  type SitePasswordError,
  type SitePasswordRecord,
  type SitePasswordValues,
  type SiteRecord,
  type SiteValues,
} from "@/lib/site-passwords";

/** A failed result's errors, each under the form field `fields` maps it to, else under the form. */
function errorsOf<F extends string>(result: ApiFailure, fields: Record<string, F>) {
  // The session is gone (revoked, blocked); the dashboard gate would bounce the next page anyway.
  if (result.status === 401) redirect("/login");
  if (result.code === "invalid" && result.errors) {
    const errors = Object.entries(result.errors).map(([apiField, messages]) => ({
      field: fields[apiField] ?? ("form" as const),
      message: messages[0],
    }));
    if (errors.length > 0) return errors;
  }
  return [{ field: "form" as const, message: result.message }];
}

/** Adds a site, or edits the one with `editingId` (name and link). */
export async function saveSite(
  values: SiteValues,
  editingId?: string,
): Promise<{ ok: true; site: SiteRecord } | { ok: false; errors: SiteError[] }> {
  const body = { name: values.name, link: values.link };
  const result = editingId
    ? await apiFetch<ApiSite>(`/sites/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiSite>("/sites/create/", { method: "POST", body });
  if (!result.ok) return { ok: false, errors: errorsOf(result, { name: "name", link: "link" }) };
  revalidatePath("/", "layout");
  return { ok: true, site: toSiteRecord(result.data) };
}

const SITE_PASSWORD_ERROR_FIELDS: Record<string, SitePasswordError["field"]> = {
  agent_id: "agentId",
  agency_id: "agentId",
  site_id: "siteId",
  username: "username",
  portal_password: "portalPassword",
  status: "status",
};

/** Adds a site password, or edits the one with `editingId`. */
export async function saveSitePassword(
  values: SitePasswordValues,
  editingId?: string,
): Promise<{ ok: true; password: SitePasswordRecord } | { ok: false; errors: SitePasswordError[] }> {
  const body = {
    // One of the two is null: an agent's password, or the agency's.
    agent_id: values.agentId,
    agency_id: values.agencyId,
    site_id: values.siteId,
    username: values.username,
    portal_password: values.portalPassword,
    status: values.status,
  };
  const result = editingId
    ? await apiFetch<ApiSitePassword>(`/site-passwords/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiSitePassword>("/site-passwords/create/", { method: "POST", body });
  if (!result.ok) return { ok: false, errors: errorsOf(result, SITE_PASSWORD_ERROR_FIELDS) };
  revalidatePath("/", "layout");
  return { ok: true, password: toSitePasswordRecord(result.data) };
}

/** Removes a site password. The API soft-deletes it, so the pair is free again. */
export async function deleteSitePassword(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await apiFetch<null>(`/site-passwords/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!result.ok) return { ok: false, message: errorsOf(result, {})[0].message };
  revalidatePath("/", "layout");
  return { ok: true };
}
