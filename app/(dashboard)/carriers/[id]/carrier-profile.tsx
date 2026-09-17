import Link from "next/link";
import { ProfileSection, ProfileShell } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import type { AgentStatus } from "@/lib/agents";
import type { CarrierNote, CarrierRecord } from "@/lib/carriers";
import type { LoginRecord } from "@/lib/logins";
import { stateSummary } from "@/lib/us-states";
import { CredentialValue } from "../../logins/credential-value";
import { CarrierNotes } from "./carrier-notes";
import { CarrierSwitcher } from "./carrier-switcher";

/*
 * Read-only profile for one carrier: identity (including the states it is
 * available in, the ceiling for its appointments), then everything linked to it —
 * contracted agents (with the states each is appointed in), logins, and change
 * notes. Editing stays on the Carriers, Contracts and Logins pages. Agent names
 * link to their profiles.
 */

type CarrierProfileProps = {
  carrier: CarrierRecord;
  /** Every carrier, sorted by name, for the switcher. */
  allCarriers: Pick<CarrierRecord, "id" | "name" | "status">[];
  /** Contracted agents, sorted by name, each with its appointed state codes in code order. */
  agents: { id: string; name: string; status: AgentStatus; appointedStates: string[] }[];
  /** Sorted by agent name. */
  logins: (LoginRecord & { agentName: string })[];
  /** Newest first. */
  notes: CarrierNote[];
};

const LOGIN_COLUMNS = ["Agent", "Writing number", "Portal username", "Password", "Status"];

const LINK_CLASS = "text-fg hover:underline";

export function CarrierProfile({ carrier, allCarriers, agents, logins, notes }: CarrierProfileProps) {
  return (
    <ProfileShell
      back={{ href: "/carriers", label: "Carriers" }}
      title={carrier.name}
      status={carrier.status}
      actions={<CarrierSwitcher currentId={carrier.id} carriers={allCarriers} />}
      subtitle={<span className="font-mono">Carrier #{carrier.id}</span>}
      identity={[
        { label: "Aliases", value: carrier.aliases.join(", ") },
        {
          label: "Lines of business",
          value:
            carrier.linesOfBusiness.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {carrier.linesOfBusiness.map((line) => (
                  <li key={line} className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-fg-muted">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              ""
            ),
        },
        {
          label: "Available states",
          value: (
            <span className={carrier.availableStates.length === 0 ? "text-fg-subtle" : "tabular-nums"}>
              {stateSummary(carrier.availableStates)}
            </span>
          ),
        },
      ]}
    >
      <ProfileSection title="Agents" count={agents.length} emptyMessage="No contracted agents.">
        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
          {agents.map((agent) => (
            <li key={agent.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <Link href={`/agents/${agent.id}`} className={LINK_CLASS}>
                {agent.name}
              </Link>
              <div className="flex items-center gap-3">
                {/* Every appointed state code, or "No states". */}
                <span
                  title={agent.appointedStates.join(", ") || undefined}
                  className={`font-mono text-xs tabular-nums ${
                    agent.appointedStates.length === 0 ? "text-fg-faint" : "text-fg-muted"
                  }`}
                >
                  {stateSummary(agent.appointedStates)}
                </span>
                <StatusBadge status={agent.status} />
              </div>
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Logins" count={logins.length} emptyMessage="No logins recorded.">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface-muted">
              <tr>
                {LOGIN_COLUMNS.map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="whitespace-nowrap px-4 py-2.5 font-medium text-fg-muted"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {logins.map((login) => (
                <tr key={login.id}>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link href={`/agents/${login.agentId}`} className={LINK_CLASS}>
                      {login.agentName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-fg-muted">{login.writingNumber}</td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    <CredentialValue value={login.username} label="username" />
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    <CredentialValue value={login.portalPassword} label="password" secret />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={login.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProfileSection>

      <ProfileSection title="Notes" count={notes.length}>
        <CarrierNotes notes={notes} />
      </ProfileSection>
    </ProfileShell>
  );
}
