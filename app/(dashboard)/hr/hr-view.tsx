"use client";

import { useMemo, useState } from "react";
import { TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { useRequestsStore } from "@/components/requests-store";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import { yearMonthOf } from "@/lib/calendar";
import { REQUEST_STATUSES, REQUEST_TYPE_LABELS } from "@/lib/request-options";
import type { MerchRequestRecord, RequestRecord, RequestStatus } from "@/lib/requests";
import { formatLicenceDate } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";
import { HrCalendar, type DayOffMark, type ExpiryMark } from "./hr-calendar";

/*
 * HR page: the month calendar (./hr-calendar.tsx) over the request list.
 *
 * Requests come from the requests store on the dashboard layout, so one
 * filed from the navbar on any page is already here, and a status set here
 * is what the calendar draws a day off in. Licence expirations are the end
 * dates of the agents' state licence rows, passed in by page.tsx. Every
 * request is listed, whatever its type or status; contracts have no date so
 * the list is the only place they show. Merch orders from the shop
 * (the merch type) list too, with the buyer in the Person column and the
 * shipping and contact details in the row; only day-off requests that are
 * not denied reach the calendar. Status changes go to the API through the store; one the API
 * refuses is put back and its message shown above the calendar.
 */

type HrViewProps = {
  /** Every agent's licence rows; their end dates are the expirations. */
  licenses: AgentStateLicenseRecord[];
  /** "YYYY-MM-DD" from the server, so the first render agrees on the month. */
  today: string;
};

const STATUS_TEXT_CLASSES: Record<RequestStatus, string> = {
  pending: "text-warn-ink",
  approved: "text-brand-ink",
  denied: "text-fg-muted",
};

/** "Sep 28 – Oct 2, 2026", or one date when the range is a single day. */
const rangeText = (start: string, end: string) =>
  start === end ? formatLicenceDate(start) : `${formatLicenceDate(start)} – ${formatLicenceDate(end)}`;

export function HrView({ licenses, today }: HrViewProps) {
  const { requests, agents, setStatus, statusError } = useRequestsStore();
  const [month, setMonth] = useState(() => yearMonthOf(today));

  const agentName = (id: string) => agents.find((agent) => agent.id === id)?.name ?? `Agent ${id}`;
  /** Who the request is for: the agent, or the tee buyer for a merch order. Names come with the record. */
  const personOf = (request: RequestRecord) =>
    request.type === "merch" ? request.buyerName : request.agentName;

  /** What a request asks for, as one line: the Details cell and its search text. */
  const detailOf = (request: RequestRecord): string => {
    switch (request.type) {
      case "licensing":
      case "contract":
        return `${request.state} · ${US_STATE_NAMES[request.state] ?? request.state} · ${request.carrierName}`;
      case "dayOff":
        return rangeText(request.startDate, request.endDate);
      case "merch":
        return `${request.productName} · ${request.quantity} × ${request.size} · ${request.color}`;
    }
  };

  /** A merch order's second and third lines: where to ship, and how to reach the buyer. */
  const merchContact = (request: MerchRequestRecord) => [request.address, `${request.email} · ${request.phone}`];

  const dayOffs: DayOffMark[] = requests.flatMap((request) =>
    request.type === "dayOff" && request.status !== "denied"
      ? [
          {
            key: request.id,
            agentName: request.agentName,
            status: request.status,
            startDate: request.startDate,
            endDate: request.endDate,
            note: request.note,
          },
        ]
      : [],
  );

  const expiries: ExpiryMark[] = licenses
    .filter((license) => license.endDate)
    .map((license) => ({
      key: license.id,
      agentName: agentName(license.agentId),
      state: license.state,
      date: license.endDate,
      startDate: license.startDate,
      licenseNumber: license.licenseNumber,
      licenseStatus: license.status,
    }));

  const pendingCount = requests.filter((request) => request.status === "pending").length;

  // `setStatus` changes only when the store does, which is when the rows
  // change too, so the columns stay stable between edits.
  const columns = useMemo<DataTableColumn<RequestRecord>[]>(
    () => [
      {
        id: "type",
        header: "Type",
        cell: (request) => REQUEST_TYPE_LABELS[request.type],
        sortValue: (request) => REQUEST_TYPE_LABELS[request.type],
        searchText: (request) => REQUEST_TYPE_LABELS[request.type],
      },
      {
        id: "person",
        // The agent it is for, or the buyer of a tee order.
        header: "Person",
        cell: (request) => personOf(request),
        className: "whitespace-nowrap text-fg",
        sortValue: (request) => personOf(request),
        searchText: (request) => personOf(request),
      },
      {
        id: "detail",
        header: "Details",
        cell: (request) => (
          <>
            <span>{detailOf(request)}</span>
            {request.type === "merch" ? (
              /* Shipping address as typed (may span lines), then email and
                 phone, so the office can reach the buyer from this row. */
              <>
                <p className="mt-0.5 whitespace-pre-line text-xs text-fg-subtle">{request.address}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  <a href={`mailto:${request.email}`} className="hover:text-fg hover:underline">
                    {request.email}
                  </a>
                  {" · "}
                  {request.phone}
                </p>
              </>
            ) : null}
            {request.note ? <p className="mt-0.5 text-xs text-fg-subtle">{request.note}</p> : null}
          </>
        ),
        className: "text-fg-muted",
        searchText: (request) => [
          detailOf(request),
          ...(request.type === "merch" ? merchContact(request) : []),
          request.note ?? "",
        ],
      },
      {
        id: "filed",
        header: "Filed",
        // The UTC date only: formatted from the string on both sides, so no hydration drift.
        cell: (request) => formatLicenceDate(request.createdAt.slice(0, 10)),
        className: "whitespace-nowrap text-fg-muted",
        sortValue: (request) => request.createdAt,
      },
      {
        id: "status",
        header: "Status",
        cell: (request) => (
          <select
            value={request.status}
            onChange={(event) => setStatus(request.id, event.target.value as RequestStatus)}
            aria-label={`Status of ${personOf(request)}'s ${REQUEST_TYPE_LABELS[request.type].toLowerCase()} request`}
            className={`${TOOLBAR_INPUT_CLASS} py-1 text-xs font-medium capitalize ${STATUS_TEXT_CLASSES[request.status]}`}
          >
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        ),
        sortValue: (request) => REQUEST_STATUSES.indexOf(request.status),
        searchText: (request) => request.status,
      },
    ],
    [setStatus],
  );

  return (
    <>
      <PageHeader
        title="HR"
        description={
          pendingCount === 0
            ? "No requests waiting on a decision."
            : `${pendingCount} ${pendingCount === 1 ? "request" : "requests"} waiting on a decision.`
        }
      />

      <div role="alert" className="mb-4">
        {statusError ? (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            The status change was refused: {statusError}
          </p>
        ) : null}
      </div>

      <HrCalendar
        month={month}
        onMonthChange={setMonth}
        today={today}
        dayOffs={dayOffs}
        expiries={expiries}
        onStatusChange={setStatus}
      />

      <section aria-labelledby="hr-requests-heading" className="mt-8">
        <h2 id="hr-requests-heading" className="mb-3 text-sm font-semibold text-fg">
          Requests
        </h2>
        <DataTable
          rows={requests}
          columns={columns}
          getRowId={(request) => request.id}
          unit={["request", "requests"]}
          emptyMessage="No requests yet. File one with the + in the top bar."
        />
      </section>
    </>
  );
}
