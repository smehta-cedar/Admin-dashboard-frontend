"use server";

/*
 * Add, edit, move and delete tasks, run on the Next server so the access token
 * stays in its HttpOnly cookie. POST /tasks/create/, PATCH and DELETE
 * /tasks/{id}/. A 400's field errors go under their fields, anything else
 * under the form; a 401 sends the user to sign in. Each one revalidates
 * /tasks so the board re-renders with the saved rows.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import type { TaskError, TaskPriority, TaskRecord, TaskStatus, TaskValues } from "@/lib/task-options";
import { toTaskRecord, type ApiTask } from "@/lib/tasks";
import { getSessionUser } from "@/lib/session";

export type SaveTaskResult = { ok: true; task: TaskRecord } | { ok: false; error: TaskError };
export type ChangeTaskResult = { ok: true; task: TaskRecord } | { ok: false; message: string };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, TaskError["field"]> = {
  title: "title",
  agent_id: "agentId",
  state: "state",
  carrier_id: "carrierId",
  start_date: "startDate",
  end_date: "endDate",
  created_on: "createdOn",
  due_date: "dueDate",
};

const API_TYPES = { licensing: "licensing", contract: "contract", dayOff: "day_off" } as const;

/**
 * Adds a task, or with `id` saves the edit popup over that task. Blank
 * fields go as blank or null; only the title is required.
 */
export async function saveTask(values: TaskValues, id?: string): Promise<SaveTaskResult> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const body = {
    title: values.title,
    priority: values.priority,
    type: values.type ? API_TYPES[values.type] : "",
    note: values.note,
    agent_id: user.agentId ?? (values.agentId || null),
    state: values.state,
    carrier_id: values.carrierId || null,
    start_date: values.startDate || null,
    end_date: values.endDate || null,
    created_on: values.createdOn || null,
    due_date: values.dueDate || null,
  };
  const result = id
    ? await apiFetch<ApiTask>(`/tasks/${encodeURIComponent(id)}/`, { method: "PATCH", body })
    : await apiFetch<ApiTask>("/tasks/create/", { method: "POST", body });

  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    if (result.code === "invalid" && result.errors) {
      const [apiField, messages] = Object.entries(result.errors)[0] ?? ["", [result.message]];
      return { ok: false, error: { field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] } };
    }
    return { ok: false, error: { field: "form", message: result.message } };
  }
  revalidatePath("/tasks");
  return { ok: true, task: toTaskRecord(result.data) };
}

/** Moves a task to another box, or marks it open or done. */
export async function changeTask(
  id: string,
  changes: { priority?: TaskPriority; status?: TaskStatus },
): Promise<ChangeTaskResult> {
  const result = await apiFetch<ApiTask>(`/tasks/${encodeURIComponent(id)}/`, { method: "PATCH", body: changes });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    return { ok: false, message: result.message };
  }
  revalidatePath("/tasks");
  return { ok: true, task: toTaskRecord(result.data) };
}

export async function deleteTask(id: string): Promise<string | null> {
  const result = await apiFetch<null>(`/tasks/${encodeURIComponent(id)}/`, { method: "DELETE" });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    return result.message;
  }
  revalidatePath("/tasks");
  return null;
}
