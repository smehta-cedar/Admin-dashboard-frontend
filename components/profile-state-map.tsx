"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DISABLED_SWATCH, MAP_BUCKETS, UsMap } from "@/components/us-map";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * A profile panel's map view: the shared UsMap (components/us-map.tsx) in a
 * bordered box with a legend, above the panel's table (which always lists
 * every row). Clicking a state slides in the same right-hand panel as the
 * Contracts page, with that state's detail from `renderPanel`; Close, Escape
 * or a press outside closes it. `overlay` floats a card over the map's
 * top-left (the Carriers map's carrier list). The panel puts a TableMapToggle
 * in its header to swap between table only and map + table.
 */

export type PanelView = "table" | "map";

/** The Table | Map switch for a panel header. */
export function TableMapToggle({ view, onChange }: { view: PanelView; onChange: (view: PanelView) => void }) {
  return (
    <div role="group" aria-label="View" className="inline-flex shrink-0 rounded-md bg-surface-muted p-0.5 text-sm">
      {(["table", "map"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          onClick={() => onChange(option)}
          className={`whitespace-nowrap rounded px-4 py-1 font-medium ${
            view === option ? "bg-surface text-fg shadow-xs ring-1 ring-line" : "text-fg-muted hover:text-fg"
          }`}
        >
          {option === "table" ? "Table" : "Map"}
        </button>
      ))}
    </div>
  );
}

/** One legend entry: a MAP_BUCKETS index, "pick" for the amber highlight or "outline" for the bold border, and its text. */
export type MapLegendItem = { bucket: number | "pick" | "outline" | "disabled"; label: string };

function legendSwatch(bucket: MapLegendItem["bucket"]) {
  if (bucket === "pick") return "bg-map-pick ring-1 ring-inset ring-line";
  if (bucket === "outline") return "bg-map-0 ring-2 ring-inset ring-fg";
  if (bucket === "disabled") {
    return `ring-1 ring-inset ring-line ${DISABLED_SWATCH}`;
  }
  return `ring-1 ring-inset ring-line ${MAP_BUCKETS[bucket]?.swatch ?? ""}`;
}

type ProfileStateMapProps = {
  /** Count per state code; also the default shade and tooltip. */
  counts: Record<string, number>;
  unit: [singular: string, plural: string];
  /** The MAP_BUCKETS index per state, in place of the count's. */
  bucketOf?: (code: string) => number;
  describeState?: (code: string) => string;
  showCounts?: boolean;
  /** Legend title, then its entries. */
  legendTitle: string;
  legend: MapLegendItem[];
  /** States filled amber, e.g. the picked carrier's writable states. */
  highlighted?: string[];
  /** States with a bold border, e.g. where the agent is licensed. */
  outlined?: string[];
  /** States that can't be picked: where the agency holds no licence. Adds their legend entry. */
  disabled?: string[];
  /** Floats over the map's top-left corner, e.g. a carrier list; above the map on a phone. */
  overlay?: ReactNode;
  /** Under the state name in the sliding panel, e.g. the licence number there. */
  renderPanelSubtitle?: (code: string) => ReactNode;
  /** The sliding panel's body for the picked state. */
  renderPanel: (code: string) => ReactNode;
  /** While true (a dialog is open over the page), Escape and outside presses leave the panel open. */
  keepPanelOpen?: boolean;
};

export function ProfileStateMap({
  counts,
  unit,
  bucketOf,
  describeState,
  showCounts,
  legendTitle,
  legend,
  highlighted,
  outlined,
  disabled = [],
  overlay,
  renderPanelSubtitle,
  renderPanel,
  keepPanelOpen = false,
}: ProfileStateMapProps) {
  const id = useId();
  // The picked state; null closes the panel.
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  // What the panel shows. Kept after close so the content stays while it slides out.
  const [panelCode, setPanelCode] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const panelOpen = selectedCode !== null;

  const selectState = (code: string | null) => {
    setSelectedCode(code);
    if (code) setPanelCode(code);
  };

  // Closing makes the panel inert, so focus inside it moves back to the state
  // it was opened from (still the pressed one on the map at this point).
  const closePanel = () => {
    if (panelRef.current?.contains(document.activeElement)) {
      mapRef.current?.querySelector<SVGPathElement>('[aria-pressed="true"]')?.focus();
    }
    setSelectedCode(null);
  };

  // Escape or a press anywhere outside closes the panel, unless a dialog is
  // open over it. A state on the map doesn't count as outside, nor does
  // anything marked `data-keeps-panel` (the floating carrier card).
  useEffect(() => {
    if (!panelOpen || keepPanelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (panelRef.current?.contains(document.activeElement)) {
          mapRef.current?.querySelector<SVGPathElement>('[aria-pressed="true"]')?.focus();
        }
        setSelectedCode(null);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-keeps-panel]")) return;
      if (mapRef.current?.contains(target) && target.closest("path")) return;
      setSelectedCode(null);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [panelOpen, keepPanelOpen]);

  const panelName = panelCode ? (US_STATE_NAMES[panelCode] ?? panelCode) : null;

  return (
    <div className="relative mb-4 rounded-lg border border-line p-4">
      {overlay ? (
        <div data-keeps-panel className="mb-3 sm:absolute sm:left-3 sm:top-3 sm:z-10 sm:mb-0">
          {overlay}
        </div>
      ) : null}
      <div ref={mapRef} className="mx-auto max-w-3xl">
        <UsMap
          counts={counts}
          selectedCode={selectedCode}
          onSelect={(code) => selectState(selectedCode === code ? null : code)}
          unit={unit}
          bucketOf={bucketOf}
          describeState={describeState}
          showCounts={showCounts}
          highlighted={highlighted}
          outlined={outlined}
          disabled={disabled}
          fillSelected
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
        <span>{legendTitle}</span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {[...legend, ...(disabled.length > 0 ? [{ bucket: "disabled" as const, label: "Agency not licensed" }] : [])].map((item) => (
            <li key={item.label} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className={`size-3 rounded-sm ${legendSwatch(item.bucket)}`}
              />
              <span className="tabular-nums">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/*
       * The picked state's panel, as on Contracts: a right sidebar fixed under
       * the navbar, sliding in over the page (nothing shifts). Not modal: the
       * map stays usable, so picking another state swaps its content in place.
       * Closed, it is inert and hidden once the slide-out ends.
       */}
      <aside
        ref={panelRef}
        aria-labelledby={`${id}-panel-title`}
        inert={!panelOpen}
        className={`fixed bottom-0 right-0 top-14 z-20 flex w-96 max-w-full flex-col border-l border-line bg-surface shadow-xl transition-[translate,visibility] duration-300 ease-out motion-reduce:transition-none ${
          panelOpen ? "translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {panelCode && panelName ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={`${id}-panel-title`} className="truncate text-lg font-semibold text-fg">
                    {panelName}
                  </h2>
                  {renderPanelSubtitle ? (
                    <div className="mt-0.5 flex items-baseline text-xs text-fg-muted">
                      {renderPanelSubtitle(panelCode)}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label={`Close ${panelName}`}
                  className="-mr-2 -mt-1 shrink-0 rounded-md p-2 text-fg-muted hover:bg-surface-hover hover:text-fg"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  >
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </div>
              <div className="mt-4">{renderPanel(panelCode)}</div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
