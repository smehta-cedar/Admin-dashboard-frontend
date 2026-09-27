"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { INPUT_CLASS } from "@/components/classes";
import { US_STATES, US_STATE_NAMES } from "@/lib/us-states";

/*
 * A searchable dropdown for one US state, for forms: type part of the name
 * or the two-letter code and pick from the matches with the mouse or the
 * arrow keys. The chosen code submits through a hidden input under `name`,
 * so the form reads it exactly as it read the old <select>. Uncontrolled,
 * like the rest of the form: `defaultValue` is the code to start on, and
 * clearing the text clears the choice.
 *
 * The markup follows the navbar search (components/navbar-search.tsx): a
 * combobox input over a listbox, options picked on mousedown-prevented
 * clicks so the input keeps focus, and the list closes when focus leaves the
 * whole control.
 */

type StateSelectProps = {
  id: string;
  /** The hidden input's name; its value is the state code or "". */
  name: string;
  /** The code to start on. */
  defaultValue?: string;
  /** Runs with the new code (or "") on every change. */
  onChange?: (code: string) => void;
  /** Marks the input invalid, e.g. for an address error. */
  invalid?: boolean;
  /** IDs of the hint or error that describes the field. */
  describedBy?: string;
  placeholder?: string;
};

/** States whose name or code starts with, or whose name contains, the text. */
function matching(query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return US_STATES;
  return US_STATES.filter(
    (state) => state.name.toLowerCase().includes(text) || state.code.toLowerCase().startsWith(text),
  );
}

export function StateSelect({
  id,
  name,
  defaultValue = "",
  onChange,
  invalid,
  describedBy,
  placeholder = "Search states…",
}: StateSelectProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState(US_STATE_NAMES[defaultValue] ? defaultValue : "");
  const [query, setQuery] = useState(US_STATE_NAMES[defaultValue] ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const options = matching(query);
  const optionId = (index: number) => `${listId}-option-${index}`;

  const choose = (nextCode: string) => {
    setCode(nextCode);
    setQuery(US_STATE_NAMES[nextCode] ?? "");
    setOpen(false);
    setActive(-1);
    if (nextCode !== code) onChange?.(nextCode);
  };

  /** The list closed without a pick: show the chosen state's name again, or nothing. */
  const settle = () => {
    setOpen(false);
    setActive(-1);
    setQuery(US_STATE_NAMES[code] ?? "");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (options.length === 0 ? -1 : (index + step + options.length) % options.length));
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      // Enter on an unambiguous search picks its one match.
      const picked = active >= 0 ? options[active] : options.length === 1 ? options[0] : undefined;
      if (picked) choose(picked.code);
    } else if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      event.stopPropagation();
      settle();
    }
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) settle();
      }}
    >
      <input type="hidden" name={name} value={code} />
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => {
          const text = event.target.value;
          setQuery(text);
          setOpen(true);
          setActive(-1);
          // Clearing the text clears the choice; editing it keeps the old one until a pick.
          if (text.trim() === "" && code) {
            setCode("");
            onChange?.("");
          }
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && active !== -1 ? optionId(active) : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        autoComplete="off"
        className={`${INPUT_CLASS} pr-8`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Close the list" : "Show all states"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          inputRef.current?.focus();
          if (open) settle();
          else {
            setQuery("");
            setOpen(true);
          }
        }}
        className="absolute inset-y-0 right-0 mt-1 flex w-8 items-center justify-center text-fg-subtle hover:text-fg"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8l4 4 4-4" />
        </svg>
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-lg">
          {options.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="States" className="max-h-56 overflow-y-auto py-1">
              {options.map((state, index) => {
                const selected = state.code === code;
                return (
                  <li
                    key={state.code}
                    id={optionId(index)}
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(state.code)}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm ${
                      index === active ? "bg-surface-hover" : ""
                    } ${selected ? "font-medium text-brand-ink" : "text-fg"}`}
                  >
                    <span className="truncate">{state.name}</span>
                    <span className="shrink-0 font-mono text-xs text-fg-subtle">{state.code}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p role="status" className="px-3 py-2 text-sm text-fg-muted">
              No state matches “{query.trim()}”.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
