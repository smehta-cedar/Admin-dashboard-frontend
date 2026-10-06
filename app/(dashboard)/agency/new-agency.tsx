"use client";

import { useState } from "react";
import { PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { EmptyState } from "@/components/empty-state";
import { createAgency } from "./actions";
import { AgencyDialog, type AgencyError, type AgencyValues } from "./agency-dialog";

/*
 * The Agency page before the agency exists (a new install): a superuser gets
 * an Add agency button that opens the agency form; anyone else is told to ask
 * one. Saving revalidates the page, which then renders the agency profile,
 * where licences and contracts are added.
 */

export function NewAgency({ canAdd }: { canAdd: boolean }) {
  const [open, setOpen] = useState(false);

  const save = async (values: AgencyValues): Promise<AgencyError | null> => {
    const result = await createAgency(values);
    return result.ok ? null : result.error;
  };

  return (
    <>
      <EmptyState
        title="No agency yet"
        description={canAdd ? "Add the agency to start recording its licences and contracts." : "A superuser has to add the agency."}
        action={
          canAdd ? (
            <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BUTTON_CLASS}>
              <span aria-hidden="true">+</span> Add agency
            </button>
          ) : null
        }
      />
      <AgencyDialog editing={open ? "new" : null} onSave={save} onClose={() => setOpen(false)} />
    </>
  );
}
