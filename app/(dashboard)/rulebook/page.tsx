import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/page-header";
import { canViewModule } from "@/lib/access";

export const metadata: Metadata = {
  title: "Rulebook",
};

export default async function RulebookPage() {
  if (!(await canViewModule("dashboard"))) return <NoAccess title="Rulebook" />;
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
