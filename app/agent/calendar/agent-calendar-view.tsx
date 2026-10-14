"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { useRequestsStore } from "@/components/requests-store";
import { HrCalendar, type DayOffMark, type ExpiryMark } from "@/app/(dashboard)/hr/hr-calendar";
import type { AgentStateLicenseRecord } from "@/lib/agent-state-licenses";
import { localDateString, yearMonthOf } from "@/lib/calendar";
import { REQUEST_TYPE_LABELS } from "@/lib/request-options";
import type { RequestRecord, RequestStatus } from "@/lib/requests";
import { formatLicenceDate } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * The agent's own calendar: day-off requests and licence expiries for this
 * agent only. Status is read-only; HR decides on the staff Calendar page.
 */

type AgentCalendarViewProps = {
  licenses: AgentStateLicenseRecord[];
  today: string;
};

const STATUS_TEXT_CLASSES: Record<RequestStatus, string> = {
  pending: "text-warn-ink",
  approved: "text-brand-ink",
  denied: "text-fg-muted",
};

const rangeText = (start: string, end: string) =>
  start === end ? formatLicenceDate(start) : `${formatLicenceDate(start)} – ${formatLicenceDate(end)}`;

export function AgentCalendarView({ licenses, today: serverToday }: AgentCalendarViewProps) {
  const { requests } = useRequestsStore();
  const [today, setToday] = useState(serverToday);
  const [month, setMonth] = useState(() => yearMonthOf(serverToday));

  useEffect(() => {
    const local = localDateString();
    setToday(local);
    setMonth((current) => {
      const serverMonth = yearMonthOf(serverToday);
      const onServerTodayMonth =
        current.year === serverMonth.year && current.month === serverMonth.month;
      return onServerTodayMonth ? yearMonthOf(local) : current;
    });
  }, [serverToday]);

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

  const dayOffs: DayOffMark[] = requests.flatMap((request) =>
    request.type === "dayOff"
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
      agentId: license.agentId,
      agentName: license.agentName,
      state: license.state,
      date: license.endDate,
      startDate: license.startDate,
      licenseNumber: license.licenseNumber,
      licenseStatus: license.status,
    }));

  const pendingCount = requests.filter((request) => request.status === "pending").length;

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
        id: "detail",
        header: "Details",
        cell: (request) => (
          <>
            <span>{detailOf(request)}</span>
            {request.note ? <p className="mt-0.5 text-xs text-fg-subtle">{request.note}</p> : null}
          </>
        ),
        className: "text-fg-muted",
        searchText: (request) => [detailOf(request), request.note ?? ""],
      },
      {
        id: "filed",
        header: "Filed",
        cell: (request) => formatLicenceDate(request.createdAt.slice(0, 10)),
        className: "whitespace-nowrap text-fg-muted",
        sortValue: (request) => request.createdAt,
      },
      {
        id: "status",
        header: "Status",
        cell: (request) => (
          <span className={`text-xs font-medium capitalize ${STATUS_TEXT_CLASSES[request.status]}`}>
            {request.status}
          </span>
        ),
        sortValue: (request) => request.status,
        searchText: (request) => request.status,
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Calendar"
        description={
          pendingCount === 0
            ? "Your days off and licence expiries. File a request with + in the top bar."
            : `${pendingCount} ${pendingCount === 1 ? "request" : "requests"} waiting on a decision.`
        }
      />

      <HrCalendar month={month} onMonthChange={setMonth} today={today} dayOffs={dayOffs} expiries={expiries} />

      <section aria-labelledby="agent-requests-heading" className="mt-8">
        <h2 id="agent-requests-heading" className="mb-3 text-sm font-semibold text-fg">
          My requests
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
