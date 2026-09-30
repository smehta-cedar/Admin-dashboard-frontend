"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GHOST_BUTTON_CLASS, TOOLBAR_INPUT_CLASS } from "@/components/classes";
import { StatusBadge } from "@/components/status-badge";
import {
  addMonths,
  dateInRange,
  monthGrid,
  monthKey,
  monthLabel,
  WEEKDAY_NAMES,
  type YearMonth,
} from "@/lib/calendar";
import { REQUEST_STATUSES } from "@/lib/request-options";
import type { RequestStatus } from "@/lib/requests";
import { formatLicenceDate, type StateLicenseStatus } from "@/lib/state-licenses";
import { US_STATE_NAMES } from "@/lib/us-states";

/*
 * The month grid: a plain <table> in the app's Tailwind, one <td> per day.
 * Two kinds of mark:
 *
 *   day off   — a request's range, drawn on every day it covers as a bar
 *               that is rounded only at its first and last day, coloured by
 *               the request's status (pending amber, approved green). A
 *               denied request stays in the list and is not drawn. The
 *               agent's name sits on the first day and again on each Sunday
 *               the range runs into, so a long range stays labelled on
 *               every row.
 *   expiry    — a state licence's end date, one chip on that day.
 *
 * Clicking a name opens a panel from the right. A day off's status uses the
 * same dropdown as the request list, through the same status change. A
 * licence expiry is not a request, so that dropdown is not on its panel.
 *
 * Contract requests have no date, so they never appear here; the list below
 * the calendar has them.
 */

export type DayOffMark = {
  key: string;
  agentName: string;
  status: RequestStatus;
  startDate: string;
  endDate: string;
  note?: string;
};

export type ExpiryMark = {
  key: string;
  agentName: string;
  state: string;
  date: string;
  startDate: string;
  licenseNumber: string;
  licenseStatus: StateLicenseStatus;
};

type CalendarDetail = { kind: "dayOff"; mark: DayOffMark } | { kind: "expiry"; mark: ExpiryMark };

type HrCalendarProps = {
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  today: string;
  dayOffs: DayOffMark[];
  expiries: ExpiryMark[];
  /** The request list's status change. A day off's key is that request's id. */
  onStatusChange: (id: string, status: RequestStatus) => void;
};

const DAY_OFF_CLASSES: Record<RequestStatus, string> = {
  pending: "bg-warn-soft text-warn-ink",
  approved: "bg-brand-soft text-brand-ink",
  denied: "bg-surface-hover text-fg-muted line-through",
};

const EXPIRY_CLASS = "bg-info-soft text-info-ink";

const STATUS_TEXT_CLASSES: Record<RequestStatus, string> = {
  pending: "text-warn-ink",
  approved: "text-brand-ink",
  denied: "text-fg-muted",
};

const NAV_BUTTON_CLASS = `${GHOST_BUTTON_CLASS} px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`;

const MARK_BUTTON_CLASS =
  "block w-full cursor-pointer truncate text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand";

/** "Sep 28 – Oct 2, 2026", or one date when the range is a single day. */
const rangeText = (start: string, end: string) =>
  start === end ? formatLicenceDate(start) : `${formatLicenceDate(start)} – ${formatLicenceDate(end)}`;

export function HrCalendar({ month, onMonthChange, today, dayOffs, expiries, onStatusChange }: HrCalendarProps) {
  const captionId = useId();
  const weeks = monthGrid(month);
  const todayMonth = monthKey({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [open, setOpen] = useState<{ kind: CalendarDetail["kind"]; key: string } | null>(null);
  const detail: CalendarDetail | null = (() => {
    if (!open) return null;
    if (open.kind === "dayOff") {
      const mark = dayOffs.find((item) => item.key === open.key);
      return mark ? { kind: "dayOff", mark } : null;
    }
    const mark = expiries.find((item) => item.key === open.key);
    return mark ? { kind: "expiry", mark } : null;
  })();

  return (
    <section aria-labelledby={captionId} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-muted/80 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <span
            aria-hidden="true"
            className="mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink"
          >
            <CalendarGlyph />
          </span>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, -1))}
            aria-label="Previous month"
            className={NAV_BUTTON_CLASS}
          >
            <Chevron direction="left" />
          </button>
          <h2 id={captionId} className="truncate px-1 text-base font-semibold tracking-tight text-fg">
            <time dateTime={monthKey(month)}>{monthLabel(month)}</time>
          </h2>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="Next month"
            className={NAV_BUTTON_CLASS}
          >
            <Chevron direction="right" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onMonthChange({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })}
          disabled={monthKey(month) === todayMonth}
          className={`${GHOST_BUTTON_CLASS} px-2.5 py-1.5 text-xs ring-1 ring-inset ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40 disabled:hover:bg-transparent`}
        >
          Today
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              {WEEKDAY_NAMES.map((name, column) => (
                <th
                  key={name}
                  scope="col"
                  className={`border-b border-line bg-surface px-1 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-fg-muted ${
                    column < 6 ? "border-r" : ""
                  }`}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => (
              <tr key={index}>
                {week.map((cell, column) => {
                  const gridLine = `${index < weeks.length - 1 ? "border-b" : ""} border-line ${
                    column < 6 ? "border-r" : ""
                  }`;
                  return cell === null ? (
                    <td key={`pad-${column}`} className={`${gridLine} bg-surface-muted`} />
                  ) : (
                    <td
                      key={cell.date}
                      className={`h-24 p-1 align-top ${gridLine} ${
                        cell.date === today
                          ? "bg-brand-soft/45"
                          : cell.weekday === 0 || cell.weekday === 6
                            ? "bg-surface-muted/80"
                            : "bg-surface"
                      }`}
                    >
                      <time
                        dateTime={cell.date}
                        className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
                          cell.date === today
                            ? "bg-brand-strong font-semibold text-white shadow-[0_0_0_2px_var(--color-surface)]"
                            : cell.weekday === 0 || cell.weekday === 6
                              ? "font-medium text-fg-subtle"
                              : "font-medium text-fg"
                        }`}
                      >
                        {cell.day}
                      </time>
                      <ul className="space-y-0.5">
                        {dayOffs
                          .filter((mark) => dateInRange(cell.date, mark.startDate, mark.endDate))
                          .map((mark) => {
                            const isStart = mark.startDate === cell.date;
                            const isEnd = mark.endDate === cell.date;
                            const labelled = isStart || cell.weekday === 0;
                            return (
                              <li key={mark.key}>
                                <button
                                  type="button"
                                  title={`${mark.agentName}: day off, ${mark.status}`}
                                  aria-label={`${mark.agentName}, day off, ${mark.status}`}
                                  onClick={() => setOpen({ kind: "dayOff", key: mark.key })}
                                  className={`${MARK_BUTTON_CLASS} px-1.5 py-0.5 text-xs font-medium leading-4 ${DAY_OFF_CLASSES[mark.status]} ${
                                    isStart ? "ml-0.5 rounded-l-md border-l-[3px] border-l-current" : "-ml-1"
                                  } ${isEnd ? "mr-0.5 rounded-r-md" : "-mr-1"}`}
                                >
                                  {labelled ? mark.agentName : <span className="sr-only">{mark.agentName}</span>}
                                  {labelled ? null : <span aria-hidden="true">&nbsp;</span>}
                                </button>
                              </li>
                            );
                          })}
                        {expiries
                          .filter((mark) => mark.date === cell.date)
                          .map((mark) => (
                            <li key={mark.key}>
                              <button
                                type="button"
                                title={`${mark.agentName}: ${mark.state} licence expires`}
                                aria-label={`${mark.agentName}, ${mark.state} licence expires`}
                                onClick={() => setOpen({ kind: "expiry", key: mark.key })}
                                className={`${MARK_BUTTON_CLASS} rounded-md px-1.5 py-0.5 text-xs font-medium leading-4 ring-1 ring-inset ring-info-ink/20 ${EXPIRY_CLASS}`}
                              >
                                <span className="font-mono tracking-tight">{mark.state}</span>
                                <span className="text-info-ink/80"> expires</span>
                                <span className="text-info-ink/50"> · </span>
                                {mark.agentName}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-wrap gap-1.5 border-t border-line bg-surface-muted/50 px-3 py-2 text-xs text-fg-muted sm:px-4">
        <LegendItem className={DAY_OFF_CLASSES.pending}>Day off, pending</LegendItem>
        <LegendItem className={DAY_OFF_CLASSES.approved}>Day off, approved</LegendItem>
        <LegendItem className={EXPIRY_CLASS}>Licence expires</LegendItem>
      </ul>

      {detail ? (
        <DetailDrawer detail={detail} onStatusChange={onStatusChange} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}

function DetailDrawer({
  detail,
  onStatusChange,
  onClose,
}: {
  detail: CalendarDetail;
  onStatusChange: (id: string, status: RequestStatus) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const name = detail.mark.agentName;
  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="hr-drawer"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {detail.kind === "dayOff" ? "Day off" : "Licence expires"}
            </p>
            <h3 id={titleId} className="mt-1 truncate text-lg font-semibold tracking-tight text-fg">
              {name}
            </h3>
          </div>
          <button type="button" onClick={close} aria-label="Close" className={`${GHOST_BUTTON_CLASS} shrink-0 px-2`}>
            <CloseGlyph />
          </button>
        </header>
        <dl className="space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {detail.kind === "dayOff" ? (
            <DayOffDetails mark={detail.mark} onStatusChange={onStatusChange} />
          ) : (
            <ExpiryDetails mark={detail.mark} />
          )}
        </dl>
      </div>
    </dialog>
  );
}

function DayOffDetails({
  mark,
  onStatusChange,
}: {
  mark: DayOffMark;
  onStatusChange: (id: string, status: RequestStatus) => void;
}) {
  return (
    <>
      <DetailRow label="Status">
        <select
          value={mark.status}
          onChange={(event) => onStatusChange(mark.key, event.target.value as RequestStatus)}
          aria-label={`Status of ${mark.agentName}'s day off request`}
          className={`${TOOLBAR_INPUT_CLASS} py-1 text-xs font-medium capitalize ${STATUS_TEXT_CLASSES[mark.status]}`}
        >
          {REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </DetailRow>
      <DetailRow label="Dates">{rangeText(mark.startDate, mark.endDate)}</DetailRow>
      {mark.note ? <DetailRow label="Note">{mark.note}</DetailRow> : null}
    </>
  );
}

function ExpiryDetails({ mark }: { mark: ExpiryMark }) {
  return (
    <>
      <DetailRow label="State">
        <span className="font-mono text-xs">{mark.state}</span>
        {US_STATE_NAMES[mark.state] ? <span className="text-fg-muted"> · {US_STATE_NAMES[mark.state]}</span> : null}
      </DetailRow>
      <DetailRow label="Status">
        <StatusBadge status={mark.licenseStatus} />
      </DetailRow>
      <DetailRow label="Expires">{formatLicenceDate(mark.date)}</DetailRow>
      {mark.startDate ? <DetailRow label="Starts">{formatLicenceDate(mark.startDate)}</DetailRow> : null}
      {mark.licenseNumber ? <DetailRow label="Licence number">{mark.licenseNumber}</DetailRow> : null}
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-fg-subtle">{label}</dt>
      <dd className="mt-1 text-fg">{children}</dd>
    </div>
  );
}

function LegendItem({ className, children }: { className: string; children: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-surface py-0.5 pr-2 pl-1.5 ring-1 ring-inset ring-line">
      <span aria-hidden="true" className={`inline-block h-2 w-4 rounded-full ${className}`} />
      {children}
    </li>
  );
}

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2.5V5.5M13 2.5V5.5" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={direction === "left" ? "M12 5l-5 5 5 5" : "M8 5l5 5-5 5"} />
    </svg>
  );
}
