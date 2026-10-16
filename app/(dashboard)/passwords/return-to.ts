/*
 * Where the password form pages go back to, from their search params.
 * `from=agent` returns to that agent's profile; otherwise the Passwords list,
 * keeping its filters when it had them: the carrier table's `agent=` and
 * `carrier=`, the site table's `siteAgent=` and `site=`.
 */

type Param = string | string[] | undefined;

const one = (value: Param) => (Array.isArray(value) ? value[0] : value) ?? "";

/** The Passwords list's filters, as search params. */
export type ListFilters = { agent?: Param; carrier?: Param; siteAgent?: Param; site?: Param };

const FILTER_PARAMS = ["agent", "carrier", "siteAgent", "site"] as const;

/** The Passwords list with the given filters; empty ones are left out. */
export function passwordsListHref(filters: ListFilters): string {
  const params = new URLSearchParams();
  for (const name of FILTER_PARAMS) if (one(filters[name])) params.set(name, one(filters[name]));
  const query = params.toString();
  return query ? `/passwords?${query}` : "/passwords";
}

export function passwordReturnTo(from: Param, filters: ListFilters): string {
  const agentId = one(filters.agent);
  if (one(from) === "agent" && agentId) return `/agents/${encodeURIComponent(agentId)}`;
  return passwordsListHref(filters);
}
