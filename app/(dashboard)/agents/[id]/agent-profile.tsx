import { ProfileSection, ProfileShell } from "@/components/profile-shell";
import { StatusBadge } from "@/components/status-badge";
import type { AgentNote, AgentRecord } from "@/lib/agents";
import type { CarrierStatus } from "@/lib/carriers";
import type { LoginRecord } from "@/lib/logins";
import { US_STATE_NAMES } from "@/lib/us-states";
import { CredentialValue } from "../../logins/credential-value";
import { AgentNotes } from "./agent-notes";
import { AgentSwitcher } from "./agent-switcher";

/*
 * Read-only profile for one agent: identity, then everything linked to them —
 * licensed states, contracted carriers, logins, and change notes. Editing
 * stays on the Agents, Contracts and Logins pages.
 *
 * Carrier names are plain text until carriers get their own profile page.
 */

type AgentProfileProps = {
  agent: AgentRecord;
  /** Every agent, sorted by name, for the switcher. */
  allAgents: Pick<AgentRecord, "id" | "name" | "status">[];
  /** State codes, as stored on the agent's contract. */
  licensedStates: string[];
  /** Contracted carriers, sorted by name. */
  carriers: { id: string; name: string; status: CarrierStatus }[];
  /** Sorted by carrier name. */
  logins: (LoginRecord & { carrierName: string })[];
  /** Newest first. */
  notes: AgentNote[];
};

const LOGIN_COLUMNS = ["Carrier", "Writing number", "Portal username", "Password", "Status"];

export function AgentProfile({ agent, allAgents, licensedStates, carriers, logins, notes }: AgentProfileProps) {
  return (
    <ProfileShell
      back={{ href: "/agents", label: "Agents" }}
      title={agent.name}
      status={agent.status}
      actions={<AgentSwitcher currentId={agent.id} agents={allAgents} />}
      subtitle={<span className="font-mono">Agent #{agent.id}</span>}
      identity={[
        { label: "NPN", value: <span className="font-mono">{agent.npn}</span> },
        { label: "Email", value: agent.email },
        { label: "Phone", value: agent.phone },
        { label: "Aliases", value: agent.aliases.join(", ") },
      ]}
    >
      <ProfileSection
        title="Licensed states"
        count={licensedStates.length}
        emptyMessage="No licensed states recorded."
      >
        <ul className="flex flex-wrap gap-1.5">
          {licensedStates
            .slice()
            .sort()
            .map((code) => (
              <li
                key={code}
                title={US_STATE_NAMES[code]}
                className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-medium text-gray-700"
              >
                {code}
                {US_STATE_NAMES[code] ? <span className="sr-only"> ({US_STATE_NAMES[code]})</span> : null}
              </li>
            ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Carriers" count={carriers.length} emptyMessage="Not contracted with any carriers.">
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm">
          {carriers.map((carrier) => (
            <li key={carrier.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-gray-900">{carrier.name}</span>
              <StatusBadge status={carrier.status} />
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Logins" count={logins.length} emptyMessage="No logins recorded.">
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                {LOGIN_COLUMNS.map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-600"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-t border-gray-200">
              {logins.map((login) => (
                <tr key={login.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-900">{login.carrierName}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-600">{login.writingNumber}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    <CredentialValue value={login.username} label="username" />
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
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
        <AgentNotes notes={notes} />
      </ProfileSection>
    </ProfileShell>
  );
}
