import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getCatalog } from "@/lib/storefront";
import { ShopView } from "./shop-view";

/*
 * The shop, inside the dashboard under Storefront: the client-facing catalog
 * and order flow, behind the same sign-in as every other page. The products
 * come from the API's catalog (lib/storefront.ts, active products only);
 * the steps and the submit live in ./shop-view.tsx, and the order is filed
 * by ./actions.ts as the signed-in user. What the shop sells is managed on
 * the Storefront page one level up.
 */

export const metadata: Metadata = {
  title: "Shop",
};

export default async function ShopPage() {
  const products = await getCatalog();

  return (
    <>
      <PageHeader
        title="Shop"
        description={
          <>
            Order Cedar Grove merchandise for a client; the order lands on HR as a merch request.{" "}
            <Link href="/storefront" className="text-brand-ink hover:underline">
              Manage products<span aria-hidden="true"> →</span>
            </Link>
          </>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          title="Nothing for sale right now"
          description="Add a product on the Storefront page, or set one back to active, and it shows here."
        />
      ) : (
        <div className="mx-auto w-full max-w-4xl">
          <ShopView products={products} />
        </div>
      )}
    </>
  );
}
