"use client";

import { useId } from "react";
import { GHOST_BUTTON_CLASS } from "@/components/classes";
import {
  addMonths,
  dateInRange,
  monthGrid,
  monthKey,
  monthLabel,
  WEEKDAY_NAMES,
  type YearMonth,
} from "@/lib/calendar";
import type { RequestStatus } from "@/lib/requests";

/*
 * The month grid: a plain <table> in the app's Tailwind, one <td> per day.
 * Two kinds of mark:
 *
 *   day off   — a request's range, drawn on every day it covers as a bar
 *               that is rounded only at its first and last day, coloured by
 *               the request's status (pending amber, approved green, denied
 *               struck through). The agent's name sits on the first day and
 *               again on each Sunday the range runs into, so a long range
 *               stays labelled on every row.
 *   expiry    — a state licence's end date, one chip on that day.
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
};

export type ExpiryMark = {
  key: string;
  agentName: string;
  state: string;
  date: string;
};

type HrCalendarProps = {
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  today: string;
  dayOffs: DayOffMark[];
  expiries: ExpiryMark[];
};

const DAY_OFF_CLASSES: Record<RequestStatus, string> = {
  pending: "bg-warn-soft text-warn-ink",
  approved: "bg-brand-soft text-brand-ink",
  denied: "bg-surface-hover text-fg-muted line-through",
};

const EXPIRY_CLASS = "bg-info-soft text-info-ink";

const NAV_BUTTON_CLASS = `${GHOST_BUTTON_CLASS} px-2`;

export function HrCalendar({ month, onMonthChange, today, dayOffs, expiries }: HrCalendarProps) {
  const captionId = useId();
  const weeks = monthGrid(month);
  const todayMonth = monthKey({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });

  return (
    <section aria-labelledby={captionId} className="rounded-lg border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={captionId} className="text-sm font-semibold text-fg">
          <time dateTime={monthKey(month)}>{monthLabel(month)}</time>
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, -1))}
            aria-label="Previous month"
            className={NAV_BUTTON_CLASS}
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })}
            disabled={monthKey(month) === todayMonth}
            className={`${GHOST_BUTTON_CLASS} disabled:opacity-50 disabled:hover:bg-transparent`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="Next month"
            className={NAV_BUTTON_CLASS}
          >
            <Chevron direction="right" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              {WEEKDAY_NAMES.map((name) => (
                <th
                  key={name}
                  scope="col"
                  className="border-b border-line px-2 py-2 text-left text-xs font-medium text-fg-muted"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, index) => (
              <tr key={index}>
                {week.map((cell, column) =>
                  cell === null ? (
                    <td key={`pad-${column}`} className="border border-line bg-surface-muted" />
                  ) : (
                    <td
                      key={cell.date}
                      className={`h-28 border border-line p-1 align-top ${
                        cell.weekday === 0 || cell.weekday === 6 ? "bg-surface-muted/40" : ""
                      }`}
                    >
                      <time
                        dateTime={cell.date}
                        className={`mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs ${
                          cell.date === today ? "bg-brand-strong font-semibold text-white" : "text-fg-muted"
                        }`}
                      >
                        {cell.day}
                      </time>
                      <ul className="space-y-1">
                        {dayOffs
                          .filter((mark) => dateInRange(cell.date, mark.startDate, mark.endDate))
                          .map((mark) => {
                            const isStart = mark.startDate === cell.date;
                            const isEnd = mark.endDate === cell.date;
                            const labelled = isStart || cell.weekday === 0;
                            return (
                              <li
                                key={mark.key}
                                title={`${mark.agentName}: day off, ${mark.status}`}
                                className={`truncate px-1.5 py-0.5 text-xs font-medium ${DAY_OFF_CLASSES[mark.status]} ${
                                  isStart ? "ml-0.5 rounded-l-md" : "-ml-1"
                                } ${isEnd ? "mr-0.5 rounded-r-md" : "-mr-1"}`}
                              >
                                {labelled ? mark.agentName : <span className="sr-only">{mark.agentName}</span>}
                                {labelled ? null : <span aria-hidden="true">&nbsp;</span>}
                              </li>
                            );
                          })}
                        {expiries
                          .filter((mark) => mark.date === cell.date)
                          .map((mark) => (
                            <li
                              key={mark.key}
                              title={`${mark.agentName}: ${mark.state} licence expires`}
                              className={`truncate rounded-md px-1.5 py-0.5 text-xs font-medium ${EXPIRY_CLASS}`}
                            >
                              <span className="font-mono">{mark.state}</span> expires · {mark.agentName}
                            </li>
                          ))}
                      </ul>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-xs text-fg-muted">
        <LegendItem className={DAY_OFF_CLASSES.pending}>Day off, pending</LegendItem>
        <LegendItem className={DAY_OFF_CLASSES.approved}>Day off, approved</LegendItem>
        <LegendItem className={DAY_OFF_CLASSES.denied}>Day off, denied</LegendItem>
        <LegendItem className={EXPIRY_CLASS}>Licence expires</LegendItem>
      </ul>
    </section>
  );
}

function LegendItem({ className, children }: { className: string; children: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`inline-block h-3 w-5 rounded-sm ${className}`} />
      {children}
    </li>
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
