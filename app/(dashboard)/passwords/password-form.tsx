"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS, TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { FormSection } from "@/components/producer-form";
import type { AgentRecord } from "@/lib/agents";
import type { CarrierRecord } from "@/lib/carriers";
import type { PasswordError, PasswordField, PasswordRecord, PasswordValues } from "@/lib/passwords";
import { byName } from "@/lib/text";
import { savePassword } from "./actions";

/*
 * Add carrier password at /passwords/new (the screens add and edit through
 * the AddPasswordDialog popup, ./password-dialog.tsx, instead), as a page in the same layout as the carrier pages:
 * an Identity card (agent or the agency, and the carrier, with the status
 * select in its header), a Credentials card (portal username and password)
 * and a sticky button bar. Cancel and a successful save both return to
 * `returnTo`, the list or the agent's profile, whichever opened the page.
 * Site passwords have their own form (./site-password-form.tsx).
 *
 * Saves go through the savePassword server action (./actions.ts), which
 * revalidates every page. The API keeps one password per agent (and one for
 * the agency) at each carrier and records the change note; the form only
 * checks what it can see at once (a blank password). While the status is
 * Pending, username and password are optional (the login isn't issued yet).
 *
 * For an agent, the carrier select offers only carriers open to agents
 * (agentAccessible: the agency's contract with them has a contract number),
 * plus an edited password's own carrier so it stays the current choice. The
 * agency's own password can be at any carrier.
 */

/** The agent select's value for the agency's own password. */
export const AGENCY_CHOICE = "agency";

export type AgentOption = Pick<AgentRecord, "id" | "name" | "status">;
export type AgencyOption = { id: string; name: string };
export type CarrierOption = Pick<CarrierRecord, "id" | "name" | "status" | "agentAccessible">;

/** Also the order changes are listed in on a note. */
export const PASSWORD_FIELD_LABELS: Record<PasswordField, string> = {
  agentId: "Agent",
  agencyId: "Agency",
  carrierId: "Carrier",
  username: "Portal username",
  portalPassword: "Password",
  status: "Status",
};

type PasswordFormPageProps = {
  /** Set on Edit. Leave out for an empty Add form. */
  password?: PasswordRecord;
  agents: AgentOption[];
  carriers: CarrierOption[];
  /** The agency, offered first in the agent select. Null leaves it out. */
  agency: AgencyOption | null;
  /** Add only: the agent (or AGENCY_CHOICE) to start on. */
  presetAgentId?: string;
  /** Add only: the carrier to start on. */
  presetCarrierId?: string;
  /** Where Cancel and a successful save go. */
  returnTo: string;
};

export function PasswordFormPage({
  password: editing,
  agents,
  carriers,
  agency,
  presetAgentId,
  presetCarrierId,
  returnTo,
}: PasswordFormPageProps) {
  const router = useRouter();
  const id = useId();
  const [errors, setErrors] = useState<PasswordError[]>([]);
  const [saving, setSaving] = useState(false);

  const startAgentId = editing ? (editing.agencyId ? AGENCY_CHOICE : (editing.agentId ?? "")) : (presetAgentId ?? "");
  const defaultAgentId =
    startAgentId === AGENCY_CHOICE
      ? agency
        ? AGENCY_CHOICE
        : ""
      : agents.some((agent) => agent.id === startAgentId)
        ? startAgentId
        : "";
  const [forAgency, setForAgency] = useState(defaultAgentId === AGENCY_CHOICE);
  // Pending: the login isn't issued yet, so username and password may be blank.
  const [statusValue, setStatusValue] = useState<string>(editing?.status ?? "active");
  const pending = statusValue === "pending";
  const carrierOptions = [...carriers]
    .filter((carrier) => forAgency || carrier.agentAccessible || carrier.id === editing?.carrierId)
    .sort(byName);
  // A preset carrier (Add from a filtered list) that isn't open starts the select empty.
  const startCarrierId = editing ? editing.carrierId : (presetCarrierId ?? "");
  const defaultCarrierId = carrierOptions.some((carrier) => carrier.id === startCarrierId) ? startCarrierId : "";

  const messageFor = (field: PasswordError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (...fields: PasswordError["field"][]) =>
    setErrors((current) => current.filter((error) => !fields.includes(error.field)));

  const agentError = messageFor("agentId");
  const carrierError = messageFor("carrierId");
  const usernameError = messageFor("username");
  const passwordError = messageFor("portalPassword");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const text = (field: PasswordField) => String(data.get(field) ?? "").trim();
    const status = text("status");
    const agentChoice = text("agentId");
    const values: PasswordValues = {
      agentId: agentChoice === AGENCY_CHOICE ? null : agentChoice,
      agencyId: agentChoice === AGENCY_CHOICE && agency ? agency.id : null,
      carrierId: text("carrierId"),
      username: text("username"),
      // Not trimmed or lowercased: spaces and case can matter in a password.
      portalPassword: String(data.get("portalPassword") ?? ""),
      status: status === "pending" || status === "inactive" ? status : "active",
    };
    // Required unless pending, and spaces alone don't count. A valid password is still saved as typed.
    if (values.status !== "pending" && values.portalPassword.trim() === "") {
      setErrors([{ field: "portalPassword", message: "Password can't be blank." }]);
      return;
    }
    setSaving(true);
    try {
      const result = await savePassword(values, editing?.id);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.push(returnTo);
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? `Edit ${editing.agentName} at ${editing.carrierName}` : "Add carrier password";

  // Status lives in the Identity header, not the grid: it is a setting, not a detail.
  const status = (
    <label htmlFor={`${id}-status`} className="flex items-center gap-2 text-sm text-fg-muted">
      Status
      <select
        id={`${id}-status`}
        name="status"
        value={statusValue}
        onChange={(event) => {
          setStatusValue(event.target.value);
          clear("username", "portalPassword");
        }}
        className={`${TOOLBAR_INPUT_CLASS} py-1 pr-7 text-fg`}
      >
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="inactive">Inactive</option>
      </select>
    </label>
  );

  return (
    <>
      <PageHeader title={title} />
      <form onSubmit={handleSubmit}>
        <h2 id={`${id}-title`} className="sr-only">
          {title}
        </h2>

        {/* One card per row; capped so the inputs stay a sensible width. */}
        <div className="mx-auto grid max-w-(--breakpoint-2xl) gap-5">
          <FormSection title="Identity" action={status} layout="page" columns="sm:grid-cols-2">
            <Field
              label="Agent"
              required
              htmlFor={`${id}-agent`}
              hint={agentError ?? undefined}
              hintId={`${id}-agent-error`}
              error
            >
              <select
                id={`${id}-agent`}
                name="agentId"
                required
                defaultValue={defaultAgentId}
                aria-invalid={agentError ? true : undefined}
                aria-describedby={agentError ? `${id}-agent-error` : undefined}
                onChange={(event) => {
                  setForAgency(event.target.value === AGENCY_CHOICE);
                  clear("agentId", "carrierId");
                }}
                className={INPUT_CLASS}
              >
                <option value="">Choose an agent</option>
                {agency ? <option value={AGENCY_CHOICE}>{agency.name} (agency)</option> : null}
                {[...agents].sort(byName).map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                    {agent.status === "inactive" ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Carrier"
              required
              htmlFor={`${id}-carrier`}
              hint={carrierError ?? undefined}
              hintId={`${id}-carrier-error`}
              error
            >
              <select
                id={`${id}-carrier`}
                name="carrierId"
                required
                defaultValue={defaultCarrierId}
                aria-invalid={carrierError ? true : undefined}
                aria-describedby={carrierError ? `${id}-carrier-error` : undefined}
                onChange={() => clear("carrierId")}
                className={INPUT_CLASS}
              >
                <option value="">Choose a carrier</option>
                {carrierOptions.map((carrier) => (
                  <option key={carrier.id} value={carrier.id}>
                    {carrier.name}
                    {carrier.status === "inactive" ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </FormSection>

          <FormSection title="Credentials" layout="page" columns="sm:grid-cols-2">
            <Field
              label="Portal username"
              required={!pending}
              htmlFor={`${id}-username`}
              hint={usernameError ?? undefined}
              hintId={`${id}-username-error`}
              error
            >
              <input
                id={`${id}-username`}
                name="username"
                type="text"
                required={!pending}
                pattern=".*\S.*"
                autoComplete="off"
                defaultValue={editing?.username}
                aria-invalid={usernameError ? true : undefined}
                aria-describedby={usernameError ? `${id}-username-error` : undefined}
                onChange={() => clear("username")}
                className={INPUT_CLASS}
              />
            </Field>
            <Field
              label="Portal password"
              required={!pending}
              htmlFor={`${id}-password`}
              hint={passwordError ?? undefined}
              hintId={`${id}-password-error`}
              error
            >
              {/* Spaces are kept; all-spaces is rejected on submit unless pending. new-password stops the
                  browser filling in the signed-in user's own saved password. */}
              <PasswordInput
                id={`${id}-password`}
                name="portalPassword"
                required={!pending}
                autoComplete="new-password"
                spellCheck={false}
                defaultValue={editing?.portalPassword}
                aria-invalid={passwordError ? true : undefined}
                aria-describedby={passwordError ? `${id}-password-error` : undefined}
                onChange={() => clear("portalPassword")}
                className={INPUT_CLASS}
              />
            </Field>
          </FormSection>
        </div>

        {/*
         * Stuck to the bottom of the viewport, spanning the main area's
         * inset, so the buttons are in reach however tall the form gets.
         */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-(--breakpoint-2xl) flex-wrap items-center justify-between gap-3">
            <div role="alert" className="min-w-0 text-sm text-danger">
              {formError}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => router.push(returnTo)}
                disabled={saving}
                className={GHOST_BUTTON_CLASS}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add password"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
