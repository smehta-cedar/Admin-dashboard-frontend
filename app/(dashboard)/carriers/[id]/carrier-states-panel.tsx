"use client";

import Link from "next/link";
import { Panel, PROFILE_LINK_CLASS } from "@/components/profile-shell";
import { ProfileStateMap, type MapLegendItem } from "@/components/profile-state-map";
import { licenceLinesText, type StateLicense } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * The carrier profile's "Available states" panel: where the carrier is
 * available and which lines (Life, Health or both) it covers there. A
 * carrier holds no licences, so a row is only the state and its lines.
 *
 * Map only, no table: each available state is coloured by its lines — Life,
 * Health, Both, or no line recorded — and the rest are left blank. Clicking
 * a state slides in its lines and the contracted agents who can write there.
 */

type WritingAgent = { id: string; name: string; writable: string[] };

type CarrierStatesPanelProps = {
  /** The carrier's state rows. */
  rows: StateLicense[];
  /** Contracted agents with the states they can write with this carrier. */
  agents: WritingAgent[];
  className?: string;
};

const LEGEND: MapLegendItem[] = [
  { swatch: "bg-map-life", label: "Life" },
  { swatch: "bg-map-health", label: "Health" },
  { swatch: "bg-map-both", label: "Life & Health" },
  { swatch: "bg-map-none", label: "No line recorded" },
  { bucket: 0, label: "Not available" },
];

/** The map fill for a row's lines. */
function linesFill(row: StateLicense) {
  if (row.life && row.health) return "fill-map-both";
  if (row.life) return "fill-map-life";
  if (row.health) return "fill-map-health";
  return "fill-map-none";
}

export function CarrierStatesPanel({ rows, agents, className }: CarrierStatesPanelProps) {
  const byState = new Map(rows.map((row) => [row.state, row]));
  const stateName = (code: string) => US_STATE_NAMES[code] ?? code;
  const linesOf = (code: string) => {
    const row = byState.get(code);
    if (!row) return "Not available";
    return licenceLinesText(row) || "No line recorded";
  };

  return (
    <Panel title="Available states" count={rows.length} className={className}>
      <ProfileStateMap
        counts={{}}
        unit={["state", "states"]}
        showCounts={false}
        bucketOf={() => 0}
        fillOf={(code) => {
          const row = byState.get(code);
          return row ? linesFill(row) : undefined;
        }}
        describeState={(code) => `${stateName(code)} · ${linesOf(code)}`}
        legendTitle="Lines"
        legend={LEGEND}
        renderPanelSubtitle={(code) => linesOf(code)}
        renderPanel={(code) => {
          const writers = agents.filter((agent) => agent.writable.includes(code));
          return (
            <>
              <h4 className="text-xs font-medium text-fg-muted">Agents who can write here</h4>
              {writers.length === 0 ? (
                <p className="mt-1 text-sm text-fg-subtle">None.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {writers.map((agent) => (
                    <li key={agent.id}>
                      <Link href={`/agents/${agent.id}`} className={PROFILE_LINK_CLASS}>
                        {agent.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      />
    </Panel>
  );
}
