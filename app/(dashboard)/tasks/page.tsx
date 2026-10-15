import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule, canViewModule } from "@/lib/access";
import { localDateString } from "@/lib/calendar";
import { getTasks } from "@/lib/tasks";
import { TasksBoard } from "./tasks-board";

export const metadata: Metadata = {
  title: "Tasks",
};

/**
 * Tasks: three boxes, one per priority, that tasks are dragged between.
 * Tasks are added from the navbar's + menu. Today is worked out on the
 * server for the overdue mark.
 */
export default async function TasksPage() {
  if (!(await canViewModule("tasks"))) return <NoAccess title="Tasks" />;
  const [tasks, canUpdate, canDelete] = await Promise.all([
    getTasks(),
    canModule("tasks", "update"),
    canModule("tasks", "delete"),
  ]);

  return <TasksBoard tasks={tasks} today={localDateString()} canUpdate={canUpdate} canDelete={canDelete} />;
}
