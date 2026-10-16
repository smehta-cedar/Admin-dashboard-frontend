/*
 * The client-safe half of tasks: the record type, the three priorities (one
 * box each on the Tasks page), and the checks the Add-a-task popup runs
 * before it calls the server action. The API load lives in lib/tasks.ts
 * (server-only).
 *
 * A task has the request popup's fields (type, agent, state, carrier, days
 * off, note) plus a priority, the day it was added and a due date. Only the
 * title is required.
 */

import type { AgentRequestType } from "@/lib/requests";

export type TaskPriority = "high" | "general" | "future";
export type TaskStatus = "open" | "done";

/** The boxes on the Tasks page, in order. */
export const TASK_PRIORITIES: readonly TaskPriority[] = ["high", "general", "future"];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High priority",
  general: "To-do",
  future: "Future plans",
};

export type TaskRecord = {
  /** The API's UUID. */
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  type?: AgentRequestType;
  agentId?: string;
  agentName?: string;
  /** State code. */
  state?: string;
  carrierId?: string;
  carrierName?: string;
  /** Day off: "YYYY-MM-DD", inclusive. */
  startDate?: string;
  endDate?: string;
  note?: string;
  /** "YYYY-MM-DD"; today unless picked when added. */
  createdOn: string;
  /** "YYYY-MM-DD", when set. */
  dueDate?: string;
};

/** What the popup hands over; blank strings for what was left out. */
export type TaskValues = {
  title: string;
  priority: TaskPriority;
  type: AgentRequestType | "";
  agentId: string;
  state: string;
  carrierId: string;
  startDate: string;
  endDate: string;
  createdOn: string;
  dueDate: string;
  note: string;
};

/** A save error, shown under the field it names, or under the form for `form`. */
export type TaskError = {
  field: "title" | "agentId" | "state" | "carrierId" | "startDate" | "endDate" | "createdOn" | "dueDate" | "form";
  message: string;
};

/** A title, and dates in order when both ends are given. The API runs the same checks. */
export function checkTaskValues(values: TaskValues): TaskError | null {
  if (!values.title) return { field: "title", message: "Enter a title." };
  // ISO dates compare as text.
  if (values.type === "dayOff" && values.startDate && values.endDate && values.endDate < values.startDate) {
    return { field: "endDate", message: "The last day can't be before the first." };
  }
  if (values.createdOn && values.dueDate && values.dueDate < values.createdOn) {
    return { field: "dueDate", message: "The due date can't be before the created date." };
  }
  return null;
}
