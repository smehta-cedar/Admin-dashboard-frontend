"use server";

/*
 * Add or edit a product, run on the Next server so the access token stays
 * in its HttpOnly cookie. POST /storefront/products/create/ or PATCH
 * /storefront/products/{id}/; the API needs at least one colour and one
 * size, a unique name, and records the change note.
 *
 *   400 invalid             a field's message under that field
 *   401 token_not_valid     the session is gone               -> back to sign in
 *   403 permission_denied   the role can't change products    -> under the form
 *   network_error           the API is down                   -> under the form
 *
 * On success the shop and the Storefront page are revalidated.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import {
  toProductRecord,
  type ApiProduct,
  type ProductError,
  type ProductRecord,
  type ProductValues,
} from "@/lib/storefront";

export type SaveProductResult =
  | { ok: true; product: ProductRecord }
  | { ok: false; errors: ProductError[] };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, ProductError["field"]> = {
  name: "name",
  description: "description",
  category: "category",
  product_type: "productType",
  image_url: "imageUrl",
  price: "price",
  colors: "colors",
  sizes: "sizes",
  max_quantity: "maxQuantity",
  is_active: "status",
};

/** Adds a product, or edits the one with `editingId`. */
export async function saveProduct(values: ProductValues, editingId?: string): Promise<SaveProductResult> {
  const body = {
    name: values.name,
    description: values.description,
    category: values.category,
    product_type: values.productType,
    image_url: values.imageUrl,
    price: values.price.toFixed(2),
    colors: values.colors,
    sizes: values.sizes,
    max_quantity: values.maxQuantity,
    is_active: values.status === "active",
  };
  const result = editingId
    ? await apiFetch<ApiProduct>(`/storefront/products/${encodeURIComponent(editingId)}/`, { method: "PATCH", body })
    : await apiFetch<ApiProduct>("/storefront/products/create/", { method: "POST", body });

  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    if (result.code === "invalid" && result.errors) {
      const errors: ProductError[] = [];
      for (const [apiField, messages] of Object.entries(result.errors)) {
        // A colour's own errors come nested; the first message is enough.
        const message = Array.isArray(messages) ? String(messages[0] ?? result.message) : String(messages);
        errors.push({ field: ERROR_FIELDS[apiField] ?? "form", message });
      }
      return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message: result.message }] };
    }
    return { ok: false, errors: [{ field: "form", message: result.message }] };
  }

  revalidatePath("/storefront/shop");
  revalidatePath("/", "layout");
  return { ok: true, product: toProductRecord(result.data) };
}
