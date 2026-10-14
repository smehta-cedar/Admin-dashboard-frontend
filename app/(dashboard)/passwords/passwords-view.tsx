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
import { passwordsListHref } from "./return-to";
import { deleteSitePassword } from "./site-actions";

/*
 * The Passwords page, in two panels:
 *
 * 1. Carrier passwords: one agent (or the agency) at one carrier, with the
 *    carrier's Links (components/passwords-table.tsx). Narrowed by the agent
 *    filter in the page header and the carrier filter in the panel header.
 * 2. Site passwords: one agent (or the agency) at one site, for logins that
 *    aren't at a carrier, with the site's link (components/site-passwords-table.tsx).
 *    Narrowed by the agent filter too. Sites have no list of their own: they
 *    are added and edited from the site password form.
 *
 * Both Add buttons open the shared AddPasswordDialog popup
 * (./password-dialog.tsx), started on the filtered agent / carrier; the page
 * refreshes after a save. Edit opens a full page (./password-form.tsx,
 * ./site-password-form.tsx) carrying the filters, so it comes back to the
 * same list. Site passwords can be
 * deleted here, after a confirmation; a failure shows above the panels.
 * The filters live in the URL (?agent=<id> or
 * ?agent=agency, ?carrier=<id>), seeded on first render and kept with
 * replaceState. The agency's own logins are listed first in both tables.
 */

type PasswordsViewProps = {
  passwords: PasswordRecord[];
  sitePasswords: SitePasswordRecord[];
  /** For the Add site password popup's Site select. */
  sites: SiteRecord[];
  /** The agency, for its own passwords. Null when it can't be read. */
  agency: AgencyOption | null;
  agents: AgentOption[];
  carriers: CarrierOption[];
};

/** The agent filter's value for the agency's own passwords. */
const AGENCY_FILTER = AGENCY_CHOICE;

/** The agent filter value a password matches: its agent's ID, or AGENCY_FILTER. */
const partyOf = (password: { agentId: string | null; agencyId: string | null }) =>
  password.agencyId ? AGENCY_FILTER : (password.agentId ?? "");

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
  // Agent ID to filter by, AGENCY_FILTER for the agency's logins, or "" for
  // everyone. An unknown ID stays in the URL but shows as everyone.
  const [agentFilter, setAgentFilter] = useState(() => {
    const agentId = searchParams.get("agent") ?? "";
    if (agentId === AGENCY_FILTER) return agency ? agentId : "";
    return agents.some((agent) => agent.id === agentId) ? agentId : "";
  });
  // Carrier ID to filter carrier passwords by, or "" for all carriers.
  const [carrierFilter, setCarrierFilter] = useState(() => {
    const carrierId = searchParams.get("carrier") ?? "";
    return carriers.some((carrier) => carrier.id === carrierId) ? carrierId : "";
  });

  const agentName = (agentId: string) =>
    agentId === AGENCY_FILTER
      ? "the agency"
      : (agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`);
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;

  // State drives the selects, so they change on this render; replaceState keeps
  // the choice in the URL without a reload or refetch. "All" drops the param.
  const setFilterParam = (param: "agent" | "carrier", value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(param, value);
    else params.delete(param);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  const carrierRows = useMemo(
    () =>
      passwords
        .filter((password) => !agentFilter || partyOf(password) === agentFilter)
        .filter((password) => !carrierFilter || password.carrierId === carrierFilter)
        .sort(byPartyThen((password) => password.carrierName)),
    [passwords, agentFilter, carrierFilter],
  );
  const siteRows = useMemo(
    () =>
      sitePasswords
        .filter((password) => !agentFilter || partyOf(password) === agentFilter)
        .sort(byPartyThen((password) => password.siteName)),
    [sitePasswords, agentFilter],
  );

  // The pages come back to this list with the same filters.
  const listQuery = passwordsListHref(agentFilter, carrierFilter).replace("/passwords", "");
  const agentQuery = agentFilter ? `?agent=${encodeURIComponent(agentFilter)}` : "";

  const editCarrierPassword = useCallback(
    (password: PasswordRecord) => router.push(`/passwords/${encodeURIComponent(password.id)}/edit${listQuery}`),
    [router, listQuery],
  );
  const editSitePassword = useCallback(
    (password: SitePasswordRecord) =>
      router.push(`/passwords/site-passwords/${encodeURIComponent(password.id)}/edit${agentQuery}`),
    [router, agentQuery],
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
  const removeSitePassword = useCallback(
    (password: SitePasswordRecord) =>
      void runDelete(
        "Delete site password",
        `Delete the password for ${password.agentName} at ${password.siteName}?`,
        () => deleteSitePassword(password.id),
      ),
    [runDelete],
  );

  // Add starts on the filtered agent (and carrier, for a carrier password).
  const addButton = (kind: AddPasswordEditor["kind"], label: string) => (
    <button
      type="button"
      onClick={() =>
        setAddEditor({
          kind,
          agentId: agentFilter || undefined,
          carrierId: kind === "carrier" ? carrierFilter || undefined : undefined,
        })
      }
      className={PROFILE_BUTTON_CLASS}
    >
      <span aria-hidden="true">+ </span>
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Passwords"
        actions={
          <>
            <label htmlFor={`${id}-agent-filter`} className="sr-only">
              Filter by agent
            </label>
            <select
              id={`${id}-agent-filter`}
              value={agentFilter}
              onChange={(event) => {
                setAgentFilter(event.target.value);
                setFilterParam("agent", event.target.value);
              }}
              className={TOOLBAR_INPUT_CLASS}
            >
              <option value="">All agents</option>
              {agency ? <option value={AGENCY_FILTER}>Agency</option> : null}
              {[...agents].sort(byName).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </>
        }
      />

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
              emptyMessage={
                agentFilter || carrierFilter
                  ? `No passwords for ${[agentFilter && agentName(agentFilter), carrierFilter && carrierName(carrierFilter)]
                      .filter(Boolean)
                      .join(" at ")}.`
                  : undefined
              }
            />
          )}
        </Panel>

        <Panel
          title="Site passwords"
          count={siteRows.length}
          action={addButton("site", "Add site password")}
        >
          {sitePasswords.length === 0 ? (
            <PanelEmpty>No site passwords yet.</PanelEmpty>
          ) : (
            <SitePasswordsTable
              passwords={siteRows}
              aligned
              onEdit={editSitePassword}
              onDelete={removeSitePassword}
              emptyMessage={agentFilter ? `No site passwords for ${agentName(agentFilter)}.` : undefined}
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
