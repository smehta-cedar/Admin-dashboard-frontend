"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { HydratedNoteList } from "@/components/hydrated-note-list";
import { CopyableNumber } from "@/components/license-number";
import {
  PasswordsPanel,
  Panel,
  PanelEmpty,
  PROFILE_BUTTON_CLASS,
  PROFILE_LINK_CLASS,
  PROFILE_TH_CLASS,
  ProfileNameRow,
  ProfileTable,
  StateChipCell,
  type ProfilePassword,
} from "@/components/profile-shell";
import { LINK_ACTIVE, LINK_BASE, LINK_IDLE } from "@/components/sidebar";
import { StateLicensesPanel } from "@/components/state-licenses-panel";
import { StatusBadge } from "@/components/status-badge";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import type { CertificationRecord } from "@/lib/certifications";
import type { CarrierContractRecord } from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { formatAddress } from "@/lib/address";
import { writableStates } from "@/lib/us-states";
import { byName } from "@/lib/text";
import { saveCertification } from "../../certifications/actions";
import {
  CertificationDialog,
  type CertificationEditor,
  type CertificationError,
  type CertificationOption,
  type CertificationValues,
} from "../../certifications/certification-dialog";
import { CertificationsTable } from "../../certifications/certifications-table";
import { AppointmentDialog } from "../../contracts/appointment-dialog";
import { useAppointments } from "../../contracts/use-appointments";
import { AGENT_FIELD_LABELS } from "../agent-dialog";

/*
 * Profile for one agent: identity, then everything linked to them — the states
 * they can write in, contracted carriers, what is still pending, passwords,
 * and change notes. Passwords are still edited on their page. Two things
 * are editable here: the agent's own fields (Edit opens /agents/[id]/edit, the
 * same page as Add agent, and returns here) and appointing this agent to a carrier.
 *
 * Layout, from the shared pieces in components/profile-shell.tsx. The page is
 * capped at the 2xl breakpoint, wider than the list pages. A header that is
 * always there, then a split: a section list beside one panel.
 *
 *   name row        — initials, name, status, Edit; not in a card
 *   section list | panel (`13rem` | the rest from `lg`)
 *                   — the list names the sections, each with its
 *                     current count: Details, Pending, Carriers, State
 *                     licences, Certifications (only for a role that can
 *                     see them), Passwords, Notes. Picking one swaps the
 *                     panel beside it; only that section renders, full width
 *                     of the column. The choice is React state on this page
 *                     (`section`), not a route, so the Edit and Add carrier
 *                     dialogs stay mounted across a switch and nothing is
 *                     refetched. The page opens on Carriers, which is what
 *                     a profile is opened for. The items borrow the app
 *                     rail's link classes (components/sidebar.tsx) so the
 *                     active mark, spacing and type match it
 *
 * Details is a two-column table of the seven contact fields — the four work
 * ones (NPN, email with mailto, phone with tel, aliases), then the three
 * personal ones (personal email, personal phone, address). Every row is
 * always there; an empty one shows "—". Its count is the filled fields.
 * Pending is a `Panel` too, with an empty state ("Nothing is pending") since
 * it is always in the list.
 *
 * Below `lg` the section list sits above the panel as a wrapping row of the
 * same items; everything else stacks in reading order.
 *
 * States show in two places. The State licences panel is the agent's own
 * licences as rows (lib/agent-state-licenses.ts: number, status, start and end
 * dates): where they may write at all, whoever the carrier. The rows are the
 * truth; AgentRecord.licensedStates and licenseNumbers are derived from them,
 * so an Edit that checks or unchecks a state changes both at once
 * (saveAgent). Each carrier row then lists where they can
 * actually write with that carrier — a state counts only when it is licensed,
 * inside the carrier's footprint, and listed on the appointment. There is no
 * combined list across carriers. Carrier names link to their profiles.
 *
 * Pending is worked out from what is on the page, not stored: there are no
 * task records yet. See `pendingItems`. Its count sits on the section list,
 * like every other section's.
 *
 * "Add carrier" opens the shared AppointmentDialog
 * (../../contracts/appointment-dialog.tsx) in add mode with this agent
 * pre-filled — the same form and the same saveAppointment as Contracts, so the
 * duplicate and available-states checks are identical. An inactive agent can
 * still be appointed and keeps their carriers listed: contracts follow the
 * agent, not their status, on every page (the Contracts pages just leave them
 * out of the counts).
 *
 * The agent and their licence rows are kept in state. Editing them happens on
 * /agents/[id]/edit; coming back loads the saved agent. Appointments save through
 * the appointments hook. page.tsx keys this component by agent ID, so
 * switching agents starts that state again.
 */

type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates" | "agentAccessible">;

type AgentProfileProps = {
  initialAgent: AgentRecord;
  /** Every carrier, sorted by name, for the Add carrier dialog. */
  carriers: CarrierOption[];
  /** Every contract; the profile picks out this agent's. */
  initialContracts: CarrierContractRecord[];
  /** This agent's licence rows, in state-code order. */
  initialLicenses: AgentStateLicenseRecord[];
  /** This agent's certifications, by policy type name; null when the role can't see certifications. */
  initialCertifications: CertificationRecord[] | null;
  /** Every policy type, for the certification dialog's select. */
  policyTypes: CertificationOption[];
  /** This agent's passwords, the carrier as the party, sorted by carrier name. */
  passwords: ProfilePassword[];
  /** This agent's notes, newest first. */
  notes: AgentNote[];
};

const CARRIER_COLUMNS = ["Carrier", "Writing number", "Writable states", "Status"];

/** One row of the Details table: the field's label and its text, a link, or "—". */
type DetailRow = {
  key: string;
  label: string;
  value: ReactNode;
  /** Whether the field has a value; the section's count. */
  filled: boolean;
};

/** The Details table: label beside value, one row per field, no headings and no paging. */
function DetailsTable({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className={`w-44 align-top ${PROFILE_TH_CLASS} py-2.5`}>
                {row.label}
              </th>
              <td className="min-w-0 break-words px-3 py-2.5 align-top text-fg">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Humana", "Humana and UHC", "Humana, UHC and WellCare". */
function listText(items: string[]) {
  return items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

type PendingItem = { key: string; title: string; detail: string; href?: string; linkLabel?: string };

type PendingInput = {
  agent: AgentRecord;
  agentCarriers: (CarrierOption & { writable: string[]; writingNumber: string })[];
  passwords: ProfilePassword[];
};

/**
 * What still needs doing for this agent, worked out from the page's own data:
 * missing licences or licence numbers, appointments that can't write anywhere yet, licensed
 * states no carrier covers, contracts without a writing number, carriers without a name
 * password, passwords without a contract, and passwords still pending.
 */
function pendingItems({ agent, agentCarriers, passwords }: PendingInput): PendingItem[] {
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

  const withoutNumber = agentCarriers.filter((carrier) => !carrier.writingNumber);
  if (withoutNumber.length > 0) {
    items.push({
      key: "no-writing-number",
      title: `Add writing number${withoutNumber.length === 1 ? "" : "s"} for ${listText(withoutNumber.map((carrier) => carrier.name))}`,
      detail: "Contracted, but no producer ID recorded yet.",
      href: "/contracts",
      linkLabel: "Contracts",
    });
  }

  // One line however many carriers, so a new agent's list stays short.
  const withoutPassword = agentCarriers.filter(
    (carrier) => !passwords.some((record) => record.carrierId === carrier.id),
  );
  if (withoutPassword.length > 0) {
    items.push({
      key: "no-password",
      title: `Add ${withoutPassword.length === 1 ? "a password" : "passwords"} for ${listText(withoutPassword.map((carrier) => carrier.name))}`,
      detail: "Contracted, but no portal password recorded.",
      href:
        withoutPassword.length === 1
          ? `/passwords?carrier=${withoutPassword[0].id}`
          : "/passwords",
      linkLabel: "Passwords",
    });
  }

  for (const record of passwords) {
    if (!agentCarriers.some((carrier) => carrier.id === record.carrierId)) {
      items.push({
        key: `uncontracted-${record.id}`,
        title: `${record.partyName} password has no contract`,
        detail: "A password is recorded, but this agent isn't appointed with the carrier.",
      });
    }
  }

  for (const record of passwords) {
    if (record.status === "pending") {
      const writingNumber =
        agentCarriers.find((carrier) => carrier.id === record.carrierId)?.writingNumber ?? "";
      items.push({
        key: `pending-${record.id}`,
        title: `${record.partyName} password is pending`,
        detail: writingNumber
          ? `Writing number ${writingNumber}. Mark it active once the carrier confirms.`
          : "Mark it active once the carrier confirms.",
        href: `/passwords?carrier=${record.carrierId}`,
        linkLabel: "Passwords",
      });
    }
  }

  return items;
}

type SectionKey = "details" | "pending" | "carriers" | "licences" | "certifications" | "passwords" | "notes";

/** One item of the section list: its label and the count its panel shows. */
type Section = { key: SectionKey; label: string; count: number };

export function AgentProfile({
  initialAgent,
  carriers,
  initialContracts,
  initialLicenses,
  initialCertifications,
  policyTypes,
  passwords,
  notes,
}: AgentProfileProps) {
  const agent = initialAgent;
  const licenses = initialLicenses;
  const [certifications, setCertifications] = useState(initialCertifications);
  const router = useRouter();
  const [certificationEditor, setCertificationEditor] = useState<CertificationEditor | null>(null);
  // Which section the panel shows. Carriers first: it is what the page is opened for.
  const [section, setSection] = useState<SectionKey>("carriers");
  // Appointments added here are for this agent only.
  const { contracts, editor, setEditor, saveContract } = useAppointments({
    initialContracts,
    agents: [agent],
    carriers,
    onSaved: () => {},
  });

  // This agent's carriers, rebuilt from state so a new appointment shows at once.
  // `writable` is what the appointment actually buys them: its states within
  // this agent's licences and that carrier's footprint. `writingNumber` is on
  // the contract (producer ID), empty when none recorded yet.
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
              writingNumber: contract.writingNumber,
            },
          ]
        : [];
    })
    .sort(byName);

  const pending = pendingItems({ agent, agentCarriers, passwords });


  // Detail rows: always all four work fields, then all three personal ones,
  // so the table keeps its shape; an empty field shows "—".
  const empty = <span className="text-fg-subtle">—</span>;
  const linkClass = "hover:text-brand-ink hover:underline";
  const aliases = agent.aliases.join(", ");
  const address = formatAddress(agent.address);
  const details: DetailRow[] = [
    {
      key: "npn",
      label: AGENT_FIELD_LABELS.npn,
      value: agent.npn ? <span className="font-mono">{agent.npn}</span> : empty,
      filled: Boolean(agent.npn),
    },
    {
      key: "email",
      label: AGENT_FIELD_LABELS.email,
      value: agent.email ? (
        <a href={`mailto:${agent.email}`} className={linkClass}>
          {agent.email}
        </a>
      ) : (
        empty
      ),
      filled: Boolean(agent.email),
    },
    {
      key: "phone",
      label: AGENT_FIELD_LABELS.phone,
      value: agent.phone ? (
        <a href={`tel:${agent.phone}`} className={linkClass}>
          {agent.phone}
        </a>
      ) : (
        empty
      ),
      filled: Boolean(agent.phone),
    },
    {
      key: "aliases",
      label: AGENT_FIELD_LABELS.aliases,
      value: aliases || empty,
      filled: aliases !== "",
    },
    {
      key: "personalEmail",
      label: AGENT_FIELD_LABELS.personalEmail,
      value: agent.personalEmail ? (
        <a href={`mailto:${agent.personalEmail}`} className={linkClass}>
          {agent.personalEmail}
        </a>
      ) : (
        empty
      ),
      filled: Boolean(agent.personalEmail),
    },
    {
      key: "personalPhone",
      label: AGENT_FIELD_LABELS.personalPhone,
      value: agent.personalPhone ? (
        <a href={`tel:${agent.personalPhone}`} className={linkClass}>
          {agent.personalPhone}
        </a>
      ) : (
        empty
      ),
      filled: Boolean(agent.personalPhone),
    },
    {
      key: "address",
      label: AGENT_FIELD_LABELS.address,
      value: address || empty,
      filled: address !== "",
    },
  ];
  const filledCount = details.filter((row) => row.filled).length;

  const sections: Section[] = [
    { key: "details", label: "Details", count: filledCount },
    { key: "pending", label: "Pending", count: pending.length },
    { key: "carriers", label: "Carriers", count: agentCarriers.length },
    { key: "licences", label: "State licences", count: licenses.length },
    // Hidden for a role without certifications view (the list came back as a 403).
    ...(certifications
      ? [{ key: "certifications" as const, label: "Certifications", count: certifications.length }]
      : []),
    { key: "passwords", label: "Passwords", count: passwords.length },
    { key: "notes", label: "Notes", count: notes.length },
  ];

  /** Adds or edits one of this agent's certifications through the API. Resolves with the dialog's errors, if any. */
  const saveAgentCertification = async (values: CertificationValues): Promise<CertificationError[]> => {
    const editingId = certificationEditor?.mode === "edit" ? certificationEditor.certification.id : undefined;
    const result = await saveCertification(values, "agent", editingId);
    if (!result.ok) return result.errors;
    setCertifications((current) =>
      [...(current ?? []).filter((row) => row.id !== result.certification.id), result.certification].sort(
        (a, b) => a.policyTypeName.localeCompare(b.policyTypeName),
      ),
    );
    return [];
  };

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) pb-12">
      <ProfileNameRow
        name={agent.name}
        status={agent.status}
        onEdit={() => router.push(`/agents/${agent.id}/edit?from=profile`)}
      />

      {/*
       * The split: the section list, then the one panel it picked. From `lg`
       * the list is a narrow column on the left; below, a wrapping row above.
       */}
      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Profile sections">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {sections.map((item) => {
              const active = item.key === section;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => setSection(item.key)}
                    aria-current={active ? "true" : undefined}
                    className={`${LINK_BASE} w-full ${active ? LINK_ACTIVE : LINK_IDLE}`}
                  >
                    {item.label}
                    <span className="ml-auto text-xs tabular-nums">{item.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {section === "details" ? (
            <Panel title="Details" count={filledCount}>
              <DetailsTable rows={details} />
            </Panel>
          ) : section === "pending" ? (
            <Panel title="Pending" count={pending.length}>
              {pending.length === 0 ? (
                <PanelEmpty>Nothing is pending.</PanelEmpty>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {pending.map((item) => (
                    <li key={item.key} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{item.detail}</p>
                      </div>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-ink hover:underline"
                        >
                          {item.linkLabel}
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : section === "carriers" ? (
            <Panel
              title="Carriers"
              count={agentCarriers.length}
              action={
                carriers.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setEditor({ mode: "add", agentId: agent.id })}
                    className={PROFILE_BUTTON_CLASS}
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
                <ProfileTable
                  columns={CARRIER_COLUMNS}
                  rows={agentCarriers}
                  rowKey={(carrier) => carrier.id}
                >
                  {(carrier) => (
                    <>
                      <td className="min-w-0 truncate px-3 py-2.5 align-middle sm:whitespace-nowrap">
                        <Link href={`/carriers/${carrier.id}`} className={PROFILE_LINK_CLASS}>
                          {carrier.name}
                        </Link>
                      </td>
                      <td className="min-w-0 px-3 py-2.5 align-middle">
                        <CopyableNumber
                          value={carrier.writingNumber}
                          label="Writing number"
                          empty="No writing number"
                        />
                      </td>
                      <StateChipCell
                        codes={carrier.writable}
                        label={`States writable with ${carrier.name}`}
                        empty="No states yet"
                      />
                      <td className="px-3 py-2.5 align-middle">
                        <StatusBadge status={carrier.status} />
                      </td>
                    </>
                  )}
                </ProfileTable>
              )}
            </Panel>
          ) : section === "licences" ? (
            <StateLicensesPanel licenses={licenses} showLines />
          ) : section === "certifications" && certifications ? (
            <Panel
              title="Certifications"
              count={certifications.length}
              action={
                <button
                  type="button"
                  onClick={() => setCertificationEditor({ mode: "add" })}
                  className={PROFILE_BUTTON_CLASS}
                >
                  <span aria-hidden="true">+ </span>Add certification
                  <span className="sr-only"> for {agent.name}</span>
                </button>
              }
            >
              {certifications.length === 0 ? (
                <PanelEmpty>No certifications recorded.</PanelEmpty>
              ) : (
                <CertificationsTable
                  certifications={certifications}
                  leading="policyType"
                  onEdit={(certification) => setCertificationEditor({ mode: "edit", certification })}
                />
              )}
            </Panel>
          ) : section === "passwords" ? (
            <PasswordsPanel passwords={passwords} partyHeading="Carrier" />
          ) : (
            <Panel title="Notes" count={notes.length}>
              {/* Cancels NoteList's own top margin; the panel body already pads. */}
              <div className="-mt-2">
                <HydratedNoteList notes={notes} labels={AGENT_FIELD_LABELS} />
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Agent fixed to this profile; the form picks the policy type. */}
      <CertificationDialog
        editor={certificationEditor}
        fixed={{ kind: "agent", agent: { id: agent.id, name: agent.name } }}
        options={policyTypes}
        onSave={saveAgentCertification}
        onClose={() => setCertificationEditor(null)}
      />

      {/* Agent locked to this profile: the only option, already chosen. */}
      <AppointmentDialog
        editor={editor}
        agents={[
          { id: agent.id, name: agent.name, status: agent.status, licensedStates: agent.licensedStates },
        ]}
        carriers={carriers}
        onSave={saveContract}
        onClose={() => setEditor(null)}
      />
    </div>
  );
}
