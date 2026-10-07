"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { US_MAP_VIEWBOX, US_STATE_SHAPES, type UsStateShape } from "@/components/us-map-shapes";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * US choropleth: each state is filled by its count on a themed five-step scale.
 * Hovering or focusing a state outlines it and shows "State · N agents";
 * clicking (or Enter / Space) selects it. Plain SVG, no map library.
 */

type UsMapProps = {
  /** Count per state code. Missing codes count as 0. */
  counts: Record<string, number>;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  /** Noun for the tooltip and labels, e.g. ["agent", "agents"]. */
  unit: [singular: string, plural: string];
  /** The MAP_BUCKETS index to fill a state with, in place of the count's. */
  bucketOf?: (code: string) => number;
  /** The tooltip and accessible name, in place of "State · N agents". */
  describeState?: (code: string) => string;
  /** Count labels on the bigger states. Off when the shade says it all. */
  showCounts?: boolean;
  /** States filled with the pick color (amber) over their bucket, e.g. a picked carrier's states. */
  highlighted?: string[];
  /** Fill the selected state with the pick color too, not just outline it. */
  fillSelected?: boolean;
  /** States with a bold border, e.g. where the agent is licensed. Drawn under the selected and hover outlines. */
  outlined?: string[];
  /**
   * States that can't be picked, e.g. where the agency holds no licence:
   * striped grey whatever their count, no label, not clickable or focusable.
   * Hovering still names them, as "State · Agency not licensed".
   */
  disabled?: string[];
};

/**
 * Fill buckets, fewest to most. The last one is "this many or more". The five
 * steps and their label colors are `--color-map-*` in app/globals.css, so the
 * ramp re-points with the theme (it reverses in dark, where pale reads as more).
 */
export const MAP_BUCKETS = [
  { min: 0, label: "0", fill: "fill-map-0", swatch: "bg-map-0", text: "fill-map-0-ink" },
  { min: 1, label: "1", fill: "fill-map-1", swatch: "bg-map-1", text: "fill-map-1-ink" },
  { min: 2, label: "2", fill: "fill-map-2", swatch: "bg-map-2", text: "fill-map-2-ink" },
  { min: 3, label: "3", fill: "fill-map-3", swatch: "bg-map-3", text: "fill-map-3-ink" },
  { min: 4, label: "4+", fill: "fill-map-4", swatch: "bg-map-4", text: "fill-map-4-ink" },
];

/** Legend swatch for a disabled state: the map's grey stripes, as a CSS gradient. */
export const DISABLED_SWATCH =
  "bg-[repeating-linear-gradient(135deg,var(--color-line-strong)_0_1.5px,var(--color-map-0)_1.5px_4px)]";

/** States smaller than this (viewBox units) get no count label; the tooltip covers them. */
const LABEL_MIN_AREA = 2500;

/** Where a centroid lands awkwardly (e.g. Michigan's sits in the lake), move the label. */
const LABEL_NUDGE: Record<string, [dx: number, dy: number]> = {
  FL: [12, 6],
  LA: [-8, 0],
  MI: [14, 14],
};

function bucketFor(count: number) {
  return MAP_BUCKETS.findLast((bucket) => count >= bucket.min) ?? MAP_BUCKETS[0];
}

function labelPosition(shape: UsStateShape) {
  const [dx, dy] = LABEL_NUDGE[shape.code] ?? [0, 0];
  return { x: shape.labelX + dx, y: shape.labelY + dy };
}

export function UsMap({
  counts,
  selectedCode,
  onSelect,
  unit,
  bucketOf,
  describeState,
  showCounts = true,
  highlighted = [],
  fillSelected = false,
  outlined = [],
  disabled = [],
}: UsMapProps) {
  const stripesId = useId();
  const isDisabled = (code: string) => disabled.includes(code);
  // Filled amber: the highlighted states, and the selected one when asked.
  const picked = (code: string) => highlighted.includes(code) || (fillSelected && code === selectedCode);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const activeCode = hoveredCode ?? focusedCode;
  const activeShape = US_STATE_SHAPES.find((shape) => shape.code === activeCode);
  const selectedShape = US_STATE_SHAPES.find((shape) => shape.code === selectedCode);

  const describe = (code: string) => {
    if (isDisabled(code)) return `${US_STATE_NAMES[code] ?? code} · Agency not licensed`;
    if (describeState) return describeState(code);
    const count = counts[code] ?? 0;
    return `${US_STATE_NAMES[code] ?? code} · ${count} ${count === 1 ? unit[0] : unit[1]}`;
  };

  const handleKeyDown = (event: KeyboardEvent<SVGPathElement>, code: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(code);
    }
  };

  // Tooltip anchor in viewBox units.
  const tooltip = activeShape ? labelPosition(activeShape) : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${US_MAP_VIEWBOX.width} ${US_MAP_VIEWBOX.height}`}
        className="block h-auto w-full"
        role="group"
        aria-label="Map of US states"
      >
        {disabled.length > 0 ? (
          <defs>
            {/* Diagonal stripes for a disabled state, in theme colors. */}
            <pattern id={stripesId} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={6} height={6} className="fill-map-0" />
              <line x1={0} y1={0} x2={0} y2={6} className="stroke-line-strong" strokeWidth={2.5} />
            </pattern>
          </defs>
        ) : null}
        {US_STATE_SHAPES.map((shape) => {
          if (isDisabled(shape.code)) {
            return (
              <path
                key={shape.code}
                d={shape.d}
                role="button"
                aria-disabled="true"
                aria-label={describe(shape.code)}
                fill={`url(#${stripesId})`}
                className="cursor-not-allowed stroke-canvas outline-none"
                strokeWidth={0.75}
                onPointerEnter={() => setHoveredCode(shape.code)}
                onPointerLeave={() => setHoveredCode((code) => (code === shape.code ? null : code))}
              />
            );
          }
          const fill = picked(shape.code)
            ? { fill: "fill-map-pick" }
            : bucketOf
              ? (MAP_BUCKETS[bucketOf(shape.code)] ?? MAP_BUCKETS[0])
              : bucketFor(counts[shape.code] ?? 0);
          return (
            <path
              key={shape.code}
              d={shape.d}
              role="button"
              tabIndex={0}
              aria-label={describe(shape.code)}
              aria-pressed={shape.code === selectedCode}
              className={`${fill.fill} cursor-pointer stroke-canvas outline-none transition-colors`}
              strokeWidth={0.75}
              onClick={() => onSelect(shape.code)}
              onKeyDown={(event) => handleKeyDown(event, shape.code)}
              onPointerEnter={() => setHoveredCode(shape.code)}
              onPointerLeave={() => setHoveredCode((code) => (code === shape.code ? null : code))}
              onFocus={() => setFocusedCode(shape.code)}
              onBlur={() => setFocusedCode((code) => (code === shape.code ? null : code))}
            />
          );
        })}

        {/* Outlines drawn on top so neighbouring states don't cover the stroke. */}
        {outlined.length > 0 ? (
          <g aria-hidden="true" className="pointer-events-none">
            {US_STATE_SHAPES.filter((shape) => outlined.includes(shape.code)).map((shape) => (
              <path
                key={shape.code}
                d={shape.d}
                className="fill-none stroke-fg"
                strokeWidth={2.25}
                strokeLinejoin="round"
              />
            ))}
          </g>
        ) : null}
        {selectedShape ? (
          <path
            d={selectedShape.d}
            className={`pointer-events-none fill-none ${fillSelected ? "stroke-map-pick-line" : "stroke-fg"}`}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ) : null}
        {activeShape && activeShape !== selectedShape ? (
          <path
            d={activeShape.d}
            className="pointer-events-none fill-none stroke-fg-muted"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ) : null}

        <g aria-hidden="true" className="pointer-events-none select-none">
          {US_STATE_SHAPES.map((shape) => {
            const count = counts[shape.code] ?? 0;
            if (!showCounts || count === 0 || isDisabled(shape.code) || shape.area < LABEL_MIN_AREA) return null;
            const { x, y } = labelPosition(shape);
            return (
              <text
                key={shape.code}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
                className={`${picked(shape.code) ? "fill-map-pick-ink" : bucketFor(count).text} font-semibold tabular-nums`}
              >
                {count}
              </text>
            );
          })}
        </g>
      </svg>

      {/* Anchored at the label point; flips below near the top and hugs the side near the edges. */}
      {activeCode && tooltip ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-md bg-tooltip px-2 py-1 text-xs font-medium text-tooltip-fg shadow ${
            tooltip.x < 150 ? "-translate-x-6" : tooltip.x > US_MAP_VIEWBOX.width - 150 ? "-translate-x-[calc(100%-1.5rem)]" : "-translate-x-1/2"
          } ${tooltip.y < 90 ? "mt-4" : "-mt-4 -translate-y-full"}`}
          style={{
            left: `${(tooltip.x / US_MAP_VIEWBOX.width) * 100}%`,
            top: `${(tooltip.y / US_MAP_VIEWBOX.height) * 100}%`,
          }}
        >
          {describe(activeCode)}
        </div>
      ) : null}
    </div>
  );
}
