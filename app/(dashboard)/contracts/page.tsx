import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Contracts",
};

export default function ContractsPage() {
  return (
    <>
      <PageHeader title="Contracts" />
      <EmptyState title="No contracts yet" description="Contracts will be listed here." />
    </>
  );
}
