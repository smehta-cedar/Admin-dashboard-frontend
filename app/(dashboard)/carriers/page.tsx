import type { Metadata } from "next";
import { getCarriers } from "@/lib/carriers";
import { CarriersView } from "./carriers-view";

export const metadata: Metadata = {
  title: "Carriers",
};

export default async function CarriersPage() {
  const carriers = await getCarriers();

  return <CarriersView initialCarriers={carriers} />;
}
