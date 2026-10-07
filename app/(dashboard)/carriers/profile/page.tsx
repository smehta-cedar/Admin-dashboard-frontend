import { notFound, redirect } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getCarriers } from "@/lib/carriers";

/** The sidebar's "Carrier profile" link: opens the first active carrier. */
export default async function CarrierProfileIndexPage() {
  if (!(await canViewModule("carriers"))) return <NoAccess title="Carrier profile" />;
  const carriers = await getCarriers();
  const carrier = carriers.find((c) => c.status === "active") ?? carriers[0];
  if (!carrier) notFound();
  redirect(`/carriers/${carrier.id}`);
}
