import "server-only";

/*
 * Records across every module, picked by status, for the Pending and Archive
 * pages. No permission of its own: a section is built only when the role can
 * see its module, and reads only that API. Rows link to the list page the
 * record lives in when the role can open it.
 */

import type { StatusSection } from "@/components/status-sections-view";
import type { Status } from "@/components/status-badge";
import { getAgencyWithLicenses } from "@/lib/agency";
import { getAgencyContracts } from "@/lib/agency-contracts";
import { getAgentsWithLicenses } from "@/lib/agents";
import { canView, type SessionUser } from "@/lib/auth-user";
import { getCarrierContracts } from "@/lib/carrier-contracts";
import { getCarriers } from "@/lib/carriers";
import { getPasswords } from "@/lib/passwords";
import { getSitePasswords } from "@/lib/site-passwords";
import { getUsers } from "@/lib/users";

/** The modules the sections come from; the pages and their links show when the role can see any. */
export const STATUS_MODULES = ["carriers", "contracts", "agents", "agencies", "passwords", "users"];

/** `?q=` link into a searchable list page. */
const search = (path: string, query: string) => `${path}?q=${encodeURIComponent(query)}`;

export async function getStatusSections(user: SessionUser, statuses: readonly Status[]): Promise<StatusSection[]> {
  const sees = (module: string) => canView(user, module);
  const picked = <T extends { status: Status }>(records: T[]) => records.filter((record) => statuses.includes(record.status));

  const [carriers, contracts, agents, agency, passwords, sitePasswords, users] = await Promise.all([
    sees("carriers") ? getCarriers() : [],
    sees("contracts") ? getCarrierContracts() : [],
    sees("agents") ? getAgentsWithLicenses() : { agents: [], licenses: [] },
    sees("agencies") ? getAgencyWithLicenses() : null,
    sees("passwords") ? getPasswords() : [],
    sees("passwords") ? getSitePasswords() : [],
    sees("users") ? getUsers() : [],
  ]);
  const agencyContracts = agency ? await getAgencyContracts(agency.agency.id) : [];

  // Each card goes to the list page its records live in, searched for the row.
  const agentsHref = (name: string) => (sees("agents.list") ? search("/agents", name) : undefined);
  const carriersHref = (name: string) => (sees("carriers.list") ? search("/carriers", name) : undefined);
  const contractsHref = (agentName: string) =>
    sees("contracts.by_state") ? search("/contracts", agentName) : undefined;
  const passwordsHref = (agentName: string) => search("/passwords", agentName);

  const sections = [
    sees("agents") && {
      title: "Agents",
      columns: ["Agent", "Email"],
      rows: picked(agents.agents).map((agent) => ({
        id: agent.id,
        name: agent.name,
        detail: agent.email,
        status: agent.status,
        href: agentsHref(agent.name),
      })),
    },
    sees("agents") && {
      title: "Agent licences",
      columns: ["Agent", "State"],
      rows: picked(agents.licenses).map((license) => ({
        id: `${license.agentId}-${license.id}`,
        name: license.agentName,
        detail: license.state,
        status: license.status,
        renewing: license.renewing,
        href: agentsHref(license.agentName),
      })),
    },
    sees("carriers") && {
      title: "Carriers",
      columns: ["Carrier", "Lines"],
      rows: picked(carriers).map((carrier) => ({
        id: carrier.id,
        name: carrier.name,
        detail: carrier.linesOfBusiness.join(", "),
        status: carrier.status,
        href: carriersHref(carrier.name),
      })),
    },
    sees("carriers") && {
      title: "Carrier licences",
      columns: ["Carrier", "State"],
      rows: carriers.flatMap((carrier) =>
        picked(carrier.licenses).map((license) => ({
          id: `${carrier.id}-${license.id}`,
          name: carrier.name,
          detail: license.state,
          status: license.status,
          renewing: license.renewing,
          href: carriersHref(carrier.name),
        })),
      ),
    },
    sees("contracts") && {
      title: "Carrier contracts",
      columns: ["Agent", "Carrier"],
      rows: picked(contracts).map((contract) => ({
        id: contract.id,
        name: contract.agentName,
        detail: contract.carrierName,
        status: contract.status,
        href: contractsHref(contract.agentName),
      })),
    },
    sees("agencies") && {
      title: "Agency contracts",
      columns: ["Carrier", "Contract number"],
      rows: picked(agencyContracts).map((contract) => ({
        id: contract.id,
        name: contract.carrierName,
        detail: contract.contractNumber,
        status: contract.status,
        href: "/agency",
      })),
    },
    sees("agencies") && {
      title: "Agency licences",
      columns: ["State", "Licence number"],
      rows: picked(agency?.licenses ?? []).map((license) => ({
        id: license.id,
        name: license.state,
        detail: license.licenseNumber,
        status: license.status,
        renewing: license.renewing,
        href: "/agency",
      })),
    },
    sees("passwords") && {
      title: "Carrier passwords",
      columns: ["Agent", "Carrier"],
      rows: picked(passwords).map((password) => ({
        id: password.id,
        name: password.agentName,
        detail: password.carrierName,
        status: password.status,
        href: passwordsHref(password.agentName),
      })),
    },
    sees("passwords") && {
      title: "Site passwords",
      columns: ["Agent", "Site"],
      rows: picked(sitePasswords).map((password) => ({
        id: password.id,
        name: password.agentName,
        detail: password.siteName,
        status: password.status,
        href: passwordsHref(password.agentName),
      })),
    },
    sees("users") && {
      title: "Users",
      columns: ["User", "Email"],
      rows: picked(users).map((record) => ({
        id: record.id,
        name: record.name,
        detail: record.email,
        status: record.status,
        href: search("/users", record.name),
      })),
    },
  ] satisfies (StatusSection | false)[];

  return sections.filter((section) => section !== false);
}
