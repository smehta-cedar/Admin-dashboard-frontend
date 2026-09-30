import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCarrier } from "@/lib/carriers";
import { CarrierFormPage } from "../../carrier-form";

type EditCarrierPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(props: EditCarrierPageProps): Promise<Metadata> {
  const { id } = await props.params;
  const carrier = await getCarrier(id);
  return { title: carrier ? `Edit ${carrier.name}` : "Carrier not found" };
}

/**
 * Edit carrier as a page, in the same layout as Add carrier. `from=list`
 * returns to the carriers list; anything else returns to this carrier's
 * profile.
 */
export default async function EditCarrierPage(props: EditCarrierPageProps) {
  const { id } = await props.params;
  const { from } = await props.searchParams;
  const carrier = await getCarrier(id);
  if (!carrier) notFound();

  return <CarrierFormPage carrier={carrier} returnTo={from === "list" ? "/carriers" : `/carriers/${id}`} />;
}
