import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Contracts by carrier",
};

export default function ContractsByCarrierPage() {
  return (
    <>
      <PageHeader title="Contracts by carrier" />
      <EmptyState title="No carrier contracts yet" description="Carrier contracts will be listed here." />
    </>
  );
}
