"use client";

import type { FormEvent, ReactNode } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/field";
import { StateSelect } from "@/components/state-select";
import { statusLabel } from "@/components/status-badge";
import { renewalOpen, type StateLicenseStatus } from "@/lib/state-licenses";

/*
 * Shared add/edit state-licence form layout: State | Status, Licence number |
 * Lines (optional), Start | End. While the end date is within the renewal
 * window, a Renewing checkbox sits at the right of the Status label. Used by
 * the agent and agency licence dialogs.
 */

const LINES = [
  { key: "health", label: "Health" },
  { key: "life", label: "Life" },
] as const;

export const STATE_LICENSE_DIALOG_CLASS = "max-w-5xl overflow-visible";

type StateLicenseFormProps = {
  id: string;
  title: string;
  /** Optional note under the title. */
  description?: ReactNode;
  state: string;
  onStateChange: (code: string) => void;
  defaultState?: string;
  allowedStates?: string[];
  stateInvalid?: boolean;
  defaultLicenseNumber?: string;
  numberRequired?: boolean;
  endDateRequired?: boolean;
  status: StateLicenseStatus;
  onStatusChange: (status: StateLicenseStatus) => void;
  statuses: readonly StateLicenseStatus[];
  /** Health / Life checkboxes. Off for agency licences. */
  showLines?: boolean;
  defaultHealth?: boolean;
  defaultLife?: boolean;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  renewing: boolean;
  onRenewingChange: (value: boolean) => void;
  error: string | null;
  onClearError: () => void;
  busy: boolean;
  canRemove: boolean;
  onRequestRemove: () => void;
  onCancel: () => void;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  confirmingRemove: boolean;
  removeMessage: string;
  onConfirmRemove: () => void | Promise<void>;
  onCloseConfirmRemove: () => void;
  /** Extra fields under the dates, full width. */
  children?: ReactNode;
};

export function StateLicenseForm({
  id,
  title,
  description,
  state,
  onStateChange,
  defaultState,
  allowedStates,
  stateInvalid,
  defaultLicenseNumber,
  numberRequired = true,
  endDateRequired = true,
  status,
  onStatusChange,
  statuses,
  showLines = false,
  defaultHealth = false,
  defaultLife = false,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  renewing,
  onRenewingChange,
  error,
  onClearError,
  busy,
  canRemove,
  onRequestRemove,
  onCancel,
  submitLabel,
  onSubmit,
  confirmingRemove,
  removeMessage,
  onConfirmRemove,
  onCloseConfirmRemove,
  children,
}: StateLicenseFormProps) {
  const statusOptions = statuses.includes(status) ? statuses : [...statuses, status];

  return (
    <form onSubmit={onSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {title}
      </h2>
      {description ? <div className="mt-1 text-sm text-fg-muted">{description}</div> : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="State" required htmlFor={`${id}-state`}>
          <StateSelect
            id={`${id}-state`}
            name="state"
            defaultValue={defaultState}
            allowedStates={allowedStates}
            onChange={(code) => {
              onStateChange(code);
              onClearError();
            }}
            invalid={stateInvalid}
            describedBy={error ? `${id}-error` : undefined}
          />
        </Field>
        <Field
          label="Status"
          required
          htmlFor={`${id}-status`}
          action={
            renewalOpen(endDate) ? (
              <label className="flex items-center gap-1.5 text-sm text-fg">
                <input
                  type="checkbox"
                  name="renewing"
                  checked={renewing}
                  onChange={(event) => onRenewingChange(event.target.checked)}
                  className="size-4 accent-brand-strong"
                />
                Renewing
              </label>
            ) : null
          }
        >
          <select
            id={`${id}-status`}
            name="status"
            value={status}
            onChange={(event) => {
              onStatusChange(event.target.value as StateLicenseStatus);
              onClearError();
            }}
            className={INPUT_CLASS}
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Licence number"
          required={numberRequired}
          htmlFor={`${id}-number`}
          className={showLines ? undefined : "sm:col-span-2"}
        >
          <input
            id={`${id}-number`}
            name="licenseNumber"
            type="text"
            required={numberRequired}
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={defaultLicenseNumber}
            onChange={onClearError}
            className={INPUT_CLASS}
          />
        </Field>
        {showLines ? (
          <Field label="Lines" htmlFor={`${id}-lines`}>
            <div id={`${id}-lines`} role="group" aria-label="Lines" className="mt-1 flex h-10 items-center gap-4 text-sm text-fg">
              {LINES.map((line) => (
                <label key={line.key} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name={line.key}
                    defaultChecked={line.key === "health" ? defaultHealth : defaultLife}
                    className="size-4 accent-brand-strong"
                  />
                  {line.label}
                </label>
              ))}
            </div>
          </Field>
        ) : null}
        <Field label="Start date" htmlFor={`${id}-start`}>
          <input
            id={`${id}-start`}
            type="date"
            value={startDate}
            onChange={(event) => {
              onStartDateChange(event.target.value);
              onClearError();
            }}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="End date" required={endDateRequired} htmlFor={`${id}-end`}>
          <input
            id={`${id}-end`}
            type="date"
            required={endDateRequired}
            min={startDate || undefined}
            value={endDate}
            onChange={(event) => {
              onEndDateChange(event.target.value);
              onClearError();
            }}
            className={INPUT_CLASS}
          />
        </Field>
        {children}
      </div>

      <div id={`${id}-error`} role="alert" className="mt-4">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canRemove ? (
          <button
            type="button"
            onClick={onRequestRemove}
            disabled={busy}
            className={`${GHOST_BUTTON_CLASS} text-danger hover:text-danger`}
          >
            Remove
          </button>
        ) : null}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={GHOST_BUTTON_CLASS}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmingRemove}
        title="Delete licence"
        message={removeMessage}
        onConfirm={onConfirmRemove}
        onClose={onCloseConfirmRemove}
      />
    </form>
  );
}
