import { notFound, redirect } from "next/navigation";
import { getCarriers } from "@/lib/carriers";

/** The sidebar's "Carrier profile" link: opens the first active carrier. */
export default async function CarrierProfileIndexPage() {
  const carriers = await getCarriers();
  const carrier = carriers.find((c) => c.status === "active") ?? carriers[0];
  if (!carrier) notFound();
  redirect(`/carriers/${carrier.id}`);
}
