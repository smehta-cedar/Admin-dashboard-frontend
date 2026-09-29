import "server-only";

/*
 * Records behind the navbar search's suggestions, one list per search scope
 * (a sidebar link marked `searchable`). Built on the server and handed to the
 * navbar, which matches it as the user types. Each entry's text mirrors its
 * list table's `searchText` columns, so the suggestions and the table agree.
 *
 * Everything here reaches the browser: portal and user passwords stay out,
 * the same way their table columns have no `searchText`.
 */

import { formatAddress } from "@/lib/address";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { getPasswords } from "@/lib/passwords";
import { phoneDigits } from "@/lib/phone";
import { SEARCH_PARAM, type SearchEntry, type SearchIndex } from "@/lib/search";
import { getUsers } from "@/lib/users";
import { US_STATE_NAMES, writableStates } from "@/lib/us-states";

const entry = (href: string, title: string, details: string[], text: string[]): SearchEntry => ({
  href,
  title,
  detail: details.filter(Boolean).join(" · "),
  text: text.join("\n").toLowerCase(),
});

/** A list page narrowed to one row: these words are that row's own. */
const listHref = (href: string, ...words: string[]) =>
  `${href}?${SEARCH_PARAM}=${encodeURIComponent(words.filter(Boolean).join(" "))}`;

/** A module the role can't see (a 403) searches as empty rather than failing the page. */
const orEmpty = async <T>(request: Promise<T[]>): Promise<T[]> => (await allowForbidden(request)) ?? [];

export async function getSearchIndex(): Promise<SearchIndex> {
  const [agents, carriers, passwords, contracts, users] = await Promise.all([
    orEmpty(getAgents()),
    orEmpty(getCarriers()),
    orEmpty(getPasswords()),
    orEmpty(getCarrierContracts()),
    orEmpty(getUsers()),
  ]);
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const carriersById = new Map(carriers.map((carrier) => [carrier.id, carrier]));

  return {
    "/agents": agents.map((agent) =>
      entry(
        `/agents/${agent.id}`,
        agent.name,
        [`NPN ${agent.npn}`, agent.email],
        [
          agent.id,
          agent.npn,
          agent.name,
          ...agent.aliases,
          agent.status,
          agent.email,
          agent.phone,
          phoneDigits(agent.phone),
          agent.personalEmail ?? "",
          agent.personalPhone ?? "",
          phoneDigits(agent.personalPhone ?? ""),
          formatAddress(agent.address),
        ],
      ),
    ),
    "/carriers": carriers.map((carrier) =>
      entry(
        `/carriers/${carrier.id}`,
        carrier.name,
        [carrier.linesOfBusiness.join(", ")],
        [
          carrier.id,
          carrier.name,
          ...carrier.aliases,
          ...carrier.linesOfBusiness,
          ...carrier.availableStates.flatMap((code) => [code, US_STATE_NAMES[code] ?? ""]),
          carrier.status,
        ],
      ),
    ),
    "/passwords": passwords.map((password) => {
      const agent = agentsById.get(password.agentId)?.name ?? `Agent ${password.agentId}`;
      const carrier = carriersById.get(password.carrierId)?.name ?? `Carrier ${password.carrierId}`;
      return entry(
        listHref("/passwords", agent, carrier),
        agent,
        [carrier, password.username],
        [agent, carrier, password.username, password.status],
      );
    }),
    "/contracts": contracts.flatMap((contract) => {
      const agent = agentsById.get(contract.agentId);
      if (!agent) return [];
      const carrier = carriersById.get(contract.carrierId);
      const carrierName = carrier?.name ?? `Carrier ${contract.carrierId}`;
      const states = writableStates(
        contract.appointedStates,
        agent.licensedStates,
        carrier?.availableStates ?? [],
      );
      return [
        entry(
          listHref("/contracts", agent.name, carrierName),
          agent.name,
          [carrierName, contract.writingNumber],
          [
            agent.name,
            carrierName,
            contract.writingNumber,
            ...states.flatMap((code) => [code, US_STATE_NAMES[code] ?? ""]),
          ],
        ),
      ];
    }),
    "/users": users.map((user) =>
      entry(listHref("/users", user.email), user.name, [user.email, user.role?.name ?? ""], [
        user.name,
        user.email,
        user.role?.name ?? "",
        user.status,
      ]),
    ),
  };
}
