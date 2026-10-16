"use client";

import { useId, useState, type FormEvent } from "react";
import { deleteTask, saveTask } from "@/app/(dashboard)/tasks/actions";
import { INPUT_CLASS, GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { useConfirm } from "@/components/confirm-dialog";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { PartyOptions } from "@/components/request-dialog";
import { useRequestsStore } from "@/components/requests-store";
import { localDateString } from "@/lib/calendar";
import { REQUEST_TYPES, REQUEST_TYPE_LABELS } from "@/lib/request-options";
import type { AgentRequestType } from "@/lib/requests";
import {
  checkTaskValues,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskError,
  type TaskPriority,
  type TaskRecord,
  type TaskValues,
} from "@/lib/task-options";
import { US_STATES } from "@/lib/us-states";

/*
 * The Add-a-task popup the navbar's + menu opens: the request popup's
 * selects plus a title, a priority (the box it lands in on the Tasks page),
 * the day it was added (today unless changed) and a due date. Only the title
 * is required. Saving goes to saveTask (app/(dashboard)/tasks/actions.ts),
 * which revalidates the Tasks page. Clicking a card on the Tasks page opens
 * it with `task`: the fields start from that task, Save changes it, and
 * Delete (with `canDelete`) removes it after a confirmation.
 *
 * Mounted per open inside a ModalDialog, so its fields and errors start
 * clear each time.
 */

type TaskDialogProps = {
  open: boolean;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
  /** The task being edited; left out to add a new one. */
  task?: TaskRecord | null;
  /** Shows Delete while editing. */
  canDelete?: boolean;
};

export function TaskDialog({ open, onClose, task, canDelete = false }: TaskDialogProps) {
  const { dialogRef, close } = useModalDialog(open);
  const id = useId();

  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {open ? <TaskForm id={id} close={close} task={task ?? undefined} canDelete={canDelete} /> : null}
    </ModalDialog>
  );
}

function readValues(form: HTMLFormElement): TaskValues {
  const data = new FormData(form);
  const text = (field: keyof TaskValues) => String(data.get(field) ?? "").trim();
  const type = text("type");
  const priority = text("priority");
  return {
    title: text("title"),
    priority: TASK_PRIORITIES.includes(priority as TaskPriority) ? (priority as TaskPriority) : "general",
    type: REQUEST_TYPES.includes(type as AgentRequestType) ? (type as AgentRequestType) : "",
    agentId: text("agentId"),
    state: text("state"),
    carrierId: text("carrierId"),
    startDate: text("startDate"),
    endDate: text("endDate"),
    createdOn: text("createdOn"),
    dueDate: text("dueDate"),
    note: text("note"),
  };
}

function TaskForm({
  id,
  close,
  task,
  canDelete,
}: {
  id: string;
  close: () => void;
  task?: TaskRecord;
  canDelete: boolean;
}) {
  const { agents, carriers } = useRequestsStore();
  const { confirm, confirmDialog } = useConfirm();
  const [type, setType] = useState<AgentRequestType | "">(task?.type ?? "");
  const [error, setError] = useState<TaskError | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const values = readValues(event.currentTarget);
    const checkError = checkTaskValues(values);
    if (checkError) {
      setError(checkError);
      return;
    }
    setSaving(true);
    try {
      const result = await saveTask(values, task?.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };
  const formError = error?.field === "form" ? error.message : null;

  const remove = async () => {
    if (!task || saving) return;
    if (!(await confirm({ title: "Delete task", message: `Delete "${task.title}"?` }))) return;
    setSaving(true);
    try {
      const message = await deleteTask(task.id);
      if (message) {
        setError({ field: "form", message });
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  /** Error props for one field: message under it while the error names it. */
  const errorFor = (field: TaskError["field"]) => {
    const message = error?.field === field ? error.message : null;
    return {
      field: { hint: message ?? undefined, hintId: `${id}-${field}-error`, error: true },
      input: {
        "aria-invalid": message ? (true as const) : undefined,
        "aria-describedby": message ? `${id}-${field}-error` : undefined,
        onChange: () => setError(null),
      },
    };
  };
  const titleError = errorFor("title");
  const agentError = errorFor("agentId");
  const stateError = errorFor("state");
  const carrierError = errorFor("carrierId");
  const startError = errorFor("startDate");
  const endError = errorFor("endDate");
  const createdError = errorFor("createdOn");
  const dueError = errorFor("dueDate");

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {task ? "Edit task" : "Add a task"}
      </h2>

      {/* Six columns: halves span 3, the agent / state / carrier row spans 2 each. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-6">
        <Field label="Title" required htmlFor={`${id}-title-input`} className="sm:col-span-6" {...titleError.field}>
          <input
            id={`${id}-title-input`}
            name="title"
            defaultValue={task?.title}
            required
            maxLength={255}
            autoComplete="off"
            className={INPUT_CLASS}
            {...titleError.input}
          />
        </Field>

        <Field label="Priority" htmlFor={`${id}-priority`} className="sm:col-span-3">
          <select id={`${id}-priority`} name="priority" defaultValue={task?.priority ?? "general"} className={INPUT_CLASS}>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type" htmlFor={`${id}-type`} className="sm:col-span-3">
          <select
            id={`${id}-type`}
            name="type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as AgentRequestType | "");
              setError(null);
            }}
            className={INPUT_CLASS}
          >
            <option value="">Choose a type</option>
            {REQUEST_TYPES.map((option) => (
              <option key={option} value={option}>
                {REQUEST_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Agent" htmlFor={`${id}-agent`} className="sm:col-span-2" {...agentError.field}>
          <select id={`${id}-agent`} name="agentId" defaultValue={task?.agentId ?? ""} className={INPUT_CLASS} {...agentError.input}>
            <PartyOptions parties={agents} placeholder="Choose an agent" />
          </select>
        </Field>
        <Field label="State" htmlFor={`${id}-state`} className="sm:col-span-2" {...stateError.field}>
          <select id={`${id}-state`} name="state" defaultValue={task?.state ?? ""} className={INPUT_CLASS} {...stateError.input}>
            <option value="">Choose a state</option>
            {US_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Carrier" htmlFor={`${id}-carrier`} className="sm:col-span-2" {...carrierError.field}>
          <select id={`${id}-carrier`} name="carrierId" defaultValue={task?.carrierId ?? ""} className={INPUT_CLASS} {...carrierError.input}>
            <PartyOptions parties={carriers} placeholder="Choose a carrier" />
          </select>
        </Field>

        {type === "dayOff" ? (
          <>
            <Field label="First day" htmlFor={`${id}-start`} className="sm:col-span-3" {...startError.field}>
              <input id={`${id}-start`} name="startDate" type="date" defaultValue={task?.startDate} className={INPUT_CLASS} {...startError.input} />
            </Field>
            <Field label="Last day" htmlFor={`${id}-end`} className="sm:col-span-3" {...endError.field}>
              <input id={`${id}-end`} name="endDate" type="date" defaultValue={task?.endDate} className={INPUT_CLASS} {...endError.input} />
            </Field>
          </>
        ) : null}

        <Field label="Created" htmlFor={`${id}-created`} className="sm:col-span-3" {...createdError.field}>
          <input
            id={`${id}-created`}
            name="createdOn"
            type="date"
            defaultValue={task?.createdOn ?? localDateString()}
            className={INPUT_CLASS}
            {...createdError.input}
          />
        </Field>
        <Field label="Due" htmlFor={`${id}-due`} className="sm:col-span-3" {...dueError.field}>
          <input id={`${id}-due`} name="dueDate" type="date" defaultValue={task?.dueDate} className={INPUT_CLASS} {...dueError.input} />
        </Field>

        <Field label="Note" htmlFor={`${id}-note`} className="sm:col-span-6">
          <textarea id={`${id}-note`} name="note" defaultValue={task?.note} rows={3} autoComplete="off" className={`${INPUT_CLASS} resize-y`} />
        </Field>
      </div>

      {/* Errors about the attempt itself (no permission, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {task && canDelete ? (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={saving}
            className="mr-auto rounded-md px-3 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
          >
            Delete
          </button>
        ) : null}
        <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
          {saving ? "Saving…" : task ? "Save" : "Add task"}
        </button>
      </div>
      {confirmDialog}
    </form>
  );
}
