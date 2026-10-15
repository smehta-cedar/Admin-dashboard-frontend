"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { ROW_BUTTON_CLASS, TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { useConfirm } from "@/components/confirm-dialog";
import { CredentialValue } from "@/components/credential-value";
import { DeleteIcon } from "@/components/delete-icon";
import { EditIcon } from "@/components/edit-icon";
import { HydratedNoteList } from "@/components/hydrated-note-list";
import { CopyableNumber, LicenseNumber } from "@/components/license-number";
import {
  PasswordsPanel,
  Panel,
  PanelEmpty,
  PROFILE_BUTTON_CLASS,
  PROFILE_LABEL_CLASS,
  PROFILE_LINK_CLASS,
  PROFILE_TH_CLASS,
  ProfileNameRow,
  ProfileTable,
  StateChipCell,
} from "@/components/profile-shell";
import { SitePasswordsTable } from "@/components/site-passwords-table";
import { ProfileStateMap, TableMapToggle, type PanelView } from "@/components/profile-state-map";
import { StateLicensesPanel } from "@/components/state-licenses-panel";
import { StatusBadge } from "@/components/status-badge";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import type { CertifiableCarrier } from "@/lib/certification-options";
import type { CertificationRecord } from "@/lib/certifications";
import type { CarrierContractRecord } from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { formatAddress } from "@/lib/address";
import type { PasswordRecord } from "@/lib/passwords";
import type { SitePasswordRecord, SiteRecord } from "@/lib/site-passwords";
import {
  formatLicenceDate,
  licenceLinesText,
  licensedStatesOf,
  licenseDatesOf,
  licenseLinesOf,
  licenseNumbersOf,
  licenseStatusesOf,
  type StateLicense,
} from "@/lib/state-licenses";
import { US_STATE_NAMES, US_STATES, writableStates } from "@/lib/us-states";
import { byName } from "@/lib/text";
import { AddPasswordDialog, type AddPasswordEditor } from "../../passwords/password-dialog";
import { deleteCertification, listAgentCertifications, saveCertification } from "../../certifications/actions";
import { saveAgentLicenses } from "../actions";
import { AgentLicenseDialog, type AgentLicenseEditor, type AgentLicenseValues } from "./license-dialog";
import {
  CertificationDialog,
  type CertificationEditor,
  type CertificationError,
  type CertificationValues,
} from "../../certifications/certification-dialog";
import {
  CertificationsTable,
  certificationLabel,
  certificationsByYear,
  compareCertifications,
} from "../../certifications/certifications-table";
import { AppointmentDialog } from "../../contracts/appointment-dialog";
import { useAppointments } from "../../contracts/use-appointments";
import { AGENT_FIELD_LABELS } from "../agent-dialog";

/*
 * Profile for one agent: identity, then everything linked to them — the states
 * they can write in, contracted carriers, what is still pending, passwords,
 * and change notes. The agent's own fields are edited on /agents/[id]/edit
 * (Edit, the same page as Add agent, which returns here). Every row of
 * Carriers, State licences, Certifications and Passwords starts with its own
 * Edit button, and each panel has an Add button; both open that section's
 * dialog, so one row is changed without leaving the profile.
 *
 * Layout, from the shared pieces in components/profile-shell.tsx. The page is
 * capped at the 2xl breakpoint, wider than the list pages. A header that is
 * always there, then a row of section cards, then one panel at full width.
 *
 *   name row        — initials, name, status, Edit; not in a card
 *   section cards   — a navbar of equal cards under the name, each naming a
 *                     section and its current count: Details, Pending,
 *                     Carriers, State licences, Certifications (only for a
 *                     role that can see them), Passwords, History. They stretch
 *                     across the row and scroll sideways when they cannot.
 *                     Picking one swaps the panel below; only that section
 *                     renders, across the full width. The choice is React
 *                     state on this page (`section`), not a route, so the
 *                     Edit and Add carrier dialogs stay mounted across a
 *                     switch and nothing is refetched. The page opens on
 *                     Carriers, which is what a profile is opened for.
 *
 * Details is a two-column table of twelve fields — the work ones (NPN,
 * email with mailto, whether a login code is set, phone with tel, aliases), the three personal contact
 * ones (personal email, personal phone, address), then date of birth, join
 * date, start date (dated like licences) and the SSN's last four, masked
 * until its eye button shows it. Every row is
 * always there; an empty one shows "—". Its count is the filled fields.
 * Pending is a `Panel` too, with an empty state ("Nothing is pending") since
 * it is always in the list.
 *
 * Carriers and State licences each have a Table | Map switch in their header
 * (components/profile-state-map.tsx). The Carriers map shades a state by how
 * many carriers the agent can write with there; the licences map shades
 * licensed states, darker when the licence is active. In Map view the full
 * table sits under the map, always every row. Clicking a state slides in the
 * Contracts page's right-hand panel: the carriers writable there (a line
 * opens that contract's Edit), or the licence there with Edit licence. The
 * Carriers map also floats a card of the agent's carriers (name and writing
 * number) over its top-left; picking one lights only its writable states.
 * On both maps, states the agency holds no licence in are striped and can't
 * be picked (`agencyLicensedStates`). The choices are page state, kept across section
 * switches; a pick only filters while its map shows.
 *
 * The cards stay a single row; on a narrow screen they scroll sideways
 * instead of stacking over the panel.
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
 * task records yet. See `pendingItems`. Its count sits on its section card,
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
 * "Add carrier" and a carrier row's Edit share that dialog (edit mode holds
 * the contract). A State licences row's Edit, and Add licence, open
 * AgentLicenseDialog (./license-dialog.tsx) for one licence; its save sends
 * the whole list, with that row changed, through saveAgentLicenses — the same
 * call the edit page makes when a licence is deleted — and the saved agent
 * comes back, so the carriers' writable states follow at once. A carrier
 * password's Add and Edit open the shared AddPasswordDialog popup with this
 * agent fixed. Site passwords sit under them in the same section, in the
 * Passwords page's SitePasswordsTable filtered to this agent, with the same
 * popup (Site kind, without adding or editing sites). Deleting either kind is
 * on the Passwords page. Each panel has
 * its own dropdown filter, by carrier or by site, from the agent's own rows.
 *
 * The agent, their licence rows, certifications and passwords are kept in
 * state, each started again when a fresh server render brings new props
 * (useServerState). Appointments save through the appointments hook.
 * page.tsx keys this component by agent ID, so switching agents starts that
 * state again.
 *
 * A section whose data the role can't see (null) stays out of the list.
 */

/** `licenses` (each state's lines) feeds the Carriers map's badges; the agent's own home doesn't load it. */
type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates" | "agentAccessible"> &
  Partial<Pick<CarrierRecord, "licenses">>;

type AgentProfileProps = {
  initialAgent: AgentRecord;
  /** Every carrier, sorted by name, for the Add carrier dialog. */
  carriers: CarrierOption[];
  /** Every contract; the profile picks out this agent's. */
  initialContracts: CarrierContractRecord[];
  /** This agent's licence rows, in state-code order. */
  initialLicenses: AgentStateLicenseRecord[];
  /** This agent's certifications, by due date; null when the role can't see certifications. */
  initialCertifications: CertificationRecord[] | null;
  /** Every carrier with its lines, for the certification dialog. */
  certificationCarriers: CertifiableCarrier[];
  /** This agent's passwords, sorted by carrier name; null hides the section. */
  passwords: PasswordRecord[] | null;
  /** This agent's site passwords, sorted by site name; null leaves the panel out. */
  sitePasswords?: SitePasswordRecord[] | null;
  /** Every site, for the Add site password popup. */
  sites?: SiteRecord[];
  /** This agent's notes, newest first; null hides the section. */
  notes: AgentNote[] | null;
  /**
   * The agency's licensed states. Every other state is disabled on the maps.
   * Null (no agency yet, or the role can't read it) disables nothing.
   */
  agencyLicensedStates?: string[] | null;
};

const CARRIER_COLUMNS = ["Carrier", "Writing number", "Writable states", "Status"];

/** State that starts from a prop, and starts again when a fresh server render (refresh, revalidation) brings a new one. */
function useServerState<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(initial);
  if (initial !== loaded) {
    setLoaded(initial);
    setValue(initial);
  }
  return [value, setValue] as const;
}

/** A row's first cell: icon-only Edit and Delete buttons. */
function RowActions({
  editLabel,
  onEdit,
  deleteLabel,
  onDelete,
}: {
  editLabel: string;
  onEdit: () => void;
  deleteLabel: string;
  onDelete: () => void;
}) {
  return (
    <td className="whitespace-nowrap px-3 py-1.5 align-middle">
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        title="Edit"
        className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
      >
        <EditIcon className="size-3.5 shrink-0" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        title="Delete"
        className={`inline-flex items-center ${ROW_BUTTON_CLASS} hover:text-danger`}
      >
        <DeleteIcon className="size-3.5 shrink-0" />
      </button>
    </td>
  );
}

/**
 * The card floating over the Carriers map's top-left: one button per carrier,
 * its name over its writing number. Picking one lights its writable states on
 * the map; picking it again clears it.
 */
function CarrierMapCard({
  carriers,
  selectedId,
  onSelect,
}: {
  carriers: { id: string; name: string; writingNumber: string; writable: string[] }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-lg bg-surface/95 shadow-md ring-1 ring-line sm:w-56">
      <p className={`border-b border-line ${PROFILE_TH_CLASS}`}>Carriers</p>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {carriers.map((carrier) => {
          const active = carrier.id === selectedId;
          return (
            <li key={carrier.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(carrier.id)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                  active
                    ? "bg-map-pick-soft text-map-pick-soft-ink shadow-[inset_3px_0_0_var(--color-map-pick)]"
                    : "text-fg hover:bg-surface-hover"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{carrier.name}</span>
                  <span className={`block truncate font-mono text-xs ${carrier.writingNumber ? "" : "text-fg-subtle"}`}>
                    {carrier.writingNumber || "No writing number"}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-xs tabular-nums text-fg-muted"
                  title={`${carrier.writable.length} writable ${carrier.writable.length === 1 ? "state" : "states"}`}
                >
                  {carrier.writable.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

type PendingItem = {
  key: string;
  title: string;
  detail: string;
  href?: string;
  linkLabel?: string;
};

type PendingInput = {
  agent: AgentRecord;
  agentCarriers: (CarrierOption & {
    writable: string[];
    writingNumber: string;
    contract: Pick<CarrierContractRecord, "status">;
  })[];
  passwords: PasswordRecord[];
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

  // Only an active contract needs its writing number.
  const withoutNumber = agentCarriers.filter((carrier) => carrier.contract.status === "active" && !carrier.writingNumber);
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
      href: withoutPassword.length === 1 ? `/passwords?agent=${agent.id}&carrier=${withoutPassword[0].id}` : `/passwords?agent=${agent.id}`,
      linkLabel: "Passwords",
    });
  }

  for (const record of passwords) {
    if (!agentCarriers.some((carrier) => carrier.id === record.carrierId)) {
      items.push({
        key: `uncontracted-${record.id}`,
        title: `${record.carrierName} password has no contract`,
        detail: "A password is recorded, but this agent isn't appointed with the carrier.",
      });
    }
  }

  for (const record of passwords) {
    if (record.status === "pending") {
      const writingNumber = agentCarriers.find((carrier) => carrier.id === record.carrierId)?.writingNumber ?? "";
      items.push({
        key: `pending-${record.id}`,
        title: `${record.carrierName} password is pending`,
        detail: writingNumber
          ? `Writing number ${writingNumber}. Mark it active once the carrier confirms.`
          : "Mark it active once the carrier confirms.",
        href: `/passwords?agent=${agent.id}&carrier=${record.carrierId}`,
        linkLabel: "Passwords",
      });
    }
  }

  return items;
}

type SectionKey = "details" | "pending" | "carriers" | "licences" | "certifications" | "passwords" | "notes";

/** One item of the section cards: its label and the count its panel shows. */
type Section = { key: SectionKey; label: string; count: number };

export function AgentProfile({
  initialAgent,
  carriers,
  initialContracts,
  initialLicenses,
  initialCertifications,
  certificationCarriers,
  passwords: initialPasswords,
  sitePasswords: initialSitePasswords = null,
  sites = [],
  notes,
  agencyLicensedStates = null,
}: AgentProfileProps) {
  const [agent, setAgent] = useServerState(initialAgent);
  const [licenses, setLicenses] = useServerState(initialLicenses);
  // A fresh server render also brings certifications added elsewhere, e.g. by the yearly command.
  const [certifications, setCertifications] = useServerState(initialCertifications);
  const [passwords] = useServerState(initialPasswords);
  const [sitePasswords] = useServerState(initialSitePasswords);
  // Carrier / site ID to narrow the Passwords section's two tables by, or "" for all.
  const [passwordCarrierFilter, setPasswordCarrierFilter] = useState("");
  const [passwordSiteFilter, setPasswordSiteFilter] = useState("");
  const filterId = useId();
  const router = useRouter();
  const [certificationEditor, setCertificationEditor] = useState<CertificationEditor | null>(null);
  const [licenseEditor, setLicenseEditor] = useState<AgentLicenseEditor | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The Add / Edit password popup's editor, if open.
  const [passwordEditor, setPasswordEditor] = useState<AddPasswordEditor | null>(null);
  // Which section the panel shows. Carriers first: it is what the page is opened for.
  const [section, setSection] = useState<SectionKey | null>(null);
  // Carriers opens on its map (with the table under it); State licences on its table.
  const [carriersView, setCarriersView] = useState<PanelView>("map");
  const [licencesView, setLicencesView] = useState<PanelView>("table");
  // The carrier picked on the Carriers map's card: only its writable states light up.
  const [mapCarrierId, setMapCarrierId] = useState<string | null>(null);
  // Appointments added here are for this agent only.
  const { contracts, editor, setEditor, saveContract, removeContract } = useAppointments({
    initialContracts,
    agents: [agent],
    carriers,
    // A new carrier gives the agent a certification per line of business, so reload them.
    onSaved: async () => {
      if (certifications === null) return;
      const fresh = await listAgentCertifications(agent.id);
      if (fresh) setCertifications(fresh);
    },
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
              writable: writableStates(contract.appointedStates, agent.licensedStates, carrier.availableStates),
              writingNumber: contract.writingNumber,
              contract,
            },
          ]
        : [];
    })
    .sort(byName);

  // How many of this agent's carriers they can write with in each state, for the Carriers map.
  const carrierCounts: Record<string, number> = {};
  for (const carrier of agentCarriers) {
    for (const code of carrier.writable) carrierCounts[code] = (carrierCounts[code] ?? 0) + 1;
  }
  const licenceByState = new Map(licenses.map((license) => [license.state, license]));
  const licenceCounts = Object.fromEntries(licenses.map((license) => [license.state, 1]));
  const mapCarrier = agentCarriers.find((carrier) => carrier.id === mapCarrierId) ?? null;

  // The Carriers map's badges: the lines the carriers cover in each state the
  // agent can write with them (only the picked carrier's, when one is picked).
  const carrierLinesAt = (code: string) => {
    const lines = { life: false, health: false };
    let any = false;
    for (const carrier of mapCarrier ? [mapCarrier] : agentCarriers) {
      if (!carrier.writable.includes(code)) continue;
      any = true;
      const row = carrier.licenses?.find((license) => license.state === code);
      lines.life ||= Boolean(row?.life);
      lines.health ||= Boolean(row?.health);
    }
    return any ? lines : null;
  };
  // Both maps disable the states the agency isn't licensed in.
  const agencyUnlicensed = agencyLicensedStates
    ? US_STATES.map((state) => state.code).filter((code) => !agencyLicensedStates.includes(code))
    : [];
  // The agent's carriers they can write with in a state, for the State licences map panel.
  const carriersIn = (code: string) => agentCarriers.filter((carrier) => carrier.writable.includes(code));
  /** A state's carriers, one per line: name (linked for staff) and its writing number with a copy icon. */
  const stateCarriers = (code: string) => {
    const here = carriersIn(code);
    if (here.length === 0) return <span className="text-xs text-fg-faint">No carriers</span>;
    return (
      <ul aria-label={`Carriers in ${US_STATE_NAMES[code] ?? code}`} className="grid gap-1">
        {here.map((carrier) => (
          <li key={carrier.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-2">
            <span className="min-w-0 truncate text-sm">
              <Link href={`/carriers/${carrier.id}`} className={PROFILE_LINK_CLASS}>
                {carrier.name}
              </Link>
            </span>
            <CopyableNumber value={carrier.writingNumber} label={`${carrier.name} writing number`} empty="No writing number" />
          </li>
        ))}
      </ul>
    );
  };
  // The Carriers map outlines licensed states; its tooltip says which.
  const licensedText = (code: string) => (agent.licensedStates.includes(code) ? "Licensed" : "Not licensed");

  const pending = pendingItems({ agent, agentCarriers, passwords: passwords ?? [] });

  // Detail rows: always all four work fields, then all the personal ones,
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
    ...(["dateOfBirth", "joinDate", "startDate"] as const).map((key) => {
      const date = agent[key];
      return {
        key,
        label: AGENT_FIELD_LABELS[key],
        value: date ? <time dateTime={date}>{formatLicenceDate(date)}</time> : empty,
        filled: Boolean(date),
      };
    }),
    {
      key: "ssnLast4",
      label: AGENT_FIELD_LABELS.ssnLast4,
      value: agent.ssnLast4 ? <CredentialValue value={agent.ssnLast4} label="SSN" secret /> : empty,
      filled: Boolean(agent.ssnLast4),
    },
    {
      key: "remarks",
      label: AGENT_FIELD_LABELS.remarks,
      value: agent.remarks ? <span className="whitespace-pre-wrap">{agent.remarks}</span> : empty,
      filled: Boolean(agent.remarks),
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
      ? [
          {
            key: "certifications" as const,
            label: "Certifications",
            count: certifications.length,
          },
        ]
      : []),
    ...(passwords
      ? [
          {
            key: "passwords" as const,
            label: "Passwords",
            count: passwords.length + (sitePasswords?.length ?? 0),
          },
        ]
      : []),
    ...(notes ? [{ key: "notes" as const, label: "History", count: notes.length }] : []),
  ];
  // The chosen section while it is listed; before a choice, Carriers or else the first one.
  const shown =
    sections.find((item) => item.key === section)?.key ??
    sections.find((item) => item.key === "carriers")?.key ??
    sections[0]?.key ??
    null;

  /** Adds or edits one of this agent's certifications through the API. Resolves with the dialog's errors, if any. */
  const saveAgentCertification = async (values: CertificationValues): Promise<CertificationError[]> => {
    const editingId = certificationEditor?.mode === "edit" ? certificationEditor.certification.id : undefined;
    const result = await saveCertification(values, editingId);
    if (!result.ok) return result.errors;
    setCertifications((current) =>
      [...(current ?? []).filter((row) => row.id !== result.certification.id), result.certification].sort(
        compareCertifications,
      ),
    );
    return [];
  };

  /** Replaces this agent's licences with `rows` through the API. Resolves with the error to show, if any. */
  const saveLicenceRows = async (rows: StateLicense[]): Promise<string | null> => {
    const result = await saveAgentLicenses(agent.id, {
      licensedStates: licensedStatesOf(rows),
      licenseNumbers: licenseNumbersOf(rows),
      licenseStatuses: licenseStatusesOf(rows),
      licenseLines: licenseLinesOf(rows),
      licenseDates: licenseDatesOf(rows),
    });
    if (!result.ok) return result.error.message;
    // The saved agent too: its licensed states decide each carrier's writable states.
    setAgent(result.agent);
    setLicenses(result.licenses);
    return null;
  };

  /** Adds a licence, or replaces the row for `previousState`. */
  const saveLicence = (values: AgentLicenseValues, previousState: string | null) =>
    saveLicenceRows([
      ...licenses.filter((row) => row.state !== previousState),
      // Only the state, number, status, lines and dates are sent; the API keeps the rest.
      { ...values, id: "" },
    ]);

  const removeLicence = (state: string) => saveLicenceRows(licenses.filter((row) => row.state !== state));

  const editPassword = (password: PasswordRecord) => setPasswordEditor({ kind: "carrier", password });
  // Only the carriers / sites this agent has a password at, A–Z.
  const passwordCarriers = [
    ...new Map((passwords ?? []).map((record) => [record.carrierId, record.carrierName])),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const passwordSites = [
    ...new Map((sitePasswords ?? []).map((record) => [record.siteId, record.siteName])),
  ].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }));
  const shownPasswords = (passwords ?? []).filter(
    (record) => !passwordCarrierFilter || record.carrierId === passwordCarrierFilter,
  );
  const shownSitePasswords = (sitePasswords ?? []).filter(
    (record) => !passwordSiteFilter || record.siteId === passwordSiteFilter,
  );
  const placeSelect = (
    kind: "carrier" | "site",
    options: [string, string][],
    value: string,
    setValue: (value: string) => void,
  ) => (
    <>
      <label htmlFor={`${filterId}-${kind}-filter`} className="sr-only">
        Filter by {kind}
      </label>
      <select
        id={`${filterId}-${kind}-filter`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={`${TOOLBAR_INPUT_CLASS} py-1`}
      >
        <option value="">{kind === "carrier" ? "All carriers" : "All sites"}</option>
        {options.map(([optionId, name]) => (
          <option key={optionId} value={optionId}>
            {name}
          </option>
        ))}
      </select>
    </>
  );

  const carrierFilter = placeSelect("carrier", passwordCarriers, passwordCarrierFilter, setPasswordCarrierFilter);

  const editSitePassword = (password: SitePasswordRecord) => setPasswordEditor({ kind: "site", password });

  // The State licences header: Add licence at the end.
  const licencesAction = (
    <button type="button" onClick={() => setLicenseEditor({ mode: "add" })} className={PROFILE_BUTTON_CLASS}>
      <span aria-hidden="true">+ </span>Add licence
      <span className="sr-only"> for {agent.name}</span>
    </button>
  );

  const { confirm, confirmDialog } = useConfirm();

  /** Asks first, then runs a row delete and keeps the API's message when it fails. */
  const runDelete = async (title: string, question: string, remove: () => Promise<string | null>) => {
    if (!(await confirm({ title, message: question }))) return;
    setActionError(null);
    const message = await remove();
    if (message) setActionError(message);
  };

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) pb-12">
      <ProfileNameRow
        name={agent.name}
        status={agent.status}
        onEdit={() => router.push(`/agents/${agent.id}/edit?from=profile`)}
      />

      {/*
       * Section cards sit under the name and span the row, so the panel
       * below can use the full width. They scroll sideways when the row
       * is narrower than the cards' minimum.
       */}
      <nav aria-label="Profile sections" className="mt-6">
        <ul className="flex gap-2 overflow-x-auto py-1">
          {sections.map((item) => {
            const active = item.key === shown;
            return (
              <li key={item.key} className="min-w-40 flex-1">
                <button
                  type="button"
                  onClick={() => setSection(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    active
                      ? "border-brand bg-brand-soft text-brand-ink shadow-[0_1px_2px_0_rgb(0_0_0/0.05),inset_0_-3px_0_var(--color-brand)]"
                      : "glass text-fg hover:border-brand/40 hover:bg-brand-soft/50"
                  }`}
                >
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                      active ? "bg-surface text-brand-ink" : "bg-brand-soft text-brand-ink"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-5 min-w-0">
          {actionError ? (
            <p role="alert" className="mb-3 text-sm text-danger">
              {actionError}
            </p>
          ) : null}
          {shown === "details" ? (
            <Panel title="Details" count={filledCount}>
              <DetailsTable rows={details} />
            </Panel>
          ) : shown === "pending" ? (
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
          ) : shown === "carriers" ? (
            <Panel
              title="Carriers"
              count={agentCarriers.length}
              center={
                agentCarriers.length > 0 ? <TableMapToggle view={carriersView} onChange={setCarriersView} /> : undefined
              }
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
                <>
                  {carriersView === "map" ? (
                    <ProfileStateMap
                      disabled={agencyUnlicensed}
                      counts={carrierCounts}
                      unit={["carrier", "carriers"]}
                      {...(mapCarrier
                        ? {
                            // One carrier picked: its writable states lit, the rest blank.
                            showCounts: false,
                            bucketOf: () => 0,
                            highlighted: mapCarrier.writable,
                            describeState: (code: string) =>
                              `${US_STATE_NAMES[code] ?? code} · ${
                                mapCarrier.writable.includes(code) ? "Writable" : "Not writable"
                              } with ${mapCarrier.name} · ${licensedText(code)}`,
                            legendTitle: mapCarrier.name,
                            legend: [
                              { bucket: "pick" as const, label: "Writable" },
                              { bucket: 0, label: "Not writable" },
                              { bucket: "outline" as const, label: "Licensed" },
                            ],
                          }
                        : {
                            describeState: (code: string) => {
                              const count = carrierCounts[code] ?? 0;
                              return `${US_STATE_NAMES[code] ?? code} · ${count} ${
                                count === 1 ? "carrier" : "carriers"
                              } · ${licensedText(code)}`;
                            },
                            legendTitle: "Carriers writable",
                            legend: [
                              { bucket: 0, label: "0" },
                              { bucket: 1, label: "1" },
                              { bucket: 2, label: "2" },
                              { bucket: 3, label: "3" },
                              { bucket: 4, label: "4+" },
                              { bucket: "outline" as const, label: "Licensed" },
                            ],
                          })}
                      outlined={agent.licensedStates}
                      lineMarkers={carrierLinesAt}
                      overlay={
                        <CarrierMapCard
                          carriers={agentCarriers}
                          selectedId={mapCarrier?.id ?? null}
                          onSelect={(id) => setMapCarrierId((current) => (current === id ? null : id))}
                        />
                      }
                      keepPanelOpen={editor !== null}
                      renderPanelSubtitle={(code) => <LicenseNumber value={agent.licenseNumbers[code]} />}
                      renderPanel={(code) => {
                        const here = agentCarriers.filter((carrier) => carrier.writable.includes(code));
                        return (
                          <>
                            <p role="status" className="text-xs text-fg-muted">
                              {here.length === 1 ? "Carrier" : "Carriers"}: {here.length}
                            </p>
                            {here.length > 0 ? (
                              <ul className="mt-4 divide-y divide-line text-sm">
                                {here.map((carrier) => (
                                  // Clicking the line opens Edit, as on Contracts; the name links to the carrier.
                                  <li
                                    key={carrier.id}
                                    onClick={
                                      () => setEditor({ mode: "edit", contract: carrier.contract })
                                    }
                                    className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-2.5 hover:bg-surface-hover"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate font-semibold text-fg">
                                        <Link
                                          href={`/carriers/${carrier.id}`}
                                          onClick={(event) => event.stopPropagation()}
                                          className="hover:underline"
                                        >
                                          {carrier.name}
                                        </Link>
                                      </span>
                                      <span className="mt-1 block">
                                        <StatusBadge status={carrier.contract.status} />
                                      </span>
                                    </span>
                                    <span onClick={(event) => event.stopPropagation()} className="shrink-0">
                                      <CopyableNumber
                                        value={carrier.writingNumber}
                                        label="Writing number"
                                        empty="No writing number"
                                      />
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-3 text-sm text-fg-subtle">
                                {agent.name} can&apos;t write in {US_STATE_NAMES[code] ?? code} with any carrier yet.
                              </p>
                            )}
                          </>
                        );
                      }}
                    />
                  ) : null}
                  <ProfileTable
                    columns={["Action", ...CARRIER_COLUMNS]}
                    rows={agentCarriers}
                    rowKey={(carrier) => carrier.id}
                  >
                    {(carrier) => (
                      <>
                        <RowActions
                          editLabel={`Edit the ${carrier.name} contract`}
                          onEdit={() => setEditor({ mode: "edit", contract: carrier.contract })}
                          deleteLabel={`Delete the ${carrier.name} contract`}
                          onDelete={() =>
                            void runDelete("Delete contract", `Delete the ${carrier.name} contract?`, () =>
                              removeContract(carrier.contract.id),
                            )
                          }
                        />
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
                          <StatusBadge status={carrier.contract.status} />
                        </td>
                      </>
                    )}
                  </ProfileTable>
                </>
              )}
            </Panel>
          ) : shown === "licences" ? (
            <StateLicensesPanel
              licenses={licenses}
              center={
                licenses.length > 0 ? <TableMapToggle view={licencesView} onChange={setLicencesView} /> : undefined
              }
              beforeTable={
                licencesView === "map" && licenses.length > 0 ? (
                  <ProfileStateMap
                    disabled={agencyUnlicensed}
                    counts={licenceCounts}
                    unit={["licence", "licences"]}
                    showCounts={false}
                    bucketOf={(code) => {
                      const license = licenceByState.get(code);
                      return !license ? 0 : license.status === "active" ? 4 : 2;
                    }}
                    describeState={(code) => {
                      const license = licenceByState.get(code);
                      const name = US_STATE_NAMES[code] ?? code;
                      if (!license) return `${name} · Not licensed`;
                      return [name, license.licenseNumber, licenceLinesText(license), license.status]
                        .filter(Boolean)
                        .join(" · ");
                    }}
                    legendTitle="Licence"
                    legend={[
                      { bucket: 4, label: "Active" },
                      { bucket: 2, label: "Other status" },
                      { bucket: 0, label: "Not licensed" },
                    ]}
                    lineMarkers={(code) => licenceByState.get(code)}
                    keepPanelOpen={licenseEditor !== null}
                    renderPanelSubtitle={(code) => <LicenseNumber value={licenceByState.get(code)?.licenseNumber} />}
                    renderPanel={(code) => {
                      const license = licenceByState.get(code);
                      if (!license) {
                        return (
                          <p className="text-sm text-fg-subtle">
                            {agent.name} isn&apos;t licensed in {US_STATE_NAMES[code] ?? code}.
                          </p>
                        );
                      }
                      return (
                        <>
                          <DetailsTable
                            rows={[
                              { key: "lines", label: "Lines", value: licenceLinesText(license) || "—", filled: true },
                              {
                                key: "status",
                                label: "Status",
                                value: <StatusBadge status={license.status} />,
                                filled: true,
                              },
                              {
                                key: "start",
                                label: "Start",
                                value: <time dateTime={license.startDate}>{formatLicenceDate(license.startDate)}</time>,
                                filled: true,
                              },
                              {
                                key: "end",
                                label: "End",
                                value: <time dateTime={license.endDate}>{formatLicenceDate(license.endDate)}</time>,
                                filled: true,
                              },
                            ]}
                          />
                          <h3 className={`mt-5 mb-2 ${PROFILE_LABEL_CLASS}`}>Carriers</h3>
                          {stateCarriers(code)}
                          <button
                            type="button"
                            onClick={() => setLicenseEditor({ mode: "edit", license })}
                            className={`mt-4 ${PROFILE_BUTTON_CLASS}`}
                          >
                            <EditIcon className="size-3.5 shrink-0" />
                            Edit licence
                          </button>
                        </>
                      );
                    }}
                  />
                ) : null
              }
              showLines
              action={licencesAction}
              onEdit={(license) => setLicenseEditor({ mode: "edit", license })}
              onDelete={(license) =>
                void runDelete(
                  "Delete licence",
                  `Delete the ${US_STATE_NAMES[license.state] ?? license.state} licence?`,
                  () => removeLicence(license.state),
                )
              }
            />
          ) : shown === "certifications" && certifications ? (
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
                // One table per year due, newest first.
                <div className="grid gap-6">
                  {certificationsByYear(certifications).map((group) => (
                    <section key={group.year || "none"} aria-label={`Certifications due ${group.year || "without a date"}`}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                        {group.year || "No due date"}
                        <span className="ml-2 font-normal tabular-nums">{group.certifications.length}</span>
                      </h3>
                      <CertificationsTable
                        certifications={group.certifications}
                        onEdit={(certification) => setCertificationEditor({ mode: "edit", certification })}
                        onDelete={(certification) =>
                          void runDelete(
                            "Delete certification",
                            `Delete the ${certificationLabel(certification)} certification?`,
                            async () => {
                              const result = await deleteCertification(certification.id);
                              if (!result.ok) return result.message;
                              setCertifications((current) =>
                                (current ?? []).filter((row) => row.id !== certification.id),
                              );
                              return null;
                            },
                          )
                        }
                      />
                    </section>
                  ))}
                </div>
              )}
            </Panel>
          ) : shown === "passwords" && passwords ? (
            <div className="grid gap-5">
              <PasswordsPanel
                passwords={shownPasswords}
                party="carrier"
                filter={carrierFilter}
                emptyText={passwordCarrierFilter ? "No passwords at this carrier." : undefined}
                onAdd={() => setPasswordEditor({ kind: "carrier", agentId: agent.id })}
                onEdit={editPassword}
              />
              {sitePasswords ? (
                <Panel
                  title="Site passwords"
                  count={shownSitePasswords.length}
                  action={
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      {placeSelect("site", passwordSites, passwordSiteFilter, setPasswordSiteFilter)}
                      <button type="button" onClick={() => setPasswordEditor({ kind: "site", agentId: agent.id })} className={PROFILE_BUTTON_CLASS}>
                        <span aria-hidden="true">+ </span>Add site password
                      </button>
                    </span>
                  }
                >
                  {shownSitePasswords.length === 0 ? (
                    <PanelEmpty>
                      {passwordSiteFilter ? "No site passwords at this site." : "No site passwords recorded."}
                    </PanelEmpty>
                  ) : (
                    <SitePasswordsTable
                      passwords={shownSitePasswords}
                      onEdit={editSitePassword}
                    />
                  )}
                </Panel>
              ) : null}
            </div>
          ) : shown === "notes" && notes ? (
            <Panel title="History" count={notes.length}>
              {/* Cancels NoteList's own top margin; the panel body already pads. */}
              <div className="-mt-2">
                <HydratedNoteList notes={notes} labels={AGENT_FIELD_LABELS} />
              </div>
            </Panel>
          ) : shown === null ? (
            <PanelEmpty>Nothing is shared with you yet. Ask the office.</PanelEmpty>
          ) : null}
      </div>

      {confirmDialog}

      {/* This agent is the only choice, so a password added here is always theirs. Sites
          are chosen from the list only: adding or editing a site is on the Passwords page. */}
      <AddPasswordDialog
        editor={passwordEditor}
        agents={[{ id: agent.id, name: agent.name, status: agent.status }]}
        agency={null}
        carriers={carriers}
        sites={sites}
        manageSites={false}
        onSaved={() => router.refresh()}
        onClose={() => setPasswordEditor(null)}
      />

      {/* Agent fixed to this profile. */}
      <CertificationDialog
        editor={certificationEditor}
        agent={{ id: agent.id, name: agent.name }}
        carriers={certificationCarriers}
        onSave={saveAgentCertification}
        onClose={() => setCertificationEditor(null)}
      />

      <AgentLicenseDialog
        editor={licenseEditor}
        licensedStates={agent.licensedStates}
        agencyStates={agencyLicensedStates}
        onSave={saveLicence}
        onRemove={removeLicence}
        onClose={() => setLicenseEditor(null)}
      />

      {/* Agent locked to this profile: the only option, already chosen. */}
      <AppointmentDialog
        editor={editor}
        agents={[
          {
            id: agent.id,
            name: agent.name,
            status: agent.status,
            licensedStates: agent.licensedStates,
          },
        ]}
        carriers={carriers}
        requireWritingNumber
        onSave={saveContract}
        onClose={() => setEditor(null)}
      />
    </div>
  );
}
