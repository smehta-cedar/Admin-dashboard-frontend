import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Carriers",
};

export default function CarriersPage() {
  return (
    <>
      <PageHeader title="Carriers" />
      <p className="text-sm text-gray-600">This page is coming soon.</p>
    </>
  );
}
