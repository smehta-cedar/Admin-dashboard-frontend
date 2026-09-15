import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Logins",
};

export default function LoginsPage() {
  return (
    <>
      <PageHeader title="Logins" />
      <EmptyState title="No logins yet" description="Saved logins will be listed here." />
    </>
  );
}
