"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { EditIcon } from "@/components/edit-icon";
import { LicenseNumber } from "@/components/license-number";
import {
  Count,
  Detail,
  Panel,
  PanelEmpty,
  PROFILE_LINK_CLASS as LINK_CLASS,
  PROFILE_TH_CLASS as TH_CLASS,
  ProfileAvatar,
  ProfileBackLink,
  StateChip,
} from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import type {
  CarrierContractNote,
  CarrierContractRecord,
} from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import type { LoginRecord } from "@/lib/logins";
import { US_STATE_NAMES, writableStates } from "@/lib/us-states";
import {
  AppointmentDialog,
  saveAppointment,
  type AppointmentEditor,
  type AppointmentError,
  type AppointmentValues,
} from "../../contracts/appointment-dialog";
import { CredentialValue } from "../../logins/credential-value";
import {
  AgentDialog,
  saveAgent,
  type AgentEditor,
  type AgentError,
  type AgentValues,
} from "../agent-dialog";
import { AgentNotes } from "./agent-notes";
import { AgentSwitcher } from "./agent-switcher";

/*
 * Profile for one agent: identity, then everything linked to them — the states
 * they can write in, contracted carriers, what is still pending, logins, and
 * change notes. Logins are still edited on their page. Two things are editable
 * here: the agent's own fields (Edit opens the same AgentDialog as the Agents
 * list) and appointing this agent to a carrier.
 *
 * Layout: the name row (initials, name, status, Edit) sits above one header
 * card holding the contact details and the licensed states, one small card
 * per state: the code beside its licence number (the state's name is the tooltip). Below it two rows of two panels on wide screens:
 * Carriers beside Pending, then Logins beside Notes. They stack otherwise.
 *
 * States show in two places. "Licensed states" is the agent's own licences
 * (AgentRecord.licensedStates): where they may write at all, whoever the
 * carrier, each with the licence number that state issued
 * (AgentRecord.licenseNumbers) or "No number yet". Each carrier row then lists where they can actually write with that
 * carrier — a state counts only when it is licensed, inside the carrier's
 * footprint, and listed on the appointment. There is no combined list across
 * carriers. Carrier names link to their profiles.
 *
 * Pending is worked out from what is on the page, not stored: there are no
 * task records yet. See `pendingItems`.
 *
 * "Add carrier" opens the shared AppointmentDialog
 * (../../contracts/appointment-dialog.tsx) in add mode with this agent
 * pre-filled — the same form and the same saveAppointment as Contracts, so the
 * duplicate and available-states checks are identical. It is all dummy like the
 * rest: the agent, contracts and notes live in component state, and a refresh
 * brings back the JSON. page.tsx keys this component by agent ID, so switching
 * agents starts that state again.
 */

type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates">;

type AgentProfileProps = {
  initialAgent: AgentRecord;
  /** Every agent, sorted by name: the switcher's options and the NPN uniqueness check. */
  allAgents: Pick<AgentRecord, "id" | "name" | "status" | "npn">[];
  /** Every carrier, sorted by name, for the Add carrier dialog. */
  carriers: CarrierOption[];
  /** Every contract, not just this agent's: the duplicate check and new IDs need them all. */
  initialContracts: CarrierContractRecord[];
  /** Every contract note, newest first. Not shown here; new ones are still recorded. */
  initialContractNotes: CarrierContractNote[];
  /** Sorted by carrier name. */
  logins: (LoginRecord & { carrierName: string })[];
  /** Every agent's notes, newest first: new note IDs need them all. Only this agent's are shown. */
  initialNotes: AgentNote[];
};

const CARRIER_COLUMNS = ["Carrier", "Writable states", "Status"];

const LOGIN_COLUMNS = ["Carrier", "Writing number", "Portal username", "Password", "Status"];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/** Soft brand fill, so it reads as the one action of its row rather than as row text. */
const PANEL_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2.5 py-1 text-sm font-medium text-brand-ink shadow-sm hover:bg-brand-strong hover:text-white";

/** "Humana", "Humana and UHC", "Humana, UHC and WellCare". */
function listText(items: string[]) {
  return items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

type PendingItem = { key: string; title: string; detail: string; href?: string; linkLabel?: string };

type PendingInput = {
  agent: AgentRecord;
  agentCarriers: (CarrierOption & { writable: string[] })[];
  logins: AgentProfileProps["logins"];
};

/**
 * What still needs doing for this agent, worked out from the page's own data:
 * missing licences or licence numbers, appointments that can't write anywhere yet, licensed
 * states no carrier covers, carriers without a login, logins without a
 * contract, and logins still pending.
 */
function pendingItems({ agent, agentCarriers, logins }: PendingInput): PendingItem[] {
  const items: PendingItem[] = [];

  if (agent.licensedStates.length === 0) {
    items.push({
      key: "licences",
      title: "Record licensed states",
      detail: "Without a licence this agent can't write anywhere, whatever the carrier.",
    });
  }

  const unnumbered = agent.licensedStates.filter((code) => !agent.licenseNumbers[code]);
  if (unnumbered.length > 0) {
    items.push({
      key: "licence-numbers",
      title: `Record the licence ${unnumbered.length === 1 ? "number" : "numbers"} for ${listText(unnumbered)}`,
      detail: "Licensed there, but the state's licence number isn't on file. Add it with Edit.",
    });
  }

  for (const carrier of agentCarriers) {
    if (carrier.writable.length === 0) {
      items.push({
        key: `states-${carrier.id}`,
        title: `Finish the ${carrier.name} contract`,
        detail: "Appointed, but with no writable states yet.",
        href: "/contracts",
        linkLabel: "Contracts",
      });
    }
  }

  const covered = new Set(agentCarriers.flatMap((carrier) => carrier.writable));
  const uncovered = agent.licensedStates.filter((code) => !covered.has(code));
  if (uncovered.length > 0 && agentCarriers.length > 0) {
    items.push({
      key: "uncovered",
      title: `No carrier in ${listText(uncovered)}`,
      detail: `Licensed there, but no appointment lists ${uncovered.length === 1 ? "it" : "them"}.`,
    });
  } else if (agent.licensedStates.length > 0 && agentCarriers.length === 0) {
    items.push({
      key: "no-carriers",
      title: "Appoint to a carrier",
      detail: "Licensed, but not contracted with any carrier yet.",
    });
  }

  // One line however many carriers, so a new agent's list stays short.
  const withoutLogin = agentCarriers.filter(
    (carrier) => !logins.some((login) => login.carrierId === carrier.id),
  );
  if (withoutLogin.length > 0) {
    items.push({
      key: "no-login",
      title: `Add ${withoutLogin.length === 1 ? "a login" : "logins"} for ${listText(withoutLogin.map((carrier) => carrier.name))}`,
      detail: "Contracted, but no writing number or portal login recorded.",
      href: withoutLogin.length === 1 ? `/logins?carrier=${withoutLogin[0].id}` : "/logins",
      linkLabel: "Logins",
    });
  }

  for (const login of logins) {
    if (!agentCarriers.some((carrier) => carrier.id === login.carrierId)) {
      items.push({
        key: `uncontracted-${login.id}`,
        title: `${login.carrierName} login has no contract`,
        detail: "A login is recorded, but this agent isn't appointed with the carrier.",
      });
    }
  }

  for (const login of logins) {
    if (login.status === "pending") {
      items.push({
        key: `pending-${login.id}`,
        title: `${login.carrierName} login is pending`,
        detail: `Writing number ${login.writingNumber || "not set"}. Mark it active once the carrier confirms.`,
        href: `/logins?carrier=${login.carrierId}`,
        linkLabel: "Logins",
      });
    }
  }

  return items;
}

export function AgentProfile({
  initialAgent,
  allAgents,
  carriers,
  initialContracts,
  initialContractNotes,
  logins,
  initialNotes,
}: AgentProfileProps) {
  const [agent, setAgent] = useState(initialAgent);
  const [allNotes, setAllNotes] = useState(initialNotes);
  const [contracts, setContracts] = useState(initialContracts);
  const [contractNotes, setContractNotes] = useState(initialContractNotes);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [agentEditor, setAgentEditor] = useState<AgentEditor | null>(null);
  const [editor, setEditor] = useState<AppointmentEditor | null>(null);
  const licensedHeadingId = useId();

  // An edit here shows at once in the switcher too.
  const agents = allAgents.map((other) => (other.id === agent.id ? agent : other));
  const notes = allNotes.filter((note) => note.agentId === agent.id);

  const agentName = (agentId: string) =>
    agents.find((other) => other.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;
  const availableStates = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.availableStates ?? [];

  // This agent's carriers, rebuilt from state so a new appointment shows at once.
  // `writable` is what the appointment actually buys them: its states within
  // this agent's licences and that carrier's footprint.
  const agentCarriers = contracts
    .filter((contract) => contract.agentId === agent.id)
    .flatMap((contract) => {
      const carrier = carriers.find((option) => option.id === contract.carrierId);
      return carrier
        ? [
            {
              ...carrier,
              writable: writableStates(
                contract.appointedStates,
                agent.licensedStates,
                carrier.availableStates,
              ),
            },
          ]
        : [];
    })
    .sort(byName);

  const pending = pendingItems({ agent, agentCarriers, logins });

  /** Edits this agent. Returns the dialog's error, if any. */
  const saveAgentEdit = (values: AgentValues): AgentError | null => {
    const result = saveAgent({ agents, notes: allNotes, values, editing: agent });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    setAgent(result.agent);
    setAllNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  /** Appoints this agent to a carrier. Returns the dialog's error message, if any. */
  const saveContract = (
    values: AppointmentValues,
    editing?: CarrierContractRecord,
  ): AppointmentError | null => {
    const result = saveAppointment({
      contracts,
      notes: contractNotes,
      values,
      editing,
      agentName,
      carrierName,
      availableStates,
      // The dialog locks the agent to this profile, so this is the only answer.
      licensedStates: () => agent.licensedStates,
    });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    setContracts(result.contracts);
    setContractNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProfileBackLink href="/agents" label="Agents" />
        <AgentSwitcher currentId={agent.id} agents={agents} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <ProfileAvatar name={agent.name} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-fg">{agent.name}</h1>
            <div className="mt-0.5 flex">
              <StatusBadge status={agent.status} />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAgentEditor({ mode: "edit", agent })}
          className={PANEL_BUTTON_CLASS}
        >
          <EditIcon className="size-3.5 shrink-0" />
          Edit<span className="sr-only"> {agent.name}</span>
        </button>
      </div>

      <header className="mt-4 p-2 grid overflow-hidden rounded-xl border border-line bg-surface shadow-sm lg:grid-cols-[auto_minmax(0,1fr)]">
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] content-start items-baseline gap-x-6 gap-y-3 px-5 py-4 lg:max-w-md">
          <Detail label="NPN">
            {agent.npn ? <span className="font-mono">{agent.npn}</span> : null}
          </Detail>
          <Detail label="Email">
            {agent.email ? (
              <a href={`mailto:${agent.email}`} className="hover:text-brand-ink hover:underline">
                {agent.email}
              </a>
            ) : null}
          </Detail>
          <Detail label="Phone">
            {agent.phone ? (
              <a href={`tel:${agent.phone}`} className="hover:text-brand-ink hover:underline">
                {agent.phone}
              </a>
            ) : null}
          </Detail>
          <Detail label="Aliases">{agent.aliases.join(", ")}</Detail>
        </dl>

        <section
          aria-labelledby={licensedHeadingId}
          className="min-w-0 border-t border-line px-5 py-4 lg:border-l lg:border-t-0"
        >
          <h2
            id={licensedHeadingId}
            title="Personal licences, whoever the carrier."
            className="flex items-center gap-2 text-sm font-semibold text-fg"
          >
            Licensed states
            <Count value={agent.licensedStates.length} />
          </h2>

          {agent.licensedStates.length === 0 ? (
            <p className="mt-2 text-sm text-fg-subtle">
              No licences recorded, so this agent can&apos;t write anywhere yet.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
              {agent.licensedStates.map((code) => (
                <li
                  key={code}
                  title={US_STATE_NAMES[code]}
                  className="flex items-baseline justify-between rounded-lg bg-surface-muted px-3 py-2 ring-1 ring-inset ring-line"
                >
                  <span className="font-mono text-sm font-bold text-fg">
                    {code}
                    {US_STATE_NAMES[code] ? (
                      <span className="sr-only"> ({US_STATE_NAMES[code]})</span>
                    ) : null}
                  </span>
                  <LicenseNumber value={agent.licenseNumbers[code]} className="min-w-0 " />
                </li>
              ))}
            </ul>
          )}
        </section>
      </header>

      <div role="status">
        {unsavedCount > 0 ? (
          <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            {unsavedCount === 1 ? "1 change" : `${unsavedCount} changes`} made on this page only.
            Nothing is saved yet, so refreshing undoes {unsavedCount === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">

        <Panel
          title="Carriers"
          count={agentCarriers.length}
          action={
            carriers.length > 0 ? (
              <button
                type="button"
                onClick={() => setEditor({ mode: "add", agentId: agent.id })}
                className={PANEL_BUTTON_CLASS} 
              >
                <span aria-hidden="true">+ </span>Add carrier
                <span className="sr-only"> for {agent.name}</span>
              </button>
            ) : null
          }
        >
          {agentCarriers.length === 0 ? (
            <PanelEmpty>Not contracted with any carriers.</PanelEmpty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-muted">
                  <tr>
                    {CARRIER_COLUMNS.map((heading) => (
                      <th key={heading} scope="col" className={TH_CLASS}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line border-t border-line">
                  {agentCarriers.map((carrier) => (
                    <tr key={carrier.id}>
                      <td className="px-3 py-2.5 align-middle sm:whitespace-nowrap">
                        <Link href={`/carriers/${carrier.id}`} className={LINK_CLASS}>
                          {carrier.name}
                        </Link>
                      </td>
                      <td className="w-full px-3 py-2.5">
                        {carrier.writable.length > 0 ? (
                          <ul
                            aria-label={`States writable with ${carrier.name}`}
                            className="flex flex-wrap gap-1"
                          >
                            {carrier.writable.map((code) => (
                              <StateChip key={code} code={code} />
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-fg-faint">No states yet</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={carrier.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Pending" count={pending.length}>
          {pending.length === 0 ? (
            <PanelEmpty>Nothing pending. Licences, contracts and logins all line up.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line text-sm">
              {pending.map((item) => (
                <li key={item.key} className="flex items-start gap-3 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-warn-ink"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg">{item.title}</p>
                    <p className="mt-0.5 text-xs text-fg-muted">{item.detail}</p>
                  </div>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-ink hover:underline"
                    >
                      {item.linkLabel}
                      <span aria-hidden="true"> →</span>
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Logins" count={logins.length}>
          {logins.length === 0 ? (
            <PanelEmpty>No logins recorded.</PanelEmpty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-muted">
                  <tr>
                    {LOGIN_COLUMNS.map((heading) => (
                      <th key={heading} scope="col" className={TH_CLASS}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line border-t border-line">
                  {logins.map((login) => (
                    <tr key={login.id}>
                      <td className="min-w-24 px-3 py-2.5">
                        <Link href={`/carriers/${login.carrierId}`} className={LINK_CLASS}>
                          {login.carrierName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-fg-muted">
                        {login.writingNumber}
                      </td>
                      <td className="px-3 py-2.5 text-fg-muted">
                        <CredentialValue value={login.username} label="username" />
                      </td>
                      <td className="px-3 py-2.5 text-fg-muted">
                        <CredentialValue value={login.portalPassword} label="password" secret />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={login.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Notes" count={notes.length}>
          {/* Cancels NoteList's own top margin; the panel body already pads. */}
          <div className="-mt-2">
            <AgentNotes notes={notes} />
          </div>
        </Panel>
      </div>

      <AgentDialog editor={agentEditor} onSave={saveAgentEdit} onClose={() => setAgentEditor(null)} />

      {/* Agent locked to this profile: the only option, already chosen. */}
      <AppointmentDialog
        editor={editor}
        agents={[{ id: agent.id, name: agent.name, licensedStates: agent.licensedStates }]}
        carriers={carriers}
        onSave={saveContract}
        onClose={() => setEditor(null)}
      />
    </div>
  );
}
