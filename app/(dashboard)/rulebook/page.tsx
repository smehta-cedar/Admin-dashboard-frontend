import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Rulebook",
};

export default function RulebookPage() {
  return (
    <>
      <PageHeader title="Rulebook" description="How payouts are calculated." />
      <EmptyState
        title="No rules yet"
        description="Rules for how each carrier’s commissions are calculated will be listed here."
      />
    </>
  );
}
