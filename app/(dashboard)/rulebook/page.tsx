import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Rulebook",
};

export default function RulebookPage() {
  return (
    <>
      <PageHeader title="Rulebook" />
      <EmptyState title="No rules yet" description="Commission rules will be listed here." />
    </>
  );
}
