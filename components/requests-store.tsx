"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { newRequest, type RequestError, type RequestValues } from "@/lib/request-options";
import type { RequestRecord, RequestStatus } from "@/lib/requests";

/*
 * The dummy request list, held above every dashboard page. The navbar's
 * Create-a-request button files from anywhere, and the HR page reads and
 * changes statuses, so the state has to outlive any one page: the dashboard
 * layout (app/(dashboard)/layout.tsx) loads data/requests.json once and
 * mounts this provider around the shell. Like every other list, nothing
 * reaches a server and a refresh brings back the JSON.
 *
 * The slim agent and carrier options ride along for the dialog's selects and
 * the HR page's names, so neither has to load them again.
 */

export type RequestParty = { id: string; name: string; status: "active" | "inactive" };

type RequestsStore = {
  requests: RequestRecord[];
  /** Every agent, sorted by name; inactive ones are marked in the selects. */
  agents: RequestParty[];
  /** Every carrier, sorted by name. */
  carriers: RequestParty[];
  /** Requests filed and statuses changed since the page loaded, for an unsaved banner. */
  unsavedCount: number;
  /** Files a pending request. Returns the form error, if any. */
  addRequest: (values: RequestValues) => RequestError | null;
  /** HR's decision. A status that is already set changes nothing. */
  setStatus: (id: string, status: RequestStatus) => void;
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
  const [unsavedCount, setUnsavedCount] = useState(0);

  const addRequest: RequestsStore["addRequest"] = (values) => {
    const result = newRequest(values, requests);
    if (result.error !== null) return result.error;
    setRequests((current) => [...current, result.request]);
    setUnsavedCount((count) => count + 1);
    return null;
  };

  const setStatus: RequestsStore["setStatus"] = (id, status) => {
    const request = requests.find((candidate) => candidate.id === id);
    if (!request || request.status === status) return;
    setRequests((current) =>
      current.map((candidate) => (candidate.id === id ? { ...candidate, status } : candidate)),
    );
    setUnsavedCount((count) => count + 1);
  };

  return (
    <RequestsContext.Provider
      value={{ requests, agents, carriers, unsavedCount, addRequest, setStatus }}
    >
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
