import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Contracts",
};

export default function ContractsPage() {
  return (
    <>
      <PageHeader title="Contracts" description="Agreements with agents and carriers." />
      <EmptyState
        title="No contracts yet"
        description="Agent and carrier contracts will be listed here."
      />
    </>
  );
}
