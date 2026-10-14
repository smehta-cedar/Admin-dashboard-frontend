"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS, TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { FormSection } from "@/components/producer-form";
import { PROFILE_BUTTON_CLASS } from "@/components/profile-shell";
import type {
  SitePasswordError,
  SitePasswordField,
  SitePasswordRecord,
  SitePasswordValues,
  SiteRecord,
} from "@/lib/site-passwords";
import { byName } from "@/lib/text";
import { AGENCY_CHOICE, type AgencyOption, type AgentOption } from "./password-form";
import { saveSitePassword } from "./site-actions";
import { SiteDialog, type SiteEditor } from "./site-dialog";

/*
 * Edit site password (/passwords/site-passwords/[id]/edit), and Add at
 * /passwords/site-passwords/new (the screens add through the
 * AddPasswordDialog popup, ./password-dialog.tsx, instead): the carrier password page
 * (./password-form.tsx) with a Site dropdown in place of the carrier. Add
 * site beside the dropdown, and Edit site for the chosen one, open
 * SiteDialog (./site-dialog.tsx: name and link); a saved site is added to the
 * dropdown and chosen. Sites have no page or list of their own. Cancel and a
 * successful save return to `returnTo`, the Passwords list.
 *
 * Saves go through saveSitePassword (./site-actions.ts). The API keeps one
 * password per agent (and one for the agency) at each site and records the
 * change note; the form only checks a blank password. While the status is
 * Pending, username and password are optional.
 */

type SitePasswordFormPageProps = {
  /** Set on Edit. Leave out for an empty Add form. */
  password?: SitePasswordRecord;
  agents: AgentOption[];
  sites: SiteRecord[];
  /** The agency, offered first in the agent select. Null leaves it out. */
  agency: AgencyOption | null;
  /** Add only: the agent (or AGENCY_CHOICE) to start on. */
  presetAgentId?: string;
  /** Add only: the site to start on. */
  presetSiteId?: string;
  /** Where Cancel and a successful save go. */
  returnTo: string;
};

export function SitePasswordFormPage({
  password: editing,
  agents,
  sites: initialSites,
  agency,
  presetAgentId,
  presetSiteId,
  returnTo,
}: SitePasswordFormPageProps) {
  const router = useRouter();
  const id = useId();
  const [errors, setErrors] = useState<SitePasswordError[]>([]);
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
  // Sites added or edited in the dialog join the list, so the select is controlled.
  const [sites, setSites] = useState(initialSites);
  const [siteId, setSiteId] = useState(() => {
    const startSiteId = editing ? editing.siteId : (presetSiteId ?? "");
    return initialSites.some((site) => site.id === startSiteId) ? startSiteId : "";
  });
  const [siteEditor, setSiteEditor] = useState<SiteEditor | null>(null);
  const chosenSite = sites.find((site) => site.id === siteId);
  // Pending: the login isn't issued yet, so username and password may be blank.
  const [statusValue, setStatusValue] = useState<string>(editing?.status ?? "active");
  const pending = statusValue === "pending";

  const messageFor = (field: SitePasswordError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (...fields: SitePasswordError["field"][]) =>
    setErrors((current) => current.filter((error) => !fields.includes(error.field)));

  const agentError = messageFor("agentId");
  const siteError = messageFor("siteId");
  const usernameError = messageFor("username");
  const passwordError = messageFor("portalPassword");
  const formError = messageFor("form") ?? messageFor("status");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const text = (field: SitePasswordField) => String(data.get(field) ?? "").trim();
    const status = text("status");
    const agentChoice = text("agentId");
    const values: SitePasswordValues = {
      agentId: agentChoice === AGENCY_CHOICE ? null : agentChoice,
      agencyId: agentChoice === AGENCY_CHOICE && agency ? agency.id : null,
      siteId: text("siteId"),
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
      const result = await saveSitePassword(values, editing?.id);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      router.push(returnTo);
    } finally {
      setSaving(false);
    }
  };

  const title = editing ? `Edit ${editing.agentName} at ${editing.siteName}` : "Add site password";

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
                onChange={() => clear("agentId", "siteId")}
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
              label="Site"
              required
              htmlFor={`${id}-site`}
              hint={siteError ?? undefined}
              hintId={`${id}-site-error`}
              error
            >
              <select
                id={`${id}-site`}
                name="siteId"
                required
                value={siteId}
                aria-invalid={siteError ? true : undefined}
                aria-describedby={siteError ? `${id}-site-error` : undefined}
                onChange={(event) => {
                  setSiteId(event.target.value);
                  clear("siteId");
                }}
                className={INPUT_CLASS}
              >
                <option value="">Choose a site</option>
                {[...sites].sort(byName).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setSiteEditor({ mode: "add" })} className={PROFILE_BUTTON_CLASS}>
                  <span aria-hidden="true">+ </span>Add site
                </button>
                {chosenSite ? (
                  <button
                    type="button"
                    onClick={() => setSiteEditor({ mode: "edit", site: chosenSite })}
                    className={PROFILE_BUTTON_CLASS}
                  >
                    Edit site<span className="sr-only"> {chosenSite.name}</span>
                  </button>
                ) : null}
                {chosenSite?.link ? (
                  <a
                    href={chosenSite.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs font-medium text-brand-ink underline underline-offset-2"
                  >
                    {chosenSite.link}
                  </a>
                ) : null}
              </div>
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

      {/* Outside the form above: a dialog's form can't nest in it. */}
      <SiteDialog
        editor={siteEditor}
        onSaved={(saved) => {
          setSites((current) => [...current.filter((site) => site.id !== saved.id), saved]);
          setSiteId(saved.id);
          clear("siteId");
        }}
        onClose={() => setSiteEditor(null)}
      />
    </>
  );
}
