import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Agents",
};

export default function AgentsPage() {
  return (
    <>
      <PageHeader title="Agents" description="People who earn commission." />
      <EmptyState
        title="No agents yet"
        description="Agents will appear here once commissions are assigned to them."
      />
    </>
  );
}
