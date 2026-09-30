import type { Metadata } from "next";
import { CarrierFormPage } from "../carrier-form";

export const metadata: Metadata = {
  title: "Add carrier",
};

/**
 * Add carrier as a page rather than a dialog. The static `new` segment wins
 * over the dynamic `[id]` beside it. Cancel and a successful save return to
 * the list.
 */
export default function NewCarrierPage() {
  return <CarrierFormPage returnTo="/carriers" />;
}
