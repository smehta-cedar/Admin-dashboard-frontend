"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { PageHeader } from "@/components/page-header";
import { AgentForm } from "../agent-dialog";
import { useAgentsStore } from "../agents-store";

/*
 * The Add agent page: the same AgentForm the row and profile Edit dialogs
 * render, laid out in a card instead of a <dialog>. Saving goes through the
 * section store, then Cancel and a successful save both return to the list,
 * where the new agent already is. Nothing is saved anywhere; a refresh drops
 * it, and the agent has no profile page until it exists in the JSON.
 */
export function NewAgentView() {
  const router = useRouter();
  const { save } = useAgentsStore();
  const id = useId();

  return (
    <>
      <PageHeader
        title="Add agent"
        description="Not saved anywhere yet. The agent stays in the list until you refresh, and has no profile until then."
      />

      {/* The form owns its inset (p-6), the same as inside the dialog. */}
      <div className="mx-auto max-w-3xl rounded-lg border border-line bg-surface shadow-sm">
        <AgentForm id={id} onSave={(values) => save(values)} close={() => router.push("/agents")} />
      </div>
    </>
  );
}
