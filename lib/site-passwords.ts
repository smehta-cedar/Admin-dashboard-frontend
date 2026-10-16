import "server-only";

/*
 * Data boundary for sites and site passwords: reads the Django API
 * (backend/apps/passwords, `/api/v1/sites/` and `/api/v1/site-passwords/`)
 * as the signed-in user. Writes go through the server actions in
 * app/(dashboard)/passwords/site-actions.ts.
 *
 * A site is somewhere a portal login is used that isn't a carrier, e.g. a
 * quoting tool: a name, unique whatever its case, and an optional link. Sites
 * are added and edited from the site password form. A site password is one
 * agent's (or the agency's) login at one site, the counterpart of a carrier
 * password in lib/passwords.ts: one per agent at each site, and one for the
 * agency. Both live in the Passwords module (same permission); there is no
 * Sites page or list of their own. While a password's status is pending its
 * username and password may be blank. The portal password reaches the browser in the
 * page's props, like a carrier password's, never the search index.
 */

import { ApiError, apiFetch, apiGetAll } from "@/lib/api-server";
import type { PasswordStatus } from "@/lib/passwords";

export type SiteRecord = {
  /** The API's UUID. */
  id: string;
  name: string;
  /** The site's sign-in page, or "" when none. */
  link: string;
  /** Live site passwords at this site. */
  passwordCount: number;
};

export type SiteValues = Pick<SiteRecord, "name" | "link">;

export type SiteError = { field: "name" | "link" | "form"; message: string };

export type SitePasswordRecord = {
  /** The API's UUID. */
  id: string;
  /** Null on the agency's own password. */
  agentId: string | null;
  /** Set only on the agency's own password. */
  agencyId: string | null;
  /** The agent's (or the agency's) name as of the read. */
  agentName: string;
  siteId: string;
  siteName: string;
  /** The site's link as of the read; edited on the site, not here. */
  siteLink: string;
  /** Blank only while the status is pending. */
  username: string;
  /** Exactly as entered (not trimmed). */
  portalPassword: string;
  status: PasswordStatus;
};

/** Site password fields the form submits. */
export type SitePasswordField = Exclude<keyof SitePasswordRecord, "id" | "agentName" | "siteName" | "siteLink">;

export type SitePasswordValues = Pick<SitePasswordRecord, SitePasswordField>;

export type SitePasswordError = { field: SitePasswordField | "form"; message: string };

/** A site as the API serialises it (SiteSerializer). */
export type ApiSite = { id: string; name: string; link: string; password_count: number };

/** A site password as the API serialises it (SitePasswordSerializer). */
export type ApiSitePassword = {
  id: string;
  /** One of agent and agency is set, the other null. */
  agent: { id: string; name: string; is_active: boolean } | null;
  agency: { id: string; name: string; is_active: boolean } | null;
  site: { id: string; name: string; link: string };
  username: string;
  portal_password: string;
  status: string;
};

const STATUSES: readonly string[] = ["active", "pending", "inactive"] satisfies PasswordStatus[];

export function toSiteRecord(site: ApiSite): SiteRecord {
  return { id: site.id, name: site.name, link: site.link ?? "", passwordCount: site.password_count };
}

/** An API site password as the app holds it. An unknown status reads as "active". */
export function toSitePasswordRecord(password: ApiSitePassword): SitePasswordRecord {
  return {
    id: password.id,
    agentId: password.agent?.id ?? null,
    agencyId: password.agency?.id ?? null,
    agentName: (password.agent ?? password.agency)?.name ?? "",
    siteId: password.site.id,
    siteName: password.site.name,
    siteLink: password.site.link ?? "",
    username: password.username,
    portalPassword: password.portal_password,
    status: STATUSES.includes(password.status) ? (password.status as PasswordStatus) : "active",
  };
}

/** Every live site, by name. */
export async function getSites(): Promise<SiteRecord[]> {
  return (await apiGetAll<ApiSite>("/sites/")).map(toSiteRecord);
}

/** Every site password, by agent name then site name. */
export async function getSitePasswords(): Promise<SitePasswordRecord[]> {
  return (await apiGetAll<ApiSitePassword>("/site-passwords/")).map(toSitePasswordRecord);
}

/** One site password, or null when there is no such password. */
export async function getSitePassword(id: string): Promise<SitePasswordRecord | null> {
  const result = await apiFetch<ApiSitePassword>(`/site-passwords/${encodeURIComponent(id)}/`);
  if (!result.ok) {
    if (result.status === 404) return null;
    throw new ApiError(`/site-passwords/${id}/`, result);
  }
  return toSitePasswordRecord(result.data);
}
