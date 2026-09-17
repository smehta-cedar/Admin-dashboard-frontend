"use client";

import { useId, useState, type ReactNode } from "react";
import { US_STATES, type UsState } from "@/lib/us-states";

type StateCheckboxesProps = {
  /** Heading above the grid; names the group. */
  legend: string;
  /** Form field name; each checked box submits its state code. */
  name: string;
  /** Codes to offer, shown in US_STATES (name) order. Leave out for every state; empty shows no grid. */
  codes?: string[];
  /**
   * Offered codes that can't be picked: listed with a disabled, unchecked box
   * and a muted label, skipped by Select all, and never submitted.
   */
  disabledCodes?: string[];
  /** Tooltip for a disabled state, e.g. why it can't be picked. */
  disabledTitle?: (state: UsState) => string;
  /** Codes checked when the grid first renders. */
  defaultChecked?: string[];
  /** Runs on every change with the checked codes, in code order. */
  onChange?: (checkedCodes: string[]) => void;
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
 * offered before and after stays checked. `disabledCodes` stay listed but
 * can't be checked: Select all and the submitted values only cover the enabled
 * ones. Used for an agent's licensed states, a carrier's available states and
 * an appointment's states.
 */
export function StateCheckboxes({
  legend,
  name,
  codes,
  disabledCodes = [],
  disabledTitle,
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
  // Select all and its count only cover the states that can be picked.
  const enabledStates = states.filter((state) => !disabledCodes.includes(state.code));
  const checkedCount = enabledStates.filter((state) => checked.has(state.code)).length;
  const allChecked = enabledStates.length > 0 && checkedCount === enabledStates.length;

  const update = (next: Set<string>) => {
    setChecked(next);
    onChange?.([...next].sort());
  };

  const toggle = (code: string) => {
    const next = new Set(checked);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    update(next);
  };

  // Only the enabled states change; disabled codes and codes outside `codes` are left alone.
  const toggleAll = () => {
    const next = new Set(checked);
    for (const state of enabledStates) {
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
        {enabledStates.length > 0 ? (
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
          {states.map((state) => {
            const disabled = disabledCodes.includes(state.code);
            return (
              <label
                key={state.code}
                className={`flex items-center gap-2 text-sm ${
                  disabled ? "cursor-not-allowed text-fg-faint" : "text-fg"
                }`}
              >
                {/* A disabled box has no name and shows unchecked, so it never submits. */}
                <input
                  type="checkbox"
                  name={disabled ? undefined : name}
                  value={state.code}
                  disabled={disabled}
                  checked={!disabled && checked.has(state.code)}
                  onChange={() => toggle(state.code)}
                  className="size-4 shrink-0 accent-brand-strong disabled:cursor-not-allowed"
                />
                <span
                  className="min-w-0 truncate"
                  title={disabled ? (disabledTitle?.(state) ?? state.name) : state.name}
                >
                  {state.name}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
      {footer}
    </fieldset>
  );
}
