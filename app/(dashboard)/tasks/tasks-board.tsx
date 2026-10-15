"use client";

import { useState, type DragEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { TaskDialog } from "@/components/task-dialog";
import { REQUEST_TYPE_LABELS } from "@/lib/request-options";
import { formatLicenceDate } from "@/lib/state-licenses";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus,
} from "@/lib/task-options";
import { US_STATE_NAMES } from "@/lib/us-states";
import { changeTask } from "./actions";

/*
 * The Tasks board: one box per priority for open tasks, and a Done box
 * below them. Dragging a card into another priority box saves its new
 * priority (and opens it again when it came from Done); dragging it into
 * Done marks it done, as does its checkbox. The card moves at once and goes
 * back if the API refuses. Clicking a card opens the task popup filled in,
 * to change or delete it. The rows come from the server (page.tsx); every
 * save revalidates /tasks, and a new `tasks` prop (a save here, or a task
 * added from the navbar) replaces the local copy.
 */

type TasksBoardProps = {
  tasks: TaskRecord[];
  /** "YYYY-MM-DD", for the overdue mark. */
  today: string;
  canUpdate: boolean;
  canDelete: boolean;
};

/** A priority box, or the Done box below them. */
type BoxKey = TaskPriority | "done";

/** Each box's colour on its top edge and count, and on its cards' left edge and fill: red, green, yellow, grey. */
const BOX_ACCENTS: Record<BoxKey, string> = {
  high: "border-t-danger-strong",
  general: "border-t-brand-strong",
  future: "border-t-stat-amber-ink",
  done: "border-t-line-strong",
};
const COUNT_CLASSES: Record<BoxKey, string> = {
  high: "bg-danger-soft text-danger-ink",
  general: "bg-brand-soft text-brand-ink",
  future: "bg-stat-amber-soft text-stat-amber-ink",
  done: "bg-surface text-fg-muted",
};
const CARD_CLASSES: Record<BoxKey, string> = {
  high: "border-l-danger-strong bg-danger-soft/40",
  general: "border-l-brand-strong bg-brand-soft/40",
  future: "border-l-stat-amber-ink bg-stat-amber-soft/50",
  done: "border-l-line-strong bg-surface",
};

/** By due date (none last), then the day added. */
function compareTasks(a: TaskRecord, b: TaskRecord) {
  const due = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  return due || a.createdOn.localeCompare(b.createdOn);
}

/** Type and agent, then state, carrier and days off: whichever were filled in, or "". */
function summaryOf(task: TaskRecord) {
  return [task.type ? REQUEST_TYPE_LABELS[task.type] : "", task.agentName ?? ""].filter(Boolean).join(" · ");
}

function detailOf(task: TaskRecord) {
  const days = [task.startDate, task.endDate].filter((day): day is string => Boolean(day)).map(formatLicenceDate);
  return [
    task.state ? `${US_STATE_NAMES[task.state] ?? task.state} (${task.state})` : "",
    task.carrierName ?? "",
    days.length === 2 && days[0] !== days[1] ? `${days[0]} – ${days[1]}` : (days[0] ?? ""),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function TasksBoard({ tasks: savedTasks, today, canUpdate, canDelete }: TasksBoardProps) {
  const [tasks, setTasks] = useState(savedTasks);
  const [seen, setSeen] = useState(savedTasks);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<BoxKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskRecord | null>(null);

  // A fresh server render (after any save) replaces the local copy.
  if (savedTasks !== seen) {
    setSeen(savedTasks);
    setTasks(savedTasks);
  }

  /** Shows the change at once; puts the task back if the API refuses it. */
  const change = async (task: TaskRecord, changes: { priority?: TaskPriority; status?: TaskStatus }) => {
    setError(null);
    setTasks((current) => current.map((row) => (row.id === task.id ? { ...row, ...changes } : row)));
    const result = await changeTask(task.id, changes);
    if (!result.ok) {
      setTasks((current) => current.map((row) => (row.id === task.id ? task : row)));
      setError(result.message);
    }
  };

  const drop = (box: BoxKey) => (event: DragEvent) => {
    event.preventDefault();
    setOver(null);
    const task = tasks.find((row) => row.id === event.dataTransfer.getData("text/plain"));
    if (!task) return;
    if (box === "done") {
      if (task.status !== "done") void change(task, { status: "done" });
    } else if (task.status === "done" || task.priority !== box) {
      void change(task, { priority: box, status: "open" });
    }
  };

  const openCount = tasks.filter((task) => task.status === "open").length;

  const renderCard = (task: TaskRecord) => {
    const done = task.status === "done";
    const overdue = !done && task.dueDate !== undefined && task.dueDate < today;
    return (
      <li
        key={task.id}
        draggable={canUpdate}
        onClick={canUpdate ? () => setEditing(task) : undefined}
        tabIndex={canUpdate ? 0 : undefined}
        onKeyDown={(event) => {
          if (canUpdate && event.key === "Enter" && event.target === event.currentTarget) setEditing(task);
        }}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", task.id);
          event.dataTransfer.effectAllowed = "move";
          setDragging(task.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
        className={`rounded-md border border-l-4 border-line p-3 shadow-sm ${CARD_CLASSES[done ? "done" : task.priority]} ${
          canUpdate ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <div className="flex items-start gap-2">
          {canUpdate ? (
            <input
              type="checkbox"
              checked={done}
              onChange={() => void change(task, { status: done ? "open" : "done" })}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Mark "${task.title}" ${done ? "open" : "done"}`}
              className="mt-0.5 size-4 shrink-0 accent-brand-strong"
            />
          ) : null}
          <p className={`min-w-0 flex-1 text-sm font-medium ${done ? "text-fg-subtle line-through" : "text-fg"}`}>
            {task.title}
          </p>
        </div>
        {summaryOf(task) ? <p className="mt-1 text-xs text-fg-muted">{summaryOf(task)}</p> : null}
        {detailOf(task) ? <p className="mt-0.5 text-xs text-fg-muted">{detailOf(task)}</p> : null}
        {task.note ? <p className="mt-1 text-xs text-fg-subtle">{task.note}</p> : null}
        <p className="mt-2 text-xs text-fg-subtle">
          Added {formatLicenceDate(task.createdOn)}
          {task.dueDate ? (
            <>
              {" · "}
              <span className={overdue ? "font-medium text-danger" : undefined}>
                Due {formatLicenceDate(task.dueDate)}
              </span>
            </>
          ) : null}
        </p>
      </li>
    );
  };

  /** One box: its heading and count, its cards, and the drop that moves a card into it. */
  const renderBox = (box: BoxKey, label: string, boxTasks: TaskRecord[], listClassName: string) => {
    const headingId = `tasks-${box}-heading`;
    return (
      <section
        key={box}
        aria-labelledby={headingId}
        onDragOver={
          canUpdate
            ? (event) => {
                event.preventDefault();
                setOver(box);
              }
            : undefined
        }
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
        }}
        onDrop={canUpdate ? drop(box) : undefined}
        className={`flex flex-col rounded-lg border border-t-4 border-line bg-surface-muted p-3 transition-colors ${
          box === "done" ? "min-h-32" : "min-h-96"
        } ${BOX_ACCENTS[box]} ${over === box && dragging ? "ring-2 ring-brand-strong/40" : ""}`}
      >
        <h2 id={headingId} className="mb-3 flex items-center justify-between text-sm font-semibold text-fg">
          {label}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COUNT_CLASSES[box]}`}>{boxTasks.length}</span>
        </h2>
        <ul className={`flex-1 gap-2 ${listClassName}`}>
          {[...boxTasks].sort(compareTasks).map(renderCard)}
          {boxTasks.length === 0 ? (
            <li className="col-span-full flex flex-1 items-center justify-center rounded-md border border-dashed border-line-strong p-6 text-xs text-fg-subtle">
              No tasks
            </li>
          ) : null}
        </ul>
      </section>
    );
  };

  const openTasks = tasks.filter((task) => task.status === "open");

  return (
    <>
      <PageHeader
        title="Tasks"
        description={openCount === 0 ? "No open tasks." : `${openCount} open ${openCount === 1 ? "task" : "tasks"}.`}
      />

      <div role="alert" className="mb-4">
        {error ? (
          <p className="rounded-md bg-warn-soft px-3 py-2 text-sm text-warn-ink">The change was refused: {error}</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {TASK_PRIORITIES.map((priority) =>
          renderBox(
            priority,
            TASK_PRIORITY_LABELS[priority],
            openTasks.filter((task) => task.priority === priority),
            "flex flex-col",
          ),
        )}
      </div>

      <div className="mt-4">
        {renderBox(
          "done",
          "Done",
          tasks.filter((task) => task.status === "done"),
          "grid sm:grid-cols-2 lg:grid-cols-3",
        )}
      </div>

      <TaskDialog
        open={editing !== null}
        task={editing}
        canDelete={canDelete}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
