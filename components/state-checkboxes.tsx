"use client";

import { useId, useState, type ReactNode } from "react";
import { US_STATES } from "@/lib/us-states";

type StateCheckboxesProps = {
  /** Heading above the grid; names the group. */
  legend: string;
  /** Form field name; each checked box submits its state code. */
  name: string;
  /** Codes to offer, shown in US_STATES (name) order. Leave out for every state; empty shows no grid. */
  codes?: string[];
  /** Codes checked when the grid first renders. */
  defaultChecked?: string[];
  onChange?: () => void;
  className?: string;
  /** Extra classes for the heading only, e.g. a heavier weight. */
  legendClassName?: string;
  /** Hint, error or warning ids that describe the group. */
  describedBy?: string;
  /** Shown between the heading and the grid, e.g. a hint. */
  children?: ReactNode;
  /** Shown below the grid, e.g. a warning or error. */
  footer?: ReactNode;
};

/**
 * Fieldset of US state checkboxes in a scrolling grid, with a Select all
 * checkbox beside the heading (indeterminate when some are checked). Checked
 * codes live in state and submit with the form. When `codes` changes, a code
 * offered before and after stays checked. Used for a carrier's available
 * states and an appointment's states.
 */
export function StateCheckboxes({
  legend,
  name,
  codes,
  defaultChecked = [],
  onChange,
  className,
  legendClassName = "font-medium",
  describedBy,
  children,
  footer,
}: StateCheckboxesProps) {
  const [checked, setChecked] = useState(() => new Set(defaultChecked));
  const id = useId();

  const states = codes ? US_STATES.filter((state) => codes.includes(state.code)) : US_STATES;
  const checkedCount = states.filter((state) => checked.has(state.code)).length;
  const allChecked = states.length > 0 && checkedCount === states.length;

  const update = (next: Set<string>) => {
    setChecked(next);
    onChange?.();
  };

  const toggle = (code: string) => {
    const next = new Set(checked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    update(next);
  };

  // Only the offered states change; codes outside `codes` are left alone.
  const toggleAll = () => {
    const next = new Set(checked);
    for (const state of states) {
      if (allChecked) next.delete(state.code);
      else next.add(state.code);
    }
    update(next);
  };

  return (
    <fieldset aria-labelledby={`${id}-legend`} aria-describedby={describedBy} className={className}>
      <div className="flex items-center justify-between gap-3">
        <span id={`${id}-legend`} className={`text-sm text-fg ${legendClassName}`}>
          {legend}
        </span>
        {states.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={allChecked}
              ref={(input) => {
                if (input) input.indeterminate = checkedCount > 0 && !allChecked;
              }}
              onChange={toggleAll}
              className="size-4 accent-brand-strong"
            />
            Select all
          </label>
        ) : null}
      </div>
      {children}
      {states.length > 0 ? (
        <div className="mt-2 grid max-h-64 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto rounded-md border border-line p-3 sm:grid-cols-3">
          {states.map((state) => (
            <label key={state.code} className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                name={name}
                value={state.code}
                checked={checked.has(state.code)}
                onChange={() => toggle(state.code)}
                className="size-4 shrink-0 accent-brand-strong"
              />
              <span className="min-w-0 truncate" title={state.name}>
                {state.name}
              </span>
            </label>
          ))}
        </div>
      ) : null}
      {footer}
    </fieldset>
  );
}
