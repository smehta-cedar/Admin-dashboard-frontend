import Link from "next/link";
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
 * the states they can write in, contracted carriers, logins, and change notes.
 * Editing stays on the Agents, Contracts and Logins pages. Carrier names link
 * to their profiles.
 *
 * States come from carrier appointments only: "States" is the union across
 * every appointment ("via carriers"), and each carrier row lists the states
 * that appointment covers.
 */

type AgentProfileProps = {
  agent: AgentRecord;
  /** Every agent, sorted by name, for the switcher. */
  allAgents: Pick<AgentRecord, "id" | "name" | "status">[];
  /** Contracted carriers, sorted by name, each with its appointed state codes in code order. */
  carriers: { id: string; name: string; status: CarrierStatus; appointedStates: string[] }[];
  /** Sorted by carrier name. */
  logins: (LoginRecord & { carrierName: string })[];
  /** Newest first. */
  notes: AgentNote[];
};

const LOGIN_COLUMNS = ["Carrier", "Writing number", "Portal username", "Password", "Status"];

/** A state code chip, with the full name on hover and for screen readers. */
function StateChip({ code }: { code: string }) {
  return (
    <li
      title={US_STATE_NAMES[code]}
      className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-medium text-gray-700"
    >
      {code}
      {US_STATE_NAMES[code] ? <span className="sr-only"> ({US_STATE_NAMES[code]})</span> : null}
    </li>
  );
}

export function AgentProfile({ agent, allAgents, carriers, logins, notes }: AgentProfileProps) {
  const states = [...new Set(carriers.flatMap((carrier) => carrier.appointedStates))].sort();

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
        title="States"
        count={states.length}
        emptyMessage="Not appointed in any states through a carrier yet."
      >
        <p className="mb-2 text-xs text-gray-500">Via carrier appointments</p>
        <ul className="flex flex-wrap gap-1.5">
          {states.map((code) => (
            <StateChip key={code} code={code} />
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Carriers" count={carriers.length} emptyMessage="Not contracted with any carriers.">
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 text-sm">
          {carriers.map((carrier) => (
            <li key={carrier.id} className="flex flex-col gap-2 px-4 py-2.5">
              <div className="flex items-center justify-between gap-4">
                <Link href={`/carriers/${carrier.id}`} className="text-gray-900 hover:underline">
                  {carrier.name}
                </Link>
                <StatusBadge status={carrier.status} />
              </div>
              {carrier.appointedStates.length > 0 ? (
                <ul aria-label={`States with ${carrier.name}`} className="flex flex-wrap gap-1">
                  {carrier.appointedStates.map((code) => (
                    <StateChip key={code} code={code} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400">No states yet</p>
              )}
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
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link href={`/carriers/${login.carrierId}`} className="text-gray-900 hover:underline">
                      {login.carrierName}
                    </Link>
                  </td>
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
