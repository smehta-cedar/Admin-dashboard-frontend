"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { PageHeader } from "@/components/page-header";
import { AgentForm } from "../agent-dialog";
import { useAgentsStore } from "../agents-store";

/*
 * The Add agent page: the same AgentForm the row and profile Edit dialogs
 * render, in its page layout — the sections as cards across two columns,
 * with the buttons in a bar stuck to the bottom — instead of a <dialog>.
 * The navbar already names the page, so there is no header text; the form
 * starts at the top. Saving goes through the section store to the API, then
 * Cancel and a successful save both return to the list, where the new agent
 * already is.
 */
export function NewAgentView() {
  const router = useRouter();
  const { save } = useAgentsStore();
  const id = useId();

  return (
    <>
      <PageHeader title="Add agent" />
      <AgentForm
        id={id}
        layout="page"
        onSave={(values) => save(values)}
        close={() => router.push("/agents")}
      />
    </>
  );
}
