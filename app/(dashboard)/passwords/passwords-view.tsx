"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { useConfirm } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { PasswordsTable } from "@/components/passwords-table";
import { Panel, PanelEmpty, PROFILE_BUTTON_CLASS } from "@/components/profile-shell";
import { SitePasswordsTable } from "@/components/site-passwords-table";
import type { PasswordRecord } from "@/lib/passwords";
import type { SitePasswordRecord, SiteRecord } from "@/lib/site-passwords";
import { byName } from "@/lib/text";
import { AddPasswordDialog, type AddPasswordEditor } from "./password-dialog";
import { AGENCY_CHOICE, type AgencyOption, type AgentOption, type CarrierOption } from "./password-form";
import { deletePassword } from "./actions";
import { deleteSitePassword } from "./site-actions";

/*
 * The Passwords page, in two panels:
 *
 * 1. Carrier passwords: one agent (or the agency) at one carrier, with the
 *    carrier's Links (components/passwords-table.tsx). Narrowed by the agent
 *    and carrier filters in its panel header.
 * 2. Site passwords: one agent (or the agency) at one site, for logins that
 *    aren't at a carrier, with the site's link (components/site-passwords-table.tsx).
 *    Narrowed by its own agent and site filters in its panel header. Sites
 *    have no list of their own: they are added and edited from the site
 *    password form.
 *
 * Both Add buttons open the shared AddPasswordDialog popup
 * (./password-dialog.tsx), started on that table's filtered agent and
 * carrier / site; a row's Edit opens the same popup filled in from that
 * password. The page refreshes after a save. Either kind can be deleted
 * here, after a confirmation; a failure shows above the panels.
 *
 * Both agent filters start on the agency (All agents when there is none).
 * The filters live in the URL (carrier table: ?agent= and ?carrier=; site
 * table: ?siteAgent= and ?site=; an agent filter is an agent's ID, `agency`
 * or `all`, left out at the default), seeded on first render and kept with
 * replaceState. The agency's own logins are listed first in both tables.
 */

type PasswordsViewProps = {
  passwords: PasswordRecord[];
  sitePasswords: SitePasswordRecord[];
  /** For the site filter and the Add site password popup's Site select. */
  sites: SiteRecord[];
  /** The agency, for its own passwords. Null when it can't be read. */
  agency: AgencyOption | null;
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/** The agent filter's value for the agency's own passwords. */
const AGENCY_FILTER = AGENCY_CHOICE;
/** The agent filter's value for every agent and the agency. */
const ALL_FILTER = "all";

type FilterParam = "agent" | "carrier" | "siteAgent" | "site";
type Party = { agentId: string | null; agencyId: string | null };

/** The agent filter value a password matches: its agent's ID, or AGENCY_FILTER. */
const partyOf = (password: Party) => (password.agencyId ? AGENCY_FILTER : (password.agentId ?? ""));

const matchesAgent = (filter: string) => (password: Party) => filter === ALL_FILTER || partyOf(password) === filter;

/** The agency's logins first, then by agent name, then by `place` (carrier or site name). */
const byPartyThen =
  <T extends { agencyId: string | null; agentName: string }>(place: (row: T) => string) =>
  (a: T, b: T) =>
    Number(!a.agencyId) - Number(!b.agencyId) ||
    a.agentName.localeCompare(b.agentName) ||
    place(a).localeCompare(place(b), undefined, { sensitivity: "base" });

export function PasswordsView({ passwords, sitePasswords, sites, agency, agents, carriers }: PasswordsViewProps) {
  const id = useId();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, confirmDialog } = useConfirm();
  const [actionError, setActionError] = useState<string | null>(null);
  const [addEditor, setAddEditor] = useState<AddPasswordEditor | null>(null);

  // Each table's agent filter: an agent's ID, AGENCY_FILTER for the agency's
  // logins, or ALL_FILTER for everyone. No param starts on the default; an
  // unknown ID stays in the URL but shows as everyone.
  const defaultAgentFilter = agency ? AGENCY_FILTER : ALL_FILTER;
  const initialAgentFilter = (param: "agent" | "siteAgent") => {
    const agentId = searchParams.get(param);
    if (agentId === null) return defaultAgentFilter;
    if (agentId === AGENCY_FILTER) return agency ? agentId : ALL_FILTER;
    return agents.some((agent) => agent.id === agentId) ? agentId : ALL_FILTER;
  };
  const [agentFilter, setAgentFilter] = useState(() => initialAgentFilter("agent"));
  const [siteAgentFilter, setSiteAgentFilter] = useState(() => initialAgentFilter("siteAgent"));
  // Carrier ID to filter carrier passwords by, or "" for all carriers.
  const [carrierFilter, setCarrierFilter] = useState(() => {
    const carrierId = searchParams.get("carrier") ?? "";
    return carriers.some((carrier) => carrier.id === carrierId) ? carrierId : "";
  });
  // Site ID to filter site passwords by, or "" for all sites.
  const [siteFilter, setSiteFilter] = useState(() => {
    const siteId = searchParams.get("site") ?? "";
    return sites.some((site) => site.id === siteId) ? siteId : "";
  });

  const agentName = (agentId: string) =>
    agentId === AGENCY_FILTER
      ? "the agency"
      : (agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`);
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;
  const siteName = (siteId: string) => sites.find((site) => site.id === siteId)?.name ?? `Site ${siteId}`;

  /** An agent filter as a URL param: the default is left out. */
  const agentParam = (filter: string) => (filter === defaultAgentFilter ? "" : filter);

  // State drives the selects, so they change on this render; replaceState keeps
  // the choice in the URL without a reload or refetch. "" drops the param.
  const setFilterParam = (param: FilterParam, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(param, value);
    else params.delete(param);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  const carrierRows = useMemo(
    () =>
      passwords
        .filter(matchesAgent(agentFilter))
        .filter((password) => !carrierFilter || password.carrierId === carrierFilter)
        .sort(byPartyThen((password) => password.carrierName)),
    [passwords, agentFilter, carrierFilter],
  );
  const siteRows = useMemo(
    () =>
      sitePasswords
        .filter(matchesAgent(siteAgentFilter))
        .filter((password) => !siteFilter || password.siteId === siteFilter)
        .sort(byPartyThen((password) => password.siteName)),
    [sitePasswords, siteAgentFilter, siteFilter],
  );

  const editCarrierPassword = useCallback(
    (password: PasswordRecord) => setAddEditor({ kind: "carrier", password }),
    [],
  );
  const editSitePassword = useCallback(
    (password: SitePasswordRecord) => setAddEditor({ kind: "site", password }),
    [],
  );

  /** Confirms, then deletes; a refusal shows above the panels. The action revalidates the page. */
  const runDelete = useCallback(
    async (title: string, message: string, remove: () => Promise<{ ok: true } | { ok: false; message: string }>) => {
      setActionError(null);
      if (!(await confirm({ title, message, confirmLabel: "Delete" }))) return;
      const result = await remove();
      if (!result.ok) setActionError(result.message);
      else router.refresh();
    },
    [confirm, router],
  );
  const removeCarrierPassword = useCallback(
    (password: PasswordRecord) =>
      void runDelete(
        "Delete carrier password",
        `Delete the password for ${password.agentName} at ${password.carrierName}?`,
        () => deletePassword(password.id),
      ),
    [runDelete],
  );
  const removeSitePassword = useCallback(
    (password: SitePasswordRecord) =>
      void runDelete(
        "Delete site password",
        `Delete the password for ${password.agentName} at ${password.siteName}?`,
        () => deleteSitePassword(password.id),
      ),
    [runDelete],
  );

  // Add starts on the table's filtered agent, and carrier or site.
  const addButton = (kind: AddPasswordEditor["kind"], label: string) => {
    const tableAgent = kind === "carrier" ? agentFilter : siteAgentFilter;
    return (
      <button
        type="button"
        onClick={() =>
          setAddEditor({
            kind,
            agentId: tableAgent === ALL_FILTER ? undefined : tableAgent,
            carrierId: kind === "carrier" ? carrierFilter || undefined : undefined,
            siteId: kind === "site" ? siteFilter || undefined : undefined,
          })
        }
        className={PROFILE_BUTTON_CLASS}
      >
        <span aria-hidden="true">+ </span>
        {label}
      </button>
    );
  };

  const agentSelect = (param: "agent" | "siteAgent", value: string, setValue: (value: string) => void) => (
    <>
      <label htmlFor={`${id}-${param}-filter`} className="sr-only">
        Filter by agent
      </label>
      <select
        id={`${id}-${param}-filter`}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setFilterParam(param, agentParam(event.target.value));
        }}
        className={`${TOOLBAR_INPUT_CLASS} py-1`}
      >
        <option value={ALL_FILTER}>All agents</option>
        {agency ? <option value={AGENCY_FILTER}>Agency</option> : null}
        {[...agents].sort(byName).map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
            {agent.status === "inactive" ? " (inactive)" : ""}
          </option>
        ))}
      </select>
    </>
  );

  /** "No passwords for Jane Doe at Acme." for the filters set, or undefined when none are. */
  const emptyFor = (lead: string, tableAgent: string, placeName: string) => {
    const parts = [tableAgent !== ALL_FILTER && agentName(tableAgent), placeName].filter(Boolean);
    return parts.length ? `${lead} for ${parts.join(" at ")}.` : undefined;
  };

  return (
    <>
      <PageHeader title="Passwords" />

      <div role="alert">
        {actionError ? <p className="mb-4 text-sm text-danger">{actionError}</p> : null}
      </div>

      <div className="grid gap-5">
        <Panel
          title="Carrier passwords"
          count={carrierRows.length}
          action={
            <span className="flex flex-wrap items-center justify-end gap-2">
              <label htmlFor={`${id}-carrier-filter`} className="sr-only">
                Filter by carrier
              </label>
              <select
                id={`${id}-carrier-filter`}
                value={carrierFilter}
                onChange={(event) => {
                  setCarrierFilter(event.target.value);
                  setFilterParam("carrier", event.target.value);
                }}
                className={`${TOOLBAR_INPUT_CLASS} py-1`}
              >
                <option value="">All carriers</option>
                {[...carriers].sort(byName).map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                    {carrier.status === "inactive" ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
              {agentSelect("agent", agentFilter, setAgentFilter)}
              {addButton("carrier", "Add carrier password")}
            </span>
          }
        >
          {passwords.length === 0 ? (
            <PanelEmpty>No carrier passwords yet.</PanelEmpty>
          ) : (
            <PasswordsTable
              passwords={carrierRows}
              aligned
              onEdit={editCarrierPassword}
              onDelete={removeCarrierPassword}
              emptyMessage={emptyFor("No passwords", agentFilter, carrierFilter && carrierName(carrierFilter))}
            />
          )}
        </Panel>

        <Panel
          title="Site passwords"
          count={siteRows.length}
          action={
            <span className="flex flex-wrap items-center justify-end gap-2">
              <label htmlFor={`${id}-site-filter`} className="sr-only">
                Filter by site
              </label>
              <select
                id={`${id}-site-filter`}
                value={siteFilter}
                onChange={(event) => {
                  setSiteFilter(event.target.value);
                  setFilterParam("site", event.target.value);
                }}
                className={`${TOOLBAR_INPUT_CLASS} py-1`}
              >
                <option value="">All sites</option>
                {[...sites].sort(byName).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
              {agentSelect("siteAgent", siteAgentFilter, setSiteAgentFilter)}
              {addButton("site", "Add site password")}
            </span>
          }
        >
          {sitePasswords.length === 0 ? (
            <PanelEmpty>No site passwords yet.</PanelEmpty>
          ) : (
            <SitePasswordsTable
              passwords={siteRows}
              aligned
              onEdit={editSitePassword}
              onDelete={removeSitePassword}
              emptyMessage={emptyFor("No site passwords", siteAgentFilter, siteFilter && siteName(siteFilter))}
            />
          )}
        </Panel>
      </div>

      <AddPasswordDialog
        editor={addEditor}
        agents={agents}
        agency={agency}
        carriers={carriers}
        sites={sites}
        onSaved={() => router.refresh()}
        onClose={() => setAddEditor(null)}
      />

      {confirmDialog}
    </>
  );
}
