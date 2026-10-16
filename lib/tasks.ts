import "server-only";

/*
 * Data boundary for tasks: reads the Django API (`/api/v1/tasks/`,
 * backend/apps/requests) as the signed-in user. Adding, moving between
 * boxes, marking done and deleting go through the server actions in
 * app/(dashboard)/tasks/actions.ts. Types and labels are client-safe in
 * lib/task-options.ts.
 */

import { apiGetAll } from "@/lib/api-server";
import { TASK_PRIORITIES, type TaskPriority, type TaskRecord } from "@/lib/task-options";

/** A task as the API serialises it (TaskSerializer). */
export type ApiTask = {
  id: string;
  title: string;
  priority: string;
  type: "licensing" | "contract" | "day_off" | "";
  status: string;
  note: string;
  agent: { id: string; name: string; is_active: boolean } | null;
  carrier: { id: string; name: string; is_active: boolean } | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  created_on: string;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function toTaskRecord(task: ApiTask): TaskRecord {
  return {
    id: task.id,
    title: task.title,
    priority: TASK_PRIORITIES.includes(task.priority as TaskPriority) ? (task.priority as TaskPriority) : "general",
    status: task.status === "done" ? "done" : "open",
    ...(task.type ? { type: task.type === "day_off" ? ("dayOff" as const) : task.type } : {}),
    ...(task.agent ? { agentId: task.agent.id, agentName: task.agent.name } : {}),
    ...(task.state ? { state: task.state } : {}),
    ...(task.carrier ? { carrierId: task.carrier.id, carrierName: task.carrier.name } : {}),
    ...(task.start_date ? { startDate: task.start_date } : {}),
    ...(task.end_date ? { endDate: task.end_date } : {}),
    ...(task.note ? { note: task.note } : {}),
    createdOn: task.created_on,
    ...(task.due_date ? { dueDate: task.due_date } : {}),
  };
}

/** Every task the user can see, oldest first. */
export async function getTasks(): Promise<TaskRecord[]> {
  return (await apiGetAll<ApiTask>("/tasks/")).map(toTaskRecord);
}
