"use server";

/*
 * Files a merch order from the dashboard's shop. The action trusts nothing
 * from the client and re-runs the same selection validation the view ran,
 * against what the shop sells right now. The order goes to the API as a
 * pending merch request (POST /requests/merch/) as the signed-in user; the
 * API fills buyer contact from their profile. Admins get a notification;
 * the shop view appends the row into the requests store so an open HR page
 * sees it without a full refresh.
 *
 * A 401 (session gone) sends the user to sign in; any other refusal shows
 * on the choose step as a plain message.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import {
  toRequestRecord,
  type ApiRequest,
  type MerchRequestRecord,
} from "@/lib/requests";
import { validateSelection, type SelectionError, type SelectionValues } from "@/lib/shop";
import { getCatalog } from "@/lib/storefront";

export type PlaceOrderResult =
  | { ok: true; request: MerchRequestRecord }
  | { ok: false; error: SelectionError };

export async function placeOrder(input: SelectionValues): Promise<PlaceOrderResult> {
  // Coerce before checking: the wire can carry anything.
  const values: SelectionValues = {
    productId: String(input.productId ?? ""),
    size: String(input.size ?? ""),
    color: String(input.color ?? ""),
    quantity: Number(input.quantity),
  };
  // Checked against what the shop sells right now, not what the page was rendered with.
  const products = await getCatalog();
  const error = validateSelection(values, products.find((product) => product.id === values.productId));
  if (error) return { ok: false, error };

  const result = await apiFetch<ApiRequest>("/requests/merch/", {
    method: "POST",
    body: {
      product_id: values.productId,
      size: values.size,
      color: values.color,
      quantity: values.quantity,
    },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    console.error(`Shop order failed: ${result.message} (${result.code}).`);
    return {
      ok: false,
      error: {
        field: "productId",
        message:
          result.status === 403
            ? "Your account can't place orders."
            : "Orders can't be placed right now. Please try again later.",
      },
    };
  }

  const request = toRequestRecord(result.data);
  if (!request || request.type !== "merch") {
    return {
      ok: false,
      error: { field: "productId", message: "Orders can't be placed right now. Please try again later." },
    };
  }

  revalidatePath("/", "layout");
  return { ok: true, request };
}
