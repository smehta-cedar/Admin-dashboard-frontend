import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule } from "@/lib/access";
import { CarrierFormPage } from "../carrier-form";

export const metadata: Metadata = {
  title: "Add carrier",
};

/**
 * Add carrier as a page rather than a dialog. The static `new` segment wins
 * over the dynamic `[id]` beside it. Cancel and a successful save return to
 * the list.
 */
export default async function NewCarrierPage() {
  if (!(await canModule("carriers.list", "create"))) return <NoAccess title="Add carrier" />;
  return <CarrierFormPage returnTo="/carriers" />;
}
