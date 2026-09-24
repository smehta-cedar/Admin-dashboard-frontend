"use client";

import { INPUT_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import type { ProducerError, ProducerExtra } from "@/components/producer-form";
import { ADDRESS_PARTS, formatAddress, type Address } from "@/lib/address";
import type { AgentRecord } from "@/lib/agents";
import { formatPhone } from "@/lib/phone";
import { US_STATES } from "@/lib/us-states";

/*
 * The agent-only part of the producer form: personal email, personal phone
 * and home address, every one optional. The agency shares the form but has
 * none of these, so the agent dialog passes this section in as the form's
 * `extra` (components/producer-form.tsx) rather than the form owning it.
 *
 * The address is all or nothing: fill in street, city, state and ZIP, or
 * leave all four blank. `saveAgent` checks that with `incompleteAddressError`
 * and the form shows the message under the address fields.
 */

/** The three optional fields, exactly as AgentRecord holds them. */
export type AgentContact = Pick<AgentRecord, "personalEmail" | "personalPhone" | "address">;

const addressField = (part: keyof Address) => `address-${part}`;

/** The section's values off the submitted form: blanks become absent, the phone formatted. */
function readAgentContact(data: FormData): AgentContact {
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const personalEmail = text("personalEmail");
  const personalPhone = formatPhone(text("personalPhone"));
  const parts = Object.fromEntries(ADDRESS_PARTS.map((part) => [part, text(addressField(part))])) as Address;
  const hasAddress = ADDRESS_PARTS.some((part) => parts[part]);
  return {
    ...(personalEmail ? { personalEmail } : {}),
    ...(personalPhone ? { personalPhone } : {}),
    // A partly filled address is kept so the save can reject it by name.
    ...(hasAddress ? { address: parts } : {}),
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
    render: ({ id, error, clearError }) => {
      const address = initial?.address;
      const invalid = error ? { "aria-invalid": true as const, "aria-describedby": `${id}-address-error` } : {};
      return (
        <>
          <Field label="Personal email" optional htmlFor={`${id}-personal-email`}>
            <input
              id={`${id}-personal-email`}
              name="personalEmail"
              type="email"
              autoComplete="off"
              defaultValue={initial?.personalEmail}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Personal phone" optional htmlFor={`${id}-personal-phone`}>
            <input
              id={`${id}-personal-phone`}
              name="personalPhone"
              type="tel"
              autoComplete="off"
              defaultValue={initial?.personalPhone}
              className={INPUT_CLASS}
            />
          </Field>

          <fieldset className="min-w-0 sm:col-span-2">
            <legend className="text-sm font-medium text-fg">
              Address<span className="font-normal text-fg-subtle"> (optional)</span>
            </legend>
            <p className="mt-1 text-xs text-fg-subtle">
              Home address. Fill in all four parts, or leave them all blank.
            </p>
            <div className="mt-2 grid gap-x-4 gap-y-3 sm:grid-cols-6">
              <Field label="Street" htmlFor={`${id}-address-street`} className="sm:col-span-6">
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
              <Field label="City" htmlFor={`${id}-address-city`} className="sm:col-span-3">
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
              <Field label="State" htmlFor={`${id}-address-state`} className="sm:col-span-1">
                <select
                  id={`${id}-address-state`}
                  name={addressField("state")}
                  defaultValue={address?.state ?? ""}
                  onChange={clearError}
                  className={INPUT_CLASS}
                  {...invalid}
                >
                  <option value="">—</option>
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code} title={state.name}>
                      {state.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ZIP" htmlFor={`${id}-address-zip`} className="sm:col-span-2">
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
            </div>
            {error ? (
              <p id={`${id}-address-error`} className="mt-1 text-xs text-danger">
                {error}
              </p>
            ) : null}
          </fieldset>
        </>
      );
    },
  };
}
