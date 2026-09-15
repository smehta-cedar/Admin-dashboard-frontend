import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Logins",
};

export default function LoginsPage() {
  return (
    <>
      <PageHeader title="Logins" description="Carrier portal access." />
      <EmptyState
        title="No logins yet"
        description="Carrier commission-portal logins will be listed here. Do not put passwords on this page."
      />
    </>
  );
}
