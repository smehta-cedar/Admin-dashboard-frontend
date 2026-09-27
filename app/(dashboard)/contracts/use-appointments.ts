"use client";

import { useState } from "react";
import type { AppointmentError, AppointmentValues, CarrierContractRecord } from "@/lib/carrier-contracts";
import { saveAppointment } from "./actions";
import type { AppointmentEditor } from "./appointment-dialog";

/*
 * The appointment state every page with an AppointmentDialog keeps: the
 * contracts, which dialog is open, the name lookups, and the `onSave` that
 * calls the saveAppointment server action and stores the saved contract.
 * Contracts by state, Contracts by carrier and the agent profile all use it;
 * each still derives its own rows from `contracts`, since what they show
 * differs. The API writes the notes; the by-state page reads them as a prop.
 */

type AgentLookup = { id: string; name: string };
type CarrierLookup = { id: string; name: string };

type UseAppointmentsInput = {
  initialContracts: CarrierContractRecord[];
  /** Read on every save, so a live (edited) agent or carrier list works. */
  agents: AgentLookup[];
  carriers: CarrierLookup[];
  /** Runs after a successful save, with the values and the contracts as they are now. */
  onSaved: (values: AppointmentValues, contracts: CarrierContractRecord[]) => void;
};

export function useAppointments({ initialContracts, agents, carriers, onSaved }: UseAppointmentsInput) {
  const [contracts, setContracts] = useState(initialContracts);
  const [editor, setEditor] = useState<AppointmentEditor | null>(null);

  const agentName = (agentId: string) =>
    agents.find((agent) => agent.id === agentId)?.name ?? `Agent ${agentId}`;
  const carrierName = (carrierId: string) =>
    carriers.find((carrier) => carrier.id === carrierId)?.name ?? `Carrier ${carrierId}`;

  /** The dialog's onSave: adds or edits through the API. Resolves with the error to show, if any. */
  const saveContract = async (
    values: AppointmentValues,
    editing?: CarrierContractRecord,
  ): Promise<AppointmentError | null> => {
    const result = await saveAppointment(values, editing?.id);
    if (!result.ok) return result.error;

    const saved = result.contract;
    const next = editing
      ? contracts.map((contract) => (contract.id === saved.id ? saved : contract))
      : [...contracts, saved];
    setContracts(next);
    onSaved(values, next);
    return null;
  };

  return { contracts, editor, setEditor, saveContract, agentName, carrierName };
}
