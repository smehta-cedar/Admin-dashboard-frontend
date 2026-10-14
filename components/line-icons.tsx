/*
 * Life and Health as icons, for maps where colour is already taken (the
 * Contracts map shades states by agent count): a heart for Life, a medical
 * cross for Health. `LineBadges` draws them as small round badges inside a
 * map's SVG, centred on (0, 0) in viewBox units; `LineIcon` is the same
 * badge as an inline HTML <svg> for a legend.
 */

/** Badge radius in map viewBox units. */
const BADGE_R = 7.5;

const HEART = "M0,4.2 C-6.4,0 -5,-5.6 -1.6,-4.6 C-0.7,-4.3 -0.2,-3.7 0,-3.1 C0.2,-3.7 0.7,-4.3 1.6,-4.6 C5,-5.6 6.4,0 0,4.2Z";
const CROSS = "M-1.5,-4.5 H1.5 V-1.5 H4.5 V1.5 H1.5 V4.5 H-1.5 V1.5 H-4.5 V-1.5 H-1.5Z";

export type LineKind = "life" | "health";

function Badge({ kind }: { kind: LineKind }) {
  return (
    <>
      <circle r={BADGE_R} className="fill-surface stroke-line-strong" strokeWidth={0.75} />
      <path d={kind === "life" ? HEART : CROSS} className={kind === "life" ? "fill-line-life" : "fill-line-health"} />
    </>
  );
}

/** The state's badges, side by side when both lines are written; nothing when neither. */
export function LineBadges({ life, health, scale = 1 }: { life: boolean; health: boolean; scale?: number }) {
  const kinds: LineKind[] = [...(life ? ["life" as const] : []), ...(health ? ["health" as const] : [])];
  if (kinds.length === 0) return null;
  const gap = BADGE_R * 2 + 1;
  return (
    <g transform={`scale(${scale})`}>
      {kinds.map((kind, index) => (
        <g key={kind} transform={`translate(${(index - (kinds.length - 1) / 2) * gap} 0)`}>
          <Badge kind={kind} />
        </g>
      ))}
    </g>
  );
}

/** One badge for a legend, sized like the legend's swatches. */
export function LineIcon({ kind, className = "size-4" }: { kind: LineKind; className?: string }) {
  return (
    <svg viewBox={`${-BADGE_R - 0.5} ${-BADGE_R - 0.5} ${BADGE_R * 2 + 1} ${BADGE_R * 2 + 1}`} aria-hidden="true" className={className}>
      <Badge kind={kind} />
    </svg>
  );
}
