/*
 * Where the password form pages go back to, from their search params.
 * `from=agent` returns to that agent's profile; otherwise the Passwords list,
 * keeping its filters (`agent=<id>` or `agent=agency`, and `carrier=<id>`)
 * when it had them.
 */

type Param = string | string[] | undefined;

const one = (value: Param) => (Array.isArray(value) ? value[0] : value) ?? "";

/** The Passwords list with the given filters; empty ones are left out. */
export function passwordsListHref(agent: Param, carrier?: Param): string {
  const params = new URLSearchParams();
  if (one(agent)) params.set("agent", one(agent));
  if (one(carrier)) params.set("carrier", one(carrier));
  const query = params.toString();
  return query ? `/passwords?${query}` : "/passwords";
}

export function passwordReturnTo(from: Param, agent: Param, carrier?: Param): string {
  const agentId = one(agent);
  if (one(from) === "agent" && agentId) return `/agents/${encodeURIComponent(agentId)}`;
  return passwordsListHref(agent, carrier);
}
