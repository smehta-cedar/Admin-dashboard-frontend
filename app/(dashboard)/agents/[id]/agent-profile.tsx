"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { HydratedNoteList } from "@/components/hydrated-note-list";
import {
  Count,
  PasswordsPanel,
  Panel,
  PanelEmpty,
  PROFILE_BUTTON_CLASS,
  PROFILE_LINK_CLASS,
  ProfileNameRow,
  ProfileTable,
  StateChipCell,
  type ProfilePassword,
} from "@/components/profile-shell";
import { StateLicensesPanel } from "@/components/state-licenses-panel";
import { StatusBadge } from "@/components/status-badge";
import { UnsavedBanner } from "@/components/unsaved-banner";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import type {
  CarrierContractNote,
  CarrierContractRecord,
} from "@/lib/carrier-contracts";
import type { CarrierRecord } from "@/lib/carriers";
import { formatAddress } from "@/lib/address";
import { writableStates } from "@/lib/us-states";
import { byName } from "@/lib/text";
import { AppointmentDialog } from "../../contracts/appointment-dialog";
import { useAppointments } from "../../contracts/use-appointments";
import {
  AGENT_FIELD_LABELS,
  AgentDialog,
  saveAgent,
  type AgentEditor,
  type AgentError,
  type AgentValues,
} from "../agent-dialog";

/*
 * Profile for one agent: identity, then everything linked to them — the states
 * they can write in, contracted carriers, what is still pending, passwords,
 * and change notes. Passwords are still edited on their page. Two things
 * are editable here: the agent's own fields (Edit opens the same AgentDialog as
 * the Agents list) and appointing this agent to a carrier.
 *
 * Layout, from the shared pieces in components/profile-shell.tsx, top to
 * bottom — no tabs and no sticky rail. The page is capped at the 2xl
 * breakpoint, wider than the list pages:
 *
 *   name row        — initials, name, status, Edit; not in a card
 *   details | counts (2/3 | 1/3 from `lg`, tops and bottoms aligned)
 *                   — four detail cards in one row, one per contact field
 *                     (NPN, email with mailto, phone with tel, aliases;
 *                     always all four, an empty one shows "—"): a tinted
 *                     icon, the label, the value right-aligned and truncated,
 *                     and a bar in the same hue. Beside them, four small
 *                     count cards as a 2×2 (Carriers, State licences,
 *                     Pending, Passwords): a tinted icon and the number its
 *                     panel below shows, with its name, and no bar; the
 *                     two rows share out the detail cards' height
 *   personal contact — a second row of three detail cards under the first
 *                     (personal email, personal phone, address; an empty one
 *                     shows "—"), the same width as the four above
 *   unsaved banner  — only once something was changed
 *   Pending card    — full width, only when something is pending; no empty
 *                     state, absence is the good news. With nothing pending
 *                     and nothing unsaved, nothing sits between the top row
 *                     and the panels
 *   Carriers | State licences (50/50 from `lg`)
 *                   — what the page is opened for, beside the licences that
 *                     bound it
 *   Passwords | Notes (70/30 from `lg`)
 *                   — the wide passwords table beside the audit trail
 *
 * The cards local to this file (details, counts, Pending) are `rounded-sm`;
 * the shared `Panel` keeps its own corners.
 *
 * Below `lg` everything stacks in that reading order: name, the four detail
 * cards, the 2×2 counts, unsaved banner, Pending, Carriers, State licences,
 * Passwords, Notes.
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
 * task records yet. See `pendingItems`.
 *
 * "Add carrier" opens the shared AppointmentDialog
 * (../../contracts/appointment-dialog.tsx) in add mode with this agent
 * pre-filled — the same form and the same saveAppointment as Contracts, so the
 * duplicate and available-states checks are identical. An inactive agent can
 * still be appointed and keeps their carriers listed: contracts follow the
 * agent, not their status, on every page (the Contracts pages just leave them
 * out of the counts). It is all dummy like the rest: the agent, contracts and
 * notes live in component state, and a refresh brings back the JSON. page.tsx
 * keys this component by agent ID, so switching agents starts that state again.
 */

type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "availableStates">;

type AgentProfileProps = {
  initialAgent: AgentRecord;
  /** Every agent: the switcher's options and the NPN uniqueness check. */
  allAgents: Pick<AgentRecord, "id" | "name" | "status" | "npn">[];
  /** Every carrier, sorted by name, for the Add carrier dialog. */
  carriers: CarrierOption[];
  /** Every contract, not just this agent's: the duplicate check and new IDs need them all. */
  initialContracts: CarrierContractRecord[];
  /** Every contract note, newest first. Not shown here; new ones are still recorded. */
  initialContractNotes: CarrierContractNote[];
  /** Every agent's licence rows, in ID order: new row IDs need them all. Only this agent's are shown. */
  initialLicenses: AgentStateLicenseRecord[];
  /** This agent's passwords, the carrier as the party, sorted by carrier name. */
  passwords: ProfilePassword[];
  /** Every agent's notes, newest first: new note IDs need them all. Only this agent's are shown. */
  initialNotes: AgentNote[];
};

const CARRIER_COLUMNS = ["Carrier", "Writing number", "Writable states", "Status"];

type SummaryHue = "blue" | "amber" | "indigo" | "green";

/** Full class strings per hue, so Tailwind can see every one it has to emit. */
const SUMMARY_HUE_CLASSES: Record<SummaryHue, { tint: string; bar: string }> = {
  blue: { tint: "bg-stat-blue-soft text-stat-blue-ink", bar: "bg-stat-blue-ink" },
  amber: { tint: "bg-stat-amber-soft text-stat-amber-ink", bar: "bg-stat-amber-ink" },
  indigo: { tint: "bg-stat-indigo-soft text-stat-indigo-ink", bar: "bg-stat-indigo-ink" },
  green: { tint: "bg-stat-green-soft text-stat-green-ink", bar: "bg-stat-green-ink" },
};

/**
 * Outline glyphs on the sidebar's 24-grid (components/nav-icons.tsx), one per
 * card. Details: a hash (the NPN is a number), an envelope, a handset, a name
 * tag, a map pin (address). Counts: an office building, a licence card, a
 * list, a key.
 */
const SUMMARY_ICONS = {
  hash: <path d="M9.75 3.5 7.75 20.5M16.25 3.5l-2 17M4 9h16.5M3.5 15H20" />,
  envelope: (
    <>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2" />
      <path d="m3.5 6.75 8.5 6.25 8.5-6.25" />
    </>
  ),
  handset: (
    <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
  ),
  tag: (
    <>
      <path d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <circle cx="6.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s-6.75-6.2-6.75-11.25a6.75 6.75 0 0 1 13.5 0C18.75 15.3 12 21.5 12 21.5Z" />
      <circle cx="12" cy="10.25" r="2.5" />
    </>
  ),
  building: (
    <path d="M3.75 21h16.5M5.25 21V4.5A1.5 1.5 0 0 1 6.75 3h10.5a1.5 1.5 0 0 1 1.5 1.5V21M9 7.5h1.5m3 0H15M9 11.25h1.5m3 0H15M9 15h1.5m3 0H15M10.5 21v-3h3v3" />
  ),
  licence: (
    <>
      <rect x="2.75" y="5" width="18.5" height="14" rx="2" />
      <circle cx="8.25" cy="10.25" r="2" />
      <path d="M5 16c.6-1.5 1.8-2.25 3.25-2.25S10.9 14.5 11.5 16M14 9.5h4.25M14 12.75h4.25M14 16h2.75" />
    </>
  ),
  list: (
    <>
      <path d="M8.75 6.5h11.5M8.75 12h11.5M8.75 17.5h11.5" />
      <circle cx="4.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  key: (
    <>
      <circle cx="15.75" cy="8.25" r="4.5" />
      <path d="M12.5 11.5 3.75 20.25M6.25 17.75l2 2M8.75 15.25l2 2" />
    </>
  ),
};

/** The outline icon in its tinted square. `size` is the square; the glyph is a step smaller. */
function SummaryIcon({
  icon,
  hue,
  size,
}: {
  icon: keyof typeof SUMMARY_ICONS;
  hue: SummaryHue;
  size: "md" | "sm";
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-md ${size === "md" ? "size-11 rounded-lg" : "size-7"} ${SUMMARY_HUE_CLASSES[hue].tint}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={size === "md" ? "size-6" : "size-4"}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {SUMMARY_ICONS[icon]}
      </svg>
    </span>
  );
}

type DetailCard = {
  key: string;
  label: string;
  /** The field's text: a link, a mono span, or "—" when empty. */
  value: ReactNode;
  /** Full text behind a truncated value, shown on hover. */
  title?: string;
  hue: SummaryHue;
  icon: keyof typeof SUMMARY_ICONS;
};

/**
 * Contact cards on one line from `lg` (stacked below): an icon in its tint,
 * the label, the value right-aligned and truncated so an email fits a narrow
 * card, and a short bar in the same hue underneath. The bar is decoration
 * (always full width; it doesn't stand for a share of anything). Each card is
 * a `<dt>` / `<dd>` pair, so the row reads as "Email, …". `columns` is the
 * count from `lg`: four for the work row, three for the personal one.
 */
function DetailCards({
  cards,
  columns,
  className = "",
}: {
  cards: DetailCard[];
  columns: 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={`grid grid-cols-1 gap-4 ${columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} ${className}`}
    >
      {cards.map((card) => (
        <div
          key={card.key}
          className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] content-center items-center gap-x-3 rounded-sm border border-line bg-surface px-4 py-4 shadow-sm"
        >
          <SummaryIcon icon={card.icon} hue={card.hue} size="md" />
          <dt className="truncate text-sm font-medium text-fg-muted">{card.label}</dt>
          <dd title={card.title} className="min-w-0 truncate text-right text-sm text-fg">
            {card.value}
          </dd>
          <div
            aria-hidden="true"
            className={`col-span-3 mt-4 h-1 rounded-full ${SUMMARY_HUE_CLASSES[card.hue].bar}`}
          />
        </div>
      ))}
    </dl>
  );
}

type CountCard = {
  key: string;
  /** Printed between the icon and the number. */
  label: string;
  value: number;
  hue: SummaryHue;
  icon: keyof typeof SUMMARY_ICONS;
};

/**
 * The four count cards as a 2×2 block: an icon in its tint, the name, and the
 * number, with a tight gap and small padding so the two rows fit inside the
 * height of the detail cards beside them (`h-full` + `grid-rows-2` share that
 * height out). No bar. Each card is a `<dt>` / `<dd>` pair, so the block still
 * reads as "Carriers, 3".
 */
function CountCards({ cards, className = "" }: { cards: CountCard[]; className?: string }) {
  return (
    <dl className={`grid grid-cols-2 grid-rows-2 gap-2 ${className}`}>
      {cards.map((card) => (
        <div
          key={card.key}
          className="flex min-w-0 items-center gap-2 rounded-sm border border-line bg-surface px-3 py-1.5 shadow-sm"
        >
          <SummaryIcon icon={card.icon} hue={card.hue} size="sm" />
          <dt className="min-w-0 flex-1 truncate text-xs font-medium text-fg-muted">{card.label}</dt>
          <dd className="shrink-0 text-lg font-semibold tabular-nums text-fg">{card.value}</dd>
        </div>
      ))}
    </dl>
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

export function AgentProfile({
  initialAgent,
  allAgents,
  carriers,
  initialContracts,
  initialContractNotes,
  initialLicenses,
  passwords,
  initialNotes,
}: AgentProfileProps) {
  const [agent, setAgent] = useState(initialAgent);
  const [allNotes, setAllNotes] = useState(initialNotes);
  const [allLicenses, setAllLicenses] = useState(initialLicenses);
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [agentEditor, setAgentEditor] = useState<AgentEditor | null>(null);
  const pendingHeadingId = useId();
  // The dialog locks the agent to this profile, so the live agent is the only
  // lookup it needs; an edited name or licence list is read at save time.
  const { contracts, editor, setEditor, saveContract } = useAppointments({
    initialContracts,
    initialNotes: initialContractNotes,
    agents: [agent],
    carriers,
    onSaved: () => setUnsavedCount((count) => count + 1),
  });

  // An edit here shows at once in the switcher too.
  const agents = allAgents.map((other) => (other.id === agent.id ? agent : other));
  const notes = allNotes.filter((note) => note.agentId === agent.id);
  const licenses = allLicenses.filter((license) => license.agentId === agent.id);

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

  // Contact cards: always all four work ones and all three personal ones, so
  // the rows keep their shape; an empty field shows "—".
  const empty = <span className="text-fg-subtle">—</span>;
  const linkClass = "hover:text-brand-ink hover:underline";
  const aliases = agent.aliases.join(", ");
  const details: DetailCard[] = [
    {
      key: "npn",
      label: AGENT_FIELD_LABELS.npn,
      value: agent.npn ? <span className="font-mono">{agent.npn}</span> : empty,
      title: agent.npn || undefined,
      hue: "blue",
      icon: "hash",
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
      title: agent.email || undefined,
      hue: "amber",
      icon: "envelope",
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
      title: agent.phone || undefined,
      hue: "indigo",
      icon: "handset",
    },
    {
      key: "aliases",
      label: AGENT_FIELD_LABELS.aliases,
      value: aliases || empty,
      title: aliases || undefined,
      hue: "green",
      icon: "tag",
    },
  ];
  const address = formatAddress(agent.address);
  const personalDetails: DetailCard[] = [
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
      title: agent.personalEmail || undefined,
      hue: "amber",
      icon: "envelope",
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
      title: agent.personalPhone || undefined,
      hue: "indigo",
      icon: "handset",
    },
    {
      key: "address",
      label: AGENT_FIELD_LABELS.address,
      value: address || empty,
      title: address || undefined,
      hue: "blue",
      icon: "pin",
    },
  ];

  /** Edits this agent. Returns the dialog's error, if any. */
  const saveAgentEdit = (values: AgentValues): AgentError | null => {
    const result = saveAgent({
      agents,
      notes: allNotes,
      licenses: allLicenses,
      values,
      editing: agent,
    });
    if (result.error !== null) return result.error;
    if (!result.changed) return null;

    setAgent(result.agent);
    setAllLicenses(result.licenses);
    setAllNotes(result.notes);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  return (
    <div className="mx-auto max-w-(--breakpoint-2xl) pb-12">
      <ProfileNameRow
        name={agent.name}
        status={agent.status}
        onEdit={() => setAgentEditor({ mode: "edit", agent })}
      />

      {/*
       * Four detail cards in a row (2/3) beside the counts as a 2×2 (1/3),
       * the counts sharing out the details' height so tops and bottoms
       * align. Below `lg` the details stack, then the 2×2.
       */}
      <div className="mt-5 grid items-stretch gap-4 lg:grid-cols-3">
        <DetailCards className="h-full lg:col-span-2" columns={4} cards={details} />

        {/* The same four counts the panels below carry, up front. */}
        <CountCards
          className="h-full"
          cards={[
            { key: "carriers", label: "Carriers", value: agentCarriers.length, hue: "blue", icon: "building" },
            { key: "licences", label: "State licences", value: licenses.length, hue: "amber", icon: "licence" },
            { key: "pending", label: "Pending", value: pending.length, hue: "indigo", icon: "list" },
            { key: "passwords", label: "Passwords", value: passwords.length, hue: "green", icon: "key" },
          ]}
        />

        {/* Personal contact: a second row under the work row, the same width. */}
        <DetailCards className="lg:col-span-2" columns={3} cards={personalDetails} />
      </div>

      {/* The status region always renders; the banner itself only once something changed. */}
      <UnsavedBanner count={unsavedCount} className="mt-4" />

      {/* Attention card: only there when something needs doing. */}
      {pending.length > 0 ? (
        <section
          aria-labelledby={pendingHeadingId}
          className="mt-4 min-w-0 overflow-hidden rounded-sm border border-line bg-surface shadow-sm"
        >
          <h2
            id={pendingHeadingId}
            className="flex min-h-13 items-center gap-2 border-b border-line px-5 py-2.5 text-sm font-semibold text-fg"
          >
            Pending
            <Count value={pending.length} />
          </h2>
          <ul className="divide-y divide-line">
            {pending.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3 px-5 py-3">
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
        </section>
      ) : null}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-10">
        {/* Row one, 50/50: the primary work beside the licences it depends on. */}
        <Panel
          className="lg:col-span-5"
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
                  <td className="min-w-0 truncate px-3 py-2.5 align-middle font-mono text-fg-muted">
                    {carrier.writingNumber || (
                      <span className="font-sans text-xs text-fg-faint">No writing number</span>
                    )}
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

        <StateLicensesPanel licenses={licenses} className="lg:col-span-5" />

        {/* Row two, 70/30: the wide passwords table beside the audit trail. */}
        <PasswordsPanel passwords={passwords} partyHeading="Carrier" className="lg:col-span-7" />

        <Panel title="Notes" count={notes.length} className="lg:col-span-3">
          {/* Cancels NoteList's own top margin; the panel body already pads. */}
          <div className="-mt-2">
            <HydratedNoteList notes={notes} labels={AGENT_FIELD_LABELS} />
          </div>
        </Panel>
      </div>

      <AgentDialog editor={agentEditor} onSave={saveAgentEdit} onClose={() => setAgentEditor(null)} />

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
