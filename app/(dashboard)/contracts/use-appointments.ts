"use client";

import { useState } from "react";
import type { CarrierContractNote, CarrierContractRecord } from "@/lib/carrier-contracts";
import {
  saveAppointment,
  type AppointmentEditor,
  type AppointmentError,
  type AppointmentValues,
} from "./appointment-dialog";

/*
 * The appointment state every page with an AppointmentDialog keeps: the
 * contracts and their notes (component state only, dummy like the rest), which
 * dialog is open, the name / ceiling lookups saveAppointment needs, and the
 * `onSave` that runs it and stores the result. Contracts by state, Contracts
 * by carrier and the agent profile all use it; each still derives its own rows
 * from `contracts`, since what they show differs.
 */

type AgentLookup = { id: string; name: string; licensedStates: string[] };
type CarrierLookup = { id: string; name: string; availableStates: string[] };

type UseAppointmentsInput = {
  initialContracts: CarrierContractRecord[];
  initialNotes: CarrierContractNote[];
  /** Read on every save, so a live (edited) agent or carrier list works. */
  agents: AgentLookup[];
  carriers: CarrierLookup[];
  /** Runs after a save that changed something, with the values and the contracts as they are now. */
  onSaved: (values: AppointmentValues, contracts: CarrierContractRecord[]) => void;
};

export function useAppointments({
  initialContracts,
  initialNotes,
  agents,
  carriers,
  onSaved,
}: UseAppointmentsInput) {
  const [contracts, setContracts] = useState(initialContracts);
  const [notes, setNotes] = useState(initialNotes);
  const [editor, setEditor] = useState<AppointmentEditor | null>(null);

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;
  const availableStates = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.availableStates ?? [];
  const licensedStates = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.licensedStates ?? [];

  /** The dialog's onSave: adds or edits through saveAppointment. Returns the error to show, if any. */
  const saveContract = (
    values: AppointmentValues,
    editing?: CarrierContractRecord,
  ): AppointmentError | null => {
    const result = saveAppointment({
      contracts,
      notes,
      values,
      editing,
      agentName,
      carrierName,
      availableStates,
      licensedStates,
    });
    if (result.error !== null) return result.error;
    // Saving an edit with nothing changed just closes, without a note.
    if (!result.changed) return null;

    setContracts(result.contracts);
    setNotes(result.notes);
    onSaved(values, result.contracts);
    return null;
  };

  return { contracts, notes, editor, setEditor, saveContract, agentName, carrierName };
}
