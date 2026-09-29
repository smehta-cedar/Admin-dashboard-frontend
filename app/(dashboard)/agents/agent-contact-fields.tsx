"use client";

import { INPUT_CLASS } from "@/components/classes";
import { PasswordInput } from "@/components/credential-value";
import { Field } from "@/components/field";
import type { ProducerError, ProducerExtra } from "@/components/producer-form";
import { StateSelect } from "@/components/state-select";
import { ADDRESS_PARTS, formatAddress, type Address } from "@/lib/address";
import type { AgentRecord } from "@/lib/agents";
import { formatPhone } from "@/lib/phone";

/*
 * The agent-only part of the producer form: personal email and personal
 * phone (both required on the form; the record keeps them optional for
 * agents entered before that) and the optional home address, drawn in the
 * Contact section after the work email and phone. The agency shares the form but has none of
 * these, so the agent dialog passes them in as the form's `extra`
 * (components/producer-form.tsx) rather than the form owning them.
 *
 * The address is all or nothing: fill in street, city, state and ZIP, or
 * leave all four blank. `saveAgent` checks that with `incompleteAddressError`
 * and the form shows the message under the address fields; there is no
 * help text ahead of it, this being an internal form.
 *
 * After the address, four optional fields on one row: date of birth, join
 * date, start date (employment, not a licence's) and the SSN's last four
 * digits, typed into a masked input like a password.
 */

/** The section's fields, exactly as AgentRecord holds them. */
export type AgentContact = Pick<
  AgentRecord,
  "personalEmail" | "personalPhone" | "address" | "dateOfBirth" | "joinDate" | "startDate" | "ssnLast4"
>;

const addressField = (part: keyof Address) => `address-${part}`;

/** The section's values off the submitted form: blanks become absent, the phone formatted. */
function readAgentContact(data: FormData): AgentContact {
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const personalEmail = text("personalEmail");
  const personalPhone = formatPhone(text("personalPhone"));
  const parts = Object.fromEntries(ADDRESS_PARTS.map((part) => [part, text(addressField(part))])) as Address;
  const hasAddress = ADDRESS_PARTS.some((part) => parts[part]);
  const dateOfBirth = text("dateOfBirth");
  const joinDate = text("joinDate");
  const startDate = text("startDate");
  const ssnLast4 = text("ssnLast4");
  return {
    ...(personalEmail ? { personalEmail } : {}),
    ...(personalPhone ? { personalPhone } : {}),
    // A partly filled address is kept so the save can reject it by name.
    ...(hasAddress ? { address: parts } : {}),
    ...(dateOfBirth ? { dateOfBirth } : {}),
    ...(joinDate ? { joinDate } : {}),
    ...(startDate ? { startDate } : {}),
    ...(ssnLast4 ? { ssnLast4 } : {}),
  };
}

/** The error `saveAgent` returns for an address with some of its four parts blank. */
export const incompleteAddressError = (values: AgentContact): ProducerError | null => {
  if (!values.address) return null;
  const missing = ADDRESS_PARTS.filter((part) => !values.address?.[part]);
  if (missing.length === 0) return null;
  return {
    field: "address",
    message: `Enter the ${missing.join(", ")} too, or leave the whole address blank.`,
  };
};

/** The contact fields as notes compare and show them: absent is "", the address one line. */
export const agentContactNoteValues = (values: AgentContact) => ({
  personalEmail: values.personalEmail ?? "",
  personalPhone: values.personalPhone ?? "",
  address: formatAddress(values.address),
});

/** The form section the agent dialog hands to ProducerForm. */
export function agentContactExtra(initial?: AgentContact): ProducerExtra<AgentContact> {
  return {
    read: readAgentContact,
    render: ({ id, error, clearError, span }) => {
      const address = initial?.address;
      const invalid = error ? { "aria-invalid": true as const, "aria-describedby": `${id}-address-error` } : {};
      return (
        <>
          <Field label="Personal email" required htmlFor={`${id}-personal-email`} className={span.field}>
            <input
              id={`${id}-personal-email`}
              name="personalEmail"
              type="email"
              required
              autoComplete="off"
              defaultValue={initial?.personalEmail}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Personal phone" required htmlFor={`${id}-personal-phone`} className={span.field}>
            <input
              id={`${id}-personal-phone`}
              name="personalPhone"
              type="tel"
              required
              pattern=".*\S.*"
              autoComplete="off"
              defaultValue={initial?.personalPhone}
              className={INPUT_CLASS}
            />
          </Field>

          <fieldset className={`min-w-0 ${span.full}`}>
            <legend className="text-sm font-medium text-fg">
              Address
            </legend>
            {/* Street, then ZIP, state and city side by side; all one row on the wide page. */}
            <div className={`mt-2 grid gap-x-4 gap-y-3 ${span.innerGrid}`}>
              <Field label="Street" htmlFor={`${id}-address-street`} className="sm:col-span-3">
                <input
                  id={`${id}-address-street`}
                  name={addressField("street")}
                  type="text"
                  autoComplete="off"
                  defaultValue={address?.street}
                  onChange={clearError}
                  className={INPUT_CLASS}
                  {...invalid}
                />
              </Field>
              <Field label="ZIP code" htmlFor={`${id}-address-zip`}>
                <input
                  id={`${id}-address-zip`}
                  name={addressField("zip")}
                  type="text"
                  inputMode="numeric"
                  pattern="\d{5}(-\d{4})?"
                  title="Five digits, or ZIP+4 like 78701-1234"
                  autoComplete="off"
                  defaultValue={address?.zip}
                  onChange={clearError}
                  className={INPUT_CLASS}
                  {...invalid}
                />
              </Field>
              <Field label="State" htmlFor={`${id}-address-state`}>
                <StateSelect
                  id={`${id}-address-state`}
                  name={addressField("state")}
                  defaultValue={address?.state}
                  onChange={clearError}
                  invalid={Boolean(error)}
                  describedBy={error ? `${id}-address-error` : undefined}
                />
              </Field>
              <Field label="City" htmlFor={`${id}-address-city`}>
                <input
                  id={`${id}-address-city`}
                  name={addressField("city")}
                  type="text"
                  autoComplete="off"
                  defaultValue={address?.city}
                  onChange={clearError}
                  className={INPUT_CLASS}
                  {...invalid}
                />
              </Field>
            </div>
            {error ? (
              <p id={`${id}-address-error`} className="mt-1 text-xs text-danger">
                {error}
              </p>
            ) : null}
          </fieldset>

          <Field label="Date of birth" htmlFor={`${id}-date-of-birth`} className={span.field}>
            <input
              id={`${id}-date-of-birth`}
              name="dateOfBirth"
              type="date"
              autoComplete="off"
              defaultValue={initial?.dateOfBirth}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Join date" htmlFor={`${id}-join-date`} className={span.field}>
            <input
              id={`${id}-join-date`}
              name="joinDate"
              type="date"
              autoComplete="off"
              defaultValue={initial?.joinDate}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Start date" htmlFor={`${id}-start-date`} className={span.field}>
            <input
              id={`${id}-start-date`}
              name="startDate"
              type="date"
              autoComplete="off"
              defaultValue={initial?.startDate}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="SSN" htmlFor={`${id}-ssn-last4`} className={span.field}>
            <PasswordInput
              id={`${id}-ssn-last4`}
              name="ssnLast4"
              label="SSN"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              title="The last 4 digits"
              autoComplete="off"
              defaultValue={initial?.ssnLast4}
              className={INPUT_CLASS}
            />
          </Field>
        </>
      );
    },
  };
}
