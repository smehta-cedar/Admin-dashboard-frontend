"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { fileRequest, setRequestStatus } from "@/app/(dashboard)/hr/actions";
import type { CarrierStatus } from "@/lib/carrier-statuses";
import { refreshNotificationsSoon } from "@/lib/notifications";
import { checkRequestValues, type RequestError, type RequestValues } from "@/lib/request-options";
import type { RequestRecord, RequestStatus } from "@/lib/requests";

/*
 * The request list, held above every dashboard page. The navbar's
 * Create-a-request button files from anywhere, and the HR page reads and
 * changes statuses, so the state has to outlive any one page: the dashboard
 * layout (app/(dashboard)/layout.tsx) loads the list from the API once and
 * mounts this provider around the shell. Filing and status changes go to
 * the API through the server actions in app/(dashboard)/hr/actions.ts and
 * update the list here from the result.
 *
 * The slim agent and carrier options ride along for the dialog's selects and
 * the HR page's names, so neither has to load them again.
 */

/** Agents are active or inactive; a carrier can also be applied, pending or expired. */
export type RequestParty = { id: string; name: string; status: CarrierStatus };

type RequestsStore = {
  requests: RequestRecord[];
  /** Every agent, sorted by name; inactive ones are marked in the selects. */
  agents: RequestParty[];
  /** Every carrier, sorted by name. */
  carriers: RequestParty[];
  /** Files a pending request through the API. Resolves with the form error, if any. */
  addRequest: (values: RequestValues) => Promise<RequestError | null>;
  /** HR's decision, through the API. Resolves with a message when it failed. A status already set changes nothing. */
  setStatus: (id: string, status: RequestStatus) => Promise<string | null>;
  /** The last status change that failed, for the HR page to show. */
  statusError: string | null;
};

const RequestsContext = createContext<RequestsStore | null>(null);

type RequestsProviderProps = {
  initialRequests: RequestRecord[];
  agents: RequestParty[];
  carriers: RequestParty[];
  children: ReactNode;
};

export function RequestsProvider({ initialRequests, agents, carriers, children }: RequestsProviderProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [statusError, setStatusError] = useState<string | null>(null);

  const addRequest: RequestsStore["addRequest"] = async (values) => {
    const error = checkRequestValues(values);
    if (error) return error;
    const result = await fileRequest(values);
    if (!result.ok) return result.error;
    setRequests((current) => [...current, result.request]);
    // Filing notifies the admins, this user among them when they are one.
    refreshNotificationsSoon();
    return null;
  };

  const setStatus: RequestsStore["setStatus"] = async (id, status) => {
    const request = requests.find((candidate) => candidate.id === id);
    if (!request || request.status === status) return null;
    // Show the choice at once; put the old one back if the API refuses it.
    setRequests((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, status } : candidate)),
    );
    setStatusError(null);
    const result = await setRequestStatus(id, status);
    if (!result.ok) {
      setRequests((current) => current.map((candidate) => (candidate.id === id ? request : candidate)));
      setStatusError(result.message);
      return result.message;
    }
    setRequests((current) => current.map((candidate) => (candidate.id === id ? result.request : candidate)));
    return null;
  };

  return (
    <RequestsContext.Provider value={{ requests, agents, carriers, addRequest, setStatus, statusError }}>
      {children}
    </RequestsContext.Provider>
  );
}

/** The request list and its parties. Only under the dashboard layout. */
export function useRequestsStore(): RequestsStore {
  const store = useContext(RequestsContext);
  if (!store) throw new Error("useRequestsStore needs a RequestsProvider (app/(dashboard)/layout.tsx).");
  return store;
}
