import type { Metadata } from "next";
import { getCarrierNotes, getCarriers } from "@/lib/carriers";
import { CarriersView } from "./carriers-view";

export const metadata: Metadata = {
  title: "Carriers",
};

export default async function CarriersPage() {
  const [carriers, notes] = await Promise.all([getCarriers(), getCarrierNotes()]);

  return <CarriersView initialCarriers={carriers} initialNotes={notes} />;
}
