/*
 * Glanceable bar chart: active agents contracted per carrier, one small block
 * per line of business. Bars run from 0 to the number of active agents, so a
 * full bar means every active agent is contracted. Plain HTML/CSS bars in the
 * app's gray/green/amber tokens; the count is always text and the bar's length
 * shows the share, so color is never the only signal.
 */

export type ChartBar = {
  /** Unique within its group. */
  id: string;
  name: string;
  count: number;
  /** Tailwind background class for the bar, e.g. "bg-green-500". */
  barClass: string;
};

export type ChartGroup = { line: string; bars: ChartBar[] };

type AgentsPerCarrierChartProps = {
  groups: ChartGroup[];
  /** Number of active agents: the scale's maximum. */
  total: number;
  /** Explains what the chart currently includes. */
  scopeText: string;
};

export function AgentsPerCarrierChart({ groups, total, scopeText }: AgentsPerCarrierChartProps) {
  return (
    <section
      aria-labelledby="agents-per-carrier-title"
      className="mb-10 rounded-lg border border-gray-200 bg-white px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="agents-per-carrier-title" className="text-sm font-semibold text-gray-900">
          Policy Type
        </h2>
        <p className="text-xs text-gray-500">
          Out of {total} active {total === 1 ? "agent" : "agents"} · {scopeText}
        </p>
      </div>

      <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(({ line, bars }) => (
          <div key={line}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{line}</h3>
            <ul className="mt-1.5 space-y-1">
              {[...bars]
                .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
                .map((bar) => {
                  const percent = total === 0 ? 0 : Math.min(100, (bar.count / total) * 100);
                  return (
                    <li
                      key={bar.id}
                      title={`${bar.name} · ${bar.count} of ${total} active agents`}
                      className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_1.5rem] items-center gap-2 rounded px-1 text-xs hover:bg-gray-50"
                    >
                      <span className="truncate text-gray-700">{bar.name}</span>
                      <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-sm bg-gray-100">
                        <span
                          className={`block h-full rounded-r-sm ${bar.barClass}`}
                          style={{ width: `${percent}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums text-gray-900">
                        {bar.count}
                        <span className="sr-only">
                          {" "}
                          of {total} active agents
                        </span>
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
