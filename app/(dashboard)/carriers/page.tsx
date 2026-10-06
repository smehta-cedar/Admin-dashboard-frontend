import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getCarriers } from "@/lib/carriers";
import { CarriersView } from "./carriers-view";

export const metadata: Metadata = {
  title: "Carriers",
};

export default async function CarriersPage() {
  if (!(await canViewModule("carriers"))) return <NoAccess title="Carriers" />;
  const carriers = await getCarriers();

  return <CarriersView carriers={carriers} />;
}
