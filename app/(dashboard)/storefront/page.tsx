import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getProductNotes, getProducts } from "@/lib/storefront";
import { StorefrontView } from "./storefront-view";

export const metadata: Metadata = {
  title: "Storefront",
};

export default async function StorefrontPage() {
  if (!(await canViewModule("storefront"))) return <NoAccess title="Storefront" />;
  const products = await getProducts();
  // A handful of products, so one notes read each is fine.
  const notes = (await Promise.all(products.map((product) => getProductNotes(product.id)))).flat();

  return <StorefrontView initialProducts={products} notes={notes} />;
}
