import "server-only";

/*
 * Data boundary for the storefront: what the shop sells, read from
 * the Django API (`/api/v1/storefront/`, backend/apps/storefront).
 *
 * Two reads: `getCatalog()` (`storefront/catalog/`, active products only)
 * is what the shop page under Storefront renders from; `getProducts()`
 * is the managed list (`storefront/products/`, every product) the dashboard's
 * Storefront page edits through the server actions in
 * app/(dashboard)/storefront/actions.ts. The API records a change note on
 * every add and every edit that changed something.
 *
 * A product's colours are {id, label, hex}: the id is what an order picks
 * and the hex fills the shop's preview. Orders (lib/requests.ts, the merch
 * type) name the product and store the colour's label.
 */

import { apiRequest } from "@/lib/api";
import { apiFetch, apiGet, apiGetAll, ApiError } from "@/lib/api-server";
import type { FieldChange } from "@/lib/change-notes";
import type { ProductColor, ProductRecord } from "@/lib/shop";

export type { ProductColor, ProductRecord } from "@/lib/shop";

/** Product fields a note can record. The ID never changes. */
export type ProductField = Exclude<keyof ProductRecord, "id" | "priceLabel">;

/** What the add / edit form submits. */
export type ProductValues = Omit<ProductRecord, "id" | "priceLabel">;

/** A save error, shown under the field it names, or under the form for `form`. */
export type ProductError = { field: ProductField | "form"; message: string };

export type ProductChange = FieldChange<ProductField>;

/** Change-log entry the API writes whenever a product is added or edited. */
export type ProductNote = {
  id: string;
  productId: string;
  kind: "added" | "edited";
  createdAt: string;
  createdBy: string | null;
  changes: ProductChange[];
};

/** A product as the API serialises it (ProductSerializer). */
export type ApiProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  product_type: string;
  image_url: string;
  /** A decimal, e.g. 28 or 28.5. */
  price: number | string;
  colors: ProductColor[];
  sizes: string[];
  max_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ApiProductNote = {
  id: string;
  product_id: string;
  kind: "added" | "edited";
  changes: { field: string; from: string; to: string }[];
  created_by: string | null;
  created_at: string;
};

const NOTE_FIELDS: Record<string, ProductField> = {
  name: "name",
  description: "description",
  category: "category",
  product_type: "productType",
  image_url: "imageUrl",
  price: "price",
  colors: "colors",
  sizes: "sizes",
  max_quantity: "maxQuantity",
  status: "status",
};

/** "$28" for whole dollars, "$28.50" otherwise. */
export function priceLabel(price: number): string {
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

/** An API product as the app holds it. */
export function toProductRecord(product: ApiProduct): ProductRecord {
  const price = Number(product.price);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    productType: product.product_type,
    imageUrl: product.image_url,
    price,
    priceLabel: priceLabel(price),
    colors: product.colors,
    sizes: product.sizes,
    maxQuantity: product.max_quantity,
    status: product.is_active ? "active" : "inactive",
  };
}

function toProductNote(note: ApiProductNote): ProductNote {
  return {
    id: note.id,
    productId: note.product_id,
    kind: note.kind,
    createdAt: note.created_at,
    createdBy: note.created_by,
    changes: note.changes.flatMap((change) => {
      const field = NOTE_FIELDS[change.field];
      return field ? [{ field, from: change.from, to: change.to }] : [];
    }),
  };
}

/** The catalog: every active product. Throws when the API can't be reached. */
export async function getCatalog(): Promise<ProductRecord[]> {
  const result = await apiRequest<ApiProduct[]>("/storefront/catalog/");
  if (!result.ok) throw new ApiError("/storefront/catalog/", result);
  return result.data.map(toProductRecord);
}

/** Every product, active or not, for the Storefront page. */
export async function getProducts(): Promise<ProductRecord[]> {
  const products = await apiGetAll<ApiProduct>("/storefront/products/");
  return products.map(toProductRecord);
}

/** One product by ID, or null when there is none. */
export async function getProduct(id: string): Promise<ProductRecord | null> {
  const result = await apiFetch<ApiProduct>(`/storefront/products/${encodeURIComponent(id)}/`);
  if (!result.ok) {
    if (result.status === 404) return null;
    throw new ApiError(`/storefront/products/${id}/`, result);
  }
  return toProductRecord(result.data);
}

/** One product's change notes, newest first. */
export async function getProductNotes(productId: string): Promise<ProductNote[]> {
  const notes = await apiGet<ApiProductNote[]>(`/storefront/products/${encodeURIComponent(productId)}/notes/`);
  return notes.map(toProductNote);
}
